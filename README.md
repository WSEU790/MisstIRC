# MisstIRC

Professional Windows-first IRC client built with **Electron**, **React**, **TypeScript**, and **Vite**. Real TCP/TLS IRC networking, multi-connection support, CAP/SASL registration, and a classic channel/PM shell.

> Brand: **MisstIRC** — original assets only.  
> Phases 1–8 + **0.10.0**: DCC send/receive (local/direct), script context menus, virtualized chat, `$iif`/`$calc`, query flood guard. Signed Windows installer still gated on smoke checklist.

## Requirements

- Node.js 20+
- npm 10+
- Linux/macOS/Windows (Windows is the primary target; native modules rebuild per platform)

## Setup

```bash
npm install
```

## Develop

```bash
npm run dev
```

This starts Vite + Electron with secure defaults (`contextIsolation`, no `nodeIntegration`, sandboxed renderer).

## Test

Protocol and persistence tests (includes a local mock IRC server):

```bash
npm test
npm run typecheck
```

## Build

```bash
npm run build
```

Output lands in `out/`.

### Packaging (Phase 8 prep)

```bash
npm run pack:dir        # Linux x64 unpacked → release/linux-unpacked/
npm run pack:win:dir    # Windows x64 unpacked → release/win-unpacked/
npm run pack:win        # NSIS (unsigned) — do not ship until Windows smoke passes
```

See `RELEASE.md` / `TESTING.md`. Installer distribution is gated on the Windows smoke checklist (§26 rule 11).

## Connect

1. Open **Servers** — a fresh profile includes **Libera.Chat** (`irc.libera.chat:6697` TLS) ready to connect (not auto-connected)
2. Set your nick if needed, then Connect — or add another host/port (e.g. `127.0.0.1` against a local mock)
3. Optional password is stored via the secret store (encrypted file fallback on non-Windows; Credential Manager path reserved for Windows)

Slash commands: `/join`, `/part`, `/msg`, `/notice`, `/nick`, `/me`, `/quit`, plus raw passthrough.

## Project docs

Architecture, plan, and checklist live in the Project Context store under `docs/`.

## Security notes

- Renderer has no Node access; IPC is a typed preload bridge (`window.misstirc`)
- IRC passwords are not written into ordinary settings rows
- Scripts are untrusted by default; grant capabilities explicitly. Not full mIRC/NNScript compatibility.
- DCC SEND receive + RESUME/ACCEPT for local/direct peers; files never auto-executed; NAT/firewall not guaranteed
