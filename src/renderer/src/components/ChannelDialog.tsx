import { useState } from 'react'

interface Props {
  onCancel: () => void
  onJoin: (channel: string, key?: string) => void
  onPart: (channel: string) => void
  currentChannel?: string
}

export function ChannelDialog({ onCancel, onJoin, onPart, currentChannel }: Props): React.JSX.Element {
  const [channel, setChannel] = useState(currentChannel?.startsWith('#') ? currentChannel : '#')
  const [key, setKey] = useState('')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Channels</h2>
        <p className="sub">Join or part a channel. Keys are sent only for this JOIN (not logged as secrets).</p>
        <div className="form-grid">
          <label>
            Channel
            <input type="text" value={channel} onChange={(e) => setChannel(e.target.value)} />
          </label>
          <label>
            Key (optional)
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          {currentChannel && currentChannel !== '*' ? (
            <button type="button" className="btn" onClick={() => onPart(currentChannel)}>
              Part {currentChannel}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!channel.startsWith('#') && !channel.startsWith('&')}
            onClick={() => onJoin(channel.trim(), key || undefined)}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  )
}
