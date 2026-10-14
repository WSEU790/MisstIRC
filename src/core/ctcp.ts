export interface CtcpMessage {
  type: string
  args: string
  raw: string
}

/** Parse CTCP payload from PRIVMSG/NOTICE text (`\x01TYPE args\x01`). */
export function parseCtcp(text: string): CtcpMessage | null {
  if (!text.startsWith('\x01') || !text.endsWith('\x01') || text.length < 3) return null
  const inner = text.slice(1, -1)
  const sp = inner.indexOf(' ')
  if (sp === -1) return { type: inner.toUpperCase(), args: '', raw: text }
  return {
    type: inner.slice(0, sp).toUpperCase(),
    args: inner.slice(sp + 1),
    raw: text
  }
}

export function formatCtcp(type: string, args = ''): string {
  return args ? `\x01${type} ${args}\x01` : `\x01${type}\x01`
}

export class CtcpFloodGuard {
  private stamps: number[] = []

  constructor(private readonly limit: number, private readonly windowMs = 10_000) {}

  /** Returns true if a reply is allowed. */
  allow(): boolean {
    const now = Date.now()
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs)
    if (this.stamps.length >= this.limit) return false
    this.stamps.push(now)
    return true
  }
}

export function buildVersionReply(): string {
  return formatCtcp('VERSION', 'MisstIRC 0.2.0 — Electron IRC client')
}

export function buildTimeReply(date = new Date()): string {
  return formatCtcp('TIME', date.toUTCString())
}

export function buildPingReply(token: string): string {
  return formatCtcp('PING', token)
}
