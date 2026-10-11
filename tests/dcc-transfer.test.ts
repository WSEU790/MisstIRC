import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DccManager,
  defaultTestDownloadDir,
  parseDccAcceptArgs,
  parseDccResumeArgs,
  parseDccSendArgs,
  dccAddressToHost,
  ipv4ToDccNumber,
  startMockDccSend,
  DCC_MAX_QUEUE
} from '../src/dcc'

describe('DCC parsers', () => {
  it('parses SEND / RESUME / ACCEPT including quoted names', () => {
    const send = parseDccSendArgs('SEND "my file.txt" 2130706433 4000 12')
    expect(send).toMatchObject({
      kind: 'SEND',
      filename: 'my file.txt',
      address: '2130706433',
      port: 4000,
      size: 12
    })
    expect(dccAddressToHost('2130706433')).toBe('127.0.0.1')
    expect(ipv4ToDccNumber('127.0.0.1')).toBe(2130706433)

    expect(parseDccResumeArgs('RESUME "my file.txt" 4000 4')).toMatchObject({
      kind: 'RESUME',
      filename: 'my file.txt',
      port: 4000,
      position: 4
    })
    expect(parseDccAcceptArgs('ACCEPT my.txt 4000 4')).toMatchObject({
      kind: 'ACCEPT',
      filename: 'my.txt',
      port: 4000,
      position: 4
    })
  })
})

