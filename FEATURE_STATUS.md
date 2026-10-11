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
| Server/channel managers, nick modes, WHOIS/kick/ban, formatting, history/completion, unread | Implemented and tested / incompletely tested (UI manual) |
| Log search UX (filters, prefixes, empty/loading) | Implemented and tested | `kind:`/`target:`/`nick:`; UI filters |
| Ignore list (`/ignore`, `-list`, `-r`, channel/kind scope) | Implemented and tested | Session rules; save network to persist |

## Phase 4 — Advanced IRC

| Feature | Status | Notes |
|---------|--------|-------|
| IRCv3 caps (account-*, away-notify, chghost, batch, labeled-response, multi-prefix, server-time, message-tags, SASL) | Implemented and tested | Negotiated; batch tracked |
| ISUPPORT (005) | Implemented and tested | |
| CTCP VERSION/TIME/PING/ACTION + flood prefs | Implemented and tested | |
| DCC SEND send+receive + RESUME/ACCEPT + progress/cancel/queue | Implemented and tested (local/direct) | Outbound binds localhost; **NAT not guaranteed**; never auto-exec |
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
| Full mIRC / NNScript compatibility | Unsupported (drop-in) | Subset only; see Phase 6 |

## Phase 6 — Legacy compatibility

| Feature | Status | Notes |
|---------|--------|-------|
| mIRC-style syntax compat layer | Partially implemented | Expanded helpers/events + fixtures; still not drop-in |
| Compat diagnostics on import | Implemented and tested | Blocking unsupported disables script |
| Unsupported command reporting | Implemented and tested | Never silent; runtime throws |
| Menu/popup scaffolding | Partially implemented | Parse + list API; no full popup engine |
| NNScript workflow fixtures | Implemented and tested | Original fixtures (not `.nns` copies) |
| COMPATIBILITY.md matrix | Implemented and tested | Tied to fixtures |
| Drop-in `.nns` / DLL host | Unsupported | License + security |

## Phase 7 — Advanced customization

| Feature | Status | Notes |
|---------|--------|-------|
| Theme editor (dark/light/classic + tokens) | Implemented and tested | Import/export JSON |
| Custom menus (visual + text, validated) | Partially implemented | App menus; script menus remain in Scripts |
| Shortcut manager + conflict detection | Implemented and tested | Editing chords reserved |
| Window layout manager | Implemented and tested | Resize/hide/restore defaults |
| Advanced notifications | Implemented and tested | Focus suppress + categories |
| Config import/export (no credentials) | Implemented and tested | Rejects password-bearing JSON |
| Profile backups | Implemented and tested | userData/backups |

## Phase 8 — Production readiness

| Feature | Status | Notes |
|---------|--------|-------|
| Performance bounds documented + constants | Implemented and tested | Caps already enforced; `PERFORMANCE.md` |
| Security review (Electron checklist) | Implemented and tested | `SECURITY.md` Phase 8 section |
| Crash hooks + recovery guidance | Partially implemented | Local `crash.log`; manual recovery steps in TESTING |
| Long-session guidance | Implemented but incompletely tested | Documented soak procedure |
| electron-builder Windows x64 config | Implemented but incompletely tested | Linux `pack:dir` + hardened yml; Win dir/NSIS unsigned; **installer not shipped** |
| Upgrade / uninstall docs | Implemented and tested | `RELEASE.md` / `DEVELOPMENT.md` |
| Signed installer + smoke on Windows | Planned / Blocked | Needs Windows smoke checklist + signing outside repo |
