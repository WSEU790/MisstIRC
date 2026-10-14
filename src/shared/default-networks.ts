import type { NetworkConfig } from './types'

/** Stable id so we can recognize the shipped Libera.Chat preset. */
export const DEFAULT_LIBERA_NETWORK_ID = 'preset-libera-chat'

/**
 * Built-in server list for first launch (empty DB only).
 * No passwords, no SASL secrets, no auto-connect, no auto-join channels.
 */
export function defaultSeedNetworks(): NetworkConfig[] {
  return [
    {
      id: DEFAULT_LIBERA_NETWORK_ID,
      name: 'Libera.Chat',
      host: 'irc.libera.chat',
      port: 6697,
      tls: true,
      rejectUnauthorized: true,
      nick: 'MisstUser',
      altNicks: ['MisstUser_', 'MisstUser__'],
      username: 'misstirc',
      realname: 'MisstIRC User',
      channels: [],
      autoConnect: false,
      hasPassword: false,
      replyCtcpVersion: true,
      replyCtcpTime: true,
      replyCtcpPing: true
    }
  ]
}
