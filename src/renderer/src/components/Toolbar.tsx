interface Props {
  onServers: () => void
  onChannels: () => void
  onSearch: () => void
  onDcc: () => void
  onScripts: () => void
  onCustomize: () => void
  onDisconnect: () => void
  canDisconnect: boolean
  canChannels: boolean
  dccCount?: number
  scriptCount?: number
}

export function Toolbar({
  onServers,
  onChannels,
  onSearch,
  onDcc,
  onScripts,
  onCustomize,
  onDisconnect,
  canDisconnect,
  canChannels,
  dccCount = 0,
  scriptCount = 0
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
        <button type="button" className="btn" onClick={onDcc}>
          DCC{dccCount ? ` (${dccCount})` : ''}
        </button>
        <button type="button" className="btn" onClick={onScripts}>
          Scripts{scriptCount ? ` (${scriptCount})` : ''}
        </button>
        <button type="button" className="btn" onClick={onCustomize}>
          Customize
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
