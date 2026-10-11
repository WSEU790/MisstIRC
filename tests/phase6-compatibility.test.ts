import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  COMPAT_CATALOG,
  diagnoseCompatibility,
  formatCompatSummary
} from '../src/scripting/compat'
import { parseMenus, flattenMenuCommands } from '../src/scripting/menus'
import { parseScript } from '../src/scripting/parser'
import { ScriptRuntime } from '../src/scripting/runtime'
import { ScriptManager } from '../src/scripting/manager'
import { UNTRUSTED_POLICY, DEFAULT_SANDBOX_POLICY } from '../src/scripting/sandbox'

const FIX = join(__dirname, 'fixtures/compatibility')

function load(name: string): string {
  return readFileSync(join(FIX, name), 'utf8')
}

describe('Phase 6 compatibility diagnostics', () => {
  it('catalog covers works / partial / unsupported', () => {
    const statuses = new Set(COMPAT_CATALOG.map((c) => c.status))
    expect(statuses.has('works')).toBe(true)
    expect(statuses.has('partial')).toBe(true)
    expect(statuses.has('unsupported')).toBe(true)
  })

  it('reports /dll as blocking unsupported (never silent)', () => {
    const src = load('workflow-unsupported-dll.mrc')
    const report = diagnoseCompatibility(src)
    expect(report.hasBlockingUnsupported).toBe(true)
    expect(report.findings.some((f) => f.code === 'cmd.dll')).toBe(true)
    expect(formatCompatSummary(report)).toMatch(/unsupported/i)
  })

  it('greeter fixture is non-blocking and parses', () => {
    const src = load('workflow-greeter.mrc')
    const report = diagnoseCompatibility(src)
    expect(report.hasBlockingUnsupported).toBe(false)
    const { file, errors } = parseScript(src)
    expect(errors).toEqual([])
    expect(file?.body.some((b) => b.type === 'AliasDecl')).toBe(true)
    expect(file?.body.some((b) => b.type === 'EventDecl')).toBe(true)
  })

  it('does not silently treat /dll as IRC passthrough at runtime', () => {
    const { file, errors } = parseScript(load('workflow-unsupported-dll.mrc'))
    expect(errors).toEqual([])
    const rt = new ScriptRuntime(file!, {
      scriptId: 'dll-test',
      policy: { ...DEFAULT_SANDBOX_POLICY },
      host: {
        echo: () => undefined,
        sendCommand: () => {
          throw new Error('must not send dll as IRC')
        },
        setTimer: () => undefined,
        clearTimer: () => undefined
      }
    })
    rt.runAlias('boom', '')
    expect(rt.errors.some((e) => /Unsupported script command: \/dll/i.test(e))).toBe(true)
  })
})

describe('Phase 6 menu/popup scaffolding', () => {
  it('parses channel menu with submenu and separator', () => {
    const { menus, errors } = parseMenus(load('workflow-channel-menu.mrc'))
    expect(errors).toEqual([])
    expect(menus).toHaveLength(1)
    expect(menus[0]!.target).toBe('channel')
    const cmds = flattenMenuCommands(menus[0]!)
    expect(cmds.map((c) => c.label)).toEqual(expect.arrayContaining(['Say hi', 'Ping echo']))
    expect(menus[0]!.items.some((i) => i.type === 'separator')).toBe(true)
    expect(menus[0]!.items.some((i) => i.type === 'submenu')).toBe(true)
  })

  it('main parser accepts menu top-level without error', () => {
    const { errors, file } = parseScript(load('workflow-channel-menu.mrc'))
    expect(errors).toEqual([])
    expect(file?.body.some((b) => b.type === 'MenuDecl')).toBe(true)
  })
})

