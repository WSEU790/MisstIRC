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

  it('persists networks across open/close', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-db-'))
    dirs.push(dir)
    const path = join(dir, 'test.sqlite')
    const db = new AppDatabase(path)
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
