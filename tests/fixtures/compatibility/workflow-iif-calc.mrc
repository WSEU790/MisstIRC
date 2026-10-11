; Original MisstIRC fixture — $iif / $calc helpers
; Expected: works

alias checkiif {
  var %n = alice
  echo -a iif=$iif(%n == alice,yes,no)
  echo -a calc=$calc(2+3*4)
}
