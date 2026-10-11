# MisstIRC Feature Status

States: **Implemented and tested** · **Implemented but incompletely tested** · **Partially implemented** · **Planned** · **Blocked** · **Unsupported**

## Phase 1 — Foundation

| Feature | Status | Notes |
|---------|--------|-------|
| Electron + React + TS + Vite scaffold | Implemented and tested | |
| Secure process boundaries | Implemented and tested | |
| Design system / MisstIRC theme | Partially implemented | Theme editor later |
| Main application shell | Implemented but incompletely tested | Electron UI manual |
| SQLite + secret store | Implemented and tested / Partially (Win creds later) | |
| Mock IRC infrastructure | Implemented and tested | |

## Phase 2 — IRC core

| Feature | Status |
|---------|--------|
| TCP/TLS, CAP, SASL PLAIN, parser, multi-conn, channels/PM, reconnect | Implemented and tested |

## Phase 3 — Daily IRC

| Feature | Status |
|---------|--------|
| Server/channel managers, nick modes, WHOIS/kick/ban, formatting, history/completion, unread, search/logging | Implemented and tested / incompletely tested (UI manual) |

## Phase 4 — Advanced IRC

| Feature | Status | Notes |
|---------|--------|-------|
| IRCv3 caps (account-*, away-notify, chghost, batch, labeled-response, multi-prefix, server-time, message-tags, SASL) | Implemented and tested | Negotiated; batch tracked |
| ISUPPORT (005) | Implemented and tested | |
| CTCP VERSION/TIME/PING/ACTION + flood prefs | Implemented and tested | |
| DCC SEND offer parse + path validation + approve/reject | Partially implemented | **No active transfer sockets**; NAT/firewall limits labeled |
| Ignore rules | Implemented and tested | |
| Highlights + notification engine | Implemented but incompletely tested | Main-process Notification |
| Automation (perform, aliases, auto-away, alt nicks) | Implemented and tested | Runaway alias guard; no secret perform |
| Moderation shortcuts (op/deop/voice/kickban) | Implemented but incompletely tested | UI + slash commands |
| Per-network configuration | Implemented and tested | extras_json migration |

## Phase 5 — Scripting foundation

| Feature | Status | Notes |
|---------|--------|-------|
| Lexer / parser → structured AST | Implemented and tested | Not string-eval |
| Alias engine, vars/expressions | Implemented and tested | Subset |
| Event handlers (`on` TEXT/JOIN/…, `raw`) | Implemented and tested | Subset match patterns |
| Timers | Implemented and tested | Caps; infinite repeats hard-limited |
| Script manager (import/enable/disable/reload/unload) | Implemented and tested | Parse/exec errors surfaced |
| Sandbox (untrusted default, grants, limits) | Implemented and tested | No DLL / unrestricted Node |
| Command registry integration | Implemented but incompletely tested | Aliases before slash; UI Scripts panel |
| Full mIRC / NNScript compatibility | Planned / Unsupported (DLLs) | Do not claim drop-in yet |

## Phase 6–8

| Feature | Status |
|---------|--------|
| Legacy fixtures / workflow docs | Planned |
| Theme editor, layouts, backups | Planned |
| Windows installer | Planned |
