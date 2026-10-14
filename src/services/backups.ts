import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AppSettings, NetworkConfig } from '../shared/types'
import {
  buildConfigExport,
  parseConfigImport,
  type ConfigExportBundle,
  type ProfileBackupMeta
} from '../shared/config-export'

export class BackupStore {
  constructor(private readonly dir: string) {
    mkdirSync(this.dir, { recursive: true })
  }

  list(): ProfileBackupMeta[] {
    if (!existsSync(this.dir)) return []
    const out: ProfileBackupMeta[] = []
    for (const file of readdirSync(this.dir)) {
      if (!file.endsWith('.json')) continue
      try {
        const path = join(this.dir, file)
        const data = JSON.parse(readFileSync(path, 'utf8')) as ConfigExportBundle & {
          label?: string
          id?: string
        }
        out.push({
          id: data.id ?? file.replace(/\.json$/, ''),
          createdAt: data.exportedAt ?? 0,
          label: data.label ?? file,
          path
        })
      } catch {
        /* skip corrupt */
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  }

  create(settings: AppSettings, networks: NetworkConfig[], label?: string): ProfileBackupMeta {
    const id = randomUUID()
    const bundle = {
      ...buildConfigExport(settings, networks),
      id,
      label: label ?? `Backup ${new Date().toISOString()}`
    }
    const path = join(this.dir, `${id}.json`)
    writeFileSync(path, JSON.stringify(bundle, null, 2), 'utf8')
    return {
      id,
      createdAt: bundle.exportedAt,
      label: bundle.label,
      path
    }
  }

  read(id: string): ConfigExportBundle | null {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return null
    const parsed = parseConfigImport(JSON.parse(readFileSync(path, 'utf8')))
    return parsed.ok ? parsed.bundle : null
  }

  delete(id: string): void {
    const path = join(this.dir, `${id}.json`)
    if (existsSync(path)) unlinkSync(path)
  }
}
