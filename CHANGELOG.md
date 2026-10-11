# Changelog

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
