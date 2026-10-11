interface Props {
  onConnect: () => void
  onDisconnect: () => void
  canDisconnect: boolean
}

export function Toolbar({ onConnect, onDisconnect, canDisconnect }: Props): React.JSX.Element {
  return (
    <header className="toolbar">
      <div className="brand" aria-label="MisstIRC">
        <div className="brand-mark" aria-hidden="true" />
        <div className="brand-name">
          Misst<span>IRC</span>
        </div>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn btn-primary" onClick={onConnect}>
          Connect
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
