import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppStateSnapshot,
  IrcMessageView,
  LogSearchHit,
  NetworkConfig,
  WhoisInfo
} from '../../shared/types'
import { ChannelDialog } from './components/ChannelDialog'
import { Conversation } from './components/Conversation'
import { NavTree } from './components/NavTree'
import { NickList } from './components/NickList'
import { SearchPanel } from './components/SearchPanel'
import { ServerManager } from './components/ServerManager'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

const emptyState: AppStateSnapshot = {
  connections: [],
  activeBufferKey: null,
  settings: { theme: 'misstirc-dark', showStatusBar: true, fontSize: 14, loggingEnabled: true },
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
  const [showServers, setShowServers] = useState(false)
  const [showChannels, setShowChannels] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [whois, setWhois] = useState<WhoisInfo | null>(null)
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
        if (event.type === 'whois') setWhois(event.payload)
      })
    })()

    return () => unsub()
  }, [apiReady])

  const active = parseBufferKey(state.activeBufferKey)
  const activeConnection = state.connections.find((c) => c.id === active?.connectionId)
  const activeBuffer = activeConnection?.buffers.find(
    (b) => b.name === active?.name || b.name.toLowerCase() === active?.name.toLowerCase()
  )

  const visibleMessages = useMemo(() => {
    if (!active) return []
    return messages.filter((m) => {
      if (m.connectionId !== active.connectionId) return false
      if (active.name === '*') return m.target === '*'
      return m.target.toLowerCase() === active.name.toLowerCase()
    })
  }, [messages, active])

  async function refreshNetworks(): Promise<void> {
    setNetworks(await window.misstirc.listNetworks())
  }

  async function handleConnect(network: NetworkConfig, password?: string): Promise<void> {
    setError(null)
    await window.misstirc.connect({ network, password, saslPassword: password })
    await refreshNetworks()
  }

  async function handleDisconnect(connectionId?: string): Promise<void> {
    const id = connectionId ?? activeConnection?.id
    if (!id) return
    await window.misstirc.disconnect(id)
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
        onServers={() => setShowServers(true)}
        onChannels={() => setShowChannels(true)}
        onSearch={() => setShowSearch(true)}
        onDisconnect={() => void handleDisconnect()}
        canDisconnect={Boolean(activeConnection)}
        canChannels={Boolean(activeConnection && activeConnection.state === 'connected')}
      />

      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {whois ? (
        <div className="error-banner whois-banner" role="status">
          WHOIS <strong>{whois.nick}</strong>: {whois.realname} ({whois.user}@{whois.host}){' '}
          {whois.channels} {whois.account ? `account=${whois.account}` : ''}
          <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setWhois(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="workspace">
        <NavTree
          connections={state.connections}
          activeKey={state.activeBufferKey}
          onSelect={(cid, name) => void selectBuffer(cid, name)}
        />

        {activeConnection && active ? (
          <Conversation
            title={active.name === '*' ? activeConnection.network.name : active.name}
            topic={activeBuffer?.type === 'channel' ? activeBuffer.topic ?? '' : undefined}
            nick={activeConnection.nick}
            messages={visibleMessages}
            nicks={(activeBuffer?.nicks ?? []).map((n) => n.nick)}
            connectionId={active.connectionId}
            buffer={active.name}
            onSend={(t) => void handleSend(t)}
            onTopic={(t) => void handleSend(`/topic ${t}`)}
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
              <button className="btn btn-primary" onClick={() => setShowServers(true)}>
                Servers…
              </button>
            </div>
          </section>
        )}

        <NickList
          nicks={activeBuffer?.nicks ?? []}
          selfIsOp={activeBuffer?.selfIsOp}
          channel={activeBuffer?.type === 'channel' ? activeBuffer.name : undefined}
          onWhois={(n) => void handleSend(`/whois ${n}`)}
          onQuery={(n) => void handleSend(`/query ${n}`)}
          onKick={(n) => void handleSend(`/kick ${n}`)}
          onBan={(n) => void handleSend(`/ban ${n}`)}
        />
      </div>

      <StatusBar
        connection={activeConnection}
        unfinished={state.unfinished}
        show={state.settings.showStatusBar}
      />

      {showServers ? (
        <ServerManager
          networks={networks}
          connections={state.connections}
          onClose={() => {
            setShowServers(false)
            void refreshNetworks()
          }}
          onSave={async (n, p) => {
            await window.misstirc.saveNetwork(n, p)
            await refreshNetworks()
          }}
          onDelete={async (id) => {
            await window.misstirc.deleteNetwork(id)
            await refreshNetworks()
          }}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onReconnect={async (id) => {
            await window.misstirc.reconnect(id)
          }}
        />
      ) : null}

      {showChannels && activeConnection ? (
        <ChannelDialog
          currentChannel={active?.name}
          onCancel={() => setShowChannels(false)}
          onJoin={(channel, key) => {
            void handleSend(key ? `/join ${channel} ${key}` : `/join ${channel}`)
            setShowChannels(false)
          }}
          onPart={(channel) => {
            void handleSend(`/part ${channel}`)
            setShowChannels(false)
          }}
        />
      ) : null}

      {showSearch ? (
        <SearchPanel
          onClose={() => setShowSearch(false)}
          onSearch={(q) => window.misstirc.searchLogs(q)}
          onOpenHit={(hit: LogSearchHit) => {
            if (hit.connectionId) {
              void selectBuffer(hit.connectionId, hit.target)
            }
            setShowSearch(false)
          }}
        />
      ) : null}
    </div>
  )
}
