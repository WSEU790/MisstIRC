import { afterEach, describe, expect, it } from 'vitest'
import { IrcConnection } from '../src/core/connection'
import { ConnectionManager } from '../src/core/manager'
import { MockIrcServer } from '../src/mock-irc/server'

describe('Phase 3 daily IRC flows', () => {
  let server: MockIrcServer

  afterEach(async () => {
    await server?.stop()
  })

  async function connected(): Promise<IrcConnection> {
    server = new MockIrcServer()
    const port = await server.start()
    const conn = new IrcConnection({
      network: {
        id: 'p3',
        name: 'P3',
        host: '127.0.0.1',
        port,
        tls: false,
        rejectUnauthorized: true,
        nick: 'OpUser',
        username: 'opuser',
        realname: 'Op User',
        channels: ['#lobby']
      }
    })
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('register timeout')), 5000)
      conn.on('registered', () => {
        clearTimeout(t)
        resolve()
      })
      void conn.connect()
    })
    await new Promise((r) => setTimeout(r, 40))
    return conn
  }

  it('tracks ops/voice from NAMES', async () => {
    const conn = await connected()
    const ch = conn.channels.get('#lobby')
    expect(ch).toBeTruthy()
    expect(ch!.nicks.get('opuser')?.modes).toContain('@')
    expect(ch!.nicks.get('alice')?.modes).toContain('+')
    expect(ch!.nicks.get('bob')?.modes).toBe('')
    expect(conn.selfIsOp('#lobby')).toBe(true)
    conn.disconnect()
  })

  it('WHOIS returns structured info', async () => {
    const conn = await connected()
    const whois = new Promise((resolve) => conn.on('whois', resolve))
    conn.whois('alice')
    const info = (await whois) as { nick: string; user?: string; channels?: string }
    expect(info.nick).toBe('alice')
    expect(info.user).toBe('alice')
    expect(info.channels).toContain('#lobby')
    conn.disconnect()
  })

  it('topic and kick round-trip on mock server', async () => {
    const conn = await connected()
    const topic = new Promise<string>((resolve) => {
      conn.on('message', (msg) => {
        if (msg.command === 'TOPIC') resolve(msg.params[1] ?? '')
      })
    })
    conn.topic('#lobby', 'new topic')
    expect(await topic).toBe('new topic')

    const kick = new Promise<string>((resolve) => {
      conn.on('message', (msg) => {
        if (msg.command === 'KICK') resolve(msg.params[1] ?? '')
      })
    })
    conn.kick('#lobby', 'bob', 'bye')
    expect(await kick).toBe('bob')
    conn.disconnect()
  })

  it('manager increments unread for inactive buffers', async () => {
    const conn = await connected()
    const manager = new ConnectionManager()
    manager.attach(conn)
    manager.setActiveBuffer(`${conn.id}:*`)

    const unreadReady = new Promise<void>((resolve) => {
      manager.on('state', (snap: { connections: Array<{ buffers: Array<{ name: string; unread?: number }> }> }) => {
        const buf = snap.connections[0]?.buffers.find((b) => b.name === '#lobby')
        if (buf && (buf.unread ?? 0) > 0) resolve()
      })
    })

    conn.privmsg('#lobby', 'ping-unread')
    await unreadReady
    const snap = manager.getSnapshot()
    const lobby = snap.connections[0]?.buffers.find((b) => b.name === '#lobby')
    expect((lobby?.unread ?? 0) > 0).toBe(true)

    manager.setActiveBuffer(`${conn.id}:#lobby`)
    expect(
      manager.getSnapshot().connections[0]?.buffers.find((b) => b.name === '#lobby')?.unread
    ).toBe(0)
    manager.disconnect(conn.id)
  })
})
