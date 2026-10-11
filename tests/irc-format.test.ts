import { describe, expect, it } from 'vitest'
import { parseIrcFormatting, stripIrcFormatting } from '../src/shared/irc-format'

describe('IRC formatting', () => {
  it('parses bold/italic/underline/color without HTML', () => {
    const spans = parseIrcFormatting('\x02bold\x02 \x1ditalic\x1d \x0312,01blue\x03')
    expect(spans.some((s) => s.bold && s.text === 'bold')).toBe(true)
    expect(spans.some((s) => s.italic && s.text === 'italic')).toBe(true)
    expect(spans.some((s) => s.fg === 12 && s.bg === 1 && s.text === 'blue')).toBe(true)
    expect(JSON.stringify(spans)).not.toMatch(/</)
  })

  it('strips codes for plain search text', () => {
    expect(stripIrcFormatting('\x02hi\x02')).toBe('hi')
  })
})
