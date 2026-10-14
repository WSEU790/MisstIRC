/**
 * mIRC-style menu / popup scaffolding.
 * Parses `menu <target> { … }` into a structured tree for future context menus.
 * Not a full mIRC popup engine — no DLL-backed UI.
 */

export type MenuTarget =
  | 'channel'
  | 'nick'
  | 'query'
  | 'status'
  | 'menubar'
  | 'nicklist'
  | 'unknown'

export interface MenuCommandItem {
  type: 'command'
  label: string
  /** Command line without leading / when possible */
  command: string
  line: number
}

export interface MenuSeparatorItem {
  type: 'separator'
  line: number
}

export interface MenuSubmenuItem {
  type: 'submenu'
  label: string
  children: MenuItem[]
  line: number
}

export type MenuItem = MenuCommandItem | MenuSeparatorItem | MenuSubmenuItem

export interface MenuDefinition {
  target: MenuTarget
  rawTarget: string
  items: MenuItem[]
  line: number
}

export interface MenuParseResult {
  menus: MenuDefinition[]
  errors: { line: number; message: string }[]
}

/**
 * Extract menu blocks from source (brace-aware, comment-aware).
 * Independent of the main script AST so incomplete scripts still yield menus.
 */
export function parseMenus(source: string): MenuParseResult {
  const menus: MenuDefinition[] = []
  const errors: { line: number; message: string }[] = []
  const text = source.replace(/\r\n/g, '\n')
  const lines = text.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const lineNo = i + 1
    if (!trimmed || trimmed.startsWith(';')) {
      i += 1
      continue
    }

    const m = /^menu\s+(\S+)\s*\{?\s*$/i.exec(trimmed)
    if (!m) {
      i += 1
      continue
    }

    const rawTarget = m[1]!.replace(/:$/, '')
    let bodyLines: string[] = []
    const opensOnSame = trimmed.includes('{')
    i += 1
    if (!opensOnSame) {
      // consume until {
      while (i < lines.length && !lines[i]!.includes('{')) {
        if (lines[i]!.trim() && !lines[i]!.trim().startsWith(';')) {
          errors.push({ line: i + 1, message: 'Expected { after menu header' })
          break
        }
        i += 1
      }
      if (i < lines.length && lines[i]!.includes('{')) {
        const after = lines[i]!.slice(lines[i]!.indexOf('{') + 1)
        if (after.trim() && !after.trim().startsWith(';')) bodyLines.push(after)
        i += 1
      }
    }

    let depth = 1
    while (i < lines.length && depth > 0) {
      const l = lines[i] ?? ''
      for (const ch of l) {
        if (ch === '{') depth += 1
        if (ch === '}') depth -= 1
      }
      if (depth > 0) bodyLines.push(l)
      else {
        const before = l.slice(0, l.lastIndexOf('}'))
        if (before.trim()) bodyLines.push(before)
      }
      i += 1
    }

    if (depth !== 0) {
      errors.push({ line: lineNo, message: `Unclosed menu block for "${rawTarget}"` })
    }

    menus.push({
      target: normalizeTarget(rawTarget),
      rawTarget,
      items: parseMenuBody(bodyLines, lineNo + 1),
      line: lineNo
    })
  }

  return { menus, errors }
}

function normalizeTarget(raw: string): MenuTarget {
  const t = raw.toLowerCase()
  if (t === 'channel' || t === '#') return 'channel'
  if (t === 'nick' || t === 'nickname') return 'nick'
  if (t === 'query' || t === 'chat') return 'query'
  if (t === 'status' || t === 'server') return 'status'
  if (t === 'menubar' || t === 'main') return 'menubar'
  if (t === 'nicklist') return 'nicklist'
  return 'unknown'
}

function parseMenuBody(bodyLines: string[], startLine: number): MenuItem[] {
  const root: MenuItem[] = []
  /** stack of submenu children arrays */
  const stack: { label: string; children: MenuItem[]; line: number }[] = []
  let current = root

  const flushSub = (dotLevel: number): void => {
    while (stack.length >= dotLevel) {
      const finished = stack.pop()!
      const parent = stack.length ? stack[stack.length - 1]!.children : root
      parent.push({
        type: 'submenu',
        label: finished.label,
        children: finished.children,
        line: finished.line
      })
    }
    current = stack.length ? stack[stack.length - 1]!.children : root
  }

  bodyLines.forEach((raw, idx) => {
    const lineNo = startLine + idx
    let line = raw.trim()
    if (!line || line.startsWith(';')) return

    if (line === '-' || line === '.-') {
      flushSub(1)
      current.push({ type: 'separator', line: lineNo })
      return
    }

    let dots = 0
    while (line.startsWith('.')) {
      dots += 1
      line = line.slice(1)
    }
    flushSub(dots + 1)

    // submenu header without command: "More" or "More {"
    if (!line.includes(':') && !line.startsWith('$')) {
      const label = line.replace(/\{?\s*$/, '').trim()
      if (!label) return
      stack.push({ label, children: [], line: lineNo })
      current = stack[stack.length - 1]!.children
      return
    }

    const colon = line.indexOf(':')
    if (colon === -1) {
      current.push({ type: 'command', label: line, command: line, line: lineNo })
      return
    }
    const label = line.slice(0, colon).trim()
    const command = line.slice(colon + 1).trim().replace(/^\//, '')
    current.push({ type: 'command', label, command, line: lineNo })
  })

  flushSub(1)
  return root
}

/** Flat list of invokable commands (for tests / simple UI). */
export function flattenMenuCommands(menu: MenuDefinition): MenuCommandItem[] {
  const out: MenuCommandItem[] = []
  const walk = (items: MenuItem[]): void => {
    for (const it of items) {
      if (it.type === 'command') out.push(it)
      if (it.type === 'submenu') walk(it.children)
    }
  }
  walk(menu.items)
  return out
}
