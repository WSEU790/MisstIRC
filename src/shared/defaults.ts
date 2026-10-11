import type { AppSettings } from './types'
import { DEFAULT_LAYOUT } from './layout'
import { DEFAULT_SHORTCUTS } from './shortcuts'
import { DEFAULT_NOTIFICATION_PREFS } from './notifications'

export function defaultAppSettings(): AppSettings {
  return {
    theme: 'misstirc-dark',
    themeOverrides: {},
    showStatusBar: true,
    fontSize: 14,
    loggingEnabled: true,
    notificationsEnabled: true,
    layout: { ...DEFAULT_LAYOUT },
    shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })),
    notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    customMenus: []
  }
}

/** Merge persisted JSON with defaults (forward-compatible). */
export function normalizeAppSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const d = defaultAppSettings()
  if (!raw) return d
  const notifications = {
    ...d.notifications,
    ...(raw.notifications ?? {}),
    enabled: raw.notifications?.enabled ?? raw.notificationsEnabled ?? d.notifications.enabled
  }
  const layout = {
    ...d.layout,
    ...(raw.layout ?? {}),
    showStatusBar: raw.layout?.showStatusBar ?? raw.showStatusBar ?? d.layout.showStatusBar
  }
  return {
    ...d,
    ...raw,
    theme: raw.theme ?? d.theme,
    themeOverrides: { ...(raw.themeOverrides ?? {}) },
    layout,
    shortcuts: raw.shortcuts?.length ? raw.shortcuts : d.shortcuts,
    notifications,
    customMenus: Array.isArray(raw.customMenus) ? raw.customMenus : [],
    showStatusBar: layout.showStatusBar,
    notificationsEnabled: notifications.enabled
  }
}
