/**
 * MisstIRC scripting foundation (Phase 5).
 * Structured AST lexer/parser + sandboxed runtime — not string-eval.
 * Untrusted by default; no unrestricted Node/fs/net; DLL calls forbidden.
 * Full mIRC / NNScript drop-in compatibility is NOT claimed.
 */

export type { ParseError, ScriptFile } from './ast'
export { lex } from './lexer'
export { parseScript, type ParseResult } from './parser'
export {
  DEFAULT_SANDBOX_POLICY,
  UNTRUSTED_POLICY,
  InstructionBudget,
  assertPermission,
  grantCapabilities,
  type ScriptPermission,
  type ScriptSandboxPolicy
} from './sandbox'
export {
  ScriptRuntime,
  type EventContext,
  type ScriptHost,
  type ScriptValue,
  type RuntimeOptions
} from './runtime'
export { TimerTable } from './timers'
export {
  ScriptManager,
  type ScriptManagerHost,
  type ScriptRecord,
  type ScriptStatus
} from './manager'
