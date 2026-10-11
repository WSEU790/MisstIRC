import type {
  AliasDecl,
  EventDecl,
  Expr,
  RawDecl,
  ScriptFile,
  Statement
} from './ast'
import { UNSUPPORTED_COMMANDS } from './compat'
import {
  assertPermission,
  InstructionBudget,
  type ScriptPermission,
  type ScriptSandboxPolicy
} from './sandbox'

export type ScriptValue = string | number | boolean | null

export interface ScriptHost {
  /** Safe echo to UI/status (requires ui.echo) */
  echo: (text: string) => void
  /** Send IRC input/command (requires irc.command / network.send) */
  sendCommand: (line: string) => void
  /** Schedule timer (requires timer) */
  setTimer: (name: string, delaySec: number, repeats: number, body: () => void) => void
  clearTimer: (name: string) => void
}

export interface EventContext {
  event: string
  nick?: string
  chan?: string
  target?: string
  text?: string
  address?: string
  numeric?: string
  args?: string[]
  raw?: string
  /** Halt further default processing */
  halt?: boolean
}

export interface RuntimeOptions {
  policy: ScriptSandboxPolicy
  host: ScriptHost
  scriptId: string
}

export class ScriptRuntime {
  private globals = new Map<string, ScriptValue>()
  private aliases = new Map<string, AliasDecl>()
  private events: EventDecl[] = []
  private raws: RawDecl[] = []
  private recursion = 0
  readonly errors: string[] = []

  constructor(
    private readonly file: ScriptFile,
    private readonly opts: RuntimeOptions
  ) {
    for (const item of file.body) {
      if (item.type === 'AliasDecl') this.aliases.set(item.name.toLowerCase(), item)
      if (item.type === 'EventDecl') this.events.push(item)
      if (item.type === 'RawDecl') this.raws.push(item)
    }
  }

  get aliasNames(): string[] {
    return [...this.aliases.keys()]
  }

  get eventCount(): number {
    return this.events.length + this.raws.length
  }

  /** Invoke a script alias like `/name args`. Returns true if handled. */
  runAlias(name: string, argStr: string): boolean {
    const alias = this.aliases.get(name.toLowerCase())
    if (!alias) return false
    const budget = new InstructionBudget(this.opts.policy.maxInstructionsPerTick)
    const locals = new Map<string, ScriptValue>()
    this.bindArgs(locals, argStr)
    try {
      this.execBlock(alias.body, locals, budget, emptyEvent('ALIAS'))
    } catch (err) {
      this.errors.push(err instanceof Error ? err.message : String(err))
    }
    return true
  }

  dispatchEvent(ctx: EventContext): EventContext {
    const budget = new InstructionBudget(this.opts.policy.maxInstructionsPerTick)
    const locals = new Map<string, ScriptValue>()
    this.bindEventIdents(locals, ctx)

    if (ctx.numeric) {
      for (const raw of this.raws) {
        if (raw.numeric !== '*' && raw.numeric !== ctx.numeric) continue
        try {
          this.execBlock(raw.body, locals, budget, ctx)
        } catch (err) {
          this.errors.push(err instanceof Error ? err.message : String(err))
        }
        if (ctx.halt) return ctx
      }
    }

    for (const ev of this.events) {
      if (ev.event !== ctx.event.toUpperCase()) continue
      if (ev.textMatch && ev.textMatch !== '*' && ctx.text !== undefined) {
        if (!matchPattern(ev.textMatch, ctx.text)) continue
      }
      if (ev.targetMatch && ev.targetMatch !== '*' && ev.targetMatch !== '#') {
        const target = ctx.target ?? ctx.chan ?? ''
        if (!matchPattern(ev.targetMatch, target) && !matchPattern(ev.targetMatch, ctx.chan ?? '')) {
          continue
        }
      }
      // mIRC `#` target means "any channel"; require a channel context when used
      if (ev.targetMatch === '#' && !ctx.chan && !(ctx.target?.startsWith('#') || ctx.target?.startsWith('&'))) {
        continue
      }
      try {
        this.execBlock(ev.body, locals, budget, ctx)
      } catch (err) {
        this.errors.push(err instanceof Error ? err.message : String(err))
      }
      if (ctx.halt) break
    }
    return ctx
  }

  private bindArgs(locals: Map<string, ScriptValue>, argStr: string): void {
    const args = splitArgs(argStr)
    locals.set('$1-', argStr)
    locals.set('$*', argStr)
    locals.set('$0', String(args.length))
    for (let i = 0; i < args.length; i++) {
      locals.set(`$${i + 1}`, args[i]!)
    }
  }

  private bindEventIdents(locals: Map<string, ScriptValue>, ctx: EventContext): void {
    if (ctx.nick) locals.set('$nick', ctx.nick)
    if (ctx.chan) locals.set('$chan', ctx.chan)
    if (ctx.target) locals.set('$target', ctx.target)
    if (ctx.text !== undefined) {
      locals.set('$1-', ctx.text)
      locals.set('$1', ctx.text.split(/\s+/)[0] ?? '')
    }
    if (ctx.address) locals.set('$address', ctx.address)
    if (ctx.numeric) locals.set('$numeric', ctx.numeric)
  }

