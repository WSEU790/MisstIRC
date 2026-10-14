# MisstIRC Development

## Prerequisites

- Node.js 20+
- npm 10+

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install deps; rebuild native modules for Electron |
| `npm run dev` | Electron + Vite dev |
| `npm test` | Vitest suites |
| `npm run typecheck` | `tsc` for node + web |
| `npm run build` | Production electron-vite build → `out/` |
| `npm run pack:dir` | Linux x64 unpacked → `release/linux-unpacked/` |
| `npm run pack:win:dir` | Windows x64 unpacked dry-run → `release/win-unpacked/` |
| `npm run pack:win` | NSIS installer (unsigned; do not ship until Windows smoke green) |

## Branching

Feature work on `cursor/<name>-d19d` branches. Do not claim Phase completion without tests or an explicit manual verification note in `FEATURE_STATUS.md`.

## Implementation phases

1. Foundation → 2. IRC core → 3. Daily IRC → 4. Advanced IRC → 5. Scripting → 6. Legacy compatibility → 7. Customization → 8. Production readiness

Acceptance rules in §26 are mandatory (no fake IRC, no plaintext credentials, no unrestricted scripts, **no installer before smoke tests**).

## Native modules

`better-sqlite3` rebuilds for the Electron ABI via `electron-builder install-app-deps`. If load fails, re-run on the target OS: `npm run rebuild:electron`.

## Packaging notes

- Config: `electron-builder.yml`  
- Output: `release/` (ignored by git)  
- Details: `RELEASE.md` (upgrade / uninstall / dry-run)  
- Performance bounds: `PERFORMANCE.md`  
- Security review: `SECURITY.md`  

## Upgrade & uninstall (dev summary)

- Upgrades keep Electron `userData` (settings, scripts, logs, backups).  
- Passwords are not in config exports — re-enter after machine migration.  
- NSIS uninstall leaves userData by default; delete `%APPDATA%/misstirc` for a full wipe.  

## Reference materials

Lawful NNScript 4.21 notes: `COMPATIBILITY.md` and Project Context `docs/reference-matrix.md`. **Do not** copy proprietary `.nns`, icons, fonts, or DLLs into this repository.

## Secrets

Never commit PATs, passwords, or embed tokens in `git remote -v`. Prefer `GH_TOKEN` in the environment for forge access.
