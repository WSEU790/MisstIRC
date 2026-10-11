/**
 * MisstIRC scripting (Phase 5–6).
 * Structured AST + sandboxed runtime + compatibility diagnostics.
 * Full mIRC / NNScript drop-in compatibility is NOT claimed.
 */

export type { ParseError, ScriptFile, MenuDecl } from './ast'
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
  type ScriptStatus,
  type ScriptDiagnostics
} from './manager'
export {
  diagnoseCompatibility,
  formatCompatSummary,
  COMPAT_CATALOG,
  UNSUPPORTED_COMMANDS,
  type CompatFinding,
  type CompatReport,
  type CompatStatus
} from './compat'
export {
  parseMenus,
  flattenMenuCommands,
  type MenuDefinition,
  type MenuItem,
  type MenuTarget
} from './menus'
