import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { ParseError, ScriptFile } from './ast'
import {
  diagnoseCompatibility,
  formatCompatSummary,
  type CompatFinding,
  type CompatReport
} from './compat'
import {
  flattenMenuCommands,
  parseMenus,
  type MenuDefinition
} from './menus'
import { parseScript } from './parser'
import { ScriptRuntime, type EventContext, type ScriptHost } from './runtime'
import {
  DEFAULT_SANDBOX_POLICY,
  UNTRUSTED_POLICY,
  grantCapabilities,
  type ScriptPermission,
  type ScriptSandboxPolicy
} from './sandbox'
import { TimerTable } from './timers'

export type ScriptStatus = 'enabled' | 'disabled' | 'error'

export interface ScriptDiagnostics {
  summary: string
  findings: CompatFinding[]
  unsupportedCount: number
  partialCount: number
  hasBlockingUnsupported: boolean
  menuErrors: { line: number; message: string }[]
}

export interface ScriptRecord {
  id: string
  name: string
  filename: string
  source: string
  enabled: boolean
  trusted: boolean
  permissions: ScriptPermission[]
  parseErrors: ParseError[]
  execErrors: string[]
  diagnostics: ScriptDiagnostics
  menus: MenuDefinition[]
  status: ScriptStatus
  aliasCount: number
  eventCount: number
  menuCount: number
  loadedAt: number
}

export interface ScriptManagerHost {
  echo: (scriptId: string, text: string) => void
  sendCommand: (scriptId: string, line: string) => void
}

export class ScriptManager {
  private scripts = new Map<
    string,
    { record: ScriptRecord; ast: ScriptFile | null; runtime: ScriptRuntime | null }
  >()
  private readonly timers: TimerTable
  private readonly dir: string

  constructor(
    userDataScriptsDir: string,
    private readonly host: ScriptManagerHost
  ) {
    this.dir = userDataScriptsDir
    mkdirSync(this.dir, { recursive: true })
    this.timers = new TimerTable((id) => this.policyFor(id))
  }

