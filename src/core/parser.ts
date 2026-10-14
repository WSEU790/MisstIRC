export interface ParsedIrcMessage {
  raw: string
  tags: Record<string, string>
  source: string | null
  nick: string | null
  user: string | null
  host: string | null
  command: string
  params: string[]
}

function parseTags(tagStr: string): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const part of tagStr.split(';')) {
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq === -1) {
      tags[part] = ''
    } else {
      const key = part.slice(0, eq)
      const value = part
        .slice(eq + 1)
        .replace(/\\:/g, ';')
        .replace(/\\s/g, ' ')
        .replace(/\\\\/g, '\\')
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n')
      tags[key] = value
    }
  }
  return tags
}

function parseSource(source: string): Pick<ParsedIrcMessage, 'source' | 'nick' | 'user' | 'host'> {
  const bang = source.indexOf('!')
  const at = source.indexOf('@')
  if (bang === -1) {
    return { source, nick: source, user: null, host: at === -1 ? null : source.slice(at + 1) }
  }
  const nick = source.slice(0, bang)
  const user = at === -1 ? source.slice(bang + 1) : source.slice(bang + 1, at)
  const host = at === -1 ? null : source.slice(at + 1)
  return { source, nick, user, host }
}

/** Parse a single IRC protocol line (without trailing CRLF). */
export function parseIrcLine(line: string): ParsedIrcMessage {
  let rest = line
  let tags: Record<string, string> = {}
  let source: string | null = null
  let nick: string | null = null
  let user: string | null = null
  let host: string | null = null

  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ')
    if (space === -1) {
      throw new Error('Malformed IRC line: tags without command')
    }
    tags = parseTags(rest.slice(1, space))
    rest = rest.slice(space + 1)
  }

  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ')
    if (space === -1) {
      throw new Error('Malformed IRC line: source without command')
    }
    const parsed = parseSource(rest.slice(1, space))
    source = parsed.source
    nick = parsed.nick
    user = parsed.user
    host = parsed.host
    rest = rest.slice(space + 1)
  }

  rest = rest.trimStart()
  const trailingIdx = rest.indexOf(' :')
  let commandPart: string
  let trailing: string | null = null
  if (trailingIdx !== -1) {
    commandPart = rest.slice(0, trailingIdx)
    trailing = rest.slice(trailingIdx + 2)
  } else if (rest.startsWith(':')) {
    commandPart = ''
    trailing = rest.slice(1)
  } else {
    commandPart = rest
  }

  const tokens = commandPart.split(/ +/).filter(Boolean)
  if (tokens.length === 0 && trailing === null) {
    throw new Error('Malformed IRC line: empty')
  }

  const command = (tokens.shift() ?? '').toUpperCase()
  const params = [...tokens]
  if (trailing !== null) params.push(trailing)

  return { raw: line, tags, source, nick, user, host, command, params }
}

export function formatIrcLine(command: string, params: string[] = []): string {
  if (params.length === 0) return command
  const head = params.slice(0, -1)
  const last = params[params.length - 1]!
  const needsColon = last.includes(' ') || last.startsWith(':') || last === '' || last.includes('\x01')
  const parts = [command, ...head]
  if (needsColon) parts.push(`:${last}`)
  else parts.push(last)
  return parts.join(' ')
}
