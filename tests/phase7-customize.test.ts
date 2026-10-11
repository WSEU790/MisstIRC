import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BUILTIN_THEMES,
  exportThemePackage,
  parseThemeImport,
  resolveThemeTokens
} from '../src/shared/themes'
import {
  DEFAULT_SHORTCUTS,
  detectShortcutConflicts,
  mergeShortcuts,
  normalizeShortcutKey
} from '../src/shared/shortcuts'
import { DEFAULT_LAYOUT, clampLayout } from '../src/shared/layout'
import {
  buildConfigExport,
  parseConfigImport,
  sanitizeNetworkForExport
} from '../src/shared/config-export'
import { shouldNotify, mergeNotificationPrefs } from '../src/shared/notifications'
import { normalizeAppSettings } from '../src/shared/defaults'
import { validateCustomMenuDef } from '../src/services/custom-menus'
import { BackupStore } from '../src/services/backups'
import { AppDatabase } from '../src/storage/database'

describe('Phase 7 themes', () => {
  it('resolves dark/light/classic tokens and exports/imports', () => {
    expect(BUILTIN_THEMES['misstirc-light'].tokens.text).toBeTruthy()
    expect(BUILTIN_THEMES['misstirc-classic'].tokens.accent).toBe('#ffff00')
    const tokens = resolveThemeTokens('misstirc-dark', { accent: '#ff00aa' })
    expect(tokens.accent).toBe('#ff00aa')
    const pkg = exportThemePackage('misstirc-dark', { accent: '#112233' })
    const parsed = parseThemeImport(pkg)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.theme.tokens.accent).toBe('#112233')
    expect(parseThemeImport({ version: 2 }).ok).toBe(false)
  })
})

describe('Phase 7 shortcuts', () => {
  it('detects conflicts and preserves editing keys', () => {
    const bad = mergeShortcuts([
      { id: 'a', action: 'open-servers', key: 'Ctrl+F', label: 'Servers' },
      { id: 'b', action: 'open-search', key: 'Ctrl+F', label: 'Search' }
    ])
    const conflicts = detectShortcutConflicts(bad)
    expect(conflicts.some((c) => c.key === 'Ctrl+F')).toBe(true)
    expect(normalizeShortcutKey('ctrl+shift+s')).toBe('Ctrl+Shift+S')
    expect(detectShortcutConflicts([{ ...DEFAULT_SHORTCUTS[0]!, key: 'Ctrl+C' }]).length).toBeGreaterThan(
      0
    )
  })
})

describe('Phase 7 layout + notifications', () => {
  it('clamps layout and evaluates notify prefs', () => {
    expect(clampLayout({ navWidth: 9999 }).navWidth).toBe(420)
    expect(clampLayout(null).showNav).toBe(DEFAULT_LAYOUT.showNav)
    const prefs = mergeNotificationPrefs({ enabled: true, suppressWhenFocused: true, onHighlight: true })
    expect(shouldNotify(prefs, 'highlight', { bufferFocused: true })).toBe(false)
    expect(shouldNotify(prefs, 'highlight', { bufferFocused: false })).toBe(true)
    expect(shouldNotify(prefs, 'disconnect', { bufferFocused: true })).toBe(true)
  })
})

describe('Phase 7 custom menus', () => {
  it('validates menu text definitions', () => {
    const ok = validateCustomMenuDef({
      id: '1',
      name: 'Chan',
      target: 'channel',
      source: 'Whois:whois $1\n-\nPing:echo ping'
    })
    expect(ok.ok).toBe(true)
    expect(ok.menus[0]?.items.length).toBeGreaterThan(0)
    const bad = validateCustomMenuDef({ id: '2', name: '', target: 'channel', source: '' })
    expect(bad.ok).toBe(false)
  })
})

describe('Phase 7 config export / backups', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })

  it('strips credentials and rejects password-bearing import', () => {
    const settings = normalizeAppSettings(null)
    const network = sanitizeNetworkForExport({
      id: 'n1',
      name: 'Test',
      host: 'irc.example',
      port: 6697,
      tls: true,
      rejectUnauthorized: true,
      nick: 'n',
      username: 'u',
      realname: 'r',
      channels: ['#a'],
      hasPassword: true,
      perform: ['PRIVMSG NickServ :IDENTIFY secret', 'JOIN #a']
    })
    expect(network.hasPassword).toBe(false)
    expect(network.perform?.some((l) => /IDENTIFY/i.test(l))).toBe(false)
    const bundle = buildConfigExport(settings, [network])
    expect(bundle.includeCredentials).toBe(false)
    const ok = parseConfigImport(bundle)
    expect(ok.ok).toBe(true)
    const rejected = parseConfigImport({
      version: 1,
      settings,
      networks: [{ ...network, password: 'nope' }]
    })
    expect(rejected.ok).toBe(false)
  })

  it('creates and restores backups without secrets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misst-bak-'))
    dirs.push(dir)
    const dbDir = mkdtempSync(join(tmpdir(), 'misst-db-'))
    dirs.push(dbDir)
    const db = new AppDatabase(join(dbDir, 't.sqlite'))
    db.saveNetwork({
      id: 'n1',
      name: 'Net',
      host: '127.0.0.1',
      port: 6667,
      tls: false,
      rejectUnauthorized: true,
      nick: 't',
      username: 't',
      realname: 't',
      channels: [],
      hasPassword: true
    })
    const store = new BackupStore(dir)
    const meta = store.create(db.getSettings(), db.listNetworks(), 'test')
    expect(store.list()).toHaveLength(1)
    const bundle = store.read(meta.id)
    expect(bundle?.networks[0]?.hasPassword).toBe(false)
    db.close()
  })
})
