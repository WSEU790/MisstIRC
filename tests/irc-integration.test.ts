import { afterEach, describe, expect, it } from 'vitest'
import { IrcConnection } from '../src/core/connection'
import { MockIrcServer } from '../src/mock-irc/server'

describe('IRC connection against mock server', () => {
  let server: MockIrcServer

  afterEach(async () => {
    await server?.stop()
  })

  it('registers, joins, and exchanges PRIVMSG', async () => {
    server = new MockIrcServer()
    const port = await server.start()

    const conn = new IrcConnection({
      network: {
        id: 'test-net',
        name: 'Mock',
        host: '127.0.0.1',
        port,
        tls: false,
        rejectUnauthorized: true,
        nick: 'Tester',
        username: 'tester',
        realname: 'Test User',
        channels: ['#lobby']
      }
    })

    const registered = new Promise<void>((resolve) => conn.on('registered', () => resolve()))
    const echo = new Promise<string>((resolve) => {
      conn.on('message', (msg) => {
        if (msg.command === 'PRIVMSG' && msg.nick === 'alice') {
          resolve(msg.params[1] ?? '')
        }
      })
    })

    await conn.connect()
    await registered

    // Wait briefly for auto-join NAMES
    await new Promise((r) => setTimeout(r, 50))
    expect(conn.channels.has('#lobby')).toBe(true)

    conn.privmsg('#lobby', 'ping-test')
    const text = await echo
    expect(text).toBe('echo:ping-test')

    conn.disconnect()
  })

  it('reconnects after a server drop', async () => {
    server = new MockIrcServer()
    const port = await server.start()

    const conn = new IrcConnection({
      network: {
        id: 'reconnect-net',
        name: 'Reconnect Mock',
        host: '127.0.0.1',
        port,
        tls: false,
        rejectUnauthorized: true,
        nick: 'Rejoin',
        username: 'rejoin',
        realname: 'Rejoin User',
        channels: []
      }
    })

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('initial register timeout')), 5000)
      conn.on('registered', () => {
        clearTimeout(t)
        resolve()
      })
      void conn.connect()
    })

    const reRegistered = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reconnect register timeout')), 8000)
      let sawReconnect = false
      conn.on('state', (state) => {
        if (state === 'reconnecting') sawReconnect = true
      })
      conn.on('registered', () => {
        if (sawReconnect) {
          clearTimeout(t)
          resolve()
        }
      })
    })

    server.dropAllClients()

    await reRegistered
    expect(conn.state).toBe('connected')
    conn.disconnect()
  })

  it('completes SASL PLAIN when password provided', async () => {
    server = new MockIrcServer({ requireSasl: true })
    const port = await server.start()

    const conn = new IrcConnection({
      network: {
        id: 'sasl-net',
        name: 'SASL Mock',
        host: '127.0.0.1',
        port,
        tls: false,
        rejectUnauthorized: true,
        nick: 'Secure',
        username: 'secure',
        realname: 'Secure User',
        channels: []
      },
      saslPassword: 's3cret'
    })

    const registered = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('SASL registration timeout')), 5000)
      conn.on('registered', () => {
        clearTimeout(t)
        resolve()
      })
    })

    await conn.connect()
    await registered
    expect(conn.state).toBe('connected')
    conn.disconnect()
  })
})
