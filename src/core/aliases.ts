import type { AliasRule } from '@shared/types'

const MAX_ALIAS_EXPANDS = 8

/**
 * Expand `/aliasname args` using network aliases.
 * Returns null if not an alias. Guards against runaway recursion.
 */
export function expandAlias(
  line: string,
  aliases: AliasRule[] | undefined
): string | null {
  if (!line.startsWith('/') || !aliases?.length) return null
  const without = line.slice(1)
  const sp = without.indexOf(' ')
  const name = (sp === -1 ? without : without.slice(0, sp)).toLowerCase()
  const argStr = sp === -1 ? '' : without.slice(sp + 1)
  const rule = aliases.find((a) => a.enabled && a.name.toLowerCase() === name)
  if (!rule) return null

  let expanded = applyArgs(rule.expansion, argStr)
  let guard = 0
  while (expanded.startsWith('/') && guard < MAX_ALIAS_EXPANDS) {
    const next = expandAliasOnce(expanded, aliases)
    if (!next) break
    expanded = next
    guard += 1
  }
  if (guard >= MAX_ALIAS_EXPANDS) {
    throw new Error('Alias expansion limit exceeded (runaway safeguard)')
  }
  return expanded
}

function expandAliasOnce(line: string, aliases: AliasRule[]): string | null {
  if (!line.startsWith('/')) return null
  const without = line.slice(1)
  const sp = without.indexOf(' ')
  const name = (sp === -1 ? without : without.slice(0, sp)).toLowerCase()
  const argStr = sp === -1 ? '' : without.slice(sp + 1)
  const rule = aliases.find((a) => a.enabled && a.name.toLowerCase() === name)
  if (!rule) return null
  return applyArgs(rule.expansion, argStr)
}

function applyArgs(expansion: string, argStr: string): string {
  const args = argStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, '')) ?? []
  let out = expansion.replace(/\$\*/g, argStr)
  out = out.replace(/\$(\d+)/g, (_m, n: string) => args[Number(n) - 1] ?? '')
  return out
}
