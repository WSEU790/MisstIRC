# MisstIRC Testing

## Automated (current)

| Suite | Path | Covers |
|-------|------|--------|
| Parser | `tests/parser.test.ts` | Tags, PRIVMSG, numerics, serializer |
| Protocol integration | `tests/irc-integration.test.ts` | Register, JOIN, PRIVMSG echo, SASL PLAIN, reconnect |
| Phase 3 flows | `tests/phase3-integration.test.ts` | Ops/voice NAMES, WHOIS, topic/kick, unread |
| Phase 4 advanced | `tests/phase4-advanced.test.ts` | CTCP flood, ignore, aliases, ISUPPORT, DCC paths, caps |
| Formatting | `tests/irc-format.test.ts` | IRC codes → safe spans |
| Logging | `tests/logging.test.ts` | Secret redaction + search |
| Prefixes | `tests/prefixes.test.ts` | Mode/prefix helpers, channel keys |
| Persistence | `tests/database.test.ts` | SQLite networks, encrypted secret store |

Run: `npm test`

Mock server: `src/mock-irc/server.ts` (TCP, CAP, optional SASL, channel echo).

## Planned

- React Testing Library for shell dialogs
- Electron launch smoke / Playwright
- Reconnect and multi-connection stress
- Script permission/limit fixtures (Phase 5+)
- Compatibility fixtures only for features we claim (Phase 6)

## Manual verification checklist (Phase 1–3)

1. `npm run dev` launches MisstIRC with brand visible.
2. Servers panel: save network, connect, reconnect, disconnect.
3. Channels: join with key, part, set topic (double-click header).
4. Nick list shows `@`/`+`; right-click Whois/Query; Kick/Ban only when op.
5. Tab completes nicks; Up/Down recalls input history; unread badges clear on focus.
6. Search finds prior messages; password/SASL lines never appear in log files.
7. Status bar lists unfinished: full mIRC/NNScript compat, DCC transfers, installer. Scripts panel imports under sandbox.

Document any manual-only checks in `FEATURE_STATUS.md` as “Implemented but incompletely tested”.