  private execBlock(
    body: Statement[],
    locals: Map<string, ScriptValue>,
    budget: InstructionBudget,
    ctx: EventContext
  ): ScriptValue {
    this.recursion += 1
    if (this.recursion > this.opts.policy.maxRecursion) {
      this.recursion -= 1
      throw new Error('Script recursion limit exceeded')
    }
    try {
      for (const stmt of body) {
        budget.tick()
        const result = this.execStmt(stmt, locals, budget, ctx)
        if (result === '__HALT__') {
          ctx.halt = true
          return null
        }
        if (result === '__RETURN__') return locals.get('__return') ?? null
      }
      return null
    } finally {
      this.recursion -= 1
    }
  }

  private execStmt(
    stmt: Statement,
    locals: Map<string, ScriptValue>,
    budget: InstructionBudget,
    ctx: EventContext
  ): ScriptValue | '__HALT__' | '__RETURN__' {
    switch (stmt.type) {
      case 'BlockStmt':
        return this.execBlock(stmt.body, locals, budget, ctx)
      case 'VarStmt': {
        const v = this.evalExpr(stmt.value, locals, budget, ctx)
        this.globals.set(stmt.name.toLowerCase(), v)
        locals.set(stmt.name.toLowerCase(), v)
        return null
      }
      case 'HaltStmt':
        return '__HALT__'
      case 'ReturnStmt': {
        const v = stmt.value ? this.evalExpr(stmt.value, locals, budget, ctx) : null
        locals.set('__return', v)
        return '__RETURN__'
      }
      case 'IfStmt': {
        const t = this.evalExpr(stmt.test, locals, budget, ctx)
        if (truthy(t)) return this.execBlock(stmt.consequent, locals, budget, ctx)
        if (stmt.alternate) return this.execBlock(stmt.alternate, locals, budget, ctx)
        return null
      }
      case 'WhileStmt': {
        let i = 0
        while (truthy(this.evalExpr(stmt.test, locals, budget, ctx))) {
          budget.tick()
          i += 1
          if (i > this.opts.policy.maxWhileIterations) {
            throw new Error('while() iteration limit exceeded')
          }
          const r = this.execBlock(stmt.body, locals, budget, ctx)
          if (r === '__HALT__' || r === '__RETURN__') return r
        }
        return null
      }
      case 'CommandStmt':
        this.execCommand(stmt.name, stmt.rawArgs, stmt.args, locals, budget, ctx)
        return null
      default:
        return null
    }
  }

  private execCommand(
    name: string,
    rawArgs: string,
    argExprs: Expr[],
    locals: Map<string, ScriptValue>,
    budget: InstructionBudget,
    ctx: EventContext
  ): void {
    budget.tick()
    const expanded = this.expandRaw(rawArgs, locals, budget, ctx)

    // Nested alias call
    if (this.aliases.has(name)) {
      this.runAlias(name, expanded)
      return
    }

    switch (name) {
      case 'echo': {
        this.require('ui.echo')
        // echo [-a] text — lexer may split "-a" into "- a"
        const text = expanded.replace(/^-\s*a\s+/i, '').trim()
        this.opts.host.echo(text)
        return
      }
      case 'msg':
      case 'say':
      case 'notice':
      case 'describe':
      case 'me':
      case 'join':
      case 'part':
      case 'quit':
      case 'nick':
      case 'mode':
      case 'kick':
      case 'topic':
      case 'whois':
      case 'query': {
        this.require('irc.command')
        this.require('network.send')
        this.opts.host.sendCommand(`/${name} ${expanded}`.trim())
        return
      }
      case 'timer': {
        // timer [name] <delay> <reps> <commands>
        this.require('timer')
        const parts = splitArgs(expanded)
        let timerName = `t_${Date.now()}`
        let delay = 1
        let reps = 1
        let cmd = ''
        if (parts.length >= 3 && Number.isFinite(Number(parts[0])) === false && !/^\d+$/.test(parts[0]!)) {
          timerName = parts[0]!
          delay = Number(parts[1]) || 1
          reps = Number(parts[2]) || 1
          cmd = parts.slice(3).join(' ')
        } else {
          delay = Number(parts[0]) || 1
          reps = Number(parts[1]) || 1
          cmd = parts.slice(2).join(' ')
        }
        this.opts.host.setTimer(timerName, delay, reps, () => {
          try {
            this.execCommandLine(cmd)
          } catch (err) {
            this.errors.push(err instanceof Error ? err.message : String(err))
          }
        })
        return
      }
      case 'timerc':
      case 'timerx': {
        this.require('timer')
        const n = splitArgs(expanded)[0]
        if (n) this.opts.host.clearTimer(n)
        return
      }
      case 'inc':
      case 'dec': {
        const vname = (argExprs[0] && argExprs[0].type === 'VarExpr'
          ? argExprs[0].name
          : splitArgs(expanded)[0] ?? ''
        ).toLowerCase()
        const cur = Number(this.globals.get(vname) ?? locals.get(vname) ?? 0)
        const next = name === 'inc' ? cur + 1 : cur - 1
        this.globals.set(vname, next)
        locals.set(vname, next)
        return
      }
      case 'halt':
        ctx.halt = true
        return
      case 'return':
        return
      default: {
        if (UNSUPPORTED_COMMANDS.has(name)) {
          const msg = `Unsupported script command: /${name} (not silently ignored)`
          this.errors.push(msg)
          throw new Error(msg)
        }
        // Unknown but not in unsupported list → IRC slash if permitted
        this.require('irc.command')
        this.opts.host.sendCommand(`/${name} ${expanded}`.trim())
      }
    }
  }

