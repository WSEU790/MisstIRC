import type { DccOfferView } from '../../../shared/types'

interface Props {
  offers: DccOfferView[]
  onClose: () => void
  onRespond: (id: string, accept: boolean) => void
}

export function DccPanel({ offers, onClose, onRespond }: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>DCC offers</h2>
        <p className="sub">
          Path-validated offers only. Full SEND/GET through NAT/firewalls is not guaranteed — accept records
          intent; active sockets are unsupported in this build.
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
                      status={o.status} size={o.size ?? '?'} {o.address}:{o.port}
                    </span>
                    <span className="sub">{o.note}</span>
                    {o.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary" onClick={() => onRespond(o.id, true)}>
                          Accept (limited)
                        </button>
                        <button type="button" className="btn" onClick={() => onRespond(o.id, false)}>
                          Reject
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
