/** IRC nick prefixes commonly used with multi-prefix / NAMES. */
const PREFIX_CHARS = new Set(['~', '&', '@', '%', '+'])

export function parsePrefixedNick(token: string): { modes: string; nick: string } {
  let i = 0
  while (i < token.length && PREFIX_CHARS.has(token[i]!)) i += 1
  return { modes: token.slice(0, i), nick: token.slice(i) }
}

export function modeCharFromPrefix(prefix: string): string {
  switch (prefix) {
    case '~':
      return 'q'
    case '&':
      return 'a'
    case '@':
      return 'o'
    case '%':
      return 'h'
    case '+':
      return 'v'
    default:
      return ''
  }
}

export function prefixFromMode(mode: string): string {
  switch (mode) {
    case 'q':
      return '~'
    case 'a':
      return '&'
    case 'o':
      return '@'
    case 'h':
      return '%'
    case 'v':
      return '+'
    default:
      return ''
  }
}

/** Keep prefixes in conventional order: ~ & @ % + */
export function sortPrefixes(modes: string): string {
  const order = ['~', '&', '@', '%', '+']
  return order.filter((p) => modes.includes(p)).join('')
}

export function applyNickMode(current: string, add: boolean, mode: string): string {
  const prefix = prefixFromMode(mode)
  if (!prefix) return current
  if (add) return sortPrefixes(current.includes(prefix) ? current : current + prefix)
  return sortPrefixes(current.replaceAll(prefix, ''))
}

export function isOpLike(modes: string): boolean {
  return /[~&@%]/.test(modes)
}

/** Parse auto-join entry: `#chan` or `#chan key`. */
export function parseChannelEntry(entry: string): { channel: string; key?: string } {
  const trimmed = entry.trim()
  if (!trimmed) return { channel: '' }
  const sp = trimmed.indexOf(' ')
  if (sp === -1) return { channel: trimmed }
  return { channel: trimmed.slice(0, sp), key: trimmed.slice(sp + 1).trim() || undefined }
}
