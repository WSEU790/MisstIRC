import { describe, expect, it } from 'vitest'
import {
  applyNickMode,
  isOpLike,
  parseChannelEntry,
  parsePrefixedNick
} from '../src/core/prefixes'

describe('prefixes', () => {
  it('parses multi-prefix nicks', () => {
    expect(parsePrefixedNick('@+alice')).toEqual({ modes: '@+', nick: 'alice' })
  })

  it('applies mode changes', () => {
    expect(applyNickMode('', true, 'o')).toBe('@')
    expect(applyNickMode('@', true, 'v')).toBe('@+')
    expect(applyNickMode('@+', false, 'o')).toBe('+')
    expect(isOpLike('@')).toBe(true)
    expect(isOpLike('+')).toBe(false)
  })

  it('parses channel entries with keys', () => {
    expect(parseChannelEntry('#lobby')).toEqual({ channel: '#lobby' })
    expect(parseChannelEntry('#private secret')).toEqual({
      channel: '#private',
      key: 'secret'
    })
  })
})
