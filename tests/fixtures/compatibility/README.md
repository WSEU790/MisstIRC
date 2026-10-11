# Compatibility fixtures

Original MisstIRC examples for Phase 6 tests. **Not** copied from NNScript `.nns` packs.

| File | Workflow | Expected |
|------|----------|----------|
| `workflow-greeter.mrc` | Alias + TEXT event | works |
| `workflow-channel-menu.mrc` | Channel menu scaffold | partial |
| `workflow-away-echo.mrc` | Away-status style echo | partial / works (alias) |
| `workflow-unsupported-dll.mrc` | `/dll` reporting | unsupported (blocking) |
| `workflow-nickserv-note.mrc` | NickServ guidance alias | works |

Each fixture is exercised in `tests/phase6-compatibility.test.ts`.
