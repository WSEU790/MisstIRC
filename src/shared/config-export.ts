import type { AppSettings, NetworkConfig } from './types'

export const CONFIG_EXPORT_VERSION = 1 as const

export interface ConfigExportBundle {
  version: typeof CONFIG_EXPORT_VERSION
  exportedAt: number
  includeCredentials: false
  settings: AppSettings
  /** Networks with secrets stripped — never password values */
  networks: NetworkConfig[]
  note: string
}

export interface ProfileBackupMeta {
  id: string
  createdAt: number
  label: string
  path: string
}

/** Strip anything that could hold secrets before export. */
export function sanitizeNetworkForExport(network: NetworkConfig): NetworkConfig {
  const { hasPassword: _hp, ...rest } = network
  return {
    ...rest,
    hasPassword: false,
    // perform lines that look credential-like are dropped
    perform: (network.perform ?? []).filter((line) => !/pass|identify|authenticate|ns\s+id/i.test(line))
  }
}

export function buildConfigExport(
  settings: AppSettings,
  networks: NetworkConfig[]
): ConfigExportBundle {
  return {
    version: CONFIG_EXPORT_VERSION,
    exportedAt: Date.now(),
    includeCredentials: false,
    settings,
    networks: networks.map(sanitizeNetworkForExport),
    note: 'Credentials are never included. Re-enter passwords after import.'
  }
}

export function parseConfigImport(
  raw: unknown
): { ok: true; bundle: ConfigExportBundle } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Config must be a JSON object' }
  const obj = raw as Record<string, unknown>
  if (obj.version !== 1) return { ok: false, error: 'Unsupported config version (expected 1)' }
  if (!obj.settings || typeof obj.settings !== 'object') {
    return { ok: false, error: 'Config missing settings' }
  }
  if (!Array.isArray(obj.networks)) return { ok: false, error: 'Config missing networks array' }

  // Refuse accidental credential blobs
  const json = JSON.stringify(obj)
  if (/"password"\s*:\s*"[^"]+"/i.test(json) || /"saslPassword"\s*:\s*"[^"]+"/i.test(json)) {
    return { ok: false, error: 'Import rejected: file appears to contain credential fields' }
  }

  const networks = (obj.networks as NetworkConfig[]).map((n) => sanitizeNetworkForExport(n))
  return {
    ok: true,
    bundle: {
      version: 1,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
      includeCredentials: false,
      settings: obj.settings as AppSettings,
      networks,
      note: typeof obj.note === 'string' ? obj.note : 'Imported profile'
    }
  }
}
