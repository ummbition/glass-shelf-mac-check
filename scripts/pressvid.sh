#!/bin/bash
# 기본 앱(Finder·Safari) 툴바 버튼을 짧게 누르고 꾹 누르는 모습 녹화 (hovertest=pressvid)
OUT="$1"
[ "$2" = dark ] && osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' && sleep 2
brew install cliclick > /dev/null 2>&1 || true
osascript -e 'tell application "Preview" to quit' || true
open -a Finder "$HOME"; sleep 2
osascript -e 'tell application "Finder" to set bounds of front window to {400, 200, 1320, 700}' || true
sleep 1
screencapture -x "$OUT/finder-start.png"
screencapture -x -V 22 "$OUT/finder.mov" &
REC=$!
sleep 1.5
Y=226
press() { cliclick m:$1,$Y w:600 c:$1,$Y w:1200; }
hold()  { cliclick m:$1,$Y w:600 dd:$1,$Y w:300; screencapture -x "$OUT/hold-$2.png"; cliclick w:1500 du:$1,$Y w:1200; }
press 1176; hold 1176 share
press 994;  hold 1034 gallery
press 1212; hold 1212 tag
cliclick m:900,600
wait $REC
osascript -e 'tell application "Finder" to close every window' || true
open -a Safari https://example.com; sleep 6
screencapture -x "$OUT/safari-start.png"
screencapture -x -V 18 "$OUT/safari.mov" &
REC=$!
sleep 1.5
Y=72
press 411; hold 411 ssidebar
press 1522; cliclick kp:esc w:600; hold 1522 sshare; cliclick kp:esc w:600
press 1557; hold 1557 splus
cliclick m:900,600
wait $REC
