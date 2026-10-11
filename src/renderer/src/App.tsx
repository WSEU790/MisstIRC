import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppSettings,
  AppStateSnapshot,
  IrcMessageView,
  LogSearchHit,
  NetworkConfig,
  WhoisInfo
} from '../../shared/types'
import { defaultAppSettings, normalizeAppSettings } from '../../shared/defaults'
import { applyLayoutToElement, clampLayout } from '../../shared/layout'
import {
  findActionForKey,
  mergeShortcuts,
  shortcutFromKeyboardEvent
} from '../../shared/shortcuts'
import { applyThemeToElement, resolveThemeTokens } from '../../shared/themes'
import { ChannelDialog } from './components/ChannelDialog'
import { Conversation } from './components/Conversation'
import { CustomizePanel } from './components/CustomizePanel'
import { DccPanel } from './components/DccPanel'
import { NavTree } from './components/NavTree'
import { NickList } from './components/NickList'
import { ScriptsPanel } from './components/ScriptsPanel'
import { SearchPanel } from './components/SearchPanel'
import { ServerManager } from './components/ServerManager'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

const emptyState: AppStateSnapshot = {
  connections: [],
  activeBufferKey: null,
  settings: defaultAppSettings(),
  unfinished: [],
  dccOffers: [],
  scripts: []
}

function parseBufferKey(key: string | null): { connectionId: string; name: string } | null {
  if (!key) return null
  const idx = key.indexOf(':')
  if (idx === -1) return null
  return { connectionId: key.slice(0, idx), name: key.slice(idx + 1) }
}

function applyAppearance(settings: AppSettings): void {
  const root = document.documentElement
  const tokens = resolveThemeTokens(settings.theme, settings.themeOverrides)
  applyThemeToElement(root, tokens)
  const layout = clampLayout(settings.layout)
  applyLayoutToElement(root, layout)
  root.style.setProperty('--font-size-app', `${settings.fontSize}px`)
  document.body.style.fontSize = `${settings.fontSize}px`
}

