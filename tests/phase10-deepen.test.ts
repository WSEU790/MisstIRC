import { describe, expect, it } from 'vitest'
import { safeCalc } from '../src/shared/safe-calc'
import { substituteMenuPlaceholders } from '../src/shared/menu-placeholders'
import { acceptQueryMessage } from '../src/shared/query-flood'
import { computeVirtualWindow } from '../src/shared/virtual-window'
import { diagnoseCompatibility } from '../src/scripting/compat'
import { QUERY_FLOOD_MAX, QUERY_FLOOD_WINDOW_MS } from '../src/shared/limits'

describe('0.10.0 deepen helpers', () => {
  it('safeCalc evaluates precedence and rejects junk', () => {
    expect(safeCalc('2+3*4')).toBe(14)
    expect(safeCalc('(2+3)*4')).toBe(20)
    expect(safeCalc('-3+5')).toBe(2)
    expect(() => safeCalc('2+alert(1)')).toThrow(/invalid/i)
  })

  it('substituteMenuPlaceholders expands $$1 and $nick', () => {
    expect(substituteMenuPlaceholders('whois $$1', { nick: 'alice' })).toBe('whois alice')
    expect(
      substituteMenuPlaceholders('msg $nick hi from $me on $chan', {
        nick: 'bob',
        me: 'me',
        chan: '#lobby'
      })
    ).toBe('msg bob hi from me on #lobby')
  })

  it('query flood accepts up to max then rejects', () => {
    const buckets = new Map<string, number[]>()
    const key = 'c1:spammer'
    const t0 = 1_000_000
    for (let i = 0; i < QUERY_FLOOD_MAX; i++) {
      expect(acceptQueryMessage(buckets, key, t0 + i, {
        maxPerWindow: QUERY_FLOOD_MAX,
        windowMs: QUERY_FLOOD_WINDOW_MS
      }).accept).toBe(true)
    }
    const blocked = acceptQueryMessage(buckets, key, t0 + QUERY_FLOOD_MAX, {
      maxPerWindow: QUERY_FLOOD_MAX,
      windowMs: QUERY_FLOOD_WINDOW_MS
    })
    expect(blocked.accept).toBe(false)
    expect(blocked.flooded).toBe(true)
    // After window elapses, accept again
    const later = acceptQueryMessage(buckets, key, t0 + QUERY_FLOOD_WINDOW_MS + 1, {
      maxPerWindow: QUERY_FLOOD_MAX,
      windowMs: QUERY_FLOOD_WINDOW_MS
    })
    expect(later.accept).toBe(true)
  })

  it('virtual window only covers visible + overscan rows', () => {
    const win = computeVirtualWindow(480, 240, 1000, 24, 5)
    expect(win.start).toBeGreaterThan(0)
    expect(win.end - win.start).toBeLessThan(1000)
    expect(win.totalHeight).toBe(1000 * 24)
    expect(win.offsetTop).toBe(win.start * 24)
  })

  it('$iif / $calc are non-blocking in compat diagnostics', () => {
    const report = diagnoseCompatibility('alias x { echo -a $iif(1,a,b) $calc(1+1) }')
    expect(report.hasBlockingUnsupported).toBe(false)
    expect(report.findings.some((f) => f.construct === '$iif' && f.status === 'works')).toBe(true)
    expect(report.findings.some((f) => f.construct === '$calc' && f.status === 'works')).toBe(true)
  })
})
