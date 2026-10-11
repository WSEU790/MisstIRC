# MisstIRC Security

## Electron

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- Preload exposes only the typed `misstirc` API
- `window.open` / new windows denied; external URLs via `shell.openExternal`
- Response CSP: `default-src 'self'` (inline styles allowed for the design system)

## Credentials

- Passwords are **not** stored in the networks settings JSON/SQLite value columns as plaintext secrets
- `hasPassword` flag only in SQLite
- Secrets go through `SecretStore` (AES-GCM file fallback for non-Windows/CI; Windows Credential Manager integration planned)
- TLS certificate validation defaults **on** (`rejectUnauthorized: true`); users may opt out **per network** for known self-signed servers — never as a global silent workaround

## Scripting (Phase 5)

- Deny-by-default / untrusted-by-default (`UNTRUSTED_POLICY` → echo only)
- Capability grants (`ui.echo`, `irc.command`, `network.send`, `timer`, …) — `process.exec` stripped
- No DLL loading (`allowDllCalls: false` always)
- Instruction budget, recursion, while-iteration, and timer caps enforced in runtime
- No unrestricted Node `fs` / `net` / `child_process` from scripts
- NNScript/`nnscript.dll` from the reference installer will **not** be loaded or redistributed

## DCC (future)

- Isolated module (`src/dcc`)
- Path validation, size limits, and explicit user consent required before implementation is marked complete

## Supply chain / reference

- User-supplied NNScript installer used only for lawful observation (metadata + user-accessible docs/config lists)
- No proprietary assets or script code copied into MisstIRC
