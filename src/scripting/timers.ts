import type { ScriptSandboxPolicy } from './sandbox'

interface TimerEntry {
  id: NodeJS.Timeout
  scriptId: string
  name: string
}

/** Global timer table with per-script caps. Infinite repeats capped for safety. */
export class TimerTable {
  private timers = new Map<string, TimerEntry>()
  private static readonly MAX_INFINITE_TICKS = 500

  constructor(private readonly getPolicy: (scriptId: string) => ScriptSandboxPolicy) {}

  countFor(scriptId: string): number {
    let n = 0
    for (const t of this.timers.values()) if (t.scriptId === scriptId) n += 1
    return n
  }

  set(
    scriptId: string,
    name: string,
    delaySec: number,
    repeats: number,
    fn: () => void
  ): void {
    const policy = this.getPolicy(scriptId)
    const key = `${scriptId}:${name}`
    this.clear(scriptId, name)
    if (this.countFor(scriptId) >= policy.maxTimers) {
      throw new Error(`Timer limit exceeded for script (${policy.maxTimers})`)
    }

    const delayMs = Math.max(50, delaySec * 1000)
    // 0 = "infinite" in mIRC — hard-cap ticks
    let left = repeats === 0 ? TimerTable.MAX_INFINITE_TICKS : Math.max(1, repeats)

    const tick = (): void => {
      try {
        fn()
      } finally {
        left -= 1
        if (left <= 0) {
          this.timers.delete(key)
          return
        }
        const id = setTimeout(tick, delayMs)
        this.timers.set(key, { id, scriptId, name })
      }
    }

    const id = setTimeout(tick, delayMs)
    this.timers.set(key, { id, scriptId, name })
  }

  clear(scriptId: string, name: string): void {
    const key = `${scriptId}:${name}`
    const t = this.timers.get(key)
    if (t) {
      clearTimeout(t.id)
      this.timers.delete(key)
    }
  }

  clearScript(scriptId: string): void {
    for (const [key, t] of [...this.timers]) {
      if (t.scriptId === scriptId) {
        clearTimeout(t.id)
        this.timers.delete(key)
      }
    }
  }

  clearAll(): void {
    for (const t of this.timers.values()) clearTimeout(t.id)
    this.timers.clear()
  }
}
