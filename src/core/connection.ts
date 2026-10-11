import { EventEmitter } from 'node:events'
import * as net from 'node:net'
import * as tls from 'node:tls'
import { randomUUID } from 'node:crypto'
import type { ConnectionState, NetworkConfig } from '@shared/types'
import {
  buildPingReply,
  buildTimeReply,
  buildVersionReply,
  CtcpFloodGuard,
  formatCtcp,
  parseCtcp
} from './ctcp'
import { PRIORITY_CAPS, parseIsupportTokens } from './isupport'
import { formatIrcLine, parseIrcLine, type ParsedIrcMessage } from './parser'
import {
  applyNickMode,
  isOpLike,
  parseChannelEntry,
  parsePrefixedNick,
  sortPrefixes
} from './prefixes'

export interface IrcConnectionOptions {
  network: NetworkConfig
  password?: string
  saslPassword?: string
  createSocket?: (opts: {
    host: string
    port: number
    tls: boolean
    rejectUnauthorized: boolean
  }) => net.Socket
}

export interface ChannelNick {
  nick: string
  modes: string
  account?: string
  away?: boolean
}

export interface ChannelState {
  name: string
  topic?: string
  key?: string
  nicks: Map<string, ChannelNick>
}

export interface WhoisPending {
  nick: string
  lines: string[]
  user?: string
  host?: string
  realname?: string
  server?: string
  channels?: string
  idle?: string
  account?: string
}

type ConnectionEvents = {
  state: [ConnectionState]
  message: [ParsedIrcMessage]
  line: [string]
  registered: []
  error: [Error]
  close: []
  whois: [WhoisPending]
  ctcp: [ParsedIrcMessage, ReturnType<typeof parseCtcp>]
  perform: []
}

export class IrcConnection extends EventEmitter {
  readonly id: string
  readonly network: NetworkConfig
  state: ConnectionState = 'disconnected'
  nick: string
  channels = new Map<string, ChannelState>()
  queries = new Set<string>()
  lastError?: string
  negotiatedCaps: string[] = []
  isupport: Record<string, string> = {}
  account: string | null = null

  private socket: net.Socket | null = null
  private buffer = ''
  private readonly password?: string
  private readonly saslPassword?: string
  private readonly createSocket?: IrcConnectionOptions['createSocket']
  private registered = false
  private capEnded = false
  private availableCaps = new Set<string>()
  private enabledCaps = new Set<string>()
  private saslInProgress = false
  private reconnectAttempt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private intentionalClose = false
  private pingTimer: NodeJS.Timeout | null = null
  private awayTimer: NodeJS.Timeout | null = null
  private readonly maxLineLength = 8192
  private readonly wantedCaps = [...PRIORITY_CAPS]
  private whoisPending = new Map<string, WhoisPending>()
  private nickAttempt = 0
  private openBatches = new Set<string>()
  private ctcpGuard: CtcpFloodGuard

  constructor(options: IrcConnectionOptions) {
    super()
    this.id = options.network.id || randomUUID()
    this.network = options.network
    this.nick = options.network.nick
    this.password = options.password
    this.saslPassword = options.saslPassword
    this.createSocket = options.createSocket
    this.ctcpGuard = new CtcpFloodGuard(options.network.ctcpFloodLimit ?? 5)
    this.on('error', () => undefined)
  }

