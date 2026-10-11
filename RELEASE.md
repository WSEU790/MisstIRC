# MisstIRC Release & Packaging

## Policy (§26 rule 11)

**Do not ship or publish an installer** until:

1. `npm test` and `npm run typecheck` are green  
2. `npm run build` succeeds  
3. A manual Electron smoke launch succeeds (see `TESTING.md`)  
4. Optionally `npm run pack:win:dir` produces an unpacked app that launches on the target OS  

The NSIS target (`npm run pack:win`) is configured for reproducibility; treating its output as a release artifact requires the checklist above.

## Reproducible packaging

Config: `electron-builder.yml` (Windows x64 NSIS + dir).

| Command | Result |
|---------|--------|
| `npm run pack:dir` | Unpacked app for **current** host OS → `release/` |
| `npm run pack:win:dir` | Unpacked Windows x64 tree (may need Wine on Linux) → `release/` |
| `npm run pack:win` | NSIS installer + dir (same gate as above) |

Artifacts land in `release/` (gitignored). Native modules rebuild via `electron-builder install-app-deps`.

### Dry-run (Linux CI / cloud agent)

```bash
npm ci
npm test
npm run typecheck
npm run pack:dir
# Inspect release/*/ — do not distribute as a Windows installer from a Linux dry-run
```

Windows installer smoke must be validated on Windows (or a Windows CI runner).

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
