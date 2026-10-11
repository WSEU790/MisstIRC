# MisstIRC Testing

## Automated (current)

| Suite | Path | Covers |
|-------|------|--------|
| Parser | `tests/parser.test.ts` | Tags, PRIVMSG, numerics, serializer |
| Protocol integration | `tests/irc-integration.test.ts` | Register, JOIN, PRIVMSG echo, SASL PLAIN vs `MockIrcServer` |
| Persistence | `tests/database.test.ts` | SQLite networks, encrypted secret store |

Run: `npm test`

Mock server: `src/mock-irc/server.ts` (TCP, CAP, optional SASL, channel echo).

## Planned

- React Testing Library for shell dialogs
- Electron launch smoke / Playwright
- Reconnect and multi-connection stress
- Script permission/limit fixtures (Phase 5+)
- Compatibility fixtures only for features we claim (Phase 6)

## Manual verification checklist (Phase 1–2)

1. `npm run dev` launches MisstIRC window with brand visible.
2. Connect dialog opens; cancel works.
3. Against mock or a real network: register, `/join`, send PRIVMSG, see nick list update.
4. Disconnect clears/stops the session.
5. Status bar shows unfinished: scripting, DCC, installer.
6. Saved network reappears after restart (SQLite).

Document any manual-only checks in `FEATURE_STATUS.md` as “Implemented but incompletely tested”.
