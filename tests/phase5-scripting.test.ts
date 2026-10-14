import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lex } from '../src/scripting/lexer'
import { parseScript } from '../src/scripting/parser'
import {
  DEFAULT_SANDBOX_POLICY,
  UNTRUSTED_POLICY,
  assertPermission,
  grantCapabilities
} from '../src/scripting/sandbox'
import { ScriptRuntime } from '../src/scripting/runtime'
import { ScriptManager } from '../src/scripting/manager'
import { ConnectionManager } from '../src/core/manager'
import { IrcConnection } from '../src/core/connection'
import { MockIrcServer } from '../src/mock-irc/server'

describe('Phase 5 lexer/parser', () => {
  it('lexes keywords, vars, and dollars', () => {
    const toks = lex('alias hi {\n  echo -a %x $nick\n}')
    expect(toks.some((t) => t.kind === 'KW_ALIAS')).toBe(true)
    expect(toks.some((t) => t.kind === 'VAR' && t.value === '%x')).toBe(true)
    expect(toks.some((t) => t.kind === 'DOLLAR' && t.value === '$nick')).toBe(true)
  })

  it('parses alias / on / if into AST (not string-eval)', () => {
    const src = `
alias greeter {
  var %n = $1
  if (%n == alice) {
    echo -a hi alice
  }
  else {
    echo -a hi stranger
  }
}

on *:TEXT:ping*:#:{
  echo -a pong from $nick
}
`
    const { file, errors } = parseScript(src)
    expect(errors).toEqual([])
    expect(file?.body).toHaveLength(2)
    expect(file?.body[0]?.type).toBe('AliasDecl')
    expect(file?.body[1]?.type).toBe('EventDecl')
    if (file?.body[0]?.type === 'AliasDecl') {
      expect(file.body[0].name).toBe('greeter')
      expect(file.body[0].body.some((s) => s.type === 'IfStmt')).toBe(true)
    }
  })

  it('reports parse errors without throwing', () => {
    const { file, errors } = parseScript('this is not a top-level')
    expect(errors.length).toBeGreaterThan(0)
    expect(file).toBeTruthy()
  })
})

describe('Phase 5 sandbox', () => {
  it('denies missing permissions and forbids DLL', () => {
    expect(() => assertPermission(UNTRUSTED_POLICY, 'network.send')).toThrow(/Permission denied/)
    expect(() => assertPermission(UNTRUSTED_POLICY, 'ui.echo')).not.toThrow()
    const granted = grantCapabilities(UNTRUSTED_POLICY, ['irc.command', 'network.send'])
    expect(granted.allowDllCalls).toBe(false)
    expect(granted.allowed).toContain('irc.command')
  })

  it('untrusted policy is stricter than default trusted', () => {
    expect(UNTRUSTED_POLICY.maxInstructionsPerTick).toBeLessThan(
      DEFAULT_SANDBOX_POLICY.maxInstructionsPerTick
    )
    expect(UNTRUSTED_POLICY.allowed).not.toContain('network.send')
  })
})

describe('Phase 5 runtime', () => {
  it('runs aliases, vars, and echo under policy', () => {
    const { file, errors } = parseScript(`
alias hi {
  var %x = 1
  echo -a hello $1
}
`)
    expect(errors).toEqual([])
    const echoes: string[] = []
    const rt = new ScriptRuntime(file!, {
      scriptId: 't1',
      policy: UNTRUSTED_POLICY,
      host: {
        echo: (t) => echoes.push(t),
        sendCommand: () => {
          throw new Error('should not send')
        },
        setTimer: () => undefined,
        clearTimer: () => undefined
      }
    })
    expect(rt.runAlias('hi', 'world')).toBe(true)
    expect(echoes).toEqual(['hello world'])
  })

  it('blocks network commands without grant', () => {
    const { file } = parseScript(`alias shout { msg #chan hi }`)
    const rt = new ScriptRuntime(file!, {
      scriptId: 't2',
      policy: UNTRUSTED_POLICY,
      host: {
        echo: () => undefined,
        sendCommand: () => {
          throw new Error('send')
        },
        setTimer: () => undefined,
        clearTimer: () => undefined
      }
    })
    rt.runAlias('shout', '')
    expect(rt.errors.some((e) => /Permission denied: irc\.command|network\.send/.test(e))).toBe(
      true
    )
  })

  it('enforces while iteration limits', () => {
    const { file } = parseScript(`
alias loop {
  var %i = 0
  while (1 == 1) {
    echo -a x
  }
}
`)
    const rt = new ScriptRuntime(file!, {
      scriptId: 't3',
      policy: { ...UNTRUSTED_POLICY, maxWhileIterations: 5, maxInstructionsPerTick: 100_000 },
      host: {
        echo: () => undefined,
        sendCommand: () => undefined,
        setTimer: () => undefined,
        clearTimer: () => undefined
      }
    })
    rt.runAlias('loop', '')
    expect(rt.errors.some((e) => /while|iteration|limit/i.test(e))).toBe(true)
  })

  it('dispatches TEXT events and halt', () => {
    const { file, errors } = parseScript(`
on *:TEXT:secret*:#:{
  echo -a caught
  halt
}
`)
    expect(errors).toEqual([])
    const echoes: string[] = []
    const rt = new ScriptRuntime(file!, {
      scriptId: 't4',
      policy: UNTRUSTED_POLICY,
      host: {
        echo: (t) => echoes.push(t),
        sendCommand: () => undefined,
        setTimer: () => undefined,
        clearTimer: () => undefined
      }
    })
    const ctx = rt.dispatchEvent({
      event: 'TEXT',
      nick: 'bob',
      chan: '#room',
      target: '#room',
      text: 'secret code'
    })
    expect(echoes).toEqual(['caught'])
    expect(ctx.halt).toBe(true)
  })
})

