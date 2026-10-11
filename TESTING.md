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
npm run pack:dir          # host OS unpacked app
npm run pack:win:dir      # Windows x64 unpacked (Wine may be required on Linux)
```

**Do not** publish `pack:win` NSIS output until the smoke checklist below is green on Windows (§26 rule 11).

## Electron smoke checklist (required before installer ship)

1. `npm run build` then launch via `npm run preview` or packaged dir.  
2. Brand + Customize open; theme switch persists after restart.  
3. Connect (mock or real), join, message, disconnect/reconnect.  
4. Import greeter script; confirm dll fixture diagnostics.  
5. Export config — confirm no password fields.  
6. Status bar unfinished items remain honest (DCC transfers, full script compat, installer until smoke signed off).

## Manual UI checklist (daily use)

1. Servers: save, connect, reconnect, disconnect.  
2. Channels / nick list / Tab completion / search.  
3. Customize: layout hide/restore, shortcut conflict warning.  
4. Scripts panel under sandbox.

Document manual-only checks in `FEATURE_STATUS.md` as “Implemented but incompletely tested”.
