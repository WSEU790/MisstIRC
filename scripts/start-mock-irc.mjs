/**
 * Standalone mock IRC for local UI smoke (not for production).
 * Usage: node --import ./scripts/register-ts.mjs scripts/start-mock-irc.mjs
 * Or: npx vite-node scripts/start-mock-irc.ts
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { EventEmitter } from 'node:events'

// Minimal inline mock to avoid TS loader issues in smoke scripts.
// Mirrors MockIrcServer registration for a single client.

class SmokeMockIrc extends EventEmitter {
  constructor(port = 16667) {
    super()
    this.port = port
    this.server = null
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.onConn(socket))
      this.server.once('error', reject)
      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`MOCK_IRC listening on 127.0.0.1:${this.port}`)
        resolve(this.port)
      })
    })
  }

  onConn(socket) {
    let nick = 'guest'
    let registered = false
    let buf = ''
    const send = (line) => socket.write(line + '\r\n')

    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      let idx
      while ((idx = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, idx)
        buf = buf.slice(idx + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        handle(line)
      }
    })

    const handle = (line) => {
      if (!line) return
      const upper = line.toUpperCase()
      if (upper.startsWith('CAP LS')) {
        send(':mock CAP * LS :sasl multi-prefix server-time')
        send(':mock CAP * LS :')
        return
      }
      if (upper.startsWith('CAP REQ')) {
        send(':mock CAP * ACK :multi-prefix server-time')
        return
      }
      if (upper.startsWith('CAP END') || upper.startsWith('NICK ')) {
        if (upper.startsWith('NICK ')) nick = line.split(/\s+/)[1] || nick
      }
      if (upper.startsWith('USER ') || upper.startsWith('NICK ')) {
        if (!registered && nick) {
          // wait for both — fire on USER
        }
      }
      if (upper.startsWith('USER ')) {
        registered = true
        send(`:mock 001 ${nick} :Welcome to MisstIRC mock`)
        send(`:mock 002 ${nick} :Your host is mock`)
        send(`:mock 003 ${nick} :This server was created for smoke tests`)
        send(`:mock 004 ${nick} mock MisstIRC-mock o o`)
        send(`:mock 005 ${nick} NETWORK=MisstSmoke CHANTYPES=# PREFIX=(ov)@+ :are supported`)
        send(`:mock 376 ${nick} :End of MOTD`)
        return
      }
      if (upper.startsWith('PING ')) {
        send('PONG ' + line.slice(5))
        return
      }
      if (upper.startsWith('JOIN ')) {
        const chan = line.split(/\s+/)[1]
        send(`:${nick}!u@localhost JOIN ${chan}`)
        send(`:mock 353 ${nick} = ${chan} :@${nick} alice bob`)
        send(`:mock 366 ${nick} ${chan} :End of NAMES`)
        send(`:alice!a@localhost PRIVMSG ${chan} :hello from mock`)
        return
      }
      if (upper.startsWith('PRIVMSG ')) {
        const rest = line.slice(8)
        const sp = rest.indexOf(' :')
        const target = sp === -1 ? rest.split(' ')[0] : rest.slice(0, sp)
        const text = sp === -1 ? '' : rest.slice(sp + 2)
        send(`:${nick}!u@localhost PRIVMSG ${target} :${text}`)
        return
      }
      if (upper.startsWith('QUIT')) {
        socket.end()
      }
    }
  }
}

const port = Number(process.env.MOCK_IRC_PORT || 16667)
const s = new SmokeMockIrc(port)
await s.start()
await new Promise(() => {})
