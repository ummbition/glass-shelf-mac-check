#!/bin/bash
# 사파리 사이드바 버튼 옆 아래 화살표(탭 그룹 메뉴)를 눌러 나오는 창 녹화·캡처 (hovertest=safarichev)
OUT="$1"
brew install cliclick > /dev/null 2>&1 || true
open -a Safari https://example.com; sleep 6
screencapture -x "$OUT/safari-start.png"
screencapture -x -V 8 "$OUT/chev.mov" &
REC=$!
sleep 1.2
cliclick m:438,72 w:600 c:438,72 w:1800
screencapture -x "$OUT/chev-open.png"
cliclick m:600,72 w:1500
screencapture -x "$OUT/chev-hover.png"
cliclick kp:esc
wait $REC