describe('Phase 5 ScriptManager', () => {
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

  function tempDir(): string {
    const d = mkdtempSync(join(tmpdir(), 'misst-scripts-'))
    dirs.push(d)
    return d
  }

  it('imports, disables, enables, reloads, unloads with parse errors', () => {
    const dir = tempDir()
    const mgr = new ScriptManager(dir, {
      echo: () => undefined,
      sendCommand: () => undefined
    })
    const ok = mgr.importSource(
      'hello.mrc',
      `alias hi { echo -a ok }\non *:JOIN:#:{ echo -a joined }`,
      { trusted: false }
    )
    expect(ok.status).toBe('enabled')
    expect(ok.aliasCount).toBe(1)
    expect(ok.eventCount).toBe(1)
    expect(ok.permissions).toEqual(UNTRUSTED_POLICY.allowed)

    mgr.disable(ok.id)
    expect(mgr.list()[0]?.status).toBe('disabled')
    mgr.enable(ok.id)
    expect(mgr.list()[0]?.status).toBe('enabled')

    const bad = mgr.importSource('bad.mrc', 'not valid top level stuff', { trusted: false })
    expect(bad.status).toBe('error')
    expect(bad.parseErrors.length).toBeGreaterThan(0)

    const reloaded = mgr.reload(ok.id)
    expect(reloaded?.filename).toBe('hello.mrc')
    expect(reloaded?.id).toBeTruthy()
    mgr.unload(reloaded!.id)
    expect(mgr.list().some((s) => s.filename === 'hello.mrc')).toBe(false)
  })

  it('tryAlias routes to runtime', () => {
    const dir = tempDir()
    const echoes: string[] = []
    const mgr = new ScriptManager(dir, {
      echo: (_id, t) => echoes.push(t),
      sendCommand: () => undefined
    })
    mgr.importSource('a.mrc', 'alias wave { echo -a wave $1 }', { trusted: false })
    expect(mgr.tryAlias('/wave bob')).toBe(true)
    expect(echoes).toEqual(['wave bob'])
    expect(mgr.tryAlias('/nosuch')).toBe(false)
  })

  it('strips process.exec from permission grants', () => {
    const dir = tempDir()
    const mgr = new ScriptManager(dir, {
      echo: () => undefined,
      sendCommand: () => undefined
    })
    const rec = mgr.importSource('p.mrc', 'alias x { echo -a x }', { trusted: false })
    mgr.setPermissions(rec.id, ['ui.echo', 'process.exec', 'timer'])
    expect(mgr.list()[0]?.permissions).not.toContain('process.exec')
    expect(mgr.list()[0]?.permissions).toContain('timer')
  })
})

describe('Phase 5 integration with ConnectionManager', () => {
  let server: MockIrcServer

  afterEach(async () => {
    await server?.stop()
  })

  it('script alias runs before slash handling', async () => {
    server = new MockIrcServer()
    const port = await server.start()
    const dir = mkdtempSync(join(tmpdir(), 'misst-int-'))
    const manager = new ConnectionManager()
    const echoes: string[] = []
    const scripts = new ScriptManager(dir, {
      echo: (id, t) => {
        echoes.push(t)
        manager.scriptEcho(id, t)
      },
      sendCommand: (id, line) => manager.scriptSendCommand(id, line)
    })
    manager.setScriptManager(scripts)
    scripts.importSource('hi.mrc', 'alias hi { echo -a scripted }', { trusted: false })

    const conn = new IrcConnection({
      network: {
        id: 'n1',
        name: 'Test',
        host: '127.0.0.1',
        port,
        tls: false,
        rejectUnauthorized: false,
        nick: 'tester',
        username: 'tester',
        realname: 'Tester',
        channels: ['#lobby']
      }
    })
    manager.attach(conn)
    await conn.connect()
    await vi.waitFor(() => expect(conn.state).toBe('connected'), { timeout: 5000 })

    const messages: string[] = []
    manager.on('message', (m) => messages.push(m.text))
    manager.sendInput(conn.id, '#lobby', '/hi')
    expect(echoes.some((t) => t.includes('scripted'))).toBe(true)
    expect(messages.some((t) => t.includes('[script]') && t.includes('scripted'))).toBe(true)

    conn.disconnect()
    rmSync(dir, { recursive: true, force: true })
  })
})
