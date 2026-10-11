/** Notification preference helpers (Phase 7). */

export type NotifyKind =
  | 'highlight'
  | 'private'
  | 'disconnect'
  | 'reconnect'
  | 'dcc'
  | 'script'
  | 'notice'
  | 'other'

export interface NotificationPrefs {
  enabled: boolean
  /** Suppress desktop notify when the matching buffer is already focused */
  suppressWhenFocused: boolean
  onHighlight: boolean
  onPrivate: boolean
  onDisconnect: boolean
  onDcc: boolean
  onScriptError: boolean
  soundEnabled: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  suppressWhenFocused: true,
  onHighlight: true,
  onPrivate: true,
  onDisconnect: true,
  onDcc: true,
  onScriptError: true,
  soundEnabled: false
}

export function mergeNotificationPrefs(
  partial?: Partial<NotificationPrefs> | null,
  legacyEnabled?: boolean
): NotificationPrefs {
  const base = { ...DEFAULT_NOTIFICATION_PREFS, ...(partial ?? {}) }
  if (partial == null && legacyEnabled === false) base.enabled = false
  if (partial == null && legacyEnabled === true) base.enabled = true
  return base
}

export function shouldNotify(
  prefs: NotificationPrefs,
  kind: NotifyKind,
  opts: { bufferFocused: boolean }
): boolean {
  if (!prefs.enabled) return false
  if (prefs.suppressWhenFocused && opts.bufferFocused) {
    if (kind === 'highlight' || kind === 'private' || kind === 'notice') return false
  }
  switch (kind) {
    case 'highlight':
      return prefs.onHighlight
    case 'private':
      return prefs.onPrivate
    case 'disconnect':
    case 'reconnect':
      return prefs.onDisconnect
    case 'dcc':
      return prefs.onDcc
    case 'script':
      return prefs.onScriptError
    default:
      return true
  }
}
