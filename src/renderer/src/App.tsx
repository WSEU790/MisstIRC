import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppStateSnapshot,
  IrcMessageView,
  NetworkConfig
} from '../../shared/types'
import { ConnectDialog } from './components/ConnectDialog'
import { Conversation } from './components/Conversation'
import { NavTree } from './components/NavTree'
import { NickList } from './components/NickList'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

const emptyState: AppStateSnapshot = {
  connections: [],
  activeBufferKey: null,
  settings: { theme: 'misstirc-dark', showStatusBar: true, fontSize: 14 },
  unfinished: []
}

function parseBufferKey(key: string | null): { connectionId: string; name: string } | null {
  if (!key) return null
  const idx = key.indexOf(':')
  if (idx === -1) return null
  return { connectionId: key.slice(0, idx), name: key.slice(idx + 1) }
}

export function App(): React.JSX.Element {
  const [state, setState] = useState<AppStateSnapshot>(emptyState)
  const [messages, setMessages] = useState<IrcMessageView[]>([])
  const [showConnect, setShowConnect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networks, setNetworks] = useState<NetworkConfig[]>([])
  const apiReady = typeof window !== 'undefined' && Boolean(window.misstirc)
  const messagesRef = useRef<IrcMessageView[]>([])

  useEffect(() => {
    if (!apiReady) return
    let unsub = (): void => undefined

    void (async () => {
      const snap = await window.misstirc.getState()
      setState(snap)
      setNetworks(await window.misstirc.listNetworks())
      unsub = window.misstirc.onEvent((event) => {
        if (event.type === 'state') setState(event.payload)
        if (event.type === 'connection') {
          setState((prev) => ({
            ...prev,
            connections: prev.connections.some((c) => c.id === event.payload.id)
              ? prev.connections.map((c) => (c.id === event.payload.id ? event.payload : c))
              : [...prev.connections, event.payload]
          }))
        }
        if (event.type === 'message') {
          messagesRef.current = [...messagesRef.current, event.payload].slice(-2000)
          setMessages(messagesRef.current)
        }
        if (event.type === 'error') setError(event.payload.message)
      })
    })()

    return () => unsub()
  }, [apiReady])

  const active = parseBufferKey(state.activeBufferKey)
  const activeConnection = state.connections.find((c) => c.id === active?.connectionId)
  const activeBuffer = activeConnection?.buffers.find((b) => b.name === active?.name)

  const visibleMessages = useMemo(() => {
    if (!active) return []
    return messages.filter(
      (m) =>
        m.connectionId === active.connectionId &&
        (m.target === active.name || (active.name === '*' && m.target === '*'))
    )
  }, [messages, active])

  async function handleConnect(network: NetworkConfig, password?: string): Promise<void> {
    setError(null)
    try {
      await window.misstirc.connect({ network, password, saslPassword: password })
      setNetworks(await window.misstirc.listNetworks())
      setShowConnect(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (!activeConnection) return
    await window.misstirc.disconnect(activeConnection.id)
  }

  async function handleSend(text: string): Promise<void> {
    if (!active) return
    await window.misstirc.sendInput(active.connectionId, active.name, text)
  }

  async function selectBuffer(connectionId: string, name: string): Promise<void> {
    await window.misstirc.setActiveBuffer(`${connectionId}:${name}`)
  }

  if (!apiReady) {
    return (
      <div className="app">
        <div className="empty-state">
          <h2>MisstIRC</h2>
          <p>
            Preload bridge unavailable. Launch via <code>npm run dev</code> (Electron), not a bare
            browser tab.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar
        onConnect={() => setShowConnect(true)}
        onDisconnect={() => void handleDisconnect()}
        canDisconnect={Boolean(activeConnection)}
      />

      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="workspace" style={error ? { gridRow: 'span 1' } : undefined}>
        <NavTree
          connections={state.connections}
          activeKey={state.activeBufferKey}
          onSelect={(cid, name) => void selectBuffer(cid, name)}
        />

        {activeConnection && active ? (
          <Conversation
            title={active.name === '*' ? activeConnection.network.name : active.name}
            topic={activeBuffer?.topic}
            nick={activeConnection.nick}
            messages={visibleMessages}
            onSend={(t) => void handleSend(t)}
            disabled={
              activeConnection.state !== 'connected' && activeConnection.state !== 'registering'
            }
          />
        ) : (
          <section className="conversation">
            <div className="empty-state">
              <h2>MisstIRC</h2>
              <p>
                Connect to an IRC network to chat. Real TCP/TLS networking — not a simulated inbox.
              </p>
              <button className="btn btn-primary" onClick={() => setShowConnect(true)}>
                Connect…
              </button>
            </div>
          </section>
        )}

        <NickList nicks={activeBuffer?.nicks ?? []} />
      </div>

      <StatusBar
        connection={activeConnection}
        unfinished={state.unfinished}
        show={state.settings.showStatusBar}
      />

      {showConnect ? (
        <ConnectDialog
          savedNetworks={networks}
          onCancel={() => setShowConnect(false)}
          onConnect={(n, p) => void handleConnect(n, p)}
        />
      ) : null}
    </div>
  )
}