export function App(): React.JSX.Element {
  const [state, setState] = useState<AppStateSnapshot>(emptyState)
  const [messages, setMessages] = useState<IrcMessageView[]>([])
  const [showServers, setShowServers] = useState(false)
  const [showChannels, setShowChannels] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showDcc, setShowDcc] = useState(false)
  const [showScripts, setShowScripts] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [whois, setWhois] = useState<WhoisInfo | null>(null)
  const [networks, setNetworks] = useState<NetworkConfig[]>([])
  const apiReady = typeof window !== 'undefined' && Boolean(window.misstirc)
  const messagesRef = useRef<IrcMessageView[]>([])
  const settingsRef = useRef(state.settings)

  useEffect(() => {
    settingsRef.current = state.settings
    applyAppearance(normalizeAppSettings(state.settings))
  }, [state.settings])

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
        if (event.type === 'dcc') {
          setState((prev) => {
            const rest = prev.dccOffers.filter((o) => o.id !== event.payload.id)
            return { ...prev, dccOffers: [event.payload, ...rest] }
          })
        }
        if (event.type === 'scripts') {
          setState((prev) => ({ ...prev, scripts: event.payload }))
        }
        if (event.type === 'notify') {
          setError(`Notify: ${event.payload.title} — ${event.payload.body}`)
        }
      })
    })()

    return () => unsub()
  }, [apiReady])

  useEffect(() => {
    if (!apiReady) return

    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        // Allow customize / search chords even in inputs
        const chord = shortcutFromKeyboardEvent(e)
        if (!chord) return
        const action = findActionForKey(mergeShortcuts(settingsRef.current.shortcuts), chord)
        if (action !== 'open-customize' && action !== 'open-search' && action !== 'open-servers') {
          return
        }
      }
      const chord = shortcutFromKeyboardEvent(e)
      if (!chord) return
      const action = findActionForKey(mergeShortcuts(settingsRef.current.shortcuts), chord)
      if (!action) return
      e.preventDefault()
      switch (action) {
        case 'open-servers':
          setShowServers(true)
          break
        case 'open-channels':
          setShowChannels(true)
          break
        case 'open-search':
          setShowSearch(true)
          break
        case 'open-scripts':
          setShowScripts(true)
          break
        case 'open-customize':
          setShowCustomize(true)
          break
        case 'toggle-nav':
          void persistLayoutPatch({ showNav: !settingsRef.current.layout.showNav })
          break
        case 'toggle-nicks':
          void persistLayoutPatch({ showNickList: !settingsRef.current.layout.showNickList })
          break
        case 'focus-input':
          document.querySelector<HTMLInputElement>('.composer input')?.focus()
          break
        case 'next-unread': {
          const hit = state.connections
            .flatMap((c) => c.buffers.map((b) => ({ c, b })))
            .find(({ b }) => (b.unread ?? 0) > 0)
          if (hit) void selectBuffer(hit.c.id, hit.b.name)
          break
        }
        case 'disconnect':
          void handleDisconnect()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers use latest via refs/state reads
  }, [apiReady, state.connections])

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

  async function persistLayoutPatch(patch: Partial<AppSettings['layout']>): Promise<void> {
    const next = normalizeAppSettings({
      ...settingsRef.current,
      layout: { ...settingsRef.current.layout, ...patch },
      showStatusBar: patch.showStatusBar ?? settingsRef.current.layout.showStatusBar
    })
    const saved = await window.misstirc.saveSettings(next)
    setState((prev) => ({ ...prev, settings: saved }))
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

  const layout = clampLayout(state.settings.layout)

  return (
    <div className="app">
      {layout.showToolbar ? (
        <Toolbar
          onServers={() => setShowServers(true)}
          onChannels={() => setShowChannels(true)}
          onSearch={() => setShowSearch(true)}
          onDcc={() => setShowDcc(true)}
          onScripts={() => setShowScripts(true)}
          onCustomize={() => setShowCustomize(true)}
          onDisconnect={() => void handleDisconnect()}
          canDisconnect={Boolean(activeConnection)}
          canChannels={Boolean(activeConnection && activeConnection.state === 'connected')}
          dccCount={state.dccOffers.filter((o) => o.status === 'pending').length}
          scriptCount={state.scripts.filter((s) => s.enabled).length}
        />
      ) : null}

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
        {layout.showNav ? (
          <NavTree
            connections={state.connections}
            activeKey={state.activeBufferKey}
            onSelect={(cid, name) => void selectBuffer(cid, name)}
          />
        ) : null}

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

        {layout.showNickList ? (
          <NickList
            nicks={activeBuffer?.nicks ?? []}
            selfIsOp={activeBuffer?.selfIsOp}
            channel={activeBuffer?.type === 'channel' ? activeBuffer.name : undefined}
            onWhois={(n) => void handleSend(`/whois ${n}`)}
            onQuery={(n) => void handleSend(`/query ${n}`)}
            onKick={(n) => void handleSend(`/kick ${n}`)}
            onBan={(n) => void handleSend(`/ban ${n}`)}
            onKickBan={(n) => void handleSend(`/kickban ${n}`)}
            onOp={(n) => void handleSend(`/op ${n}`)}
            onDeop={(n) => void handleSend(`/deop ${n}`)}
            onVoice={(n) => void handleSend(`/voice ${n}`)}
            onDevoice={(n) => void handleSend(`/devoice ${n}`)}
          />
        ) : null}
      </div>

      <StatusBar
        connection={activeConnection}
        unfinished={state.unfinished}
        show={layout.showStatusBar}
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

      {showDcc ? (
        <DccPanel
          offers={state.dccOffers}
          onClose={() => setShowDcc(false)}
          onRespond={(id, accept) => void window.misstirc.respondDcc(id, accept)}
        />
      ) : null}

      {showScripts ? (
        <ScriptsPanel
          scripts={state.scripts}
          onClose={() => setShowScripts(false)}
          onImport={async (name, source, trusted) => {
            await window.misstirc.importScript(name, source, { trusted })
          }}
          onEnable={async (id, force) => {
            await window.misstirc.enableScript(id, force)
          }}
          onDisable={async (id) => {
            await window.misstirc.disableScript(id)
          }}
          onReload={async (id) => {
            await window.misstirc.reloadScript(id)
          }}
          onUnload={async (id) => {
            await window.misstirc.unloadScript(id)
          }}
          onPermissions={async (id, permissions) => {
            await window.misstirc.setScriptPermissions(id, permissions)
          }}
        />
      ) : null}

      {showCustomize ? (
        <CustomizePanel
          settings={normalizeAppSettings(state.settings)}
          onClose={() => setShowCustomize(false)}
          onSave={async (settings) => {
            const saved = await window.misstirc.saveSettings(settings)
            setState((prev) => ({ ...prev, settings: saved }))
          }}
        />
      ) : null}
    </div>
  )
}
