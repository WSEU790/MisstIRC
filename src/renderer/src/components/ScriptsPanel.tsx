import { useState } from 'react'
import type { ScriptPermissionName, ScriptRecordView } from '../../../shared/types'

const SAMPLE = `; MisstIRC sample — untrusted by default (echo only)
alias hi {
  echo -a Hello from MisstIRC scripting
}

on *:TEXT:hello*:#:{
  echo -a $nick said hello in $chan
}
`

const GRANTABLE: ScriptPermissionName[] = ['ui.echo', 'irc.command', 'network.send', 'timer']

interface Props {
  scripts: ScriptRecordView[]
  onClose: () => void
  onImport: (name: string, source: string, trusted: boolean) => Promise<void>
  onEnable: (id: string) => Promise<void>
  onDisable: (id: string) => Promise<void>
  onReload: (id: string) => Promise<void>
  onUnload: (id: string) => Promise<void>
  onPermissions: (id: string, permissions: ScriptPermissionName[]) => Promise<void>
}

export function ScriptsPanel({
  scripts,
  onClose,
  onImport,
  onEnable,
  onDisable,
  onReload,
  onUnload,
  onPermissions
}: Props): React.JSX.Element {
  const [name, setName] = useState('sample.mrc')
  const [source, setSource] = useState(SAMPLE)
  const [trusted, setTrusted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Scripts</h2>
        <p className="sub">
          Phase 5 foundation: AST lexer/parser and sandboxed runtime. Imports are{' '}
          <strong>untrusted</strong> (echo-only) until you grant capabilities. No DLL, unrestricted
          Node, or raw filesystem. Not full mIRC/NNScript compatibility.
        </p>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span>Source</span>
          <textarea
            rows={8}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={busy}
            style={{ fontFamily: 'ui-monospace, monospace', width: '100%' }}
          />
        </label>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={trusted}
            onChange={(e) => setTrusted(e.target.checked)}
            disabled={busy}
          />
          <span>Trusted (broader default caps — still no process.exec / DLL)</span>
        </label>
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !source.trim()}
            onClick={() => void run(() => onImport(name || 'script.mrc', source, trusted))}
          >
            Import / replace
          </button>
        </div>

        <div className="search-results" style={{ marginTop: 16 }}>
          {scripts.length === 0 ? (
            <div className="sub" style={{ padding: 12 }}>
              No scripts loaded
            </div>
          ) : (
            <ul>
              {scripts.map((s) => (
                <li key={s.id}>
                  <div style={{ padding: 10, display: 'grid', gap: 6 }}>
                    <strong>
                      {s.filename}{' '}
                      <span className="sub">
                        [{s.status}] aliases={s.aliasCount} events={s.eventCount}
                        {s.trusted ? ' trusted' : ' untrusted'}
                      </span>
                    </strong>
                    {s.parseErrors.length ? (
                      <span className="sub" style={{ color: 'var(--danger, #e66)' }}>
                        Parse: {s.parseErrors.map((e) => `L${e.line}: ${e.message}`).join('; ')}
                      </span>
                    ) : null}
                    {s.execErrors.length ? (
                      <span className="sub" style={{ color: 'var(--danger, #e66)' }}>
                        Exec: {s.execErrors.slice(-3).join('; ')}
                      </span>
                    ) : null}
                    <span className="sub">Caps: {s.permissions.join(', ') || '(none)'}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {s.enabled ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void run(() => onDisable(s.id))}
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          disabled={busy || s.parseErrors.length > 0}
                          onClick={() => void run(() => onEnable(s.id))}
                        >
                          Enable
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void run(() => onReload(s.id))}
                      >
                        Reload
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void run(() => onUnload(s.id))}
                      >
                        Unload
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        title="Grant echo + irc + network + timer"
                        onClick={() =>
                          void run(() => onPermissions(s.id, [...GRANTABLE]))
                        }
                      >
                        Grant IRC caps
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void run(() => onPermissions(s.id, ['ui.echo']))}
                      >
                        Echo only
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
