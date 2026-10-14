import type { ConnectionSnapshot, UnfinishedFeature } from '../../../shared/types'

interface Props {
  connection?: ConnectionSnapshot
  unfinished: UnfinishedFeature[]
  show: boolean
}

export function StatusBar({ connection, unfinished, show }: Props): React.JSX.Element | null {
  if (!show) return null
  const label = connection
    ? `${connection.network.host}:${connection.network.port} · ${connection.state} · ${connection.nick}`
    : 'Not connected'
  const unfinishedLabel = unfinished.map((u) => u.label).join(' · ')

  return (
    <footer className="status-bar">
      <span>
        <strong>MisstIRC</strong> {label}
      </span>
      {connection?.lastError ? <span style={{ color: 'var(--danger)' }}>{connection.lastError}</span> : null}
      {unfinishedLabel ? (
        <span className="unfinished" title={unfinished.map((u) => u.detail).join('\n')}>
          Unfinished: {unfinishedLabel}
        </span>
      ) : null}
    </footer>
  )
}
