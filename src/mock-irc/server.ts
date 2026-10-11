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
      'multi-prefix',
      'account-notify',
      'extended-join',
      'account-tag',
      'away-notify',
      'chghost',
      'batch',
      'labeled-response'
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

  /** Test helper: push a CTCP DCC SEND offer to the first client. */
  sendDccOffer(filename: string, address = '2130706433', port = 59_999, size = 12): void {
    const client = [...this.clients][0]
    if (!client) return
    const body = `\x01DCC SEND ${filename} ${address} ${port} ${size}\x01`
    this.send(client, `:eve!e@localhost PRIVMSG ${client.nick} :${body}`)
  }

  /** Test helper: CTCP VERSION request to client. */
  sendCtcpVersion(): void {
    const client = [...this.clients][0]
    if (!client) return
    this.send(client, `:eve!e@localhost PRIVMSG ${client.nick} :\x01VERSION\x01`)
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
        const key = msg.params[1]
        if (!channel || !client.registered) break
        client.channels.add(channel.toLowerCase())
        this.send(client, `:${client.nick}!${client.user}@localhost JOIN :${channel}`)
        this.send(
          client,
          formatIrcLine('353', [client.nick, '=', channel, `@${client.nick} +alice bob`])
        )
        this.send(client, formatIrcLine('366', [client.nick, channel, 'End of /NAMES list']))
        this.send(client, formatIrcLine('332', [client.nick, channel, 'Welcome to the mock channel']))
        if (key) {
          this.send(client, formatIrcLine('324', [client.nick, channel, '+ntk', key]))
        }
        break
      }
      case 'PART': {
        const channel = msg.params[0]
        if (!channel) break
        client.channels.delete(channel.toLowerCase())
        this.send(client, `:${client.nick}!${client.user}@localhost PART ${channel}`)
        break
      }
      case 'TOPIC': {
        const channel = msg.params[0]
        const topic = msg.params[1]
        if (!channel) break
        if (topic !== undefined) {
          this.send(client, `:${client.nick}!${client.user}@localhost TOPIC ${channel} :${topic}`)
        } else {
          this.send(client, formatIrcLine('332', [client.nick, channel, 'Welcome to the mock channel']))
        }
        break
      }
      case 'WHOIS': {
        const nick = msg.params[0] ?? 'alice'
        this.send(
          client,
          formatIrcLine('311', [client.nick, nick, nick.toLowerCase(), 'localhost', '*', `${nick} user`])
        )
        this.send(client, formatIrcLine('319', [client.nick, nick, `@#lobby +#misstirc`]))
        this.send(client, formatIrcLine('312', [client.nick, nick, 'mock.misstirc.local', 'MockIRC']))
        this.send(client, formatIrcLine('317', [client.nick, nick, '42', 'seconds idle']))
        this.send(client, formatIrcLine('318', [client.nick, nick, 'End of /WHOIS list']))
        break
      }
      case 'KICK': {
        const channel = msg.params[0]
        const victim = msg.params[1]
        const reason = msg.params[2] ?? 'kicked'
        if (!channel || !victim) break
        this.send(
          client,
          `:${client.nick}!${client.user}@localhost KICK ${channel} ${victim} :${reason}`
        )
        break
      }
      case 'MODE': {
        const target = msg.params[0]
        const modes = msg.params[1]
        const arg = msg.params[2]
        if (!target || !modes) break
        this.send(
          client,
          `:${client.nick}!${client.user}@localhost MODE ${target} ${modes}${arg ? ` ${arg}` : ''}`
        )
        break
      }
      case 'PRIVMSG': {
        const target = msg.params[0]
        const text = msg.params[1] ?? ''
        if (!target) break
        // CTCP request → reply via NOTICE
        if (text.startsWith('\x01') && text.endsWith('\x01')) {
          const inner = text.slice(1, -1)
          const type = inner.split(' ')[0]?.toUpperCase() ?? ''
          if (type === 'VERSION') {
            this.send(client, `:mock!m@localhost NOTICE ${client.nick} :\x01VERSION MockIRC 1.0\x01`)
          } else if (type === 'PING') {
            this.send(client, `:mock!m@localhost NOTICE ${client.nick} :\x01${inner}\x01`)
          } else if (type === 'DCC') {
            // ignore client-originated
          }
          break
        }
        if (target.startsWith('#')) {
          this.send(client, `:alice!alice@localhost PRIVMSG ${target} :echo:${text}`)
        } else {
          this.send(client, `:${target}!user@localhost PRIVMSG ${client.nick} :pm-ack:${text}`)
        }
        break
      }
      case 'NOTICE':
        break
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
    this.send(
      client,
      formatIrcLine('005', [
        client.nick,
        'CHANTYPES=#',
        'PREFIX=(ohv)@%+',
        'NETWORK=MockIRC',
        'are supported by this server'
      ])
    )
    this.send(client, formatIrcLine('376', [client.nick, 'End of MOTD']))
    this.emit('registered', client.nick)
  }
}
