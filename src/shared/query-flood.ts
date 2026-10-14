/** App-level query (private message) flood tracking. */

export interface QueryFloodConfig {
  /** Max PMs from one nick in the window before further PMs are dropped */
  maxPerWindow: number
  /** Window length in milliseconds */
  windowMs: number
}

export const DEFAULT_QUERY_FLOOD: QueryFloodConfig = {
  maxPerWindow: 8,
  windowMs: 10_000
}

/**
 * Record a PM timestamp and return whether it should be accepted.
 * Mutates `buckets` (key → timestamps).
 */
export function acceptQueryMessage(
  buckets: Map<string, number[]>,
  key: string,
  now: number,
  config: QueryFloodConfig = DEFAULT_QUERY_FLOOD
): { accept: boolean; flooded: boolean } {
  const cutoff = now - config.windowMs
  const prev = (buckets.get(key) ?? []).filter((t) => t >= cutoff)
  if (prev.length >= config.maxPerWindow) {
    buckets.set(key, prev)
    return { accept: false, flooded: true }
  }
  prev.push(now)
  buckets.set(key, prev)
  return { accept: true, flooded: false }
}
