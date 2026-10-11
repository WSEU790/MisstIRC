import type { ConnectionSnapshot } from '../../../shared/types'

interface Props {
  connections: ConnectionSnapshot[]
  activeKey: string | null
  onSelect: (connectionId: string, name: string) => void
}

export function NavTree({ connections, activeKey, onSelect }: Props): React.JSX.Element {
  return (
    <aside className="panel">
      <div className="panel-title">Networks</div>
      <div className="nav-tree">
        {connections.length === 0 ? (
          <div style={{ padding: '8px 10px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No connections
          </div>
        ) : (
          connections.map((conn) => (
            <div key={conn.id} className="nav-network">
              <div className="nav-network-name">
                <span className={`dot ${conn.state}`} title={conn.state} />
                {conn.network.name}
              </div>
              {conn.buffers.map((buf) => {
                const key = `${conn.id}:${buf.name}`
                const label = buf.name === '*' ? '(server)' : buf.name
                return (
                  <button
                    key={key}
                    type="button"
                    className={`nav-item${activeKey === key ? ' active' : ''}`}
                    onClick={() => onSelect(conn.id, buf.name)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
