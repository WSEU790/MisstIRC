import { EventEmitter } from 'node:events'
import type {
  AppSettings,
  AppStateSnapshot,
  BufferInfo,
  ConnectRequest,
  ConnectionSnapshot,
  IrcMessageView,
  LogSearchHit,
  NetworkConfig,
  UnfinishedFeature,
  WhoisInfo
} from '@shared/types'
import type { ChatLogger } from '../services/logging'
import { IrcConnection } from './connection'
import type { ParsedIrcMessage } from './parser'
import { formatIrcLine } from './parser'
import { isOpLike, parseChannelEntry } from './prefixes'

const UNFINISHED: UnfinishedFeature[] = [
  {
    id: 'mirc-scripting',
    label: 'mIRC / NNScript scripting',
    detail: 'Sandbox scaffold only — full script runtime not implemented.'
  },
  {
    id: 'dcc',
    label: 'DCC transfers',
    detail: 'Isolated subsystem planned; SEND/GET/CHAT not available yet.'
  },
  {
    id: 'installer',
    label: 'Windows installer',
    detail: 'Deferred until the app builds and launches reliably.'
  }
]

export class ConnectionManager extends EventEmitter {
  private connections = new Map<string, IrcConnection>()
  private messageSeq = 0
  private unreads = new Map<string, number>()
  private messageIndex: IrcMessageView[] = []
  private logger: ChatLogger | null = null
  activeBufferKey: string | null = null
  settings: AppSettings = {
    theme: 'misstirc-dark',
    showStatusBar: true,
    fontSize: 14,
    loggingEnabled: true
  }

  setLogger(logger: ChatLogger | null): void {
    this.logger = logger
  }

  getSnapshot(): AppStateSnapshot {
    return {
      connections: [...this.connections.values()].map((c) => this.toSnapshot(c)),
      activeBufferKey: this.activeBufferKey,
      settings: this.settings,
      unfinished: UNFINISHED
    }
  }

  listConnections(): ConnectionSnapshot[] {
    return [...this.connections.values()].map((c) => this.toSnapshot(c))
  }

  async connect(request: ConnectRequest): Promise<string> {
    const existing = this.connections.get(request.network.id)
    if (existing) {
      existing.disconnect()
      this.connections.delete(existing.id)
    }

    const conn = new IrcConnection({
      network: request.network,
      password: request.password,
      saslPassword: request.saslPassword
    })
    this.wire(conn)
    this.connections.set(conn.id, conn)
    this.activeBufferKey = bufferKey(conn.id, '*')
    this.emitState()
    await conn.connect()
    return conn.id
  }

