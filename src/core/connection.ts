import { EventEmitter } from 'node:events'
import * as net from 'node:net'
import * as tls from 'node:tls'
import { randomUUID } from 'node:crypto'
import type { ConnectionState, NetworkConfig } from '@shared/types'
import { formatIrcLine, parseIrcLine, type ParsedIrcMessage } from './parser'

export interface IrcConnectionOptions {
  network: NetworkConfig
  password?: string
  saslPassword?: string
  /** Override for tests */
  createSocket?: (opts: {
    host: string
    port: number
    tls: boolean
    rejectUnauthorized: boolean
  }) => net.Socket
}

export interface ChannelState {
  name: string
  topic?: string
  nicks: Map<string, string>
}

type ConnectionEvents = {
  state: [ConnectionState]
  message: [ParsedIrcMessage]
  line: [string]
  registered: []
  error: [Error]
  close: []
}

export class IrcConnection extends EventEmitter {
  readonly id: string
  readonly network: NetworkConfig
  state: ConnectionState = 'disconnected'
  nick: string
  channels = new Map<string, ChannelState>()
  lastError?: string

  private socket: net.Socket | null = null
  private buffer = ''
  private readonly password?: string
  private readonly saslPassword?: string
  private readonly createSocket?: IrcConnectionOptions['createSocket']
  private registered = false
  private capEnded = false
  private availableCaps = new Set<string>()
  private saslInProgress = false
  private reconnectAttempt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private intentionalClose = false
  private pingTimer: NodeJS.Timeout | null = null
  private readonly maxLineLength = 8192
  private readonly wantedCaps = ['sasl', 'server-time', 'message-tags', 'multi-prefix']

  constructor(options: IrcConnectionOptions) {
    super()
    this.id = options.network.id || randomUUID()
    this.network = options.network
    this.nick = options.network.nick
    this.password = options.password
    this.saslPassword = options.saslPassword
    this.createSocket = options.createSocket
    // Prevent EventEmitter from throwing on emit('error') with no listeners.
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
      // Attach error listener first so abrupt resets are not unhandled.
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

  private openSocket(): Promise<net.Socket> {
    const { host, port, tls: useTls, rejectUnauthorized } = this.network
    return new Promise((resolve, reject) => {
      if (useTls) {
        const socket = tls.connect({ host, port, rejectUnauthorized, servername: host }, () => resolve(socket))
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
        for (const channel of this.network.channels) {
          if (channel) this.join(channel)
        }
        break
      case 'NICK': {
        const newNick = msg.params[0]
        if (msg.nick === this.nick && newNick) this.nick = newNick
        break
      }
      case 'JOIN': {
        const channel = msg.params[0]
        if (!channel || !msg.nick) break
        let ch = this.channels.get(channel.toLowerCase())
        if (!ch) {
          ch = { name: channel, nicks: new Map() }
          this.channels.set(channel.toLowerCase(), ch)
        }
        ch.nicks.set(msg.nick.toLowerCase(), msg.nick)
        break
      }
      case 'PART':
      case 'QUIT': {
        const channel = msg.command === 'PART' ? msg.params[0] : undefined
        if (msg.command === 'PART' && channel) {
          const ch = this.channels.get(channel.toLowerCase())
          if (ch && msg.nick) ch.nicks.delete(msg.nick.toLowerCase())
          if (msg.nick === this.nick) this.channels.delete(channel.toLowerCase())
        } else if (msg.command === 'QUIT' && msg.nick) {
          for (const ch of this.channels.values()) {
            ch.nicks.delete(msg.nick.toLowerCase())
          }
        }
        break
      }
      case '353': {
        // RPL_NAMREPLY: <nick> <type> <channel> :<nicks>
        const channel = msg.params[2]
        const names = msg.params[3] ?? ''
        if (!channel) break
        let ch = this.channels.get(channel.toLowerCase())
        if (!ch) {
          ch = { name: channel, nicks: new Map() }
          this.channels.set(channel.toLowerCase(), ch)
        }
        for (const token of names.split(/\s+/).filter(Boolean)) {
          const modes = token.match(/^[@%+~&]/)?.[0] ?? ''
          const nick = token.slice(modes.length)
          ch.nicks.set(nick.toLowerCase(), nick)
        }
        break
      }
      case '332': {
        const channel = msg.params[1]
        const topic = msg.params[2]
        if (channel) {
          let ch = this.channels.get(channel.toLowerCase())
          if (!ch) {
            ch = { name: channel, nicks: new Map() }
            this.channels.set(channel.toLowerCase(), ch)
          }
          ch.topic = topic
        }
        break
      }
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
      const ack = (msg.params[msg.params.length - 1] ?? '').split(/\s+/)
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

  private setState(state: ConnectionState): void {
    this.state = state
    this.emit('state', state)
  }
}
