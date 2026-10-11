import { useState } from 'react'
import type { DccOfferView } from '../../../shared/types'

interface Props {
  offers: DccOfferView[]
  activeConnectionId: string | null
  onClose: () => void
  onRespond: (id: string, accept: boolean) => void
  onCancel: (id: string) => void
  onForceReceive: (id: string) => void
  onOfferSend: (connectionId: string, peerNick: string, filePath: string) => Promise<void>
}

function progressLabel(o: DccOfferView): string {
  const got = o.bytesReceived ?? 0
  if (o.size !== undefined && o.size > 0) {
    const pct = Math.min(100, Math.round((got / o.size) * 100))
    return `${got}/${o.size} bytes (${pct}%)`
  }
  return `${got} bytes`
}

export function DccPanel({
  offers,
  activeConnectionId,
  onClose,
  onRespond,
  onCancel,
  onForceReceive,
  onOfferSend
}: Props): React.JSX.Element {
  const [peer, setPeer] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendFile(): Promise<void> {
    if (!activeConnectionId || !peer.trim() || !path.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onOfferSend(activeConnectionId, peer.trim(), path.trim())
      setPath('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>DCC transfers</h2>
        <p className="sub">
          Classic SEND send+receive with optional RESUME/ACCEPT. Files are never executed. Local/direct peers
          work; NAT/firewall reliability is not guaranteed (binds localhost for outbound in this build).
        </p>

        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          <strong>Send file (outbound)</strong>
          <input
            type="text"
            placeholder="Peer nick"
            value={peer}
            onChange={(e) => setPeer(e.target.value)}
            disabled={busy || !activeConnectionId}
          />
          <input
            type="text"
            placeholder="Absolute path to file"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={busy || !activeConnectionId}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !activeConnectionId || !peer.trim() || !path.trim()}
            onClick={() => void sendFile()}
          >
            Offer SEND
          </button>
          {!activeConnectionId ? (
            <span className="sub">Connect to a network first.</span>
          ) : null}
          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="search-results">
          {offers.length === 0 ? (
            <div className="sub" style={{ padding: 12 }}>
              No transfers
            </div>
          ) : (
            <ul>
              {offers.map((o) => (
                <li key={o.id}>
                  <div style={{ padding: 10, display: 'grid', gap: 4 }}>
                    <strong>
                      [{o.direction ?? 'inbound'}] {o.peerNick}: {o.safeFilename}
                    </strong>
                    <span className="sub">
                      status={o.status} · {progressLabel(o)} · {o.address}:{o.port}
                    </span>
                    {o.localPath ? <span className="sub">path: {o.localPath}</span> : null}
                    <span className="sub">{o.note}</span>
                    {o.status === 'pending' && o.direction !== 'outbound' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" onClick={() => onRespond(o.id, true)}>
                          Accept
                        </button>
                        <button type="button" className="btn" onClick={() => onRespond(o.id, false)}>
                          Reject
                        </button>
                      </div>
                    ) : null}
                    {o.status === 'accepted' && o.direction !== 'outbound' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" onClick={() => onForceReceive(o.id)}>
                          Start without ACCEPT
                        </button>
                        <button type="button" className="btn" onClick={() => onCancel(o.id)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    {['accepted', 'transferring'].includes(o.status) && o.direction === 'outbound' ? (
                      <button type="button" className="btn" onClick={() => onCancel(o.id)}>
                        Cancel send
                      </button>
                    ) : null}
                    {o.status === 'transferring' && o.direction !== 'outbound' ? (
                      <button type="button" className="btn" onClick={() => onCancel(o.id)}>
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
