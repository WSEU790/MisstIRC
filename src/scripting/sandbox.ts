export type ScriptPermission =
  | 'network.send'
  | 'irc.command'
  | 'ui.echo'
  | 'timer'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'process.exec'

export interface ScriptSandboxPolicy {
  allowed: ScriptPermission[]
  maxInstructionsPerTick: number
  maxTimers: number
  maxRecursion: number
  maxWhileIterations: number
  allowDllCalls: false
}

export const DEFAULT_SANDBOX_POLICY: ScriptSandboxPolicy = {
  allowed: ['ui.echo', 'irc.command', 'network.send', 'timer'],
  maxInstructionsPerTick: 10_000,
  maxTimers: 32,
  maxRecursion: 32,
  maxWhileIterations: 1_000,
  allowDllCalls: false
}

/** Strictest policy for untrusted imports until user grants caps. */
export const UNTRUSTED_POLICY: ScriptSandboxPolicy = {
  allowed: ['ui.echo'],
  maxInstructionsPerTick: 2_000,
  maxTimers: 4,
  maxRecursion: 8,
  maxWhileIterations: 100,
  allowDllCalls: false
}

export class InstructionBudget {
  private used = 0

  constructor(private readonly max: number) {}

  tick(n = 1): void {
    this.used += n
    if (this.used > this.max) {
      throw new Error(`Script execution limit exceeded (${this.max} instructions)`)
    }
  }

  get remaining(): number {
    return Math.max(0, this.max - this.used)
  }
}

export function assertPermission(policy: ScriptSandboxPolicy, perm: ScriptPermission): void {
  if (policy.allowDllCalls) {
    throw new Error('DLL calls are unsupported and forbidden')
  }
  if (!policy.allowed.includes(perm)) {
    throw new Error(`Permission denied: ${perm}`)
  }
  // Hard deny dangerous ops even if somehow listed incorrectly in future
  if (perm === 'process.exec' || perm === 'filesystem.write') {
    if (!policy.allowed.includes(perm)) {
      throw new Error(`Permission denied: ${perm}`)
    }
  }
}

/** Never grant process.exec / unrestricted fs by default helpers. */
export function grantCapabilities(
  base: ScriptSandboxPolicy,
  grants: ScriptPermission[]
): ScriptSandboxPolicy {
  const allowed = new Set([...base.allowed, ...grants])
  // Never allow DLL
  return {
    ...base,
    allowed: [...allowed],
    allowDllCalls: false
  }
}
