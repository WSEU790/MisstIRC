# Changelog

## 0.9.0 — Outbound DCC, search/ignore polish, more fixtures

### Added

- **Outbound DCC SEND** (localhost bind) with RESUME→ACCEPT; mock receiver tests
- Receive connect timeout; direction field on transfer views; Send UI in DCC panel
- Search UX: empty/loading/error states, kind filters, match highlight; query prefixes `kind:` / `target:` / `nick:`
- `/ignore -list` and `/ignore -r`; channel-scoped ignore edge-case tests
- Compatibility fixtures: notice-echo, connect-banner, ignore-note

### Limits (honest)

- Outbound SEND binds local/direct peers only — NAT not claimed
- Still no full mIRC/NNScript drop-in; no signed installer

## 0.8.0 — DCC transfers, scripting depth, packaging harden

### Added

- DCC classic SEND receive with progress, cancel, queue cap, path safety; RESUME/ACCEPT path; local mock peer tests (`tests/dcc-transfer.test.ts`)
- Downloads land under `userData/downloads` and are **never auto-executed**
- Scripting: `$upper/$lower/$len/$left/$right/$mid/$replace/$pos/$ctime/$asctime`, `$me`/`$network`, ACTION/NICK/KICK/TOPIC/MODE events
- Compatibility fixtures `workflow-string-helpers.mrc`, `workflow-kick-topic.mrc`
- Scripts UI: expandable diagnostics grouped by unsupported/partial/works
- Packaging: hardened `electron-builder.yml` (asarUnpack for native modules, explicit Linux/Win dir targets, signing forced off); exact Windows smoke steps in `TESTING.md`

### Limits (honest)

- DCC through NAT/firewalls is **not** guaranteed; outbound SEND not implemented in this slice
- No full mIRC/NNScript drop-in; no signed installer until Windows smoke is green

## 0.7.0 — Phase 8 production readiness (packaging prep)

### Added

- `electron-builder.yml` — Windows x64 NSIS + dir targets; `pack:dir` / `pack:win:dir` / `pack:win` scripts
- Documented performance bounds (`PERFORMANCE.md`, `src/shared/limits.ts`)
- Main-process crash/rejection logging to `userData/logs/crash.log`
- `RELEASE.md` — upgrade/uninstall + rule-11 installer gate
- Expanded SECURITY.md Electron hardening checklist; TESTING.md crash/long-session guidance

### Not shipped

- **No public installer release** until Windows smoke checklist passes (§26 rule 11)
- Code signing / auto-update still Planned

## 0.6.0 — Phase 7 advanced customization

### Added

- Theme manager: dark / light / classic token sets, accent overrides, theme JSON import/export
- Customize panel: layout resize/hide/restore defaults, shortcut editor with conflict detection
- Custom menu visual + text editor with validation
- Notification prefs (focus suppress, highlight/PM/disconnect/DCC/script categories)
- Config import/export and profile backups — **credentials never included**

### Not claimed

- Full mIRC/NNScript drop-in, DCC transfer sockets, Windows installer

## 0.5.0 — Phase 6 legacy compatibility

### Added

- Compatibility diagnostics on script import (`works` / `partial` / `unsupported`) with line-level findings
- Blocking unsupported constructs (DLL/COM/dialogs/sockets/…) — scripts stay disabled until reviewed
- Runtime refuses known-unsupported commands instead of silent IRC passthrough
- `menu <target> { … }` popup scaffolding (parse tree + menu list API)
- Original compatibility fixtures under `tests/fixtures/compatibility/` + Phase 6 tests
- COMPATIBILITY.md rewritten with works/partial/unsupported tables (no full-compat claim)

### Not claimed

- Full mIRC or NNScript drop-in compatibility
- Loading `.nns` packs, `nnscript.dll`, DCX/MDX, or proprietary themes
- Full popup engine / `$menu` / custom dialogs

## 0.4.0 — Phase 5 scripting foundation

### Added

- Structured AST lexer/parser for a mIRC-style subset (aliases, `on`/`raw`, if/while/var/halt/return)
- Sandboxed runtime: variables, expressions, event dispatch, timers, permission-gated commands
- `ScriptManager`: import / enable / disable / reload / unload with parse and execution errors
- Untrusted-by-default sandbox + capability grants; instruction / recursion / while / timer limits
- Scripts panel in the UI; script aliases consulted before built-in slash commands
- Vitest coverage for lexer/parser/runtime/manager/integration

### Not claimed

- Full mIRC or NNScript drop-in compatibility
- DLL / COM / dialog / unrestricted filesystem or network from scripts
- Windows installer

## 0.3.0 — Phase 4 advanced IRC

### Added

- IRCv3 capability negotiation: account-notify, extended-join, account-tag, away-notify, chghost, batch, labeled-response (+ existing CAP/SASL/server-time/message-tags/multi-prefix)
- ISUPPORT (005) parsing; alt-nick fallback on 433/432
- CTCP VERSION/TIME/PING replies with per-network prefs and flood guard; ACTION display
- Isolated DCC manager: SEND offer parse, path sanitization, accept/reject UI — **no active transfer sockets**; NAT/firewall limits labeled
- Ignore masks, keyword highlights, desktop notifications
- Automation: perform-on-connect, aliases with runaway safeguard, auto-away
- Moderation shortcuts: op/deop/voice/devoice/kickban
- Per-network extras persisted (`extras_json` migration)

### Not included

- Full DCC SEND/GET through NAT
- Full mIRC/NNScript runtime
- Windows installer

## 0.2.0 — Phase 3 daily IRC

Servers/channels managers, nick modes, formatting, history/completion, unread, search/logging.

## 0.1.0 — Phase 1–2 first slice

Electron shell, IRC engine, mock tests, docs.
