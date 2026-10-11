import { useMemo, useState } from 'react'
import type { ConnectionSnapshot, NetworkConfig } from '../../../shared/types'
import { randomUUID } from './id'

interface Props {
  networks: NetworkConfig[]
  connections: ConnectionSnapshot[]
  onClose: () => void
  onSave: (network: NetworkConfig, password?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onConnect: (network: NetworkConfig, password?: string) => Promise<void>
  onDisconnect: (connectionId: string) => Promise<void>
  onReconnect: (connectionId: string) => Promise<void>
}

function blank(): NetworkConfig {
  return {
    id: randomUUID(),
    name: '',
    host: '',
    port: 6697,
    tls: true,
    rejectUnauthorized: true,
    nick: 'MisstUser',
    username: 'misstirc',
    realname: 'MisstIRC User',
    channels: [],
    autoConnect: false
  }
}

export function ServerManager({
  networks,
  connections,
  onClose,
  onSave,
  onDelete,
  onConnect,
  onDisconnect,
  onReconnect
}: Props): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(networks[0]?.id ?? null)
  const selected = networks.find((n) => n.id === selectedId) ?? null
  const [draft, setDraft] = useState<NetworkConfig>(selected ?? blank())
  const [password, setPassword] = useState('')
  const [channels, setChannels] = useState((selected?.channels ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const live = useMemo(
    () => connections.find((c) => c.network.id === draft.id || c.id === draft.id),
    [connections, draft.id]
  )

  function load(n: NetworkConfig): void {
    setSelectedId(n.id)
    setDraft({ ...n })
    setChannels(n.channels.join(', '))
    setPassword('')
    setError(null)
  }

  function newNetwork(): void {
    const n = blank()
    setSelectedId(n.id)
    setDraft(n)
    setChannels('#misstirc')
    setPassword('')
  }

  function parsed(): NetworkConfig {
    return {
      ...draft,
      name: draft.name || draft.host || 'Network',
      channels: channels
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      username: draft.username || draft.nick,
      realname: draft.realname || draft.nick
    }
  }

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await onSave(parsed(), password || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function connect(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await onSave(parsed(), password || undefined)
      await onConnect(parsed(), password || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="servers-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="servers-title">Servers</h2>
        <p className="sub">Add, edit, connect, and reconnect IRC networks. Passwords stay in the secret store.</p>

        <div className="server-manager">
          <aside className="server-list">
            <button type="button" className="btn btn-primary" onClick={newNetwork}>
              Add network
            </button>
            <ul>
              {networks.map((n) => {
                const conn = connections.find((c) => c.network.id === n.id || c.id === n.id)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={selectedId === n.id ? 'active' : ''}
                      onClick={() => load(n)}
                    >
                      <span className={`dot ${conn?.state ?? 'disconnected'}`} />
                      {n.name || n.host}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <div className="form-grid">
            {error ? <div className="error-banner">{error}</div> : null}
            <label>
              Name
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Host
                <input
                  type="text"
                  value={draft.host}
                  onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                />
              </label>
              <label>
                Port
                <input
                  type="number"
                  value={draft.port}
                  onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="form-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.tls}
                  onChange={(e) => setDraft({ ...draft, tls: e.target.checked })}
                />
                TLS
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.rejectUnauthorized}
                  onChange={(e) => setDraft({ ...draft, rejectUnauthorized: e.target.checked })}
                />
                Verify TLS cert
              </label>
            </div>
            <div className="form-row">
              <label>
                Nick
                <input
                  type="text"
                  value={draft.nick}
                  onChange={(e) => setDraft({ ...draft, nick: e.target.value })}
                />
              </label>
              <label>
                Password / SASL
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={draft.hasPassword ? '(saved)' : 'optional'}
                />
              </label>
            </div>
            <label>
              Auto-join channels (comma-separated; optional key after name)
              <input
                type="text"
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
                placeholder="#misstirc, #private secret"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(draft.autoConnect)}
                onChange={(e) => setDraft({ ...draft, autoConnect: e.target.checked })}
              />
              Auto-connect on launch (saved preference)
            </label>
            {live ? (
              <p className="sub">
                Live: <strong>{live.state}</strong> as {live.nick}
              </p>
            ) : null}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !selectedId}
            onClick={() => selectedId && void onDelete(selectedId).then(onClose)}
          >
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
            Save
          </button>
          {live && live.state !== 'disconnected' ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void onReconnect(live.id)}
              >
                Reconnect
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void onDisconnect(live.id)}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !draft.host || !draft.nick}
              onClick={() => void connect()}
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
