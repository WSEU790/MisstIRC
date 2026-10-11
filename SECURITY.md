# MisstIRC Security

## Electron hardening checklist (Phase 8 review)

| Control | Status | Notes |
|---------|--------|-------|
| `contextIsolation: true` | Yes | Renderer cannot touch Node directly |
| `nodeIntegration: false` | Yes | |
| `sandbox: true` | Yes | BrowserWindow webPreferences |
| `webSecurity: true` | Yes | |
| Preload allowlist API | Yes | Typed `window.misstirc` only |
| Navigation / `window.open` | Yes | Denied; `shell.openExternal` for http(s) |
| CSP on responses | Yes | `default-src 'self'`; styles `'unsafe-inline'` for design tokens |
| `enableRemoteModule` | N/A | Not used (removed in modern Electron) |
| ASAR packaging | Configured | `electron-builder.yml` `asar: true` |
| DevTools in production | Not forced open | Operators may still open via flags — acceptable for IRC client |
| Autoupdate / code signing | Planned | Not enabled; no updater endpoint yet |

## Credentials

- Passwords are **not** stored in networks SQLite value columns as plaintext secrets  
- `hasPassword` flag only in SQLite  
- Secrets via `SecretStore` (AES-GCM file fallback for non-Windows/CI; Windows Credential Manager planned)  
- Config export / profile backups **reject or strip** credential fields (`includeCredentials: false`)  
- TLS certificate validation defaults **on** (`rejectUnauthorized: true`); per-network opt-out only — never a global silent workaround  

## Scripting

- Untrusted-by-default (`UNTRUSTED_POLICY` → echo only)  
- Capability grants; `process.exec` stripped; `allowDllCalls: false` always  
- Instruction / recursion / while / timer caps  
- Unsupported commands error visibly — never silent IRC passthrough  
- No loading of `nnscript.dll` or proprietary NNScript packs  

## DCC

- Offers path-validated; **no transfer sockets** in this build  
- Explicit accept/reject; NAT/firewall limits labeled in UI  

## Crash / recovery logging

- Main process installs `uncaughtException` / `unhandledRejection` hooks writing to `userData/logs/crash.log`  
- Does not auto-exfiltrate; local diagnostics only  

## Supply chain / reference

- User-supplied NNScript installer: lawful observation only  
- No proprietary assets or script code in the product tree  
- Keep secrets and PATs out of git remotes and docs  

## Residual risks / follow-ups

- Code signing + SmartScreen for Windows installers (before public ship)  
- Windows Credential Manager backend for secrets  
- Renderer CSP without `'unsafe-inline'` if CSS can be fully externalized  
- Optional auto-update channel with signature verification  
