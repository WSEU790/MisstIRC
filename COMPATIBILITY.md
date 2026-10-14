# MisstIRC Compatibility Notes

## Policy

MisstIRC aims for **familiar workflows** for mIRC / NNScript users.

**Full mIRC or NNScript drop-in compatibility is not claimed.** Claims below are backed by Phase 6 fixtures in `tests/fixtures/compatibility/` and `tests/phase6-compatibility.test.ts` (§26 rule 10).

Status key:

| Status | Meaning |
|--------|---------|
| **works** | Implemented and covered by automated fixtures/tests |
| **partial** | Subset / scaffold only; differences documented |
| **unsupported** | Explicitly rejected or out of scope — **never silently ignored** |

## Reference installer (lawful inspection)

| Field | Finding |
|-------|---------|
| File | `nnscript421.exe` (Project store `internal/reference/`) |
| Size | 1,177,487 bytes |
| Type | PE32 GUI, Intel 80386, **Nullsoft Installer** self-extracting archive |
| NSIS | v2.37; LZMA:23; Solid; NSIS-2 |
| Authenticode | **Not signed** |
| Product (docs) | NoNameScript / NoNamedScript **4.21** (©2008 ESNation) |
| Host client target | Bundled `mirc.ini` targets **mIRC 6.31** |
| License (readme) | `.nns` / `nnscript.dll` copyrighted; redistribution of script parts forbidden without permission |
| Bundled proprietary | Themes, scripts, icons, fonts, DLLs — **not reused in MisstIRC** |

### Not done / not allowed

- No DRM or license bypass  
- No copying of `.nns`, icons, fonts, splash art, or DLLs into the product tree  
- No loading of `nnscript.dll`  

Full matrix: Project Context `docs/reference-matrix.md`.

## mIRC-style scripting subset

| Construct | Status | Notes | Fixture / test |
|-----------|--------|-------|----------------|
| `alias { }` | works | Nested alias calls | `workflow-greeter.mrc` |
| `on LEVEL:EVENT:…` | partial | TEXT/ACTION/JOIN/PART/QUIT/NOTICE/NICK/KICK/TOPIC/MODE/CONNECT/DISCONNECT; pattern subset | `workflow-greeter.mrc`, `workflow-kick-topic.mrc` |
| `raw N:…` | partial | Numeric handlers; match subset | unit (Phase 5) |
| `if` / `else` / `while` | works | Caps on iterations / instructions | Phase 5 tests |
| `var` / `inc` / `dec` | works | `%vars` | Phase 5 tests |
| `$nick` `$chan` `$me` `$network` `$1` `$1-` `$*` | partial | Common idents only | Phase 5–6 |
| `$upper` `$lower` `$len` `$left` `$right` `$mid` `$replace` `$pos` `$ctime` `$asctime` | works | Safe string/time helpers | `workflow-string-helpers.mrc` |
| `$iif` | works | Comparison subset + truthy tokens | `workflow-iif-calc.mrc` |
| `$calc` | works | Safe `+ - * / ()` only | `workflow-iif-calc.mrc` |
| `echo` / `timer` | works | Permission-gated | Phase 5 |
| IRC slash (`msg`/`join`/…) | works | Requires grants | Phase 5 |
| `halt` / `return` | works | Event cancel via `halt` | Phase 5 |
| `menu <target> { }` | partial | Parsed + context menus in UI; no `$menu` | `workflow-channel-menu.mrc`, `workflow-nick-menu.mrc` |
| `goto` / labels | unsupported | Reported on import | compat scanner |
| `/dll` `$dll` DCX/MDX | unsupported | Blocking diagnostics; runtime error if forced | `workflow-unsupported-dll.mrc` |
| `/dialog` `/window` `/draw*` | unsupported | Reported; not silent | compat catalog |
| `/com*` `/sock*` `/run` | unsupported | Forbidden | compat catalog |
| File / INI helpers | unsupported | No script filesystem | compat catalog |
| `$regex` `$readini` | unsupported | Out of scope | compat catalog |
| `.nns` / `nnscript.dll` | unsupported | Not loaded | scanner + dll fixture |

Untrusted imports are echo-only until the user grants capabilities. Blocking unsupported features leave the script **disabled** until reviewed (`force enable` in UI).

## NNScript workflows (from reference matrix)

These map **workflows**, not proprietary script code.

| Workflow | NNScript observation | MisstIRC | Status | Evidence |
|----------|----------------------|----------|--------|----------|
| Connect / register | mIRC UI + NickServ scripts | TCP/TLS, CAP, SASL; password field | partial | IRC integration tests |
| Channel greeter / TEXT events | events.nns-style handlers | `on *:TEXT:…` subset | works | `workflow-greeter.mrc` |
| Channel / nick popups | popups.nns / popups.ini | Context menus + `$$1` substitution | partial | `workflow-channel-menu.mrc`, `workflow-nick-menu.mrc` |
| Away system | awaysys.nns + toolbar | `/away` client + echo helper fixture | partial | `workflow-away-echo.mrc` |
| NickServ UX | 4.21 NickServ improvements | Prefer SASL/password — no secrets in scripts | partial | `workflow-nickserv-note.mrc` |
| Protections / flood | script modules | Planned (app-level ignore exists) | unsupported* | *as NNS modules |
| Themes `.nnt` | theme engine | CSS variables only | unsupported | license + Phase 7 editor |
| Native DLLs | nnscript.dll, DCX/MDX | No DLL host | unsupported | `workflow-unsupported-dll.mrc` |
| DCC helpers | scripts + relay | Classic SEND send+receive + RESUME/ACCEPT (local mocks); NAT not guaranteed | partial | `tests/dcc-transfer.test.ts` |
| NOTICE / CONNECT banners | events | `on NOTICE` / `CONNECT` fixtures | works | `workflow-notice-echo.mrc`, `workflow-connect-banner.mrc` |
| Ignore / flood prot modules | NNS prot | App `/ignore` only — not NNS modules | partial | `workflow-ignore-note.mrc` + ignore tests |

\* “Unsupported” here means MisstIRC does **not** load NNScript protection modules; app-level ignore/highlights are separate.

## Import diagnostics

On import, MisstIRC always produces:

1. **Parse errors** (structured AST parser)  
2. **Compatibility findings** (`works` / `partial` / `unsupported`) with line numbers  
3. **Menu parse errors** (if any)  

Unsupported script commands throw at runtime with a clear error — they are **not** forwarded as IRC lines.

## Menu / popup scaffolding

- `menu channel|nick|query|status|menubar|nicklist { … }` is parsed into a tree (commands, separators, dotted submenus).  
- Enabled scripts expose items via `listScriptMenus` / Scripts panel metadata.  
- **UI (0.10):** right-click nicklist → `nick`/`nicklist` menus; right-click conversation header → `channel`/`query`/`status`; invoke via `runScriptMenuCommand` with `$$1`/`$nick`/`$chan` substitution.  
- **Not claimed:** full mIRC popup evaluation, `$menu`, dynamic enable expressions, nested submenu UI, or DLL-drawn UI.

## Manual verification (optional)

1. Scripts → import `workflow-greeter.mrc` → grant IRC caps if needed → `/greeter alice` echoes.  
2. Import `workflow-unsupported-dll.mrc` → status error + diagnostics mention `/dll` → Force enable still errors at runtime on `/boom`.  
3. Import `workflow-channel-menu.mrc` → menus count ≥ 1 in Scripts panel.
