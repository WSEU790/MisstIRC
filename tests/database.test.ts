import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '../src/storage/database'
import { FileSecretStore } from '../src/storage/secrets'

describe('AppDatabase', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })

  it('seeds Libera.Chat on first open (no auto-connect, no secrets)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-db-'))
    dirs.push(dir)
    const path = join(dir, 'test.sqlite')
    const db = new AppDatabase(path)
    const list = db.listNetworks()
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('Libera.Chat')
    expect(list[0]?.host).toBe('irc.libera.chat')
    expect(list[0]?.port).toBe(6697)
    expect(list[0]?.tls).toBe(true)
    expect(list[0]?.rejectUnauthorized).toBe(true)
    expect(list[0]?.autoConnect).toBe(false)
    expect(list[0]?.hasPassword).toBe(false)
    expect(list[0]?.channels).toEqual([])
    db.close()
  })

  it('does not re-seed when networks already exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-db-'))
    dirs.push(dir)
    const path = join(dir, 'test.sqlite')
    const db = new AppDatabase(path)
    expect(db.listNetworks()).toHaveLength(1)
    db.saveNetwork({
      id: 'n1',
      name: 'Custom',
      host: 'irc.example.test',
      port: 6697,
      tls: true,
      rejectUnauthorized: true,
      nick: 'Misst',
      username: 'misst',
      realname: 'MisstIRC',
      channels: [],
      autoConnect: false,
      hasPassword: false
    })
    db.close()

    const db2 = new AppDatabase(path)
    const list = db2.listNetworks()
    expect(list).toHaveLength(2)
    expect(list.some((n) => n.host === 'irc.libera.chat')).toBe(true)
    expect(list.some((n) => n.host === 'irc.example.test')).toBe(true)
    db2.close()
  })

  it('persists networks across open/close', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-db-'))
    dirs.push(dir)
    const path = join(dir, 'test.sqlite')
    const db = new AppDatabase(path)
    // First open seeds Libera; replace with a single custom network for this test
    for (const n of db.listNetworks()) db.deleteNetwork(n.id)
    db.saveNetwork({
      id: 'n1',
      name: 'Libera',
      host: 'irc.libera.chat',
      port: 6697,
      tls: true,
      rejectUnauthorized: true,
      nick: 'Misst',
      username: 'misst',
      realname: 'MisstIRC',
      channels: ['#misstirc'],
      hasPassword: true
    })
    db.close()

    const db2 = new AppDatabase(path)
    const list = db2.listNetworks()
    expect(list).toHaveLength(1)
    expect(list[0]?.host).toBe('irc.libera.chat')
    expect(list[0]?.hasPassword).toBe(true)
    db2.close()
  })
})

describe('FileSecretStore', () => {
  it('round-trips secrets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-sec-'))
    const store = new FileSecretStore(dir)
    await store.set('MisstIRC', 'acct', 'p@ss')
    expect(await store.get('MisstIRC', 'acct')).toBe('p@ss')
    await store.delete('MisstIRC', 'acct')
    expect(await store.get('MisstIRC', 'acct')).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })
})
