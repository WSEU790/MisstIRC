/** Pure helpers for windowed / virtualized list rendering. */

export interface VirtualWindow {
  start: number
  end: number
  offsetTop: number
  totalHeight: number
}

export function computeVirtualWindow(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  overscan = 12
): VirtualWindow {
  const totalHeight = Math.max(0, itemCount * itemHeight)
  if (itemCount === 0 || itemHeight <= 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: 0 }
  }
  const first = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visible = Math.ceil(viewportHeight / itemHeight) + overscan * 2
  const end = Math.min(itemCount, first + visible)
  return {
    start: first,
    end,
    offsetTop: first * itemHeight,
    totalHeight
  }
}
