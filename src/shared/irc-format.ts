/**
 * Parse mIRC/IRC formatting codes into styled text spans.
 * Safe for React: never produces HTML — consumers render plain text + CSS classes.
 */

export interface FormatSpan {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  reverse?: boolean
  fg?: number
  bg?: number
}

const COLOR = 0x03
const BOLD = 0x02
const ITALIC = 0x1d
const UNDERLINE = 0x1f
const STRIKE = 0x1e
const REVERSE = 0x16
const RESET = 0x0f

function readColorNum(input: string, start: number): { value?: number; next: number } {
  let i = start
  let digits = ''
  while (i < input.length && digits.length < 2 && input[i]! >= '0' && input[i]! <= '9') {
    digits += input[i]
    i += 1
  }
  if (!digits) return { next: start }
  return { value: Number(digits), next: i }
}

export function parseIrcFormatting(input: string): FormatSpan[] {
  const spans: FormatSpan[] = []
  let buf = ''
  let bold = false
  let italic = false
  let underline = false
  let strikethrough = false
  let reverse = false
  let fg: number | undefined
  let bg: number | undefined

  const flush = (): void => {
    if (!buf) return
    spans.push({
      text: buf,
      bold: bold || undefined,
      italic: italic || undefined,
      underline: underline || undefined,
      strikethrough: strikethrough || undefined,
      reverse: reverse || undefined,
      fg,
      bg
    })
    buf = ''
  }

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code === BOLD) {
      flush()
      bold = !bold
    } else if (code === ITALIC) {
      flush()
      italic = !italic
    } else if (code === UNDERLINE) {
      flush()
      underline = !underline
    } else if (code === STRIKE) {
      flush()
      strikethrough = !strikethrough
    } else if (code === REVERSE) {
      flush()
      reverse = !reverse
    } else if (code === RESET) {
      flush()
      bold = italic = underline = strikethrough = reverse = false
      fg = bg = undefined
    } else if (code === COLOR) {
      flush()
      const first = readColorNum(input, i + 1)
      if (first.value === undefined) {
        fg = undefined
        bg = undefined
        i = first.next - 1
      } else {
        fg = first.value
        i = first.next - 1
        if (input[first.next] === ',') {
          const second = readColorNum(input, first.next + 1)
          bg = second.value
          i = second.next - 1
        }
      }
    } else {
      buf += input[i]
    }
  }
  flush()
  return spans.length ? spans : [{ text: input }]
}

/** Strip formatting codes for search/logs previews. */
export function stripIrcFormatting(input: string): string {
  return parseIrcFormatting(input)
    .map((s) => s.text)
    .join('')
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi

export function splitUrls(text: string): Array<{ type: 'text' | 'url'; value: string }> {
  const parts: Array<{ type: 'text' | 'url'; value: string }> = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const idx = match.index ?? 0
    if (idx > last) parts.push({ type: 'text', value: text.slice(last, idx) })
    parts.push({ type: 'url', value: match[0]! })
    last = idx + match[0]!.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts.length ? parts : [{ type: 'text', value: text }]
}
