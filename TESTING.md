# MisstIRC Testing

## Automated (current)

| Suite | Path | Covers |
|-------|------|--------|
| Parser | `tests/parser.test.ts` | Tags, PRIVMSG, numerics, serializer |
| Protocol integration | `tests/irc-integration.test.ts` | Register, JOIN, PRIVMSG, SASL, reconnect |
| Phase 3 flows | `tests/phase3-integration.test.ts` | Ops/voice, WHOIS, topic/kick, unread |
| Phase 4 advanced | `tests/phase4-advanced.test.ts` | CTCP, ignore, aliases, ISUPPORT, DCC paths |
| Phase 5 scripting | `tests/phase5-scripting.test.ts` | Lexer/parser, sandbox, runtime, manager |
| Phase 6 compatibility | `tests/phase6-compatibility.test.ts` | Fixtures, diagnostics, menus |
| Phase 7 customize | `tests/phase7-customize.test.ts` | Themes, shortcuts, export, backups |
| Formatting | `tests/irc-format.test.ts` | IRC codes → safe spans |
| Logging | `tests/logging.test.ts` | Secret redaction + search |
| Prefixes | `tests/prefixes.test.ts` | Mode/prefix helpers |
| Persistence | `tests/database.test.ts` | SQLite + secrets |

Run: `npm test` · `npm run typecheck` · `npm run build`

Mock server: `src/mock-irc/server.ts`.

## Crash and recovery

| Scenario | Expected | How to verify |
|----------|----------|---------------|
| Uncaught exception in main | Entry in `userData/logs/crash.log`; app may exit | Dev-only throw behind a flag, or inspect after a real fault |
| Kill Electron process | Relaunch loads SQLite settings/networks; passwords still in secret store | Force-kill during idle; restart via `npm run dev` |
| Corrupt settings JSON | `normalizeAppSettings` merges defaults | Hand-edit `settings` row carefully in a **copy** of the DB |
| Script infinite while | Runtime hits while/instruction limit; error surfaced | Import fixture that loops; confirm exec error, UI stays up |
| Disconnect mid-session | Connection state updates; optional notify per prefs | Pull network cable / stop mock server |

Recovery does **not** auto-replay unsent IRC lines. Reconnect from Servers panel (passwords loaded securely).

## Long-session guidance

1. Leave logging on; UI transcript caps at `RENDERER_MESSAGE_MAX` (2 000) — older lines remain on disk if logged.  
2. Main index caps at `MESSAGE_INDEX_MAX` (5 000) — search still hits log files.  
3. After hours on busy channels: confirm memory stable in DevTools; confirm no runaway script timers (`TimerTable` caps).  
4. Create a profile backup before upgrades (Customize → Backup).  
5. See `PERFORMANCE.md` for bound tables.

Manual long-session soak is **Implemented but incompletely tested** until a recorded multi-hour pass exists.

## Packaging dry-run (not a ship gate by itself)

```bash
npm run pack:dir          # Linux x64 unpacked app → release/linux-unpacked/
npm run pack:win:dir      # Windows x64 unpacked (Wine may be required on Linux for NSIS)
npm run pack:win          # Unsigned NSIS — runs ensure:win-native + verify:win-package
```

`pack:win` / `pack:win:dir` call `ensure:win-native` (Electron **win32-x64** `better-sqlite3` prebuild) and `verify:win-package` (refuse ELF `.node` in `release/win-unpacked`). Cross-packing from Linux without that step shipped a Linux native module in `v0.10.0-test.1`.

**Do not** treat unsigned NSIS as a production release.  
**Do not** ship a **signed** installer until the **Windows smoke checklist** below is green (§26 rule 11).

## Windows smoke checklist (required before installer ship)

Run on a **Windows x64** machine (or Windows CI runner) — not only the Linux pack dry-run.

1. `npm ci` → `npm test` → `npm run typecheck` → `npm run build` all green.  
2. `npm run pack:win:dir` → launch `release/win-unpacked/MisstIRC.exe`.  
3. First launch: window title **MisstIRC**, Customize opens, theme switch persists after restart.  
4. Connect (mock IRC or a real network), join a channel, send a message, disconnect, reconnect.  
5. DCC: with a local/direct peer (or mock), accept a SEND offer → file appears under `%APPDATA%/misstirc/downloads` and is **not** executed; cancel works; RESUME path if a partial file exists.  
6. Scripts: import `workflow-greeter.mrc` (runs); import `workflow-unsupported-dll.mrc` → diagnostics + blocked enable; Force enable still errors on `/dll` at runtime.  
7. Export config — confirm **no** password/credential fields in JSON.  
8. Create a profile backup; restore it; settings return without secrets.  
9. Quit cleanly; no crash.log spam for the session (or only expected handled errors).  
10. Only then consider `npm run pack:win` NSIS — still **unsigned** until a separate signing pass.

Status bar unfinished items must remain honest until this checklist is signed off.

## Manual UI checklist (daily use)

1. Servers: save, connect, reconnect, disconnect.  
2. Channels / nick list / Tab completion / search.  
3. Customize: layout hide/restore, shortcut conflict warning.  
4. Scripts panel under sandbox.

Document manual-only checks in `FEATURE_STATUS.md` as “Implemented but incompletely tested”.
