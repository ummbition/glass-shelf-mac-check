#!/bin/bash
# 사파리 + 버튼, 주소창 왼쪽 페이지 메뉴(≡) 버튼, 공유 버튼을 눌러 나오는 창까지 녹화 (hovertest=safarivid/safarividdark)
OUT="$1"
[ "$2" = dark ] && osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' && sleep 2
brew install cliclick > /dev/null 2>&1 || true
open -a Safari https://example.com; sleep 6
screencapture -x "$OUT/safari-start.png"
screencapture -x -V 30 "$OUT/safari.mov" &
REC=$!
sleep 1.5
Y=72
tap() { cliclick m:$1,$Y w:700 c:$1,$Y w:2200; screencapture -x "$OUT/open-$2.png"; }
# + : 새 탭이 열리면 탭바가 생기므로 이후 좌표 다시 확인용으로 캡처
tap 1557 plus
screencapture -x "$OUT/after-plus.png"
cliclick kp:esc w:400
osascript -e 'tell application "Safari" to close current tab of front window' || true
sleep 1.5
tap 708 pagemenu
cliclick w:800 kp:esc w:1000
tap 1522 share
cliclick w:800 kp:esc w:1000
cliclick m:900,600
wait $REC
