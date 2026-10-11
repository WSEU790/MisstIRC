import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IrcMessageView, LogSearchHit, MessageKind } from '../shared/types'

const SECRETISH =
  /\b(PASS|AUTHENTICATE|IDENTIFY|PRIVMSG\s+NickServ\s+:IDENTIFY|NS\s+IDENTIFY|LOGIN)\b/i

/** Strip or redact credential-bearing content before persistence. */
export function redactForLog(text: string): string | null {
  if (SECRETISH.test(text)) return null
  // Drop obvious base64 auth payloads on their own line
  if (/^[A-Za-z0-9+/=]{20,}$/.test(text.trim()) && text.includes('\0')) return null
  return text.replace(/(password|passwd|passphrase)\s*[:=]\s*\S+/gi, '$1=[redacted]')
}

export class ChatLogger {
  private readonly dir: string
  private readonly memory: LogSearchHit[] = []
  private seq = 0

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  append(view: IrcMessageView, networkName: string): void {
    const safe = redactForLog(view.text)
    if (safe === null) return

    const hit: LogSearchHit = {
      id: `log-${++this.seq}`,
      connectionId: view.connectionId,
      networkName,
      target: view.target,
      nick: view.nick,
      text: safe,
      timestamp: view.timestamp,
      kind: view.kind
    }
    this.memory.push(hit)
    if (this.memory.length > 5000) this.memory.splice(0, this.memory.length - 5000)

    const day = new Date(view.timestamp).toISOString().slice(0, 10)
    const file = join(this.dir, `${sanitize(networkName)}_${day}.log`)
    const line = JSON.stringify({
      t: view.timestamp,
      target: view.target,
      nick: view.nick ?? '',
      kind: view.kind,
      text: safe
    })
    appendFileSync(file, `${line}\n`, 'utf8')
  }

  search(query: string, limit = 50): LogSearchHit[] {
    const parsed = parseSearchQuery(query)
    if (!parsed.text && !parsed.kind && !parsed.target && !parsed.nick) return []

    const fromMemory = this.memory.filter((h) => matchesParsed(h, parsed))
    // Newest first for UI polish
    fromMemory.sort((a, b) => b.timestamp - a.timestamp)
    if (fromMemory.length >= limit) return fromMemory.slice(0, limit)

    const fromDisk = this.searchDisk(parsed, limit - fromMemory.length)
    const seen = new Set(fromMemory.map((h) => `${h.timestamp}:${h.target}:${h.text}`))
    for (const hit of fromDisk) {
      const key = `${hit.timestamp}:${hit.target}:${hit.text}`
      if (!seen.has(key)) {
        fromMemory.push(hit)
        seen.add(key)
      }
    }
    fromMemory.sort((a, b) => b.timestamp - a.timestamp)
    return fromMemory.slice(0, limit)
  }

  private searchDisk(parsed: ParsedQuery, limit: number): LogSearchHit[] {
    if (!existsSync(this.dir) || limit <= 0) return []
    const files = readdirSync(this.dir)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .reverse()
    const hits: LogSearchHit[] = []
    for (const file of files) {
      if (hits.length >= limit) break
      const networkName = file.replace(/_\d{4}-\d{2}-\d{2}\.log$/, '').replace(/_/g, ' ')
      const content = readFileSync(join(this.dir, file), 'utf8')
      for (const line of content.split('\n').reverse()) {
        if (hits.length >= limit) break
        if (!line) continue
        try {
          const row = JSON.parse(line) as {
            t: number
            target: string
            nick: string
            kind: MessageKind
            text: string
          }
          if (redactForLog(row.text) === null) continue
          const hit: LogSearchHit = {
            id: `disk-${file}-${hits.length}`,
            connectionId: '',
            networkName,
            target: row.target,
            nick: row.nick || undefined,
            text: row.text,
            timestamp: row.t,
            kind: row.kind
          }
          if (!matchesParsed(hit, parsed)) continue
          hits.push(hit)
        } catch {
          /* skip corrupt lines */
        }
      }
    }
    return hits
  }
}

export interface ParsedQuery {
  text: string
  kind?: string
  target?: string
  nick?: string
}

/** Parse `kind:privmsg target:#lobby nick:alice hello` style queries. */
export function parseSearchQuery(raw: string): ParsedQuery {
  let rest = raw.trim()
  const out: ParsedQuery = { text: '' }
  const re = /^(kind|target|nick):(\S+)\s*/i
  while (true) {
    const m = re.exec(rest)
    if (!m) break
    const key = m[1]!.toLowerCase()
    const val = m[2]!
    if (key === 'kind') out.kind = val.toLowerCase()
    if (key === 'target') out.target = val.toLowerCase()
    if (key === 'nick') out.nick = val.toLowerCase()
    rest = rest.slice(m[0].length)
  }
  out.text = rest.trim().toLowerCase()
  return out
}

function matchesParsed(h: LogSearchHit, q: ParsedQuery): boolean {
  if (q.kind && h.kind.toLowerCase() !== q.kind) return false
  if (q.target && !h.target.toLowerCase().includes(q.target)) return false
  if (q.nick && !(h.nick?.toLowerCase().includes(q.nick) ?? false)) return false
  if (!q.text) return true
  return (
    h.text.toLowerCase().includes(q.text) ||
    (h.nick?.toLowerCase().includes(q.text) ?? false) ||
    h.target.toLowerCase().includes(q.text)
  )
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64) || 'network'
}
