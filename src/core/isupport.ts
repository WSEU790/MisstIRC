/** Parse RPL_ISUPPORT (005) tokens into a key/value map. */
export function parseIsupportTokens(tokens: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const token of tokens) {
    if (!token || token.startsWith(':')) continue
    const eq = token.indexOf('=')
    if (eq === -1) out[token.toUpperCase()] = ''
    else out[token.slice(0, eq).toUpperCase()] = token.slice(eq + 1)
  }
  return out
}

export const PRIORITY_CAPS = [
  'sasl',
  'server-time',
  'message-tags',
  'multi-prefix',
  'account-notify',
  'extended-join',
  'account-tag',
  'away-notify',
  'chghost',
  'batch',
  'labeled-response'
] as const
