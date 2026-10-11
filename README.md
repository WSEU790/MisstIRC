# MisstIRC

Professional Windows-first IRC client built with **Electron**, **React**, **TypeScript**, and **Vite**. Real TCP/TLS IRC networking, multi-connection support, CAP/SASL registration, and a classic channel/PM shell.

> Brand: **MisstIRC** — original assets only.  
> First slice focuses on a working IRC engine + UI. Full mIRC/NNScript scripting, DCC, and the Windows installer are **not implemented** yet (clearly labeled in the app status bar).

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

Output lands in `out/`. Windows installer packaging via electron-builder is deferred until launch reliability is proven.

## Connect

1. Click **Connect**
2. Enter host/port (or use `127.0.0.1` against your own mock/server)
3. Optional password is stored via the secret store (encrypted file fallback on non-Windows; Credential Manager path reserved for Windows)

Slash commands: `/join`, `/part`, `/msg`, `/notice`, `/nick`, `/me`, `/quit`, plus raw passthrough.

## Project docs

Architecture, plan, and checklist live in the Project Context store under `docs/`.

## Security notes

- Renderer has no Node access; IPC is a typed preload bridge (`window.misstirc`)
- IRC passwords are not written into ordinary settings rows
- DCC and script execution are gated as unfinished — do not treat stub UI as functional
