# MisstIRC Architecture

## Stack

Electron (main + sandboxed renderer) · React · TypeScript · Vite (electron-vite) · Node `net`/`tls` IRC engine · SQLite (`better-sqlite3`) · Vitest + mock IRC server.

## Process boundaries

| Process | Responsibility |
|---------|----------------|
| **Main** | Windows, IPC, IRC sockets, SQLite, secrets, OS integration |
| **Preload** | Typed `window.misstirc` bridge only |
| **Renderer** | React UI — no Node, no direct sockets |

Secure defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP on responses.

## Module layout (§24)

```
src/
  main/         lifecycle, window, IPC
  preload/      restricted API
  renderer/     React shell, components, themes
  core/         IRC connection, parser, CAP, manager
  services/     logging, backups, custom-menu validation
  shared/       themes, shortcuts, layout, notifications, config-export
  scripting/    AST runtime + compat diagnostics + menu scaffold (Phase 5–6)
  dcc/          isolated offers/path validation (no transfer sockets yet)
  storage/      SQLite, migrations, secret store
  shared/       types / IPC contracts
  mock-irc/     local test server
tests/          unit + protocol integration
```

## IRC engine

Custom engine (evaluated vs wrapping a third-party client; chose custom for CAP/SASL control and deterministic mock tests):

- Line-buffered CRLF framing, max line length
- IRCv3 message-tags parse
- CAP LS 302 → REQ → AUTHENTICATE PLAIN (optional) → CAP END → welcome
- Multi-network `ConnectionManager`
- Reconnect with exponential backoff
- Slash-command registry in the manager (renderer sends input lines)

## Persistence

- SQLite with versioned SQL migrations
- Network profiles and app settings
- Secrets via `SecretStore` (encrypted file fallback for Linux/CI; Windows Credential Manager planned)

## Scripting (Phase 5–6)

- Structured AST lexer/parser — **not** `eval` / string execution
- Alias engine, `%vars`, `$idents`, `on`/`raw` events, timers
- `ScriptManager`: import / enable / disable / reload / unload with parse, exec, and **compat** diagnostics
- Menu/popup scaffolding (`menu` blocks → structured tree + list API)
- Unsupported constructs reported on import and at runtime — never silently ignored
- Sandbox: untrusted by default, capability grants, instruction/timer/recursion/while limits
- Hard denies: DLL calls, unrestricted Node `fs`/`net`/`child_process`
- Compatibility fixtures in `tests/fixtures/compatibility/` — **no** full mIRC/NNScript claim

## Unfinished subsystems

DCC transfers remain limited (offers only). Windows installer deferred. Status bar lists unfinished features.

## Packaging (Phase 8)

- `electron-builder.yml` — Windows x64 NSIS + dir; scripts `pack:dir` / `pack:win:dir` / `pack:win`
- Output under `release/` (gitignored)
- **Installer not distributed** until smoke checklist in `TESTING.md` is green (§26 rule 11)
- See `RELEASE.md`, `PERFORMANCE.md`, `SECURITY.md`