  attach(conn: IrcConnection): void {
    this.wire(conn)
    this.connections.set(conn.id, conn)
    this.emitState()
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId)
    if (!conn) return
    conn.disconnect()
    this.connections.delete(connectionId)
    for (const key of [...this.unreads.keys()]) {
      if (key.startsWith(`${connectionId}:`)) this.unreads.delete(key)
    }
    if (this.activeBufferKey?.startsWith(`${connectionId}:`)) {
      this.activeBufferKey = null
    }
    this.emitState()
  }

  /** Soft reconnect: quit then connect again with same network config (password via caller). */
  async reconnect(connectionId: string, password?: string, saslPassword?: string): Promise<string> {
    const conn = this.require(connectionId)
    const network = conn.network
    this.disconnect(connectionId)
    return this.connect({ network, password, saslPassword })
  }

  sendRaw(connectionId: string, line: string): void {
    const conn = this.require(connectionId)
    conn.sendRaw(line)
  }

  sendInput(connectionId: string, buffer: string, text: string): void {
    const conn = this.require(connectionId)
    const trimmed = text.trimEnd()
    if (!trimmed) return

    if (trimmed.startsWith('/')) {
      this.handleSlash(conn, buffer, trimmed)
      return
    }

    const target = buffer === '*' ? null : buffer
    if (!target) {
      conn.sendRaw(trimmed)
      return
    }
    if (!target.startsWith('#') && !target.startsWith('&')) {
      conn.queries.add(target.toLowerCase())
    }
    conn.privmsg(target, trimmed)
    this.emitMessage(this.viewFromOutbound(conn, target, trimmed, 'privmsg'))
  }

  setActiveBuffer(key: string | null): void {
    this.activeBufferKey = key
    if (key) this.unreads.set(key, 0)
    this.emitState()
  }

  searchLogs(query: string, limit = 50): LogSearchHit[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const fromLive = this.messageIndex
      .filter(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          (m.nick?.toLowerCase().includes(q) ?? false) ||
          m.target.toLowerCase().includes(q)
      )
      .slice(-limit)
      .map((m) => {
        const conn = this.connections.get(m.connectionId)
        return {
          id: m.id,
          connectionId: m.connectionId,
          networkName: conn?.network.name ?? m.connectionId,
          target: m.target,
          nick: m.nick,
          text: m.text,
          timestamp: m.timestamp,
          kind: m.kind
        } satisfies LogSearchHit
      })
    if (!this.logger) return fromLive
    const merged: LogSearchHit[] = [...fromLive]
    const seen = new Set(fromLive.map((h) => h.id))
    for (const hit of this.logger.search(query, limit)) {
      if (!seen.has(hit.id)) merged.push(hit)
    }
    return merged.slice(-limit)
  }

  getCompletions(connectionId: string, buffer: string, prefix: string): string[] {
    const conn = this.connections.get(connectionId)
    if (!conn) return []
    const p = prefix.toLowerCase()
    const names = new Set<string>()
    if (buffer !== '*') {
      const ch = conn.channels.get(buffer.toLowerCase())
      if (ch) {
        for (const n of ch.nicks.values()) names.add(n.nick)
      }
    }
    for (const ch of conn.channels.values()) {
      for (const n of ch.nicks.values()) names.add(n.nick)
    }
    names.add(conn.nick)
    return [...names]
      .filter((n) => n.toLowerCase().startsWith(p))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 20)
  }

  private handleSlash(conn: IrcConnection, buffer: string, line: string): void {
    const without = line.slice(1)
    const space = without.indexOf(' ')
    const cmd = (space === -1 ? without : without.slice(0, space)).toLowerCase()
    const args = space === -1 ? '' : without.slice(space + 1).trim()

    switch (cmd) {
      case 'join': {
        const { channel, key } = parseChannelEntry(args)
        if (channel) conn.join(channel, key)
        break
      }
      case 'part': {
        const [channel, ...rest] = args.split(/\s+/)
        const target = channel || (buffer !== '*' ? buffer : '')
        if (target) conn.part(target, rest.join(' ') || undefined)
        break
      }
      case 'topic': {
        const channel = buffer.startsWith('#') || buffer.startsWith('&') ? buffer : args.split(/\s+/)[0]
        if (!channel) return
        if (buffer.startsWith('#') || buffer.startsWith('&')) {
          conn.topic(channel, args || undefined)
        } else {
          const sp = args.indexOf(' ')
          if (sp === -1) conn.topic(channel)
          else conn.topic(args.slice(0, sp), args.slice(sp + 1))
        }
        break
      }
      case 'msg':
      case 'query': {
        const sp = args.indexOf(' ')
        const nick = sp === -1 ? args : args.slice(0, sp)
        if (!nick) return
        conn.queries.add(nick.toLowerCase())
        this.activeBufferKey = bufferKey(conn.id, nick)
        this.unreads.set(this.activeBufferKey, 0)
        if (sp !== -1) {
          const text = args.slice(sp + 1)
          conn.privmsg(nick, text)
          this.emitMessage(this.viewFromOutbound(conn, nick, text, 'privmsg'))
        }
        this.emitState()
        break
      }
      case 'notice': {
        const sp = args.indexOf(' ')
        if (sp === -1) return
        conn.notice(args.slice(0, sp), args.slice(sp + 1))
        break
      }
      case 'nick':
        if (args) conn.sendRaw(formatIrcLine('NICK', [args.split(/\s+/)[0]!]))
        break
      case 'whois': {
        const nick = args.split(/\s+/)[0]
        if (nick) conn.whois(nick)
        break
      }
      case 'kick': {
        const parts = args.split(/\s+/)
        let channel = buffer
        let nick = parts[0]
        let reasonParts = parts.slice(1)
        if (parts[0]?.startsWith('#') || parts[0]?.startsWith('&')) {
          channel = parts[0]!
          nick = parts[1]
          reasonParts = parts.slice(2)
        }
        if (!channel || !nick) return
        if (!conn.selfIsOp(channel)) {
          this.emit('error', { message: `Cannot kick: you are not an op on ${channel}` })
          return
        }
        conn.kick(channel, nick, reasonParts.join(' ') || undefined)
        break
      }
      case 'ban': {
        const parts = args.split(/\s+/)
        let channel = buffer
        let nick = parts[0]
        if (parts[0]?.startsWith('#') || parts[0]?.startsWith('&')) {
          channel = parts[0]!
          nick = parts[1]
        }
        if (!channel || !nick) return
        if (!conn.selfIsOp(channel)) {
          this.emit('error', { message: `Cannot ban: you are not an op on ${channel}` })
          return
        }
        const mask = nick.includes('!') || nick.includes('@') ? nick : `${nick}!*@*`
        conn.mode(channel, '+b', mask)
        break
      }
      case 'mode': {
        if (!args) return
        const [target, modes, ...rest] = args.split(/\s+/)
        if (target && modes) conn.mode(target, modes, ...rest)
        break
      }
      case 'quit':
        conn.disconnect(args || 'MisstIRC quitting')
        this.connections.delete(conn.id)
        this.emitState()
        break
      case 'reconnect':
        this.emit('error', {
          message: 'Use the Servers panel Reconnect button (password is loaded securely).'
        })
        break
      case 'server':
      case 'connect':
        this.emit('error', { message: 'Use the Servers panel to open a network.' })
        break
      case 'me':
      case 'action': {
        const target = buffer === '*' ? null : buffer
        if (!target) return
        const text = `\x01ACTION ${args}\x01`
        conn.privmsg(target, text)
        this.emitMessage(this.viewFromOutbound(conn, target, `\x01ACTION ${args}\x01`, 'privmsg'))
        break
      }
      default:
        conn.sendRaw(without)
        break
    }
  }

  private wire(conn: IrcConnection): void {
    conn.on('state', () => this.emitConnection(conn))
    conn.on('registered', () => this.emitConnection(conn))
    conn.on('message', (msg) => this.onIrcMessage(conn, msg))
    conn.on('error', (err) => this.emit('error', { message: err.message }))
    conn.on('close', () => this.emitConnection(conn))
    conn.on('whois', (info) => {
      const payload: WhoisInfo = {
        nick: info.nick,
        user: info.user,
        host: info.host,
        realname: info.realname,
        server: info.server,
        channels: info.channels,
        idle: info.idle,
        account: info.account,
        raw: info.lines
      }
      this.emit('whois', payload)
      this.emitMessage({
        id: `${conn.id}-${++this.messageSeq}`,
        connectionId: conn.id,
        target: '*',
        kind: 'system',
        text: `WHOIS ${info.nick}: ${info.realname ?? ''} (${info.user ?? ''}@${info.host ?? ''}) ${info.channels ?? ''}`,
        timestamp: Date.now()
      })
    })
  }

  private onIrcMessage(conn: IrcConnection, msg: ParsedIrcMessage): void {
    const view = this.toView(conn, msg)
    if (view) this.emitMessage(view)
    if (
      ['JOIN', 'PART', 'QUIT', 'KICK', '353', '366', 'NICK', '001', 'MODE', 'TOPIC', '332'].includes(
        msg.command
      )
    ) {
      this.emitConnection(conn)
    }
  }

  private toView(conn: IrcConnection, msg: ParsedIrcMessage): IrcMessageView | null {
    const ts = msg.tags['time'] ? Date.parse(msg.tags['time']) || Date.now() : Date.now()
    const base = {
      id: `${conn.id}-${++this.messageSeq}`,
      connectionId: conn.id,
      timestamp: ts,
      tags: msg.tags
    }

    switch (msg.command) {
      case 'PRIVMSG': {
        const target = msg.params[0] ?? '*'
        const text = msg.params[1] ?? ''
        const isPm = target.toLowerCase() === conn.nick.toLowerCase()
        const buffer = isPm ? msg.nick ?? target : target
        if (isPm && msg.nick) conn.queries.add(msg.nick.toLowerCase())
        return { ...base, target: buffer, kind: 'privmsg', nick: msg.nick ?? undefined, text }
      }
      case 'NOTICE':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'notice',
          nick: msg.nick ?? undefined,
          text: msg.params[1] ?? ''
        }
      case 'JOIN':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'join',
          nick: msg.nick ?? undefined,
          text: `joined ${msg.params[0] ?? ''}`
        }
      case 'PART':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'part',
          nick: msg.nick ?? undefined,
          text: `left ${msg.params[0] ?? ''}${msg.params[1] ? ` (${msg.params[1]})` : ''}`
        }
      case 'QUIT':
        return {
          ...base,
          target: this.activeBufferKey?.startsWith(`${conn.id}:`)
            ? (this.activeBufferKey.split(':')[1] ?? '*')
            : '*',
          kind: 'quit',
          nick: msg.nick ?? undefined,
          text: `quit${msg.params[0] ? ` (${msg.params[0]})` : ''}`
        }
      case 'KICK':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'kick',
          nick: msg.nick ?? undefined,
          text: `${msg.params[1]} was kicked${msg.params[2] ? `: ${msg.params[2]}` : ''}`
        }
      case 'TOPIC':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'topic',
          nick: msg.nick ?? undefined,
          text: `topic: ${msg.params[1] ?? ''}`
        }
      case 'MODE':
        return {
          ...base,
          target: msg.params[0] ?? '*',
          kind: 'mode',
          nick: msg.nick ?? undefined,
          text: msg.params.slice(1).join(' ')
        }
      case 'NICK':
        return {
          ...base,
          target: '*',
          kind: 'nick',
          nick: msg.nick ?? undefined,
          text: `${msg.nick} is now known as ${msg.params[0]}`
        }
      case '001':
      case '002':
      case '003':
      case '372':
      case '375':
      case '376':
        return {
          ...base,
          target: '*',
          kind: 'system',
          text: msg.params[msg.params.length - 1] ?? msg.raw
        }
      case 'ERROR':
        return { ...base, target: '*', kind: 'error', text: msg.params.join(' ') }
      default:
        if (/^\d{3}$/.test(msg.command) && !['353', '366', '324', '329'].includes(msg.command)) {
          return {
            ...base,
            target: '*',
            kind: 'system',
            text: msg.params.slice(1).join(' ')
          }
        }
        return null
    }
  }

  private viewFromOutbound(
    conn: IrcConnection,
    target: string,
    text: string,
    kind: 'privmsg' | 'notice'
  ): IrcMessageView {
    return {
      id: `${conn.id}-${++this.messageSeq}`,
      connectionId: conn.id,
      target,
      kind,
      nick: conn.nick,
      text,
      timestamp: Date.now()
    }
  }

  private toSnapshot(conn: IrcConnection): ConnectionSnapshot {
    const buffers: BufferInfo[] = [
      {
        connectionId: conn.id,
        name: '*',
        type: 'server',
        unread: this.unreads.get(bufferKey(conn.id, '*')) ?? 0
      }
    ]
    for (const ch of conn.channels.values()) {
      const nicks = [...ch.nicks.values()].sort((a, b) => {
        const rank = (m: string): number => {
          if (m.includes('~')) return 0
          if (m.includes('&')) return 1
          if (m.includes('@')) return 2
          if (m.includes('%')) return 3
          if (m.includes('+')) return 4
          return 5
        }
        const d = rank(a.modes) - rank(b.modes)
        return d !== 0 ? d : a.nick.localeCompare(b.nick)
      })
      const self = ch.nicks.get(conn.nick.toLowerCase())
      buffers.push({
        connectionId: conn.id,
        name: ch.name,
        type: 'channel',
        topic: ch.topic,
        nicks: nicks.map((n) => ({ nick: n.nick, modes: n.modes })),
        unread: this.unreads.get(bufferKey(conn.id, ch.name)) ?? 0,
        selfIsOp: self ? isOpLike(self.modes) : false
      })
    }
    for (const q of conn.queries) {
      if (buffers.some((b) => b.name.toLowerCase() === q)) continue
      const display =
        this.messageIndex
          .slice()
          .reverse()
          .find((m) => m.connectionId === conn.id && m.target.toLowerCase() === q)?.target ?? q
      buffers.push({
        connectionId: conn.id,
        name: display,
        type: 'query',
        unread:
          this.unreads.get(bufferKey(conn.id, display)) ??
          this.unreads.get(bufferKey(conn.id, q)) ??
          0
      })
    }
    return {
      id: conn.id,
      network: conn.network as NetworkConfig,
      state: conn.state,
      nick: conn.nick,
      lastError: conn.lastError,
      buffers
    }
  }

  private require(connectionId: string): IrcConnection {
    const conn = this.connections.get(connectionId)
    if (!conn) throw new Error(`Unknown connection ${connectionId}`)
    return conn
  }

  private emitState(): void {
    this.emit('state', this.getSnapshot())
  }

  private emitConnection(conn: IrcConnection): void {
    this.emit('connection', this.toSnapshot(conn))
    this.emitState()
  }

  private emitMessage(msg: IrcMessageView): void {
    this.messageIndex.push(msg)
    if (this.messageIndex.length > 5000) {
      this.messageIndex.splice(0, this.messageIndex.length - 5000)
    }
    const key = bufferKey(msg.connectionId, msg.target)
    if (this.activeBufferKey !== key && msg.kind !== 'system') {
      // For case-insensitive match on active buffer
      const active = this.activeBufferKey
      const same =
        active &&
        active.toLowerCase() === key.toLowerCase()
      if (!same) {
        this.unreads.set(key, (this.unreads.get(key) ?? 0) + 1)
      }
    }
    if (this.settings.loggingEnabled && this.logger) {
      const conn = this.connections.get(msg.connectionId)
      this.logger.append(msg, conn?.network.name ?? msg.connectionId)
    }
    this.emit('message', msg)
    // Refresh unread badges without flooding on every system line
    if (msg.kind === 'privmsg' || msg.kind === 'notice') this.emitState()
  }
}

export function bufferKey(connectionId: string, name: string): string {
  return `${connectionId}:${name}`
}
