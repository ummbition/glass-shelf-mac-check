#!/bin/bash
# Finder 단독 버튼(검색 원, 묶기 알약)을 짧게 누르고 꾹 누르는 모습 녹화 (hovertest=singlevid/singleviddark)
OUT="$1"
[ "$2" = dark ] && osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' && sleep 2
brew install cliclick > /dev/null 2>&1 || true
open -a Finder "$HOME"; sleep 2
osascript -e 'tell application "Finder" to set bounds of front window to {400, 200, 1320, 700}' || true
sleep 1
screencapture -x "$OUT/finder-start.png"
screencapture -x -V 16 "$OUT/single.mov" &
REC=$!
sleep 1.5
Y=226
press() { cliclick m:$1,$Y w:600 c:$1,$Y w:1200; }
hold()  { cliclick m:$1,$Y w:600 dd:$1,$Y w:300; screencapture -x "$OUT/hold-$2.png"; cliclick w:1500 du:$1,$Y w:1200; }
press 1294; cliclick kp:esc w:600; hold 1294 search; cliclick kp:esc w:800
press 1124; cliclick kp:esc w:600; hold 1124 groupby; cliclick kp:esc w:600
cliclick m:900,600
wait $REC
