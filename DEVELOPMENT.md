# MisstIRC Development

## Prerequisites

- Node.js 20+
- npm 10+

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install deps; rebuild native modules for Electron |
| `npm run dev` | Electron + Vite dev |
| `npm test` | Vitest (parser, mock IRC, SQLite, secrets) |
| `npm run typecheck` | `tsc` for node + web projects |
| `npm run build` | Production electron-vite build → `out/` |

## Branching

Feature work on `cursor/<name>-d19d` branches. Do not claim Phase completion without tests or an explicit manual verification note in `FEATURE_STATUS.md`.

## Implementation phases

Follow master prompt §25:

1. Foundation → 2. IRC core → 3. Daily IRC → 4. Advanced IRC → 5. Scripting → 6. Legacy compatibility → 7. Customization → 8. Production readiness

Acceptance rules in §26 are mandatory (no fake IRC, no plaintext credentials, no unrestricted scripts, no installer before smoke tests).

## Native modules

`better-sqlite3` is rebuilt for the Electron ABI via `electron-builder install-app-deps` on `postinstall`. If Electron fails to load it, re-run install on the target OS.

## Reference materials

Lawful inspection notes for the user-supplied NNScript 4.21 installer live in `COMPATIBILITY.md` and Project Context `docs/reference-matrix.md`. **Do not** copy proprietary `.nns`, icons, fonts, or DLLs into this repository.