describe('DCC SEND receive (mock peer)', () => {
  const dirs: string[] = []
  const closes: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (closes.length) {
      const c = closes.pop()
      if (c) await c()
    }
  })

  function downloadDir(): string {
    const base = mkdtempSync(join(tmpdir(), 'misstirc-dcc-'))
    dirs.push(base)
    return defaultTestDownloadDir(base)
  }

  it('receives a full SEND transfer with progress and saves without executing', async () => {
    const payload = Buffer.from('hello-dcc-world')
    const mock = await startMockDccSend({ data: payload })
    closes.push(mock.close)

    const mgr = new DccManager(downloadDir())
    const offer = mgr.ingestCtcp(
      'c1',
      'eve',
      `SEND hello.txt ${mock.dccAddress} ${mock.port} ${payload.length}`
    )
    expect(offer?.status).toBe('pending')

    const updates: string[] = []
    mgr.on('update', (o) => updates.push(o.status))

    const done = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('transfer timeout')), 5000)
      mgr.on('update', (o) => {
        if (o.status === 'completed') {
          clearTimeout(t)
          resolve()
        }
        if (o.status === 'failed') {
          clearTimeout(t)
          reject(new Error(o.note))
        }
      })
    })

    const accepted = mgr.respond(offer!.id, true)
    expect(accepted?.status).toBe('transferring')
    await done
    await mock.done

    const final = mgr.list().find((o) => o.id === offer!.id)!
    expect(final.status).toBe('completed')
    expect(final.bytesReceived).toBe(payload.length)
    expect(final.localPath).toBeTruthy()
    expect(existsSync(final.localPath!)).toBe(true)
    expect(readFileSync(final.localPath!)).toEqual(payload)
    expect(final.note.toLowerCase()).toMatch(/not executed/)
    expect(updates).toContain('transferring')
    expect(updates).toContain('completed')
  })

  it('cancels an in-flight transfer', async () => {
    const payload = Buffer.alloc(64 * 1024, 0x61)
    const mock = await startMockDccSend({ data: payload, holdOnly: true })
    closes.push(mock.close)

    const mgr = new DccManager(downloadDir())
    const offer = mgr.ingestCtcp(
      'c1',
      'eve',
      `SEND big.bin ${mock.dccAddress} ${mock.port} ${payload.length}`
    )!

    const started = new Promise<void>((resolve) => {
      mgr.on('update', (o) => {
        if (o.status === 'transferring') resolve()
      })
    })
    mgr.respond(offer.id, true)
    await started

    const cancelled = mgr.cancel(offer.id)
    expect(cancelled?.status).toBe('cancelled')
  })

  it('RESUME + ACCEPT continues from a partial file', async () => {
    const payload = Buffer.from('ABCDEFGHIJKLMNOP')
    const resumeFrom = 6
    const mock = await startMockDccSend({ data: payload, resumeFrom })
    closes.push(mock.close)

    const dir = downloadDir()
    const mgr = new DccManager(dir)
    // Pre-seed partial download
    writeFileSync(join(dir, 'part.txt'), payload.subarray(0, resumeFrom))

    const offer = mgr.ingestCtcp(
      'c1',
      'eve',
      `SEND part.txt ${mock.dccAddress} ${mock.port} ${payload.length}`
    )!

    const accepted = mgr.respond(offer.id, true)
    expect(accepted?.status).toBe('accepted')
    expect(accepted?.bytesReceived).toBe(resumeFrom)

    const outbound = mgr.takeOutbound()
    expect(outbound).toHaveLength(1)
    expect(outbound[0]!.ctcp).toMatch(/^RESUME part\.txt /)
    expect(outbound[0]!.ctcp).toContain(` ${mock.port} ${resumeFrom}`)

    const done = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('resume timeout')), 5000)
      mgr.on('update', (o) => {
        if (o.id === offer.id && o.status === 'completed') {
          clearTimeout(t)
          resolve()
        }
        if (o.id === offer.id && o.status === 'failed') {
          clearTimeout(t)
          reject(new Error(o.note))
        }
      })
    })

    // Peer ACCEPT — manager starts transfer at resume position
    mgr.ingestCtcp('c1', 'eve', `ACCEPT part.txt ${mock.port} ${resumeFrom}`)
    await done

    const final = mgr.list().find((o) => o.id === offer.id)!
    expect(final.status).toBe('completed')
    expect(readFileSync(final.localPath!)).toEqual(payload)
  })

  it('force receive starts without peer ACCEPT', async () => {
    const payload = Buffer.from('force-me')
    const resumeFrom = 2
    const mock = await startMockDccSend({ data: payload, resumeFrom })
    closes.push(mock.close)

    const dir = downloadDir()
    const mgr = new DccManager(dir)
    writeFileSync(join(dir, 'f2.txt'), payload.subarray(0, resumeFrom))

    const offer = mgr.ingestCtcp(
      'c1',
      'eve',
      `SEND f2.txt ${mock.dccAddress} ${mock.port} ${payload.length}`
    )!
    mgr.respond(offer.id, true)
    expect(mgr.list()[0]?.status).toBe('accepted')
    expect(mgr.takeOutbound()).toHaveLength(1)

    const done = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('force timeout')), 5000)
      mgr.on('update', (o) => {
        if (o.id === offer.id && o.status === 'completed') {
          clearTimeout(t)
          resolve()
        }
        if (o.id === offer.id && o.status === 'failed') {
          clearTimeout(t)
          reject(new Error(o.note))
        }
      })
    })
    mgr.startTransferDirect(offer.id)
    await done
    expect(readFileSync(join(dir, 'f2.txt'))).toEqual(payload)
  })

  it('rejects unsafe names and enforces queue cap', () => {
    const mgr = new DccManager(downloadDir())
    const bad = mgr.ingestCtcp('c1', 'eve', 'SEND .. 1 2 3')
    expect(bad?.status).toBe('blocked')

    for (let i = 0; i < DCC_MAX_QUEUE; i++) {
      const o = mgr.ingestCtcp('c1', 'eve', `SEND q${i}.txt 2130706433 ${4000 + i} 1`)
      expect(o?.status).toBe('pending')
    }
    const overflow = mgr.ingestCtcp('c1', 'eve', 'SEND overflow.txt 2130706433 4999 1')
    expect(overflow?.status).toBe('blocked')
    expect(overflow?.note).toMatch(/queue full/i)
  })

  it('user reject leaves offer rejected', () => {
    const mgr = new DccManager(downloadDir())
    const offer = mgr.ingestCtcp('c1', 'eve', 'SEND x.txt 2130706433 9 1')!
    expect(mgr.respond(offer.id, false)?.status).toBe('rejected')
  })
})
