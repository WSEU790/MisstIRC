import { describe, expect, it } from 'vitest'
import { formatIrcLine, parseIrcLine } from '../src/core/parser'

describe('parseIrcLine', () => {
  it('parses simple PRIVMSG', () => {
    const msg = parseIrcLine(':nick!user@host PRIVMSG #chan :hello world')
    expect(msg.nick).toBe('nick')
    expect(msg.user).toBe('user')
    expect(msg.host).toBe('host')
    expect(msg.command).toBe('PRIVMSG')
    expect(msg.params).toEqual(['#chan', 'hello world'])
  })

  it('parses IRCv3 tags and server-time', () => {
    const msg = parseIrcLine(
      '@time=2024-01-01T00:00:00.000Z;msgid=abc :nick!u@h NOTICE nick :hi'
    )
    expect(msg.tags.time).toBe('2024-01-01T00:00:00.000Z')
    expect(msg.tags.msgid).toBe('abc')
    expect(msg.command).toBe('NOTICE')
    expect(msg.params).toEqual(['nick', 'hi'])
  })

  it('parses numeric replies', () => {
    const msg = parseIrcLine(':irc.example.com 001 mynick :Welcome')
    expect(msg.command).toBe('001')
    expect(msg.params).toEqual(['mynick', 'Welcome'])
  })

  it('handles empty trailing', () => {
    const msg = parseIrcLine('PRIVMSG #chan :')
    expect(msg.params).toEqual(['#chan', ''])
  })

  it('throws on empty line content after trim of structure', () => {
    expect(() => parseIrcLine('')).toThrow()
  })
})

describe('formatIrcLine', () => {
  it('colon-escapes trailing with spaces', () => {
    expect(formatIrcLine('PRIVMSG', ['#chan', 'hello there'])).toBe(
      'PRIVMSG #chan :hello there'
    )
  })

  it('omits colon when unnecessary', () => {
    expect(formatIrcLine('JOIN', ['#chan'])).toBe('JOIN #chan')
  })
})