  private execCommandLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return
    const without = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
    const sp = without.indexOf(' ')
    const name = (sp === -1 ? without : without.slice(0, sp)).toLowerCase()
    const args = sp === -1 ? '' : without.slice(sp + 1)
    const budget = new InstructionBudget(this.opts.policy.maxInstructionsPerTick)
    this.execCommand(name, args, [], new Map(), budget, emptyEvent('TIMER'))
  }

  private expandRaw(
    raw: string,
    locals: Map<string, ScriptValue>,
    budget: InstructionBudget,
    ctx: EventContext
  ): string {
    return raw.replace(/(\$?[0-9]+-|\$[A-Za-z0-9_]+|\$[0-9]+|%[A-Za-z0-9_.]+)/g, (m) => {
      budget.tick()
      if (m.startsWith('%')) {
        const v = locals.get(m.toLowerCase()) ?? this.globals.get(m.toLowerCase())
        return v === null || v === undefined ? '' : String(v)
      }
      const v = locals.get(m) ?? this.globals.get(m)
      if (v !== undefined && v !== null) return String(v)
      // evaluate as ident
      return String(this.evalExpr({ type: 'IdentExpr', name: m }, locals, budget, ctx) ?? '')
    })
  }

  private evalExpr(
    expr: Expr,
    locals: Map<string, ScriptValue>,
    budget: InstructionBudget,
    ctx: EventContext
  ): ScriptValue {
    budget.tick()
    switch (expr.type) {
      case 'StringExpr':
        return expr.value
      case 'NumberExpr':
        return expr.value
      case 'VarExpr':
        return locals.get(expr.name.toLowerCase()) ?? this.globals.get(expr.name.toLowerCase()) ?? ''
      case 'IdentExpr':
        return locals.get(expr.name) ?? this.ident(expr.name, ctx)
      case 'UnaryExpr': {
        const v = this.evalExpr(expr.argument, locals, budget, ctx)
        if (expr.op === '!') return !truthy(v)
        return -Number(v)
      }
      case 'BinaryExpr': {
        const l = this.evalExpr(expr.left, locals, budget, ctx)
        const r = this.evalExpr(expr.right, locals, budget, ctx)
        switch (expr.op) {
          case '==':
            return String(l) === String(r)
          case '!=':
            return String(l) !== String(r)
          case '<':
            return Number(l) < Number(r)
          case '>':
            return Number(l) > Number(r)
          case '<=':
            return Number(l) <= Number(r)
          case '>=':
            return Number(l) >= Number(r)
          case '&&':
            return truthy(l) && truthy(r)
          case '||':
            return truthy(l) || truthy(r)
          case '+':
            if (typeof l === 'number' && typeof r === 'number') return l + r
            return `${l ?? ''}${r ?? ''}`
          case '-':
            return Number(l) - Number(r)
          case '*':
            return Number(l) * Number(r)
          case '/':
            return Number(r) === 0 ? 0 : Number(l) / Number(r)
          case 'isin':
            return String(r).toLowerCase().includes(String(l).toLowerCase())
          case 'isnum':
            return !Number.isNaN(Number(l))
          default:
            return null
        }
      }
      case 'CallExpr': {
        // Limited safe identifiers as functions
        if (expr.callee === '$upper' || expr.callee === '$lower' || expr.callee === '$len') {
          const a = String(this.evalExpr(expr.args[0] ?? { type: 'StringExpr', value: '' }, locals, budget, ctx))
          if (expr.callee === '$upper') return a.toUpperCase()
          if (expr.callee === '$lower') return a.toLowerCase()
          return a.length
        }
        return this.ident(expr.callee, ctx)
      }
      default:
        return null
    }
  }

  private ident(name: string, ctx: EventContext): ScriptValue {
    switch (name) {
      case '$nick':
        return ctx.nick ?? ''
      case '$chan':
        return ctx.chan ?? ''
      case '$target':
        return ctx.target ?? ''
      case '$true':
        return true
      case '$false':
        return false
      case '$null':
        return null
      case '$script':
        return this.opts.scriptId
      default:
        return ''
    }
  }

  private require(perm: ScriptPermission): void {
    assertPermission(this.opts.policy, perm)
  }
}

function truthy(v: ScriptValue): boolean {
  if (v === null || v === false || v === '' || v === 0) return false
  return true
}

function emptyEvent(event: string): EventContext {
  return { event }
}

function splitArgs(s: string): string[] {
  return s.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, '')) ?? []
}

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === '*' || pattern === '') return true
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${esc}$`, 'i').test(value)
}
