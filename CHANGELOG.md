# Changelog

## 0.1.0 — Phase 1–2 first slice

### Added

- Electron + React + TypeScript + Vite application shell branded **MisstIRC**
- Secure preload bridge and main-process IRC engine (TCP/TLS, CAP, SASL PLAIN, multi-connection manager)
- Channel/PM UI: nav tree, conversation, nick list, command input, connect dialog, status bar
- SQLite persistence for networks/settings; encrypted file secret store fallback
- Local mock IRC server + Vitest protocol/persistence tests
- Module scaffolds for `scripting/` and `dcc/` (fail-closed)
- Project docs: FEATURE_STATUS, ARCHITECTURE, DEVELOPMENT, TESTING, SECURITY, COMPATIBILITY

### Not included

- Full mIRC/NNScript script runtime
- Working DCC
- Windows installer
