/** Keyboard shortcut registry + conflict detection (Phase 7). */

export type ShortcutAction =
  | 'open-servers'
  | 'open-channels'
  | 'open-search'
  | 'open-scripts'
  | 'open-customize'
  | 'toggle-nav'
  | 'toggle-nicks'
  | 'focus-input'
  | 'next-unread'
  | 'disconnect'

export interface ShortcutBinding {
  id: string
  action: ShortcutAction
  /** Normalized chord like "Ctrl+Shift+S" */
  key: string
  label: string
}

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: 'sc-servers', action: 'open-servers', key: 'Ctrl+Shift+S', label: 'Open servers' },
  { id: 'sc-channels', action: 'open-channels', key: 'Ctrl+Shift+J', label: 'Open channels' },
  { id: 'sc-search', action: 'open-search', key: 'Ctrl+F', label: 'Search logs' },
  { id: 'sc-scripts', action: 'open-scripts', key: 'Ctrl+Shift+R', label: 'Open scripts' },
  { id: 'sc-customize', action: 'open-customize', key: 'Ctrl+,', label: 'Customize' },
  { id: 'sc-nav', action: 'toggle-nav', key: 'Ctrl+B', label: 'Toggle nav tree' },
  { id: 'sc-nicks', action: 'toggle-nicks', key: 'Ctrl+Shift+N', label: 'Toggle nick list' },
  { id: 'sc-input', action: 'focus-input', key: 'Ctrl+L', label: 'Focus message input' },
  { id: 'sc-unread', action: 'next-unread', key: 'Ctrl+Shift+U', label: 'Next unread' },
  { id: 'sc-disconnect', action: 'disconnect', key: 'Ctrl+Shift+D', label: 'Disconnect' }
]

/** Keys reserved for normal text editing — shortcuts must not steal these alone. */
const RESERVED_EDITING = new Set([
  'Ctrl+C',
  'Ctrl+V',
  'Ctrl+X',
  'Ctrl+A',
  'Ctrl+Z',
  'Ctrl+Y',
  'Ctrl+Backspace'
])

export function normalizeShortcutKey(input: string): string {
  const parts = input
    .trim()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  const mods: string[] = []
  let key = ''
  for (const p of parts) {
    const low = p.toLowerCase()
    if (low === 'ctrl' || low === 'control' || low === 'cmd' || low === 'meta') mods.push('Ctrl')
    else if (low === 'alt' || low === 'option') mods.push('Alt')
    else if (low === 'shift') mods.push('Shift')
    else key = p.length === 1 ? p.toUpperCase() : p[0]!.toUpperCase() + p.slice(1)
  }
  const order = ['Ctrl', 'Alt', 'Shift']
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return [...new Set(mods), key].filter(Boolean).join('+')
}

export function shortcutFromKeyboardEvent(e: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
}): string | null {
  if (!e.ctrlKey && !e.metaKey && !e.altKey) return null
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift') return null
  return normalizeShortcutKey(
    [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key]
      .filter(Boolean)
      .join('+')
  )
}

export interface ShortcutConflict {
  key: string
  actions: string[]
  message: string
}

export function detectShortcutConflicts(bindings: ShortcutBinding[]): ShortcutConflict[] {
  const byKey = new Map<string, ShortcutBinding[]>()
  for (const b of bindings) {
    const k = normalizeShortcutKey(b.key)
    if (!k) continue
    const list = byKey.get(k) ?? []
    list.push(b)
    byKey.set(k, list)
  }
  const conflicts: ShortcutConflict[] = []
  for (const [key, list] of byKey) {
    if (list.length > 1) {
      conflicts.push({
        key,
        actions: list.map((b) => b.action),
        message: `Conflict: ${key} bound to ${list.map((b) => b.label).join(' and ')}`
      })
    }
    if (RESERVED_EDITING.has(key)) {
      conflicts.push({
        key,
        actions: list.map((b) => b.action),
        message: `Conflict: ${key} is reserved for text editing`
      })
    }
  }
  return conflicts
}

export function mergeShortcuts(custom?: ShortcutBinding[] | null): ShortcutBinding[] {
  if (!custom?.length) return DEFAULT_SHORTCUTS.map((b) => ({ ...b }))
  const byAction = new Map(custom.map((b) => [b.action, b]))
  return DEFAULT_SHORTCUTS.map((d) => {
    const c = byAction.get(d.action)
    if (!c) return { ...d }
    return {
      ...d,
      key: normalizeShortcutKey(c.key) || d.key,
      id: c.id || d.id
    }
  })
}

export function findActionForKey(
  bindings: ShortcutBinding[],
  key: string
): ShortcutAction | null {
  const n = normalizeShortcutKey(key)
  const hit = bindings.find((b) => normalizeShortcutKey(b.key) === n)
  return hit?.action ?? null
}
