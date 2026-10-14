/** Design-token themes for MisstIRC (Phase 7). */

export type ThemeId = 'misstirc-dark' | 'misstirc-light' | 'misstirc-classic'

export type ThemeTokenMap = Record<string, string>

export interface ThemePackage {
  id: string
  name: string
  version: 1
  tokens: ThemeTokenMap
}

const TOKEN_KEYS = [
  'bg-deep',
  'bg-panel',
  'bg-elevated',
  'bg-input',
  'border',
  'border-strong',
  'text',
  'text-dim',
  'accent',
  'accent-hot',
  'accent-dim',
  'danger',
  'ok',
  'join',
  'part',
  'notice',
  'system',
  'nick-self',
  'shadow',
  'font-ui',
  'font-mono',
  'radius'
] as const

export type ThemeTokenKey = (typeof TOKEN_KEYS)[number]

export const THEME_TOKEN_KEYS: readonly ThemeTokenKey[] = TOKEN_KEYS

export const BUILTIN_THEMES: Record<ThemeId, ThemePackage> = {
  'misstirc-dark': {
    id: 'misstirc-dark',
    name: 'MisstIRC Dark',
    version: 1,
    tokens: {
      'bg-deep': '#0b1016',
      'bg-panel': '#121a24',
      'bg-elevated': '#1a2432',
      'bg-input': '#0e1620',
      border: '#243244',
      'border-strong': '#33485f',
      text: '#e7eef7',
      'text-dim': '#8fa3b8',
      accent: '#e8a23a',
      'accent-hot': '#f0b95a',
      'accent-dim': 'rgba(232, 162, 58, 0.15)',
      danger: '#e85d5d',
      ok: '#3ecf8e',
      join: '#5ec8a0',
      part: '#c98a6a',
      notice: '#8ab4e8',
      system: '#7d8fa3',
      'nick-self': '#e8a23a',
      shadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
      'font-ui': "'Bahnschrift', 'Segoe UI Variable', 'Trebuchet MS', sans-serif",
      'font-mono': "'Cascadia Mono', 'Consolas', 'Courier New', monospace",
      radius: '6px'
    }
  },
  'misstirc-light': {
    id: 'misstirc-light',
    name: 'MisstIRC Light',
    version: 1,
    tokens: {
      'bg-deep': '#f4f6f9',
      'bg-panel': '#ffffff',
      'bg-elevated': '#eef2f7',
      'bg-input': '#ffffff',
      border: '#c9d3e0',
      'border-strong': '#9aadc2',
      text: '#1a2430',
      'text-dim': '#5a6b7d',
      accent: '#b86e12',
      'accent-hot': '#d4891a',
      'accent-dim': 'rgba(184, 110, 18, 0.12)',
      danger: '#c0392b',
      ok: '#1e8a55',
      join: '#1f8a62',
      part: '#a05a3a',
      notice: '#2a6fad',
      system: '#5a6b7d',
      'nick-self': '#b86e12',
      shadow: '0 12px 32px rgba(30, 40, 55, 0.12)',
      'font-ui': "'Bahnschrift', 'Segoe UI Variable', 'Trebuchet MS', sans-serif",
      'font-mono': "'Cascadia Mono', 'Consolas', 'Courier New', monospace",
      radius: '6px'
    }
  },
  'misstirc-classic': {
    id: 'misstirc-classic',
    name: 'Classic IRC',
    version: 1,
    tokens: {
      'bg-deep': '#000080',
      'bg-panel': '#000060',
      'bg-elevated': '#0000a0',
      'bg-input': '#000040',
      border: '#8080c0',
      'border-strong': '#c0c0ff',
      text: '#ffffff',
      'text-dim': '#c0c0e0',
      accent: '#ffff00',
      'accent-hot': '#ffff80',
      'accent-dim': 'rgba(255, 255, 0, 0.18)',
      danger: '#ff6060',
      ok: '#00ff80',
      join: '#00ff00',
      part: '#ff8000',
      notice: '#80ffff',
      system: '#a0a0ff',
      'nick-self': '#ffff00',
      shadow: 'none',
      'font-ui': "'Fixedsys', 'Consolas', 'Courier New', monospace",
      'font-mono': "'Consolas', 'Courier New', monospace",
      radius: '0px'
    }
  }
}

export function resolveThemeTokens(
  themeId: ThemeId,
  overrides?: Partial<ThemeTokenMap> | null
): ThemeTokenMap {
  const base = BUILTIN_THEMES[themeId]?.tokens ?? BUILTIN_THEMES['misstirc-dark'].tokens
  const merged: ThemeTokenMap = { ...base }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === 'string') merged[k] = v
    }
  }
  return merged
}

/** Apply tokens as CSS custom properties on an element (browser/renderer). */
export function applyThemeToElement(
  el: { style: { setProperty: (k: string, v: string) => void } },
  tokens: ThemeTokenMap
): void {
  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(`--${key}`, value)
  }
}

export function exportThemePackage(
  themeId: ThemeId,
  overrides?: Partial<ThemeTokenMap> | null,
  name?: string
): ThemePackage {
  return {
    id: themeId,
    name: name ?? BUILTIN_THEMES[themeId]?.name ?? themeId,
    version: 1,
    tokens: resolveThemeTokens(themeId, overrides)
  }
}

export function parseThemeImport(raw: unknown): { ok: true; theme: ThemePackage } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Theme must be a JSON object' }
  const obj = raw as Record<string, unknown>
  if (obj.version !== 1) return { ok: false, error: 'Unsupported theme version (expected 1)' }
  if (typeof obj.tokens !== 'object' || !obj.tokens) return { ok: false, error: 'Theme missing tokens' }
  const tokens = obj.tokens as ThemeTokenMap
  const missing = TOKEN_KEYS.filter((k) => typeof tokens[k] !== 'string')
  if (missing.length > 6) {
    return { ok: false, error: `Theme missing too many tokens (e.g. ${missing.slice(0, 4).join(', ')})` }
  }
  return {
    ok: true,
    theme: {
      id: typeof obj.id === 'string' ? obj.id : 'imported',
      name: typeof obj.name === 'string' ? obj.name : 'Imported theme',
      version: 1,
      tokens
    }
  }
}

export function isThemeId(v: string): v is ThemeId {
  return v === 'misstirc-dark' || v === 'misstirc-light' || v === 'misstirc-classic'
}
