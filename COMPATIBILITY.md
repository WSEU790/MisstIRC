# MisstIRC Compatibility Notes

## Policy

MisstIRC aims for **familiar workflows** for mIRC / NNScript users. Full script/theme/DLL compatibility is **not claimed** until Phase 6 fixtures exist (§26 rule 10).

## Reference installer (lawful inspection)

| Field | Finding |
|-------|---------|
| File | `nnscript421.exe` (Project store `internal/reference/`) |
| Size | 1,177,487 bytes |
| Type | PE32 GUI, Intel 80386, **Nullsoft Installer** self-extracting archive |
| NSIS | v2.37 (assembly manifest); Method LZMA:23; Solid; SubType NSIS-2 |
| Authenticode | **Not signed** (certificate data directory empty) |
| Product (docs) | NoNameScript / NoNamedScript **4.21** (©2008 ESNation) |
| Host client target | Bundled `mirc.ini` targets **mIRC 6.31** |
| License (readme) | `.nns` scripts and `nnscript.dll` copyrighted; personal modification allowed; **redistribution of script parts forbidden** without ESNation permission |
| Bundled proprietary | Themes (`.nnt`), scripts (`.nns`), icon packs, fonts, `nnscript.dll`, DCX/MDX DLLs — **not reused in MisstIRC** |

### User-accessible materials inspected

- `nnreadme.txt` — license / copyright / forum pointer  
- `nnchanges.txt` — 4.21 changelog (themes, protections, toolbar, installer, NickServ, status bar, etc.)  
- `mirc.ini` — section keys + remotes/aliases file list (names only for compatibility planning)  
- `popups.ini` — trivial stub (`NoNa&meScript`)  
- Archive file listing (extensions/counts) — ~1794 `.ico`, 58 `.nnt`, 43 `.nns`, DLLs under `scripts/dlls/`

### Not done / not allowed

- No DRM or license bypass  
- No copying of `.nns`, icons, fonts, splash art, or DLLs into the MisstIRC product tree  
- No loading of `nnscript.dll`  

## Observable NNScript feature areas → MisstIRC

Full matrix: Project Context `docs/reference-matrix.md`. Summary:

| Area | NNScript 4.21 (observed) | MisstIRC status |
|------|--------------------------|-----------------|
| Host | Script pack **on mIRC** | Standalone Electron client |
| Themes | Dozens of `.nnt` + theme engine | CSS variable theme; editor Planned |
| Toolbar / tree / status | Rich script UI | Basic shell Partially implemented |
| Protections (query flood, blacklist) | Script modules | Planned |
| Away / NickServ | Script | Planned (NickServ via SASL/pass partially) |
| DCC helpers | Scripts + relay | Stub only |
| Popups / aliases | `.nns` + popups | Planned (Phase 5–6) |
| DLL UI (DCX/MDX) | Native mIRC DLLs | **Unsupported** |

## mIRC-style scripting

Planned compatibility layer will document supported vs unsupported syntax. Until then, status is **Planned / Unsupported** for DLL-dependent features.
