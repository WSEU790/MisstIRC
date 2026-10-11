import type { NickEntry } from '../../../shared/types'

interface Props {
  nicks: NickEntry[]
}

export function NickList({ nicks }: Props): React.JSX.Element {
  return (
    <aside className="panel nicks">
      <div className="panel-title">Nicks ({nicks.length})</div>
      <div className="nick-list">
        {nicks.length === 0 ? (
          <div style={{ padding: '4px 6px', color: 'var(--text-dim)' }}>—</div>
        ) : (
          <ul>
            {nicks.map((n) => (
              <li key={n.nick}>
                {n.modes}
                {n.nick}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
