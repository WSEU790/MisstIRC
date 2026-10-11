# MisstIRC Performance Notes (Phase 8)

## Bounded buffers (implemented)

| Resource | Limit | Location |
|----------|------:|----------|
| Main-process live message index | 5 000 | `MESSAGE_INDEX_MAX` → `ConnectionManager` |
| Renderer session transcript | 2 000 | `RENDERER_MESSAGE_MAX` → `App.tsx` |
| Script exec error ring | 20 / script | `ScriptManager` |
| Script instruction budget | policy max / tick | `InstructionBudget` |
| Script while iterations | policy max | sandbox policy |
| Script timers / script | policy max | `TimerTable` |
| CTCP flood window | network pref (default 5 / 10s) | `CtcpFloodGuard` |

Constants are centralized in `src/shared/limits.ts` for the message caps.

## Disk logging

Chat logs go to `userData/logs` when logging is enabled. Search prefers the in-memory index, then falls back to on-disk logger search with a result limit. Secrets are redacted before append.

## Practical guidance for long sessions

- Prefer logging enabled for history; the UI transcript is intentionally capped.
- Multi-network: each connection keeps its own channel maps; disconnect unused networks.
- Heavy scripts: keep untrusted until needed; timers are hard-capped (including “infinite” repeats).
- DCC offers are metadata-only — no transfer sockets means no transfer I/O load.

## Profiling (manual)

1. `npm run build && npm run preview` (or `npm run dev`).
2. Connect to mock or real network; join busy channels.
3. Watch renderer memory in Chromium/Electron DevTools; confirm transcript stays near the 2 000-line cap.
4. Confirm `crash.log` stays quiet under normal use.

No automated performance suite yet — document regressions in `FEATURE_STATUS.md` if found.