  on<K extends keyof ConnectionEvents>(event: K, listener: (...args: ConnectionEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof ConnectionEvents>(event: K, ...args: ConnectionEvents[K]): boolean {
    return super.emit(event, ...args)
  }

  async connect(): Promise<void> {
    this.intentionalClose = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.setState('connecting')
    this.registered = false
    this.capEnded = false
    this.availableCaps.clear()
    this.saslInProgress = false
    this.buffer = ''
    this.channels.clear()
    this.negotiatedCaps = []
    this.enabledCaps.clear()
    this.isupport = {}
    this.nickAttempt = 0
    this.openBatches.clear()
    this.stopAwayTimer()

    try {
      const socket = this.createSocket
        ? this.createSocket({
            host: this.network.host,
            port: this.network.port,
            tls: this.network.tls,
            rejectUnauthorized: this.network.rejectUnauthorized
          })
        : await this.openSocket()

      this.socket = socket
      socket.setEncoding('utf8')
      socket.on('error', (err) => {
        this.lastError = err.message
        this.emit('error', err)
        if (!this.intentionalClose && this.state !== 'reconnecting') {
          this.setState('error')
        }
      })
      socket.on('data', (chunk: string | Buffer) =>
        this.onData(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
      )
      socket.on('close', () => this.onClose())

      this.setState('registering')
      this.sendRaw('CAP LS 302')
      if (this.password) {
        this.sendRaw(formatIrcLine('PASS', [this.password]))
      }
      this.sendRaw(formatIrcLine('NICK', [this.network.nick]))
      this.sendRaw(
        formatIrcLine('USER', [
          this.network.username || this.network.nick,
          '0',
          '*',
          this.network.realname || this.network.nick
        ])
      )
      this.startPingWatchdog()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.lastError = error.message
      this.emit('error', error)
      this.setState('error')
      this.scheduleReconnect()
      throw error
    }
  }

  disconnect(quitMessage = 'MisstIRC quitting'): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPingWatchdog()
    this.stopAwayTimer()
    if (this.socket && !this.socket.destroyed) {
      try {
        this.sendRaw(formatIrcLine('QUIT', [quitMessage]))
      } catch {
        /* ignore */
      }
      this.socket.end()
      this.socket.destroy()
    }
    this.socket = null
    this.setState('disconnected')
  }

  sendRaw(line: string): void {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Not connected')
    }
    const payload = line.endsWith('\r\n') ? line : `${line}\r\n`
    this.socket.write(payload)
  }

  join(channel: string, key?: string): void {
    this.sendRaw(formatIrcLine('JOIN', key ? [channel, key] : [channel]))
  }

  part(channel: string, reason?: string): void {
    this.sendRaw(formatIrcLine('PART', reason ? [channel, reason] : [channel]))
  }

  privmsg(target: string, text: string): void {
    this.sendRaw(formatIrcLine('PRIVMSG', [target, text]))
  }

  notice(target: string, text: string): void {
    this.sendRaw(formatIrcLine('NOTICE', [target, text]))
  }

  topic(channel: string, text?: string): void {
    if (text === undefined) this.sendRaw(formatIrcLine('TOPIC', [channel]))
    else this.sendRaw(formatIrcLine('TOPIC', [channel, text]))
  }

  kick(channel: string, nick: string, reason?: string): void {
    this.sendRaw(formatIrcLine('KICK', reason ? [channel, nick, reason] : [channel, nick]))
  }

  mode(target: string, modes: string, ...args: string[]): void {
    this.sendRaw(formatIrcLine('MODE', [target, modes, ...args]))
  }

  whois(nick: string): void {
    const key = nick.toLowerCase()
    this.whoisPending.set(key, { nick, lines: [] })
    this.sendRaw(formatIrcLine('WHOIS', [nick]))
  }

  /** Reply to inbound CTCP request if prefs + flood guard allow. */
  handleInboundCtcp(msg: ParsedIrcMessage): void {
    const text = msg.params[1] ?? ''
    const ctcp = parseCtcp(text)
    if (!ctcp || !msg.nick) return
    this.emit('ctcp', msg, ctcp)
    if (ctcp.type === 'ACTION' || ctcp.type === 'DCC') return
    if (!this.ctcpGuard.allow()) return

    const n = this.network
    if (ctcp.type === 'VERSION' && n.replyCtcpVersion !== false) {
      this.notice(msg.nick, buildVersionReply())
    } else if (ctcp.type === 'TIME' && n.replyCtcpTime !== false) {
      this.notice(msg.nick, buildTimeReply())
    } else if (ctcp.type === 'PING' && n.replyCtcpPing !== false) {
      this.notice(msg.nick, buildPingReply(ctcp.args))
    }
  }

  sendCtcp(target: string, type: string, args = ''): void {
    this.privmsg(target, formatCtcp(type, args))
  }

  setAway(message?: string): void {
    if (message) this.sendRaw(formatIrcLine('AWAY', [message]))
    else this.sendRaw('AWAY')
  }

  selfIsOp(channel: string): boolean {
    const ch = this.channels.get(channel.toLowerCase())
    if (!ch) return false
    const self = ch.nicks.get(this.nick.toLowerCase())
    return self ? isOpLike(self.modes) : false
  }

  private openSocket(): Promise<net.Socket> {
    const { host, port, tls: useTls, rejectUnauthorized } = this.network
    return new Promise((resolve, reject) => {
      if (useTls) {
        const socket = tls.connect({ host, port, rejectUnauthorized, servername: host }, () =>
          resolve(socket)
        )
        socket.once('error', reject)
      } else {
        const socket = net.connect({ host, port }, () => resolve(socket))
        socket.once('error', reject)
      }
    })
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    while (true) {
      const idx = this.buffer.indexOf('\n')
      if (idx === -1) break
      let line = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      if (line.length > this.maxLineLength) {
        this.emit('error', new Error('IRC line exceeded maximum length'))
        continue
      }
      if (!line) continue
      this.handleLine(line)
    }
    if (this.buffer.length > this.maxLineLength) {
      this.emit('error', new Error('IRC buffer overflow'))
      this.buffer = ''
    }
  }

  private handleLine(line: string): void {
    this.emit('line', line)
    let msg: ParsedIrcMessage
    try {
      msg = parseIrcLine(line)
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
      return
    }
    this.emit('message', msg)
    this.dispatch(msg)
  }

  private ensureChannel(name: string): ChannelState {
    const key = name.toLowerCase()
    let ch = this.channels.get(key)
    if (!ch) {
      ch = { name, nicks: new Map() }
      this.channels.set(key, ch)
    }
    return ch
  }

  private setNick(channel: string, nick: string, modes = ''): void {
    const ch = this.ensureChannel(channel)
    ch.nicks.set(nick.toLowerCase(), { nick, modes: sortPrefixes(modes) })
  }

  private dispatch(msg: ParsedIrcMessage): void {
    switch (msg.command) {
      case 'PING':
        this.sendRaw(formatIrcLine('PONG', [msg.params[0] ?? '']))
        break
      case 'CAP':
        this.handleCap(msg)
        break
      case 'AUTHENTICATE':
        this.handleAuthenticate(msg)
        break
      case '001':
        this.nick = msg.params[0] ?? this.nick
        this.registered = true
        this.reconnectAttempt = 0
        this.setState('connected')
        this.emit('registered')
        this.emit('perform')
        for (const entry of this.network.channels) {
          const { channel, key } = parseChannelEntry(entry)
          if (channel) this.join(channel, key)
        }
        this.startAwayTimer()
        break
      case '005': {
        const tokens = msg.params.slice(1)
        Object.assign(this.isupport, parseIsupportTokens(tokens))
        break
      }
      case '433':
      case '432': {
        // Nickname in use / erroneous — try alternatives
        const alts = this.network.altNicks ?? []
        if (this.nickAttempt < alts.length) {
          const next = alts[this.nickAttempt++]!
          this.sendRaw(formatIrcLine('NICK', [next]))
        } else {
          const fallback = `${this.network.nick}_${Math.floor(Math.random() * 9000 + 1000)}`
          this.sendRaw(formatIrcLine('NICK', [fallback]))
        }
        break
      }
      case 'ACCOUNT': {
        const account = msg.params[0]
        if (msg.nick) {
          for (const ch of this.channels.values()) {
            const entry = ch.nicks.get(msg.nick.toLowerCase())
            if (entry) {
              entry.account = account === '*' ? undefined : account
            }
          }
          if (msg.nick.toLowerCase() === this.nick.toLowerCase()) {
            this.account = account === '*' ? null : account ?? null
          }
        }
        break
      }
      case 'AWAY': {
        if (!msg.nick) break
        const away = Boolean(msg.params[0])
        for (const ch of this.channels.values()) {
          const entry = ch.nicks.get(msg.nick.toLowerCase())
          if (entry) entry.away = away
        }
        break
      }
      case 'CHGHOST': {
        // host/user change — no nicklist structure change required beyond event
        break
      }
      case 'BATCH': {
        const ref = msg.params[0] ?? ''
        if (ref.startsWith('+')) this.openBatches.add(ref.slice(1))
        else if (ref.startsWith('-')) this.openBatches.delete(ref.slice(1))
        break
      }
      case 'PRIVMSG':
      case 'NOTICE': {
        const text = msg.params[1] ?? ''
        if (text.startsWith('\x01') && text.endsWith('\x01')) {
          this.handleInboundCtcp(msg)
        }
        break
      }
      case 'NICK': {
        const newNick = msg.params[0]
        if (!newNick || !msg.nick) break
        const oldKey = msg.nick.toLowerCase()
        if (oldKey === this.nick.toLowerCase()) this.nick = newNick
        for (const ch of this.channels.values()) {
          const entry = ch.nicks.get(oldKey)
          if (entry) {
            ch.nicks.delete(oldKey)
            ch.nicks.set(newNick.toLowerCase(), { nick: newNick, modes: entry.modes })
          }
        }
        if (this.queries.has(oldKey)) {
          this.queries.delete(oldKey)
          this.queries.add(newNick.toLowerCase())
        }
        break
      }
      case 'JOIN': {
        const channel = msg.params[0]
        if (!channel || !msg.nick) break
        this.setNick(channel, msg.nick, '')
        // extended-join: JOIN #chan account :realname
        if (msg.params[1] && msg.params[1] !== '*') {
          const entry = this.channels.get(channel.toLowerCase())?.nicks.get(msg.nick.toLowerCase())
          if (entry) entry.account = msg.params[1]
        }
        break
      }
      case 'PART': {
        const channel = msg.params[0]
        if (!channel || !msg.nick) break
        const ch = this.channels.get(channel.toLowerCase())
        ch?.nicks.delete(msg.nick.toLowerCase())
        if (msg.nick.toLowerCase() === this.nick.toLowerCase()) {
          this.channels.delete(channel.toLowerCase())
        }
        break
      }
      case 'QUIT': {
        if (!msg.nick) break
        for (const ch of this.channels.values()) {
          ch.nicks.delete(msg.nick.toLowerCase())
        }
        break
      }
      case 'KICK': {
        const channel = msg.params[0]
        const victim = msg.params[1]
        if (!channel || !victim) break
        const ch = this.channels.get(channel.toLowerCase())
        ch?.nicks.delete(victim.toLowerCase())
        if (victim.toLowerCase() === this.nick.toLowerCase()) {
          this.channels.delete(channel.toLowerCase())
        }
        break
      }
      case 'TOPIC': {
        const channel = msg.params[0]
        const topic = msg.params[1]
        if (channel) this.ensureChannel(channel).topic = topic
        break
      }
      case 'MODE': {
        this.handleMode(msg)
        break
      }
      case '353': {
        const channel = msg.params[2]
        const names = msg.params[3] ?? ''
        if (!channel) break
        for (const token of names.split(/\s+/).filter(Boolean)) {
          const { modes, nick } = parsePrefixedNick(token)
          if (nick) this.setNick(channel, nick, modes)
        }
        break
      }
      case '332': {
        const channel = msg.params[1]
        const topic = msg.params[2]
        if (channel) this.ensureChannel(channel).topic = topic
        break
      }
      case '324': {
        // RPL_CHANNELMODEIS <nick> <channel> <mode> <mode params>
        const channel = msg.params[1]
        if (!channel) break
        const modes = msg.params[2] ?? ''
        if (modes.includes('k') && msg.params[3]) {
          this.ensureChannel(channel).key = msg.params[3]
        }
        break
      }
      case '311':
      case '312':
      case '317':
      case '319':
      case '330':
      case '318':
        this.handleWhois(msg)
        break
      case '900':
      case '903':
        if (this.saslInProgress) {
          this.saslInProgress = false
          this.finishCap()
        }
        break
      case '904':
      case '905':
      case '906':
        if (this.saslInProgress) {
          this.saslInProgress = false
          this.lastError = `SASL failed (${msg.command})`
          this.finishCap()
        }
        break
      default:
        break
    }
  }

  private handleMode(msg: ParsedIrcMessage): void {
    const target = msg.params[0]
    const modeStr = msg.params[1]
    if (!target || !modeStr || !target.startsWith('#') && !target.startsWith('&')) {
      // channel modes only for nick list updates
      if (!target?.startsWith('#') && !target?.startsWith('&')) return
    }
    if (!target || !modeStr) return
    const ch = this.ensureChannel(target)
    let adding = true
    let argIdx = 2
    for (const chMode of modeStr) {
      if (chMode === '+') {
        adding = true
        continue
      }
      if (chMode === '-') {
        adding = false
        continue
      }
      if ('ovhqa'.includes(chMode)) {
        const nick = msg.params[argIdx++]
        if (!nick) continue
        const entry = ch.nicks.get(nick.toLowerCase()) ?? { nick, modes: '' }
        entry.modes = applyNickMode(entry.modes, adding, chMode)
        ch.nicks.set(nick.toLowerCase(), entry)
      } else if (chMode === 'k') {
        const key = msg.params[argIdx++]
        if (adding && key) ch.key = key
        if (!adding) ch.key = undefined
      } else if ('blI'.includes(chMode)) {
        argIdx += 1
      }
    }
  }

  private handleWhois(msg: ParsedIrcMessage): void {
    const nick = msg.params[1] ?? ''
    const key = nick.toLowerCase()
    let pending = this.whoisPending.get(key)
    if (!pending) {
      pending = { nick, lines: [] }
      this.whoisPending.set(key, pending)
    }
    pending.lines.push(msg.raw)
    if (msg.command === '311') {
      pending.user = msg.params[2]
      pending.host = msg.params[3]
      pending.realname = msg.params[5] ?? msg.params[msg.params.length - 1]
    } else if (msg.command === '312') {
      pending.server = msg.params[2]
    } else if (msg.command === '319') {
      pending.channels = msg.params[2]
    } else if (msg.command === '317') {
      pending.idle = msg.params[2]
    } else if (msg.command === '330') {
      pending.account = msg.params[2]
    } else if (msg.command === '318') {
      this.whoisPending.delete(key)
      this.emit('whois', pending)
    }
  }

  private handleCap(msg: ParsedIrcMessage): void {
    const sub = (msg.params[1] ?? '').toUpperCase()
    if (sub === 'LS' || sub === 'NEW') {
      const list = (msg.params[msg.params.length - 1] ?? '').split(/\s+/).filter(Boolean)
      for (const cap of list) {
        const name = cap.split('=')[0]!
        this.availableCaps.add(name)
      }
      if (!msg.params[msg.params.length - 1]?.endsWith('*') && sub === 'LS') {
        const req = this.wantedCaps.filter((c) => this.availableCaps.has(c))
        if (req.length) this.sendRaw(formatIrcLine('CAP', ['REQ', req.join(' ')]))
        else this.finishCap()
      }
    } else if (sub === 'ACK' || sub === 'NAK') {
      const ack = (msg.params[msg.params.length - 1] ?? '').split(/\s+/).filter(Boolean)
      if (sub === 'ACK') {
        for (const c of ack) this.enabledCaps.add(c)
        this.negotiatedCaps = [...this.enabledCaps]
      }
      if (sub === 'ACK' && ack.includes('sasl') && this.saslPassword) {
        this.saslInProgress = true
        this.sendRaw(formatIrcLine('AUTHENTICATE', ['PLAIN']))
      } else {
        this.finishCap()
      }
    }
  }

  private handleAuthenticate(msg: ParsedIrcMessage): void {
    if (msg.params[0] === '+' && this.saslPassword) {
      const authzid = ''
      const authcid = this.network.nick
      const pass = this.saslPassword
      const payload = Buffer.from(`${authzid}\0${authcid}\0${pass}`, 'utf8').toString('base64')
      this.sendRaw(formatIrcLine('AUTHENTICATE', [payload]))
    }
  }

  private finishCap(): void {
    if (this.capEnded) return
    this.capEnded = true
    this.sendRaw('CAP END')
  }

  private onClose(): void {
    this.stopPingWatchdog()
    this.socket = null
    this.emit('close')
    if (this.intentionalClose) {
      this.setState('disconnected')
      return
    }
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return
    this.reconnectAttempt += 1
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 5))
    this.setState('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {
        /* errors already emitted */
      })
    }, delay)
  }

  private startPingWatchdog(): void {
    this.stopPingWatchdog()
    this.pingTimer = setInterval(() => {
      if (!this.socket || this.socket.destroyed) return
      try {
        this.sendRaw(formatIrcLine('PING', [`misstirc_${Date.now()}`]))
      } catch {
        /* ignore */
      }
    }, 60_000)
  }

  private stopPingWatchdog(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private startAwayTimer(): void {
    this.stopAwayTimer()
    const minutes = this.network.autoAwayMinutes
    if (!minutes || minutes <= 0) return
    this.awayTimer = setTimeout(() => {
      try {
        this.setAway(this.network.autoAwayMessage || 'Auto-away (MisstIRC)')
      } catch {
        /* ignore */
      }
    }, minutes * 60_000)
  }

  private stopAwayTimer(): void {
    if (this.awayTimer) {
      clearTimeout(this.awayTimer)
      this.awayTimer = null
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state
    this.emit('state', state)
  }
}
