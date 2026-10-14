import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function crashLogPath(userDataPath: string): string {
  return join(userDataPath, 'logs', 'crash.log')
}

/** Append a crash/recovery breadcrumb under userData/logs (best-effort). */
export function writeCrashLog(userDataPath: string, label: string, err: unknown): void {
  const logDir = join(userDataPath, 'logs')
  try {
    mkdirSync(logDir, { recursive: true })
  } catch {
    /* ignore */
  }
  const line = `[${new Date().toISOString()}] ${label}: ${
    err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
  }\n`
  try {
    appendFileSync(crashLogPath(userDataPath), line, 'utf8')
  } catch {
    /* ignore */
  }
  console.error(label, err)
}

/** Install process-level hooks once per app lifetime. */
export function installCrashHooks(userDataPath: string): void {
  process.on('uncaughtException', (err) => {
    writeCrashLog(userDataPath, 'uncaughtException', err)
  })
  process.on('unhandledRejection', (reason) => {
    writeCrashLog(userDataPath, 'unhandledRejection', reason)
  })
}
