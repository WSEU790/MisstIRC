import type { IgnoreRule } from '@shared/types'

/** Convert IRC-style mask (* ?) to RegExp. */
export function maskToRegExp(mask: string): RegExp {
  const escaped = mask
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

export function hostmask(nick?: string | null, user?: string | null, host?: string | null): string {
  return `${nick ?? '*'}!${user ?? '*'}@${host ?? '*'}`
}

export function matchesIgnore(
  rules: IgnoreRule[] | undefined,
  opts: {
    nick?: string | null
    user?: string | null
    host?: string | null
    channel?: string
    kind: 'privmsg' | 'notice' | 'ctcp'
  }
): boolean {
  if (!rules?.length) return false
  const mask = hostmask(opts.nick, opts.user, opts.host)
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.channel && opts.channel && rule.channel.toLowerCase() !== opts.channel.toLowerCase()) {
      continue
    }
    if (opts.kind === 'privmsg' && rule.privmsg === false) continue
    if (opts.kind === 'notice' && rule.notice === false) continue
    if (opts.kind === 'ctcp' && rule.ctcp === false) continue
    if (maskToRegExp(rule.mask).test(mask) || maskToRegExp(rule.mask).test(opts.nick ?? '')) {
      return true
    }
  }
  return false
}
