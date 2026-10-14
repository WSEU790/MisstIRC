/** DCC CTCP argument parsers (SEND / RESUME / ACCEPT). */

export interface ParsedDccSend {
  kind: 'SEND'
  filename: string
  /** Raw address token (decimal IPv4 or hostname) */
  address: string
  port: number
  size?: number
}

export interface ParsedDccResume {
  kind: 'RESUME'
  filename: string
  port: number
  position: number
}

export interface ParsedDccAccept {
  kind: 'ACCEPT'
  filename: string
  port: number
  position: number
}

export type ParsedDcc = ParsedDccSend | ParsedDccResume | ParsedDccAccept

function takeFilename(rest: string): { filename: string; rest: string } | null {
  let r = rest.trim()
  if (!r) return null
  if (r.startsWith('"')) {
    const end = r.indexOf('"', 1)
    if (end === -1) return null
    return { filename: r.slice(1, end), rest: r.slice(end + 1).trim() }
  }
  const sp = r.indexOf(' ')
  if (sp === -1) return null
  return { filename: r.slice(0, sp), rest: r.slice(sp + 1).trim() }
}

/** Parse `DCC SEND filename addr port [size]` */
export function parseDccSendArgs(args: string): ParsedDccSend | null {
  const trimmed = args.trim()
  if (!trimmed.toUpperCase().startsWith('SEND')) return null
  const taken = takeFilename(trimmed.slice(4))
  if (!taken) return null
  const parts = taken.rest.split(/\s+/)
  if (parts.length < 2) return null
  const address = parts[0]!
  const port = Number(parts[1])
  const size = parts[2] !== undefined ? Number(parts[2]) : undefined
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null
  return {
    kind: 'SEND',
    filename: taken.filename,
    address,
    port,
    size: size !== undefined && Number.isFinite(size) ? size : undefined
  }
}

/** Parse `DCC RESUME filename port position` */
export function parseDccResumeArgs(args: string): ParsedDccResume | null {
  const trimmed = args.trim()
  if (!trimmed.toUpperCase().startsWith('RESUME')) return null
  const taken = takeFilename(trimmed.slice(6))
  if (!taken) return null
  const parts = taken.rest.split(/\s+/)
  if (parts.length < 2) return null
  const port = Number(parts[0])
  const position = Number(parts[1])
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null
  if (!Number.isFinite(position) || position < 0) return null
  return { kind: 'RESUME', filename: taken.filename, port, position }
}

/** Parse `DCC ACCEPT filename port position` */
export function parseDccAcceptArgs(args: string): ParsedDccAccept | null {
  const trimmed = args.trim()
  if (!trimmed.toUpperCase().startsWith('ACCEPT')) return null
  const taken = takeFilename(trimmed.slice(6))
  if (!taken) return null
  const parts = taken.rest.split(/\s+/)
  if (parts.length < 2) return null
  const port = Number(parts[0])
  const position = Number(parts[1])
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null
  if (!Number.isFinite(position) || position < 0) return null
  return { kind: 'ACCEPT', filename: taken.filename, port, position }
}

export function parseDccArgs(args: string): ParsedDcc | null {
  return parseDccSendArgs(args) ?? parseDccResumeArgs(args) ?? parseDccAcceptArgs(args)
}

/** Convert classic DCC unsigned 32-bit IP to dotted IPv4 when possible. */
export function dccAddressToHost(address: string): string {
  if (/^\d+$/.test(address)) {
    const n = Number(address) >>> 0
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  return address
}

export function ipv4ToDccNumber(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const octets = m.slice(1).map(Number)
  if (octets.some((o) => o > 255)) return null
  return (((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0)
}
