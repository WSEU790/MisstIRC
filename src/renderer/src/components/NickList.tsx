import { useState } from 'react'
import type { NickEntry } from '../../../shared/types'

interface ScriptMenuItem {
  scriptId: string
  label: string
  command: string
}

interface Props {
  nicks: NickEntry[]
  selfIsOp?: boolean
  channel?: string
  onWhois: (nick: string) => void
  onQuery: (nick: string) => void
  onKick: (nick: string) => void
  onBan: (nick: string) => void
  onKickBan: (nick: string) => void
  onOp: (nick: string) => void
  onDeop: (nick: string) => void
  onVoice: (nick: string) => void
  onDevoice: (nick: string) => void
  onScriptMenu?: (nick: string, item: ScriptMenuItem) => void
}

export function NickList({
  nicks,
  selfIsOp,
  channel,
  onWhois,
  onQuery,
  onKick,
  onBan,
  onKickBan,
  onOp,
  onDeop,
  onVoice,
  onDevoice,
  onScriptMenu
}: Props): React.JSX.Element {
  const [menu, setMenu] = useState<{
    nick: string
    x: number
    y: number
    scripts: ScriptMenuItem[]
  } | null>(null)

  async function openMenu(nick: string, x: number, y: number): Promise<void> {
    const scripts: ScriptMenuItem[] = []
    for (const t of ['nick', 'nicklist']) {
      const part = await window.misstirc.listScriptMenus(t)
      scripts.push(...part)
    }
    setMenu({ nick, x, y, scripts })
  }

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
                <button
                  type="button"
                  className="nick-btn"
                  onClick={() => onQuery(n.nick)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    void openMenu(n.nick, e.clientX, e.clientY)
                  }}
                  title="Click to PM · right-click for actions"
                >
                  <span className="modes">{n.modes}</span>
                  {n.nick}
                  {n.away ? <span className="sub"> (away)</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menu ? (
        <div className="context-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
            <button type="button" onClick={() => { onWhois(menu.nick); setMenu(null) }}>
              Whois
            </button>
            <button type="button" onClick={() => { onQuery(menu.nick); setMenu(null) }}>
              Query / PM
            </button>
            {channel && selfIsOp ? (
              <>
                <button type="button" onClick={() => { onOp(menu.nick); setMenu(null) }}>
                  Op
                </button>
                <button type="button" onClick={() => { onDeop(menu.nick); setMenu(null) }}>
                  Deop
                </button>
                <button type="button" onClick={() => { onVoice(menu.nick); setMenu(null) }}>
                  Voice
                </button>
                <button type="button" onClick={() => { onDevoice(menu.nick); setMenu(null) }}>
                  Devoice
                </button>
                <button type="button" onClick={() => { onKick(menu.nick); setMenu(null) }}>
                  Kick
                </button>
                <button type="button" onClick={() => { onBan(menu.nick); setMenu(null) }}>
                  Ban
                </button>
                <button type="button" onClick={() => { onKickBan(menu.nick); setMenu(null) }}>
                  Kickban
                </button>
              </>
            ) : null}
            {!selfIsOp && channel ? (
              <div className="context-hint">Moderation requires channel ops</div>
            ) : null}
            {menu.scripts.length > 0 ? (
              <>
                <div className="context-hint">Script menus</div>
                {menu.scripts.map((item) => (
                  <button
                    key={`${item.scriptId}:${item.label}:${item.command}`}
                    type="button"
                    onClick={() => {
                      onScriptMenu?.(menu.nick, item)
                      setMenu(null)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
