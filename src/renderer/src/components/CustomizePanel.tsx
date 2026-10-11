import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  CustomMenuDef,
  ProfileBackupMeta,
  ThemeId
} from '../../../shared/types'
import { BUILTIN_THEMES, exportThemePackage, parseThemeImport } from '../../../shared/themes'
import { DEFAULT_LAYOUT } from '../../../shared/layout'
import {
  DEFAULT_SHORTCUTS,
  detectShortcutConflicts,
  mergeShortcuts,
  normalizeShortcutKey
} from '../../../shared/shortcuts'
import { normalizeAppSettings } from '../../../shared/defaults'

type Tab = 'theme' | 'layout' | 'shortcuts' | 'menus' | 'notifications' | 'backup'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => Promise<void>
}

export function CustomizePanel({ settings, onClose, onSave }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('theme')
  const [draft, setDraft] = useState(() => normalizeAppSettings(settings))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [backups, setBackups] = useState<ProfileBackupMeta[]>([])
  const [menuText, setMenuText] = useState('')
  const [importBox, setImportBox] = useState('')

  useEffect(() => {
    setDraft(normalizeAppSettings(settings))
  }, [settings])

  useEffect(() => {
    if (tab !== 'backup') return
    void window.misstirc.listBackups().then(setBackups)
  }, [tab])

  const conflicts = useMemo(
    () => detectShortcutConflicts(mergeShortcuts(draft.shortcuts)),
    [draft.shortcuts]
  )

  const selectedMenu = draft.customMenus[0]

  async function persist(next: AppSettings): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const saved = normalizeAppSettings(next)
      await onSave(saved)
      setDraft(saved)
      setMsg('Saved')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide customize-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Customize</h2>
        <p className="sub">
          Themes, layout, shortcuts, menus, notifications, and profile backup. Credentials are never
          exported.
        </p>

        <div className="tab-row" role="tablist">
          {(
            [
              ['theme', 'Theme'],
              ['layout', 'Layout'],
              ['shortcuts', 'Shortcuts'],
              ['menus', 'Menus'],
              ['notifications', 'Notify'],
              ['backup', 'Backup']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`btn ${tab === id ? 'btn-primary' : ''}`}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {err ? (
          <div className="error-banner" role="alert">
            {err}
          </div>
        ) : null}
        {msg ? (
          <div className="error-banner whois-banner" role="status">
            {msg}
          </div>
        ) : null}

        {tab === 'theme' ? (
          <div className="customize-section">
            <label className="field">
              <span>Built-in theme</span>
              <select
                value={draft.theme}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, theme: e.target.value as ThemeId, themeOverrides: {} }))
                }
              >
                {Object.values(BUILTIN_THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Accent override</span>
              <input
                type="color"
                value={toColorInput(draft.themeOverrides?.accent ?? BUILTIN_THEMES[draft.theme].tokens.accent)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    themeOverrides: { ...d.themeOverrides, accent: e.target.value, 'accent-hot': e.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Font size</span>
              <input
                type="number"
                min={11}
                max={22}
                value={draft.fontSize}
                onChange={(e) => setDraft((d) => ({ ...d, fontSize: Number(e.target.value) || 14 }))}
              />
            </label>
            <div className="theme-preview" data-theme={draft.theme}>
              Preview: <strong>MisstIRC</strong> · #channel · nick
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  const pkg = exportThemePackage(draft.theme, draft.themeOverrides)
                  setImportBox(JSON.stringify(pkg, null, 2))
                  setMsg('Theme JSON copied into import box — copy out to save a file')
                }}
              >
                Export theme JSON
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !importBox.trim()}
                onClick={() => {
                  try {
                    const parsed = parseThemeImport(JSON.parse(importBox))
                    if (!parsed.ok) {
                      setErr(parsed.error)
                      return
                    }
                    setDraft((d) => ({
                      ...d,
                      themeOverrides: parsed.theme.tokens
                    }))
                    setMsg(`Imported tokens from ${parsed.theme.name}`)
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                Import theme JSON
              </button>
            </div>
            <textarea
              className="code-box"
              rows={5}
              placeholder="Theme / config JSON…"
              value={importBox}
              onChange={(e) => setImportBox(e.target.value)}
            />
          </div>
        ) : null}

        {tab === 'layout' ? (
          <div className="customize-section">
            <label className="field">
              <span>Nav width ({draft.layout.navWidth}px)</span>
              <input
                type="range"
                min={140}
                max={420}
                value={draft.layout.navWidth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    layout: { ...d.layout, navWidth: Number(e.target.value) }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Nick list width ({draft.layout.nicksWidth}px)</span>
              <input
                type="range"
                min={100}
                max={360}
                value={draft.layout.nicksWidth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    layout: { ...d.layout, nicksWidth: Number(e.target.value) }
                  }))
                }
              />
            </label>
            {(
              [
                ['showNav', 'Show nav tree'],
                ['showNickList', 'Show nick list'],
                ['showStatusBar', 'Show status bar'],
                ['showToolbar', 'Show toolbar']
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="field checkbox">
                <input
                  type="checkbox"
                  checked={draft.layout[key]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      layout: { ...d.layout, [key]: e.target.checked },
                      showStatusBar: key === 'showStatusBar' ? e.target.checked : d.showStatusBar
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  layout: { ...DEFAULT_LAYOUT },
                  showStatusBar: true
                }))
              }
            >
              Restore default layout
            </button>
          </div>
        ) : null}

        {tab === 'shortcuts' ? (
          <div className="customize-section">
            {mergeShortcuts(draft.shortcuts).map((sc) => (
              <label key={sc.id} className="field">
                <span>{sc.label}</span>
                <input
                  value={sc.key}
                  onChange={(e) => {
                    const key = normalizeShortcutKey(e.target.value) || e.target.value
                    setDraft((d) => ({
                      ...d,
                      shortcuts: mergeShortcuts(d.shortcuts).map((s) =>
                        s.action === sc.action ? { ...s, key } : s
                      )
                    }))
                  }}
                />
              </label>
            ))}
            {conflicts.length ? (
              <div className="error-banner" role="alert">
                {conflicts.map((c) => c.message).join(' · ')}
              </div>
            ) : (
              <p className="sub">No shortcut conflicts detected.</p>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => setDraft((d) => ({ ...d, shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })) }))}
            >
              Reset shortcuts
            </button>
          </div>
        ) : null}

        {tab === 'menus' ? (
          <div className="customize-section">
            <p className="sub">
              Visual + text editor for app custom menus (validated). Script <code>menu</code> blocks
              remain in Scripts.
            </p>
            <label className="field">
              <span>Name</span>
              <input
                value={selectedMenu?.name ?? 'Channel extras'}
                onChange={(e) => {
                  const name = e.target.value
                  setDraft((d) => {
                    const menus = d.customMenus.length
                      ? d.customMenus.map((m, i) => (i === 0 ? { ...m, name } : m))
                      : [newMenu(name, 'channel', menuText)]
                    return { ...d, customMenus: menus }
                  })
                }}
              />
            </label>
            <label className="field">
              <span>Target</span>
              <select
                value={selectedMenu?.target ?? 'channel'}
                onChange={(e) => {
                  const target = e.target.value
                  setDraft((d) => {
                    const menus = d.customMenus.length
                      ? d.customMenus.map((m, i) => (i === 0 ? { ...m, target } : m))
                      : [newMenu('Channel extras', target, menuText)]
                    return { ...d, customMenus: menus }
                  })
                }}
              >
                <option value="channel">channel</option>
                <option value="nick">nick</option>
                <option value="query">query</option>
                <option value="status">status</option>
                <option value="menubar">menubar</option>
              </select>
            </label>
            <div className="menu-visual">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setMenuText((t) => `${t}${t ? '\n' : ''}Whois here:whois $1`)
                }
              >
                + Whois item
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMenuText((t) => `${t}${t ? '\n' : ''}-`)}
              >
                + Separator
              </button>
            </div>
            <label className="field">
              <span>Menu text</span>
              <textarea
                className="code-box"
                rows={8}
                value={selectedMenu?.source ?? menuText}
                onChange={(e) => {
                  const source = e.target.value
                  setMenuText(source)
                  setDraft((d) => {
                    const base = d.customMenus[0] ?? newMenu('Channel extras', 'channel', source)
                    return {
                      ...d,
                      customMenus: [{ ...base, source }]
                    }
                  })
                }}
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  const menus = draft.customMenus.length
                    ? draft.customMenus
                    : [newMenu('Channel extras', 'channel', menuText)]
                  const result = await window.misstirc.validateCustomMenus(menus)
                  if (!result.ok) {
                    setErr(result.errors.map((e) => e.messages.join('; ')).join(' · '))
                    return
                  }
                  setMsg('Menu definition valid')
                  setDraft((d) => ({ ...d, customMenus: menus }))
                })()
              }}
            >
              Validate menu
            </button>
          </div>
        ) : null}

        {tab === 'notifications' ? (
          <div className="customize-section">
            {(
              [
                ['enabled', 'Desktop notifications'],
                ['suppressWhenFocused', 'Suppress when buffer focused'],
                ['onHighlight', 'Highlights'],
                ['onPrivate', 'Private messages'],
                ['onDisconnect', 'Disconnect / reconnect'],
                ['onDcc', 'DCC offers'],
                ['onScriptError', 'Script errors'],
                ['soundEnabled', 'Sound (reserved)']
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="field checkbox">
                <input
                  type="checkbox"
                  checked={draft.notifications[key]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      notifications: { ...d.notifications, [key]: e.target.checked },
                      notificationsEnabled:
                        key === 'enabled' ? e.target.checked : d.notificationsEnabled
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {tab === 'backup' ? (
          <div className="customize-section">
            <p className="sub">Profile backup includes settings + networks. Passwords are omitted.</p>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true)
                    try {
                      await window.misstirc.createBackup()
                      setBackups(await window.misstirc.listBackups())
                      setMsg('Backup created')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }
              >
                Create backup
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    const json = await window.misstirc.exportConfig()
                    setImportBox(json)
                    setMsg('Config exported to box (no credentials)')
                  })()
                }
              >
                Export config JSON
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !importBox.trim()}
                onClick={() =>
                  void (async () => {
                    setBusy(true)
                    setErr(null)
                    try {
                      const result = await window.misstirc.importConfig(importBox)
                      setDraft(result.settings)
                      setMsg(`Imported ${result.networks} networks (re-enter passwords)`)
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }
              >
                Import config JSON
              </button>
            </div>
            <textarea
              className="code-box"
              rows={6}
              value={importBox}
              onChange={(e) => setImportBox(e.target.value)}
              placeholder="Paste config JSON…"
            />
            <div className="search-results">
              {backups.length === 0 ? (
                <div className="sub" style={{ padding: 8 }}>
                  No backups yet
                </div>
              ) : (
                <ul>
                  {backups.map((b) => (
                    <li key={b.id}>
                      <div style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ flex: 1 }}>
                          {b.label}{' '}
                          <span className="sub">{new Date(b.createdAt).toLocaleString()}</span>
                        </span>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true)
                              try {
                                const r = await window.misstirc.restoreBackup(b.id)
                                setDraft(r.settings)
                                setMsg(`Restored backup (${r.networks} networks)`)
                              } catch (e) {
                                setErr(e instanceof Error ? e.message : String(e))
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              await window.misstirc.deleteBackup(b.id)
                              setBackups(await window.misstirc.listBackups())
                            })()
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || (tab === 'shortcuts' && conflicts.some((c) => c.message.includes('bound to')))}
            onClick={() => void persist(draft)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function newMenu(name: string, target: string, source: string): CustomMenuDef {
  return {
    id: `menu-${Date.now()}`,
    name,
    target,
    source
  }
}

function toColorInput(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  return '#e8a23a'
}