describe('Phase 6 ScriptManager import diagnostics', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0
  })

  function mgr(): ScriptManager {
    const d = mkdtempSync(join(tmpdir(), 'misst-p6-'))
    dirs.push(d)
    return new ScriptManager(d, {
      echo: () => undefined,
      sendCommand: () => undefined
    })
  }

  it('imports greeter enabled with diagnostics summary', () => {
    const m = mgr()
    const rec = m.importSource('greeter.mrc', load('workflow-greeter.mrc'), { trusted: false })
    expect(rec.status).toBe('enabled')
    expect(rec.diagnostics.summary.length).toBeGreaterThan(0)
    expect(rec.diagnostics.hasBlockingUnsupported).toBe(false)
    expect(rec.permissions).toEqual(UNTRUSTED_POLICY.allowed)
  })

  it('blocks enable for dll fixture until force', () => {
    const m = mgr()
    const rec = m.importSource('dll.mrc', load('workflow-unsupported-dll.mrc'), { trusted: true })
    expect(rec.status).toBe('error')
    expect(rec.enabled).toBe(false)
    expect(rec.diagnostics.hasBlockingUnsupported).toBe(true)
    m.enable(rec.id)
    expect(m.list()[0]?.enabled).toBe(false)
    m.enable(rec.id, true)
    expect(m.list()[0]?.enabled).toBe(true)
  })

  it('exposes channel menu commands from imported scaffold', () => {
    const m = mgr()
    m.importSource('menu.mrc', load('workflow-channel-menu.mrc'), { trusted: false })
    const cmds = m.menuCommandsFor('channel')
    expect(cmds.some((c) => c.label === 'Say hi')).toBe(true)
  })

  it('nickserv note fixture stays non-blocking', () => {
    const m = mgr()
    const rec = m.importSource('ns.mrc', load('workflow-nickserv-note.mrc'))
    expect(rec.status).toBe('enabled')
    expect(m.tryAlias('/nssuggest')).toBe(true)
  })

  it('away-echo fixture runs alias under untrusted policy', () => {
    const echoes: string[] = []
    const d = mkdtempSync(join(tmpdir(), 'misst-p6-away-'))
    dirs.push(d)
    const m = new ScriptManager(d, {
      echo: (_id, t) => echoes.push(t),
      sendCommand: () => undefined
    })
    m.importSource('away.mrc', load('workflow-away-echo.mrc'))
    expect(m.tryAlias('/awaystatus')).toBe(true)
    expect(echoes.some((t) => /Away status/i.test(t))).toBe(true)
  })

  it('string-helpers fixture runs $upper/$left/$replace and parses ACTION', () => {
    const echoes: string[] = []
    const d = mkdtempSync(join(tmpdir(), 'misst-p6-str-'))
    dirs.push(d)
    const m = new ScriptManager(d, {
      echo: (_id, t) => echoes.push(t),
      sendCommand: () => undefined
    })
    const rec = m.importSource('str.mrc', load('workflow-string-helpers.mrc'))
    expect(rec.status).toBe('enabled')
    expect(rec.diagnostics.hasBlockingUnsupported).toBe(false)
    expect(m.tryAlias('/strdemo')).toBe(true)
    expect(echoes.some((t) => /upper\s*=\s*HELLOWORLD/i.test(t))).toBe(true)
    expect(echoes.some((t) => /repl\s*=\s*HelloMisstIRC/i.test(t))).toBe(true)
    echoes.length = 0
    m.dispatch({
      event: 'ACTION',
      nick: 'eve',
      chan: '#lobby',
      text: 'waves',
      me: 'me',
      network: 'TestNet'
    })
    expect(echoes.some((t) => /action from eve/i.test(t))).toBe(true)
  })

  it('kick-topic fixture dispatches KICK/TOPIC/NICK', () => {
    const echoes: string[] = []
    const d = mkdtempSync(join(tmpdir(), 'misst-p6-kick-'))
    dirs.push(d)
    const m = new ScriptManager(d, {
      echo: (_id, t) => echoes.push(t),
      sendCommand: () => undefined
    })
    const rec = m.importSource('kt.mrc', load('workflow-kick-topic.mrc'))
    expect(rec.enabled).toBe(true)
    m.dispatch({
      event: 'KICK',
      nick: 'op',
      chan: '#c',
      target: 'spammer',
      text: 'bye',
      network: 'N',
      me: 'me'
    })
    m.dispatch({
      event: 'TOPIC',
      nick: 'op',
      chan: '#c',
      text: 'new topic',
      network: 'N',
      me: 'me'
    })
    m.dispatch({ event: 'NICK', nick: 'old', text: 'new', me: 'me', network: 'N' })
    expect(echoes.some((t) => /kick\s*:\s*op kicked spammer/i.test(t))).toBe(true)
    expect(echoes.some((t) => /topic by op/i.test(t))).toBe(true)
    expect(echoes.some((t) => /nick change old to new/i.test(t))).toBe(true)
  })
})
