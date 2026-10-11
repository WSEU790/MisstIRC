; Original MisstIRC fixture — KICK/TOPIC/NICK event subset
on *:KICK:#:{
  echo -a kick: $nick kicked $target ($1-) on $chan [$network]
}

on *:TOPIC:#:{
  echo -a topic by $nick on $chan: $1-
}

on *:NICK:{
  echo -a nick change $nick to $1-
}
