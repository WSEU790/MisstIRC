import { useState } from 'react'
import type { LogSearchHit } from '../../../shared/types'

interface Props {
  onClose: () => void
  onSearch: (query: string) => Promise<LogSearchHit[]>
  onOpenHit: (hit: LogSearchHit) => void
}

export function SearchPanel({ onClose, onSearch, onOpenHit }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LogSearchHit[]>([])
  const [busy, setBusy] = useState(false)

  async function run(): Promise<void> {
    setBusy(true)
    try {
      setHits(await onSearch(query))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Search</h2>
        <p className="sub">Search live buffers and log files. Credential-bearing lines are never stored.</p>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            placeholder="nick, channel, or text"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !query.trim()} onClick={() => void run()}>
            Search
          </button>
        </div>
        <div className="search-results">
          {hits.length === 0 ? (
            <div className="sub">No results</div>
          ) : (
            <ul>
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => onOpenHit(h)}>
                    <span className="time">{new Date(h.timestamp).toLocaleString()}</span>
                    <span className="target">{h.networkName}:{h.target}</span>
                    <span className="nick">{h.nick ?? ''}</span>
                    <span className="body">{h.text}</span>
                  </button>
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
