/**
 * Scripting subsystem scaffold (Phase 5–6).
 * Full mIRC / NNScript runtime is NOT implemented.
 * Any future import path must enforce permissions and execution limits.
 */

export type ScriptPermission =
  | 'network.send'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'ui.dialog'
  | 'process.exec'

export interface ScriptSandboxPolicy {
  /** Deny-by-default permission set */
  allowed: ScriptPermission[]
  maxInstructionsPerTick: number
  maxTimers: number
  allowDllCalls: false
}

export const DEFAULT_SANDBOX_POLICY: ScriptSandboxPolicy = {
  allowed: [],
  maxInstructionsPerTick: 10_000,
  maxTimers: 32,
  allowDllCalls: false
}

export function assertScriptingUnavailable(feature: string): never {
  throw new Error(
    `MisstIRC scripting: "${feature}" is not implemented. Sandbox policy is defined but no runtime is loaded.`
  )
}
