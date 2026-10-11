import type { DccOfferView } from '../../../shared/types'

interface Props {
  offers: DccOfferView[]
  onClose: () => void
  onRespond: (id: string, accept: boolean) => void
  onCancel: (id: string) => void
  onForceReceive: (id: string) => void
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
  onClose,
  onRespond,
  onCancel,
  onForceReceive
}: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>DCC transfers</h2>
        <p className="sub">
          Classic SEND receive with optional RESUME/ACCEPT. Files save under the app downloads folder and are
          never executed. Transfers often fail behind NAT/firewalls without port forwards or passive DCC —
          local/direct peers work; reliability through NAT is not guaranteed.
        </p>
        <div className="search-results">
          {offers.length === 0 ? (
            <div className="sub" style={{ padding: 12 }}>
              No offers
            </div>
          ) : (
            <ul>
              {offers.map((o) => (
                <li key={o.id}>
                  <div style={{ padding: 10, display: 'grid', gap: 4 }}>
                    <strong>
                      {o.peerNick}: {o.safeFilename}
                    </strong>
                    <span className="sub">
                      status={o.status} · {progressLabel(o)} · {o.address}:{o.port}
                    </span>
                    {o.localPath ? <span className="sub">path: {o.localPath}</span> : null}
                    <span className="sub">{o.note}</span>
                    {o.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" onClick={() => onRespond(o.id, true)}>
                          Accept
                        </button>
                        <button type="button" className="btn" onClick={() => onRespond(o.id, false)}>
                          Reject
                        </button>
                      </div>
                    ) : null}
                    {o.status === 'accepted' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" onClick={() => onForceReceive(o.id)}>
                          Start without ACCEPT
                        </button>
                        <button type="button" className="btn" onClick={() => onCancel(o.id)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    {o.status === 'transferring' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn" onClick={() => onCancel(o.id)}>
                          Cancel
                        </button>
                      </div>
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
