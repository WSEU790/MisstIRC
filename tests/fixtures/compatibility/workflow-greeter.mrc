; MisstIRC fixture (original) — greeter workflow
; Expected: works — alias + TEXT event under sandbox

alias greeter {
  echo -a Hello $1 from MisstIRC
}

on *:TEXT:hello*:#:{
  echo -a $nick greeted the channel
}
