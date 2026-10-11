import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AppSettings, NetworkConfig } from '@shared/types'
import { normalizeAppSettings } from '../shared/defaults'
import { MIGRATIONS } from './migrations'

type NetworkExtras = Pick<
  NetworkConfig,
  | 'altNicks'
  | 'perform'
  | 'ignoreRules'
  | 'highlights'
  | 'aliases'
  | 'autoAwayMinutes'
  | 'autoAwayMessage'
  | 'replyCtcpVersion'
  | 'replyCtcpTime'
  | 'replyCtcpPing'
  | 'ctcpFloodLimit'
>

function extrasFromNetwork(network: NetworkConfig): NetworkExtras {
  return {
    altNicks: network.altNicks,
    perform: network.perform,
    ignoreRules: network.ignoreRules,
    highlights: network.highlights,
    aliases: network.aliases,
    autoAwayMinutes: network.autoAwayMinutes,
    autoAwayMessage: network.autoAwayMessage,
    replyCtcpVersion: network.replyCtcpVersion,
    replyCtcpTime: network.replyCtcpTime,
    replyCtcpPing: network.replyCtcpPing,
    ctcpFloodLimit: network.ctcpFloodLimit
  }
}

export class AppDatabase {
  private db: Database.Database

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  listNetworks(): NetworkConfig[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, host, port, tls, reject_unauthorized, nick, username, realname,
                channels_json, auto_connect, has_password, extras_json FROM networks ORDER BY name`
      )
      .all() as Array<{
      id: string
      name: string
      host: string
      port: number
      tls: number
      reject_unauthorized: number
      nick: string
      username: string
      realname: string
      channels_json: string
      auto_connect: number
      has_password: number
      extras_json: string
    }>

    return rows.map((r) => {
      const extras = JSON.parse(r.extras_json || '{}') as NetworkExtras
      return {
        id: r.id,
        name: r.name,
        host: r.host,
        port: r.port,
        tls: !!r.tls,
        rejectUnauthorized: !!r.reject_unauthorized,
        nick: r.nick,
        username: r.username,
        realname: r.realname,
        channels: JSON.parse(r.channels_json) as string[],
        autoConnect: !!r.auto_connect,
        hasPassword: !!r.has_password,
        ...extras
      }
    })
  }

  saveNetwork(network: NetworkConfig): void {
    const now = Date.now()
    this.db
      .prepare(
        `INSERT INTO networks (
          id, name, host, port, tls, reject_unauthorized, nick, username, realname,
          channels_json, auto_connect, has_password, extras_json, created_at, updated_at
        ) VALUES (
          @id, @name, @host, @port, @tls, @rejectUnauthorized, @nick, @username, @realname,
          @channels, @autoConnect, @hasPassword, @extras, @now, @now
        )
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          host=excluded.host,
          port=excluded.port,
          tls=excluded.tls,
          reject_unauthorized=excluded.reject_unauthorized,
          nick=excluded.nick,
          username=excluded.username,
          realname=excluded.realname,
          channels_json=excluded.channels_json,
          auto_connect=excluded.auto_connect,
          has_password=excluded.has_password,
          extras_json=excluded.extras_json,
          updated_at=excluded.updated_at`
      )
      .run({
        id: network.id,
        name: network.name,
        host: network.host,
        port: network.port,
        tls: network.tls ? 1 : 0,
        rejectUnauthorized: network.rejectUnauthorized ? 1 : 0,
        nick: network.nick,
        username: network.username,
        realname: network.realname,
        channels: JSON.stringify(network.channels ?? []),
        autoConnect: network.autoConnect ? 1 : 0,
        hasPassword: network.hasPassword ? 1 : 0,
        extras: JSON.stringify(extrasFromNetwork(network)),
        now
      })
  }

  deleteNetwork(id: string): void {
    this.db.prepare('DELETE FROM networks WHERE id = ?').run(id)
  }

  getSettings(): AppSettings {
    const row = this.db.prepare(`SELECT value_json FROM settings WHERE key = 'app'`).get() as
      | { value_json: string }
      | undefined
    if (!row) return normalizeAppSettings(null)
    return normalizeAppSettings(JSON.parse(row.value_json) as Partial<AppSettings>)
  }

  saveSettings(settings: AppSettings): void {
    const normalized = normalizeAppSettings(settings)
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json) VALUES ('app', ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
      )
      .run(JSON.stringify(normalized))
  }

  private migrate(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)
    const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined
    let current = row?.version ?? 0
    if (!row) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (0)').run()
    }
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue
      this.db.exec(migration.sql)
      this.db.prepare('UPDATE schema_version SET version = ?').run(migration.version)
      current = migration.version
    }
  }
}
