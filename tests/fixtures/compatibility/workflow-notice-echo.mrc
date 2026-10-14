; Original MisstIRC fixture — NOTICE event subset (NickServ-style notices)
on *:NOTICE:*:{
  echo -a notice from $nick: $1-
}

alias noticetest {
  echo -a ready for NOTICE events on $me @ $network
}
