# MisstIRC Feature Status

States: **Implemented and tested** · **Implemented but incompletely tested** · **Partially implemented** · **Planned** · **Blocked** · **Unsupported**

## Phase 1 — Foundation

| Feature | Status | Notes |
|---------|--------|-------|
| Electron + React + TS + Vite scaffold | Implemented and tested | `npm run build` / `npm test` |
| Secure process boundaries | Implemented and tested | contextIsolation, no nodeIntegration, sandbox |
| Design system / MisstIRC theme | Partially implemented | CSS variables + shell; theme editor later |
| Main application shell | Implemented but incompletely tested | Needs Electron UI manual pass |
| Configuration persistence (SQLite) | Implemented and tested | Networks + settings migrations |
| Secret store | Partially implemented | Encrypted file fallback; Windows Credential Manager later |
| Mock IRC infrastructure | Implemented and tested | `src/mock-irc` + Vitest |

## Phase 2 — IRC core

| Feature | Status | Notes |
|---------|--------|-------|
| TCP / TLS connections | Implemented and tested | TLS path present; mock tests use TCP |
| CAP negotiation | Implemented and tested | LS 302 / REQ / END |
| SASL PLAIN | Implemented and tested | Mock server test |
| Parser / serializer | Implemented and tested | Tags, source, params |
| Multi-connection manager | Implemented but incompletely tested | Manager supports many; multi-net UI manual |
| Channels + PRIVMSG/NOTICE | Implemented and tested | Mock echo test |
| Reconnect backoff | Implemented and tested | Drop + re-register mock test |
| Registration (NICK/USER) | Implemented and tested | |

## Phase 3 — Daily IRC

| Feature | Status | Notes |
|---------|--------|-------|
| Server manager (add/edit/connect/disconnect/reconnect) | Implemented but incompletely tested | Servers panel; Electron UI manual |
| Channel manager (join/part, auto-join, topic/key) | Implemented and tested | Mock topic/join+key; Channel dialog |
| Nick list ops/voice | Implemented and tested | NAMES prefixes + MODE updates |
| WHOIS / PM / kick / ban (when op) | Implemented and tested | Mock WHOIS/KICK/MODE; UI gates kick/ban |
| Message formatting (IRC codes, no HTML) | Implemented and tested | `irc-format` unit tests |
| Command history | Implemented but incompletely tested | Up/Down in composer |
| Nickname completion | Implemented but incompletely tested | Tab + `getCompletions` API |
| Unread indicators | Implemented and tested | Manager unread mock test |
| Search + logging (no secrets) | Implemented and tested | Redaction + search unit tests |

## Phase 4 — Advanced IRC

| Feature | Status |
|---------|--------|
| Broader IRCv3 | Planned |
| CTCP (beyond ACTION display) | Partially implemented |
| DCC | Planned (scaffold only — labeled unfinished) |
| Ignore / notifications / moderation | Planned |

## Phase 5–6 — Scripting & legacy

| Feature | Status |
|---------|--------|
| Script sandbox policy scaffold | Partially implemented |
| mIRC / NNScript runtime | Planned — **no compatibility claims** |
| DLL / nnscript.dll loading | Unsupported (security) |

## Phase 7–8

| Feature | Status |
|---------|--------|
| Theme editor, layouts, backups | Planned |
| Windows installer | Planned (deferred until launch reliability) |
