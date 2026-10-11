import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ChatLogger, redactForLog } from '../src/services/logging'

describe('log redaction', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
  })

  it('drops PASS / AUTHENTICATE / identify lines', () => {
    expect(redactForLog('PASS s3cret')).toBeNull()
    expect(redactForLog('AUTHENTICATE ABCDEF')).toBeNull()
    expect(redactForLog('PRIVMSG NickServ :IDENTIFY hunter2')).toBeNull()
  })

  it('redacts password= values in ordinary text', () => {
    expect(redactForLog('failed password=hunter2 ok')).toContain('[redacted]')
  })

  it('searches logged messages without secrets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misstirc-log-'))
    dirs.push(dir)
    const logger = new ChatLogger(dir)
    logger.append(
      {
        id: '1',
        connectionId: 'c1',
        target: '#lobby',
        kind: 'privmsg',
        nick: 'alice',
        text: 'hello searchable',
        timestamp: Date.now()
      },
      'MockNet'
    )
    logger.append(
      {
        id: '2',
        connectionId: 'c1',
        target: '*',
        kind: 'system',
        text: 'PASS should-not-log',
        timestamp: Date.now()
      },
      'MockNet'
    )
    const hits = logger.search('searchable')
    expect(hits.some((h) => h.text.includes('hello'))).toBe(true)
    expect(logger.search('should-not-log')).toHaveLength(0)
  })
})
