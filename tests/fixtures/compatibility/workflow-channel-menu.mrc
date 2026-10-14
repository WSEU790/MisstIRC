; MisstIRC fixture (original) — channel popup scaffold
; Expected: partial — menu parses; not a full mIRC popup engine

alias sayhi {
  echo -a menu said hi
}

menu channel {
  Say hi:sayhi
  -
  More
  .Ping echo:echo -a ping from menu
}
