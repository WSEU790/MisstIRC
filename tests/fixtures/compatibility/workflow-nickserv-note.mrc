; MisstIRC fixture (original) — NickServ workflow guidance
; NNScript improved NickServ UX; MisstIRC uses SASL/password fields instead of
; embedding secrets in perform/scripts.
; Expected: works for the alias; secrets-in-script remain unsupported by policy

alias nssuggest {
  echo -a Prefer SASL or the network password field — do not put NickServ passwords in scripts
}
