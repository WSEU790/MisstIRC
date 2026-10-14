/** Window / panel layout settings (Phase 7). */

export interface LayoutSettings {
  navWidth: number
  nicksWidth: number
  showNav: boolean
  showNickList: boolean
  showStatusBar: boolean
  showToolbar: boolean
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  navWidth: 220,
  nicksWidth: 160,
  showNav: true,
  showNickList: true,
  showStatusBar: true,
  showToolbar: true
}

export function clampLayout(input: Partial<LayoutSettings> | null | undefined): LayoutSettings {
  const base = { ...DEFAULT_LAYOUT, ...(input ?? {}) }
  return {
    navWidth: clamp(base.navWidth, 140, 420),
    nicksWidth: clamp(base.nicksWidth, 100, 360),
    showNav: Boolean(base.showNav),
    showNickList: Boolean(base.showNickList),
    showStatusBar: Boolean(base.showStatusBar),
    showToolbar: Boolean(base.showToolbar)
  }
}

export function applyLayoutToElement(
  el: { style: { setProperty: (k: string, v: string) => void }; classList: { toggle: (c: string, f?: boolean) => void } },
  layout: LayoutSettings
): void {
  el.style.setProperty('--nav-w', `${layout.navWidth}px`)
  el.style.setProperty('--nicks-w', `${layout.nicksWidth}px`)
  el.style.setProperty('--status-h', layout.showStatusBar ? '28px' : '0px')
  el.style.setProperty('--toolbar-h', layout.showToolbar ? '44px' : '0px')
  el.classList.toggle('layout-hide-nav', !layout.showNav)
  el.classList.toggle('layout-hide-nicks', !layout.showNickList)
  el.classList.toggle('layout-hide-status', !layout.showStatusBar)
  el.classList.toggle('layout-hide-toolbar', !layout.showToolbar)
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}
