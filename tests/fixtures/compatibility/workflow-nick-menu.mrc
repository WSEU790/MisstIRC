; Original MisstIRC fixture — nick popup with $$1 placeholder
; Expected: partial — menu parses; UI invokes with nick substitution

alias greetnick {
  echo -a hello $1 from menu
}

menu nick {
  Greet:greetnick $$1
  Whois nick:whois $$1
}
