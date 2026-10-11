import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { matchesIgnore } from '../src/core/ignore'
import { ChatLogger, parseSearchQuery } from '../src/services/logging'

describe('ignore edge cases', () => {
  it('respects kind flags (notice-only)', () => {
    const rules = [
      { id: '1', mask: 'bot!*@*', enabled: true, privmsg: false, notice: true, ctcp: false }
    ]
    expect(
      matchesIgnore(rules, { nick: 'bot', user: 'u', host: 'h', kind: 'notice' })
    ).toBe(true)
    expect(
      matchesIgnore(rules, { nick: 'bot', user: 'u', host: 'h', kind: 'privmsg' })
    ).toBe(false)
  })

  it('channel-scoped rules skip PMs and other channels', () => {
    const rules = [
      { id: '1', mask: 'troll!*@*', enabled: true, channel: '#lobby', privmsg: true }
    ]
    expect(
      matchesIgnore(rules, {
        nick: 'troll',
        user: 'u',
        host: 'h',
        channel: '#lobby',
        kind: 'privmsg'
      })
    ).toBe(true)
    expect(
      matchesIgnore(rules, {
        nick: 'troll',
        user: 'u',
        host: 'h',
        channel: '#other',
        kind: 'privmsg'
      })
    ).toBe(false)
    expect(
      matchesIgnore(rules, { nick: 'troll', user: 'u', host: 'h', kind: 'privmsg' })
    ).toBe(false)
  })

  it('disabled rules never match', () => {
    const rules = [{ id: '1', mask: '*!*@*', enabled: false, privmsg: true }]
    expect(
      matchesIgnore(rules, { nick: 'x', user: 'u', host: 'h', kind: 'privmsg' })
    ).toBe(false)
  })
})

describe('log search query prefixes', () => {
  it('parses kind/target/nick prefixes', () => {
    expect(parseSearchQuery('kind:privmsg target:#lobby hello')).toEqual({
      text: 'hello',
      kind: 'privmsg',
      target: '#lobby',
      nick: undefined
    })
  })

  it('filters by kind: prefix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misst-search-'))
    const logger = new ChatLogger(dir)
    logger.append(
      {
        id: '1',
        connectionId: 'c',
        target: '#lobby',
        kind: 'privmsg',
        nick: 'alice',
        text: 'alpha unique',
        timestamp: 1000
      },
      'Net'
    )
    logger.append(
      {
        id: '2',
        connectionId: 'c',
        target: '*',
        kind: 'system',
        text: 'alpha system',
        timestamp: 2000
      },
      'Net'
    )
    const hits = logger.search('kind:privmsg alpha')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.nick).toBe('alice')
  })
})
