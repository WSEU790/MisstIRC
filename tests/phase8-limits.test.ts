import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MESSAGE_INDEX_MAX, RENDERER_MESSAGE_MAX } from '../src/shared/limits'
import { crashLogPath, writeCrashLog } from '../src/main/crash'

describe('Phase 8 limits + crash log', () => {
  it('documents positive bounded buffer constants', () => {
    expect(MESSAGE_INDEX_MAX).toBe(5_000)
    expect(RENDERER_MESSAGE_MAX).toBe(2_000)
    expect(MESSAGE_INDEX_MAX).toBeGreaterThan(RENDERER_MESSAGE_MAX)
  })

  it('writes crash breadcrumbs to userData/logs/crash.log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'misst-crash-'))
    writeCrashLog(dir, 'testHook', new Error('phase8-test'))
    const text = readFileSync(crashLogPath(dir), 'utf8')
    expect(text).toMatch(/testHook/)
    expect(text).toMatch(/phase8-test/)
    rmSync(dir, { recursive: true, force: true })
  })
})
