export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS networks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        tls INTEGER NOT NULL DEFAULT 1,
        reject_unauthorized INTEGER NOT NULL DEFAULT 1,
        nick TEXT NOT NULL,
        username TEXT NOT NULL,
        realname TEXT NOT NULL,
        channels_json TEXT NOT NULL DEFAULT '[]',
        auto_connect INTEGER NOT NULL DEFAULT 0,
        has_password INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `
  }
]
