# MisstIRC Release & Packaging

## Policy (§26 rule 11)

**Do not ship or publish an installer** (signed or unsigned) until:

1. `npm test` and `npm run typecheck` are green  
2. `npm run build` succeeds  
3. The **Windows smoke checklist** in `TESTING.md` is green on Windows x64  
4. `npm run pack:win:dir` launches on Windows (`release/win-unpacked/MisstIRC.exe`)  

Code signing credentials must never be committed. `forceCodeSigning: false` until smoke is signed off.

## Reproducible packaging

Config: `electron-builder.yml` (Windows x64 NSIS + dir; Linux dir for CI dry-run).

| Command | Result |
|---------|--------|
| `npm run pack:dir` | Linux x64 unpacked → `release/linux-unpacked/` |
| `npm run pack:win:dir` | Windows x64 unpacked → `release/win-unpacked/` (Wine may be needed on Linux) |
| `npm run pack:win` | NSIS installer + dir (same gate as above; **unsigned**) |

Artifacts land in `release/` (gitignored). Native modules: `asarUnpack` for `better-sqlite3`; rebuild via `electron-builder install-app-deps`.

### Dry-run (Linux CI / cloud agent)

```bash
npm ci
npm test
npm run typecheck
npm run pack:dir
# Inspect release/linux-unpacked/ — not a Windows installer
# Optional: npm run pack:win:dir  (may fail without Wine; still not a ship artifact)
```

Windows installer smoke must be validated on Windows (or a Windows CI runner). See exact steps in `TESTING.md`.

## Upgrade

1. Export a profile backup from **Customize → Backup** (credentials are never included).  
2. Install the new version (or replace the unpacked app directory).  
3. Launch; settings/SQLite under `%APPDATA%/misstirc` (Electron `userData`) persist across upgrades when using NSIS with `deleteAppDataOnUninstall: false`.  
4. Re-enter network passwords (secret store is local; backups omit them).  
5. Re-import scripts from `userData/scripts` if you migrated machines manually.

## Uninstall (NSIS)

- Use Windows Apps & features → MisstIRC → Uninstall.  
- By default **userData is kept** (`deleteAppDataOnUninstall: false`) so logs/settings/scripts survive.  
- To wipe: delete `%APPDATA%/misstirc` (and any portable data directory) after uninstall.  
- Backups under `userData/backups` are removed only if you delete userData.

## Versioning

Follow `CHANGELOG.md`. Phase 8 packaging prep is **0.7.0** — still not a “shipped installer” release until smoke is signed off.