  list(): ScriptRecord[] {
    return [...this.scripts.values()]
      .map((s) => s.record)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** All menu definitions from enabled scripts. */
  listMenus(): MenuDefinition[] {
    const out: MenuDefinition[] = []
    for (const entry of this.scripts.values()) {
      if (!entry.record.enabled) continue
      out.push(...entry.record.menus)
    }
    return out
  }

  /** Load .mrc/.txt/.misst scripts already on disk. */
  loadFromDisk(): void {
    if (!existsSync(this.dir)) return
    for (const file of readdirSync(this.dir)) {
      if (!/\.(mrc|txt|misst)$/i.test(file)) continue
      const source = readFileSync(join(this.dir, file), 'utf8')
      this.importSource(file, source, { persist: false, trusted: false })
    }
  }

  importSource(
    name: string,
    source: string,
    opts: { persist?: boolean; trusted?: boolean; permissions?: ScriptPermission[] } = {}
  ): ScriptRecord {
    const id = randomUUID()
    const filename = sanitizeName(normalizeFilename(name))
    const persist = opts.persist !== false
    if (persist) writeFileSync(join(this.dir, filename), source, 'utf8')

    const parsed = parseScript(source)
    const menuParsed = parseMenus(source)
    const compat = diagnoseCompatibility(source)
    const diagnostics = toDiagnostics(compat, menuParsed.errors)

    // Parse errors OR blocking unsupported → error status (still imported for inspection)
    const blocking = parsed.errors.length > 0 || diagnostics.hasBlockingUnsupported
    const record: ScriptRecord = {
      id,
      name: filename,
      filename,
      source,
      enabled: !blocking,
      trusted: Boolean(opts.trusted),
      permissions:
        opts.permissions ??
        (opts.trusted ? DEFAULT_SANDBOX_POLICY.allowed : UNTRUSTED_POLICY.allowed),
      parseErrors: parsed.errors,
      execErrors: [],
      diagnostics,
      menus: menuParsed.menus,
      status: blocking ? 'error' : 'enabled',
      aliasCount: 0,
      eventCount: 0,
      menuCount: menuParsed.menus.length,
      loadedAt: Date.now()
    }

    let runtime: ScriptRuntime | null = null
    // Allow runtime when parse succeeded even if unsupported markers exist —
    // but keep disabled when blocking so user must acknowledge / strip.
    if (parsed.file && parsed.errors.length === 0 && !diagnostics.hasBlockingUnsupported) {
      runtime = this.createRuntime(id, parsed.file, record)
      record.aliasCount = runtime.aliasNames.length
      record.eventCount = runtime.eventCount
    } else if (parsed.file && parsed.errors.length === 0) {
      // Build runtime for inspection but leave disabled
      runtime = this.createRuntime(id, parsed.file, record)
      record.aliasCount = runtime.aliasNames.length
      record.eventCount = runtime.eventCount
      record.enabled = false
      record.status = 'error'
    }

    for (const [sid, entry] of this.scripts) {
      if (entry.record.filename === filename) {
        this.timers.clearScript(sid)
        this.scripts.delete(sid)
      }
    }

    this.scripts.set(id, { record, ast: parsed.file, runtime })
    return record
  }

  /**
   * Enable a script. Refuses when parse errors remain.
   * Blocking unsupported can be overridden with `force` after user ack.
   */
  enable(id: string, force = false): void {
    const entry = this.scripts.get(id)
    if (!entry) return
    if (entry.record.parseErrors.length) {
      entry.record.status = 'error'
      entry.record.enabled = false
      return
    }
    if (entry.record.diagnostics.hasBlockingUnsupported && !force) {
      entry.record.status = 'error'
      entry.record.enabled = false
      entry.record.execErrors = [
        ...entry.record.execErrors,
        'Enable blocked: unsupported features reported — use force enable after review'
      ].slice(-20)
      return
    }
    if (!entry.runtime && entry.ast) {
      entry.runtime = this.createRuntime(id, entry.ast, entry.record)
    }
    entry.record.enabled = true
    entry.record.status = 'enabled'
  }

  disable(id: string): void {
    const entry = this.scripts.get(id)
    if (!entry) return
    entry.record.enabled = false
    entry.record.status = 'disabled'
    this.timers.clearScript(id)
  }

  reload(id: string): ScriptRecord | null {
    const entry = this.scripts.get(id)
    if (!entry) return null
    const path = join(this.dir, entry.record.filename)
    const source = existsSync(path) ? readFileSync(path, 'utf8') : entry.record.source
    this.timers.clearScript(id)
    this.scripts.delete(id)
    return this.importSource(entry.record.filename, source, {
      persist: false,
      trusted: entry.record.trusted,
      permissions: entry.record.permissions
    })
  }

  unload(id: string): void {
    const entry = this.scripts.get(id)
    if (!entry) return
    this.timers.clearScript(id)
    const path = join(this.dir, entry.record.filename)
    if (existsSync(path)) unlinkSync(path)
    this.scripts.delete(id)
  }

  setPermissions(id: string, permissions: ScriptPermission[]): void {
    const entry = this.scripts.get(id)
    if (!entry) return
    entry.record.permissions = permissions.filter((p) => p !== 'process.exec')
    if (entry.ast) {
      entry.runtime = this.createRuntime(id, entry.ast, entry.record)
      entry.record.aliasCount = entry.runtime.aliasNames.length
      entry.record.eventCount = entry.runtime.eventCount
    }
  }

  /** Invoke a menu command line through the script host (permission-gated at runtime). */
  runMenuCommand(scriptId: string, command: string): boolean {
    const entry = this.scripts.get(scriptId)
    if (!entry?.record.enabled) return false
    const line = command.startsWith('/') ? command : `/${command}`
    if (this.tryAlias(line)) return true
    this.host.sendCommand(scriptId, line)
    return true
  }

  /** Collect invokable menu commands for a target (channel/nick/…). */
  menuCommandsFor(target: string): { scriptId: string; label: string; command: string }[] {
    const t = target.toLowerCase()
    const out: { scriptId: string; label: string; command: string }[] = []
    for (const entry of this.scripts.values()) {
      if (!entry.record.enabled) continue
      for (const menu of entry.record.menus) {
        if (menu.target !== t && menu.rawTarget.toLowerCase() !== t) continue
        for (const cmd of flattenMenuCommands(menu)) {
          out.push({ scriptId: entry.record.id, label: cmd.label, command: cmd.command })
        }
      }
    }
    return out
  }

  tryAlias(line: string): boolean {
    if (!line.startsWith('/')) return false
    const without = line.slice(1)
    const sp = without.indexOf(' ')
    const name = (sp === -1 ? without : without.slice(0, sp)).toLowerCase()
    const args = sp === -1 ? '' : without.slice(sp + 1)
    for (const entry of this.scripts.values()) {
      if (!entry.record.enabled || !entry.runtime) continue
      if (entry.runtime.aliasNames.includes(name)) {
        const ok = entry.runtime.runAlias(name, args)
        entry.record.execErrors = [...entry.runtime.errors].slice(-20)
        return ok
      }
    }
    return false
  }

  dispatch(ctx: EventContext): EventContext {
    const next = { ...ctx }
    for (const entry of this.scripts.values()) {
      if (!entry.record.enabled || !entry.runtime) continue
      entry.runtime.dispatchEvent(next)
      entry.record.execErrors = [...entry.runtime.errors].slice(-20)
      if (next.halt) break
    }
    return next
  }

  private policyFor(scriptId: string): ScriptSandboxPolicy {
    const entry = this.scripts.get(scriptId)
    if (!entry) return UNTRUSTED_POLICY
    const base = entry.record.trusted ? DEFAULT_SANDBOX_POLICY : UNTRUSTED_POLICY
    return grantCapabilities(base, entry.record.permissions)
  }

  private createRuntime(id: string, file: ScriptFile, record: ScriptRecord): ScriptRuntime {
    const effective = grantCapabilities(
      record.trusted ? DEFAULT_SANDBOX_POLICY : UNTRUSTED_POLICY,
      record.permissions
    )
    const host: ScriptHost = {
      echo: (text) => this.host.echo(id, text),
      sendCommand: (line) => this.host.sendCommand(id, line),
      setTimer: (name, delay, reps, body) => this.timers.set(id, name, delay, reps, body),
      clearTimer: (name) => this.timers.clear(id, name)
    }
    return new ScriptRuntime(file, { policy: effective, host, scriptId: id })
  }
}

function toDiagnostics(
  compat: CompatReport,
  menuErrors: { line: number; message: string }[]
): ScriptDiagnostics {
  return {
    summary: formatCompatSummary(compat),
    findings: compat.findings,
    unsupportedCount: compat.unsupportedCount,
    partialCount: compat.partialCount,
    hasBlockingUnsupported: compat.hasBlockingUnsupported,
    menuErrors
  }
}

function normalizeFilename(name: string): string {
  if (/\.(mrc|txt|misst)$/i.test(name)) return name
  return `${name}.mrc`
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'script.mrc'
}
