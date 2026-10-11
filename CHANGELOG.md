# Changelog

## 0.2.0 — Phase 3 daily IRC

### Added

- Servers panel: add/edit/delete networks, connect/disconnect/reconnect
- Channel dialog: join/part with optional key; topic via double-click / `/topic`
- Nick list prefixes (ops/voice), context menu: Whois, Query, Kick/Ban when op
- IRC formatting renderer (bold/italic/underline/color/reset) without HTML injection
- Command history (Up/Down), Tab nick completion, unread badges in nav tree
- Chat logging + search with credential redaction (`PASS` / `AUTHENTICATE` / NickServ identify never stored)
- Mock IRC coverage for WHOIS, TOPIC, KICK, MODE, unread

### Not included

- Full mIRC/NNScript script runtime
- Working DCC
- Windows installer

## 0.1.0 — Phase 1–2 first slice

### Added

- Electron + React + TypeScript + Vite application shell branded **MisstIRC**
- Secure preload bridge and main-process IRC engine (TCP/TLS, CAP, SASL PLAIN, multi-connection manager)
- Channel/PM UI: nav tree, conversation, nick list, command input, status bar
- SQLite persistence for networks/settings; encrypted file secret store fallback
- Local mock IRC server + Vitest protocol/persistence tests
- Module scaffolds for `scripting/` and `dcc/` (fail-closed)
