import { basename, join, normalize, resolve, sep } from 'node:path'

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const BAD_CHARS = /[<>:"|?*\x00-\x1f]/g

/**
 * Sanitize an incoming DCC filename. Rejects path traversal and reserved names.
 * Returns null if the name cannot be made safe.
 */
export function sanitizeDccFilename(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  let name = raw.replace(/\\/g, '/')
  const parts = name.split('/').filter(Boolean)
  name = parts[parts.length - 1] ?? ''
  name = basename(name)
  if (!name || name === '.' || name === '..') return null
  if (name.includes('..')) return null
  name = name.replace(BAD_CHARS, '_')
  if (WINDOWS_RESERVED.test(name)) name = `_${name}`
  name = name.replace(/^\/+/g, '')
  if (!name || name.length > 200) return null
  return name
}

export function resolveDownloadPath(downloadDir: string, safeFilename: string): string | null {
  const safe = sanitizeDccFilename(safeFilename)
  if (!safe) return null
  const dir = resolve(downloadDir)
  const full = normalize(join(dir, safe))
  if (full !== dir && !full.startsWith(dir + sep)) return null
  return full
}
