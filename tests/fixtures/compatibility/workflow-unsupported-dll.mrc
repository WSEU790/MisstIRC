; MisstIRC fixture (original) — must report unsupported DLL usage
; Expected: unsupported — import diagnostics block enable by default

alias boom {
  dll nnscript.dll SomeProc
  echo -a should not hide the dll line
}
