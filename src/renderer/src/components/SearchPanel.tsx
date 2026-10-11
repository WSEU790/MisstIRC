import { useState } from 'react'
import type { LogSearchHit, MessageKind } from '../../../shared/types'

interface Props {
  onClose: () => void
  onSearch: (query: string) => Promise<LogSearchHit[]>
  onOpenHit: (hit: LogSearchHit) => void
}

type KindFilter = 'all' | MessageKind

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent, #c9a227)', color: 'inherit' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function SearchPanel({ onClose, onSearch, onOpenHit }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LogSearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')

  async function run(): Promise<void> {
    const q = query.trim()
    if (!q) {
      setHits([])
      setSearched(false)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const results = await onSearch(q)
      setHits(results)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setHits([])
      setSearched(true)
    } finally {
      setBusy(false)
    }
  }

  const visible =
    kind === 'all' ? hits : hits.filter((h) => h.kind === kind)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Search</h2>
        <p className="sub">
          Search live buffers and log files. Tips: plain text, or prefixes{' '}
          <code>kind:privmsg</code> / <code>target:#chan</code> / <code>nick:alice</code>. Secrets are never
          stored.
        </p>
        <div className="form-row" style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            placeholder="text, nick, channel, or kind:privmsg"
            style={{ flex: 1 }}
            aria-label="Search query"
          />
          <button type="button" className="btn btn-primary" disabled={busy || !query.trim()} onClick={() => void run()}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(['all', 'privmsg', 'notice', 'system', 'ctcp'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`btn${kind === k ? ' btn-primary' : ''}`}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        <div className="search-results">
          {!searched && !busy ? (
            <div className="sub" style={{ padding: 12 }}>
              Enter a query and press Search.
            </div>
          ) : busy ? (
            <div className="sub" style={{ padding: 12 }}>
              Searching…
            </div>
          ) : visible.length === 0 ? (
            <div className="sub" style={{ padding: 12 }}>
              No results{kind !== 'all' ? ` for kind=${kind}` : ''}.
            </div>
          ) : (
            <ul>
              {visible.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => onOpenHit(h)}>
                    <span className="time">{new Date(h.timestamp).toLocaleString()}</span>
                    <span className="target">
                      {h.networkName}:{h.target} · {h.kind}
                    </span>
                    <span className="nick">{h.nick ?? ''}</span>
                    <span className="body">{highlight(h.text, query.replace(/^\w+:\S+\s*/g, ''))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <span className="sub" style={{ marginRight: 'auto' }}>
            {searched ? `${visible.length} shown` : ''}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
