import * as net from 'node:net'
import { EventEmitter } from 'node:events'
import { parseIrcLine, formatIrcLine } from '../core/parser'

export interface MockClient {
  socket: net.Socket
  nick: string
  user: string
  registered: boolean
  caps: Set<string>
  channels: Set<string>
  buffer: string
}

export interface MockIrcServerOptions {
  host?: string
  port?: number
  requireSasl?: boolean
  password?: string
  offeredCaps?: string[]
}

/**
 * Minimal IRC server for protocol integration tests.
 * Supports CAP LS 302, optional SASL PLAIN, JOIN/PART, PRIVMSG, PING/PONG.
 */
export class MockIrcServer extends EventEmitter {
  private server: net.Server | null = null
  private clients = new Set<MockClient>()
  private readonly host: string
  private readonly port: number
  private readonly requireSasl: boolean
  private readonly password?: string
  private readonly offeredCaps: string[]
  listeningPort = 0

  constructor(options: MockIrcServerOptions = {}) {
    super()
    this.host = options.host ?? '127.0.0.1'
    this.port = options.port ?? 0
    this.requireSasl = options.requireSasl ?? false
    this.password = options.password
    this.offeredCaps = options.offeredCaps ?? [
      'sasl',
      'server-time',
      'message-tags',
      'multi-prefix'
    ]
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.onConnection(socket))
      this.server.once('error', reject)
      this.server.listen(this.port, this.host, () => {
        const addr = this.server!.address()
        if (addr && typeof addr === 'object') {
          this.listeningPort = addr.port
          resolve(addr.port)
        } else {
          reject(new Error('Failed to bind mock IRC server'))
        }
      })
    })
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.socket.destroy()
    }
    this.clients.clear()
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve()
      this.server.close(() => resolve())
    })
    this.server = null
  }

  get clientCount(): number {
    return this.clients.size
  }

  /** Test helper: forcibly drop all client sockets. */
  dropAllClients(): void {
    for (const client of this.clients) {
      client.socket.removeAllListeners('error')
      client.socket.on('error', () => undefined)
      client.socket.destroy()
    }
  }

  private onConnection(socket: net.Socket): void {
    const client: MockClient = {
      socket,
      nick: '',
      user: '',
      registered: false,
      caps: new Set(),
      channels: new Set(),
      buffer: ''
    }
    this.clients.add(client)
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      client.buffer += chunk
      while (true) {
        const idx = client.buffer.indexOf('\n')
        if (idx === -1) break
        let line = client.buffer.slice(0, idx)
        client.buffer = client.buffer.slice(idx + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line) this.handleLine(client, line)
      }
    })
    socket.on('close', () => {
      this.clients.delete(client)
    })
  }

  private send(client: MockClient, line: string): void {
    if (!client.socket.destroyed) {
      client.socket.write(line.endsWith('\r\n') ? line : `${line}\r\n`)
    }
  }

  private handleLine(client: MockClient, line: string): void {
    this.emit('line', line)
    const msg = parseIrcLine(line)

    switch (msg.command) {
      case 'CAP': {
        const sub = (msg.params[0] ?? '').toUpperCase()
        if (sub === 'LS') {
          this.send(
            client,
            formatIrcLine('CAP', ['*', 'LS', this.offeredCaps.join(' ')])
          )
        } else if (sub === 'REQ') {
          const req = (msg.params[1] ?? '').split(/\s+/).filter(Boolean)
          for (const c of req) client.caps.add(c)
          this.send(client, formatIrcLine('CAP', ['*', 'ACK', req.join(' ')]))
        } else if (sub === 'END') {
          this.maybeRegister(client)
        }
        break
      }
      case 'PASS':
        if (this.password && msg.params[0] !== this.password) {
          this.send(client, formatIrcLine('ERROR', ['Bad password']))
          client.socket.end()
        }
        break
      case 'NICK':
        client.nick = msg.params[0] ?? client.nick
        this.maybeRegister(client)
        break
      case 'USER':
        client.user = msg.params[0] ?? client.user
        this.maybeRegister(client)
        break
      case 'AUTHENTICATE':
        if (msg.params[0] === 'PLAIN') {
          this.send(client, formatIrcLine('AUTHENTICATE', ['+']))
        } else {
          // Accept any base64 PLAIN payload in tests
          this.send(
            client,
            formatIrcLine('900', [client.nick, `${client.nick}!${client.user}@localhost`, client.nick, 'You are now logged in'])
          )
          this.send(client, formatIrcLine('903', [client.nick, 'SASL authentication successful']))
          client.caps.add('sasl-ok')
          this.maybeRegister(client)
        }
        break
      case 'PING':
        this.send(client, formatIrcLine('PONG', [msg.params[0] ?? 'mock']))
        break
      case 'PONG':
        break
      case 'JOIN': {
        const channel = msg.params[0]
        if (!channel || !client.registered) break
        client.channels.add(channel.toLowerCase())
        this.send(client, `:${client.nick}!${client.user}@localhost JOIN :${channel}`)
        this.send(client, formatIrcLine('353', [client.nick, '=', channel, `@${client.nick} alice bob`]))
        this.send(client, formatIrcLine('366', [client.nick, channel, 'End of /NAMES list']))
        this.send(client, formatIrcLine('332', [client.nick, channel, 'Welcome to the mock channel']))
        break
      }
      case 'PART': {
        const channel = msg.params[0]
        if (!channel) break
        client.channels.delete(channel.toLowerCase())
        this.send(client, `:${client.nick}!${client.user}@localhost PART ${channel}`)
        break
      }
      case 'PRIVMSG': {
        const target = msg.params[0]
        const text = msg.params[1] ?? ''
        if (!target) break
        // Echo from a fake peer for channel messages
        if (target.startsWith('#')) {
          this.send(
            client,
            `:alice!alice@localhost PRIVMSG ${target} :echo:${text}`
          )
        } else {
          this.send(
            client,
            `:${target}!user@localhost PRIVMSG ${client.nick} :pm-ack:${text}`
          )
        }
        break
      }
      case 'QUIT':
        client.socket.end()
        break
      default:
        break
    }
  }

  private maybeRegister(client: MockClient): void {
    if (client.registered) return
    if (!client.nick || !client.user) return
    if (this.requireSasl && !client.caps.has('sasl-ok')) return
    client.registered = true
    this.send(client, formatIrcLine('001', [client.nick, 'Welcome to MockIRC']))
    this.send(client, formatIrcLine('002', [client.nick, 'Your host is mock.misstirc.local']))
    this.send(client, formatIrcLine('376', [client.nick, 'End of MOTD']))
    this.emit('registered', client.nick)
  }
}
