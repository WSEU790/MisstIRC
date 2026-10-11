# MisstIRC Feature Status

States: **Implemented and tested** · **Implemented but incompletely tested** · **Partially implemented** · **Planned** · **Blocked** · **Unsupported**

## Phase 1 — Foundation

| Feature | Status | Notes |
|---------|--------|-------|
| Electron + React + TS + Vite scaffold | Implemented and tested | `npm run build` / `npm test` |
| Secure process boundaries | Implemented and tested | contextIsolation, no nodeIntegration, sandbox |
| Design system / MisstIRC theme | Partially implemented | CSS variables + shell; theme editor later |
| Main application shell | Implemented but incompletely tested | Toolbar, nav, conversation, nicks, status; needs Electron UI manual pass |
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

| Feature | Status |
|---------|--------|
| Server/channel manager UI | Partially implemented |
| Nick list | Partially implemented |
| Slash commands + history | Partially implemented |
| Nick completion / unread / search / logging UI | Planned |

## Phase 4 — Advanced IRC

| Feature | Status |
|---------|--------|
| Broader IRCv3 | Planned |
| CTCP | Planned |
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
