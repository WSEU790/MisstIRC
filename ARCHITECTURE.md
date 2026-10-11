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
  services/     profiles, (future: notify/log/settings)
  scripting/    sandbox policy scaffold (no runtime yet)
  dcc/          isolated stub (no transfers yet)
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

## Unfinished subsystems

Scripting and DCC expose **fail-closed** stubs (`assertScriptingUnavailable` / `assertDccUnavailable`). UI status bar lists unfinished features. No fake “working” DCC/script execution.

## Packaging

electron-builder targeted for Windows x64 in Phase 8 — not enabled until build/launch smoke is reliable.
