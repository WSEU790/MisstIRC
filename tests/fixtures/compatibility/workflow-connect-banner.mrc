; Original MisstIRC fixture — CONNECT/DISCONNECT banner workflow
on *:CONNECT:{
  echo -a connected as $me on $network
}

on *:DISCONNECT:{
  echo -a disconnected from $network
}

alias showme {
  echo -a I am $me
}
