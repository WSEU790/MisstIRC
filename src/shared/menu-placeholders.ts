/** Substitute common mIRC-style placeholders in popup menu command lines. */

export interface MenuPlaceholderCtx {
  nick?: string
  chan?: string
  me?: string
  network?: string
}

/**
 * Expand $$1 / $1 / $nick / $chan / $me / $network in a menu command before invoke.
 * Does not run a full script evaluator — only the placeholders used by popup scaffolds.
 */
export function substituteMenuPlaceholders(command: string, ctx: MenuPlaceholderCtx): string {
  const nick = ctx.nick ?? ''
  const chan = ctx.chan ?? ''
  const me = ctx.me ?? ''
  const network = ctx.network ?? ''
  return command
    .replace(/\$\$1\b/g, nick)
    .replace(/\$1-(?:\d+)?\b/g, nick)
    .replace(/\$1\b/g, nick)
    .replace(/\$nick\b/gi, nick)
    .replace(/\$chan\b/gi, chan)
    .replace(/\$me\b/gi, me)
    .replace(/\$network\b/gi, network)
}
