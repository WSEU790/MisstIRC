/** Browser-safe UUID (no node:crypto in renderer). */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `net_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
