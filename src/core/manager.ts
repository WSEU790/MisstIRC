import { EventEmitter } from 'node:events'
import type {
  AppSettings,
  AppStateSnapshot,
  BufferInfo,
  ConnectRequest,
  ConnectionSnapshot,
  IrcMessageView,
  NetworkConfig,
  UnfinishedFeature
} from '@shared/types'
import { IrcConnection } from './connection'
import type { ParsedIrcMessage } from './parser'
import { formatIrcLine } from './parser'

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
  activeBufferKey: string | null = null
  settings: AppSettings = {
    theme: 'misstirc-dark',
    showStatusBar: true,
    fontSize: 14
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

  /** Test helper: inject a pre-built connection (e.g. with mock socket factory). */
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
    if (this.activeBufferKey?.startsWith(`${connectionId}:`)) {
      this.activeBufferKey = null
    }
    this.emitState()
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
    conn.privmsg(target, trimmed)
    this.emitMessage(this.viewFromOutbound(conn, target, trimmed, 'privmsg'))
  }

  setActiveBuffer(key: string | null): void {
    this.activeBufferKey = key
    this.emitState()
  }

  private handleSlash(conn: IrcConnection, buffer: string, line: string): void {
    const without = line.slice(1)
    const space = without.indexOf(' ')
    const cmd = (space === -1 ? without : without.slice(0, space)).toLowerCase()
    const args = space === -1 ? '' : without.slice(space + 1).trim()

    switch (cmd) {
      case 'join': {
        const [channel, key] = args.split(/\s+/)
        if (channel) conn.join(channel, key)
        break
      }
      case 'part': {
        const [channel, ...rest] = args.split(/\s+/)
        const target = channel || (buffer !== '*' ? buffer : '')
        if (target) conn.part(target, rest.join(' ') || undefined)
        break
      }
      case 'msg':
      case 'query': {
        const sp = args.indexOf(' ')
        if (sp === -1) return
        const nick = args.slice(0, sp)
        const text = args.slice(sp + 1)
        conn.privmsg(nick, text)
        this.emitMessage(this.viewFromOutbound(conn, nick, text, 'privmsg'))
        this.activeBufferKey = bufferKey(conn.id, nick)
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
      case 'quit':
        conn.disconnect(args || 'MisstIRC quitting')
        this.connections.delete(conn.id)
        this.emitState()
        break
      case 'server':
      case 'connect':
        this.emit('error', { message: 'Use the Connect dialog to open a network.' })
        break
      case 'me':
      case 'action': {
        const target = buffer === '*' ? null : buffer
        if (!target) return
        const text = `\x01ACTION ${args}\x01`
        conn.privmsg(target, text)
        this.emitMessage(this.viewFromOutbound(conn, target, `* ${conn.nick} ${args}`, 'privmsg'))
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
  }

  private onIrcMessage(conn: IrcConnection, msg: ParsedIrcMessage): void {
    const view = this.toView(conn, msg)
    if (view) this.emitMessage(view)
    if (['JOIN', 'PART', 'QUIT', '353', '366', 'NICK', '001'].includes(msg.command)) {
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
        const buffer =
          target.toLowerCase() === conn.nick.toLowerCase() ? msg.nick ?? target : target
        return {
          ...base,
          target: buffer,
          kind: 'privmsg',
          nick: msg.nick ?? undefined,
          text
        }
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
        return {
          ...base,
          target: '*',
          kind: 'error',
          text: msg.params.join(' ')
        }
      default:
        if (/^\d{3}$/.test(msg.command)) {
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
      { connectionId: conn.id, name: '*', type: 'server' }
    ]
    for (const ch of conn.channels.values()) {
      buffers.push({
        connectionId: conn.id,
        name: ch.name,
        type: 'channel',
        topic: ch.topic,
        nicks: [...ch.nicks.values()]
          .sort((a, b) => a.localeCompare(b))
          .map((nick) => ({ nick, modes: '' }))
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
    this.emit('message', msg)
  }
}

export function bufferKey(connectionId: string, name: string): string {
  return `${connectionId}:${name}`
}
