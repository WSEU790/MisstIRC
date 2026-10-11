; Original MisstIRC fixture — string helpers subset (not from NNScript packs)
alias strdemo {
  var %s = HelloWorld
  echo -a upper=$upper(%s)
  echo -a left=$left(%s,5)
  echo -a mid=$mid(%s,7,5)
  echo -a repl=$replace(%s,World,MisstIRC)
  echo -a pos=$pos(%s,world)
}

on *:ACTION:*:#:{
  echo -a action from $nick in $chan: $1-
}
