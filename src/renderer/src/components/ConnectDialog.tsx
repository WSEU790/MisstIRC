import { useMemo, useState } from 'react'
import { randomUUID } from './id'
import type { NetworkConfig } from '../../../shared/types'

interface Props {
  savedNetworks: NetworkConfig[]
  onCancel: () => void
  onConnect: (network: NetworkConfig, password?: string) => void
}

const blank = (): NetworkConfig => ({
  id: randomUUID(),
  name: 'Local mock',
  host: '127.0.0.1',
  port: 6667,
  tls: false,
  rejectUnauthorized: true,
  nick: 'MisstUser',
  username: 'misstirc',
  realname: 'MisstIRC User',
  channels: ['#misstirc'],
  autoConnect: false
})

export function ConnectDialog({ savedNetworks, onCancel, onConnect }: Props): React.JSX.Element {
  const [network, setNetwork] = useState<NetworkConfig>(() => savedNetworks[0] ?? blank())
  const [password, setPassword] = useState('')
  const [channels, setChannels] = useState((savedNetworks[0]?.channels ?? ['#misstirc']).join(', '))

  const canSubmit = useMemo(
    () => Boolean(network.host && network.nick && network.port > 0),
    [network]
  )

  function loadSaved(id: string): void {
    const found = savedNetworks.find((n) => n.id === id)
    if (!found) return
    setNetwork(found)
    setChannels(found.channels.join(', '))
  }

  function submit(): void {
    if (!canSubmit) return
    onConnect(
      {
        ...network,
        name: network.name || network.host,
        channels: channels
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        username: network.username || network.nick,
        realname: network.realname || network.nick
      },
      password || undefined
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="connect-title">Connect to IRC</h2>
        <p className="sub">TCP/TLS session from the MisstIRC engine. Passwords are stored via the secret store.</p>

        {savedNetworks.length > 0 ? (
          <label style={{ display: 'grid', gap: 4, marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            Saved networks
            <select
              value={network.id}
              onChange={(e) => loadSaved(e.target.value)}
              style={{
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius)',
                padding: '8px 10px'
              }}
            >
              {savedNetworks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.host}:{n.port})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="form-grid">
          <label>
            Network name
            <input
              type="text"
              value={network.name}
              onChange={(e) => setNetwork({ ...network, name: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Host
              <input
                type="text"
                value={network.host}
                onChange={(e) => setNetwork({ ...network, host: e.target.value })}
              />
            </label>
            <label>
              Port
              <input
                type="number"
                value={network.port}
                onChange={(e) => setNetwork({ ...network, port: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="check">
              <input
                type="checkbox"
                checked={network.tls}
                onChange={(e) => setNetwork({ ...network, tls: e.target.checked })}
              />
              TLS
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={network.rejectUnauthorized}
                onChange={(e) =>
                  setNetwork({ ...network, rejectUnauthorized: e.target.checked })
                }
              />
              Verify TLS cert
            </label>
          </div>
          <div className="form-row">
            <label>
              Nick
              <input
                type="text"
                value={network.nick}
                onChange={(e) => setNetwork({ ...network, nick: e.target.value })}
              />
            </label>
            <label>
              Password / SASL
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={network.hasPassword ? '(saved)' : 'optional'}
              />
            </label>
          </div>
          <label>
            Channels (comma-separated)
            <input type="text" value={channels} onChange={(e) => setChannels(e.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
