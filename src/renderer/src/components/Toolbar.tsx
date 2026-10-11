interface Props {
  onServers: () => void
  onChannels: () => void
  onSearch: () => void
  onDisconnect: () => void
  canDisconnect: boolean
  canChannels: boolean
}

export function Toolbar({
  onServers,
  onChannels,
  onSearch,
  onDisconnect,
  canDisconnect,
  canChannels
}: Props): React.JSX.Element {
  return (
    <header className="toolbar">
      <div className="brand" aria-label="MisstIRC">
        <div className="brand-mark" aria-hidden="true" />
        <div className="brand-name">
          Misst<span>IRC</span>
        </div>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn btn-primary" onClick={onServers}>
          Servers
        </button>
        <button type="button" className="btn" onClick={onChannels} disabled={!canChannels}>
          Channels
        </button>
        <button type="button" className="btn" onClick={onSearch}>
          Search
        </button>
        <button
          type="button"
          className="btn"
          onClick={onDisconnect}
          disabled={!canDisconnect}
          title="Disconnect active network"
        >
          Disconnect
        </button>
      </div>
    </header>
  )
}
