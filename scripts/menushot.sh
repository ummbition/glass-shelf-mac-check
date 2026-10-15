#!/bin/bash
# 우클릭 메뉴 모양·호버색·곡률 (hovertest=menushot). 라이트·다크 둘 다
OUT="$1"
brew install cliclick > /dev/null 2>&1 || true
osascript -e 'tell application "Preview" to quit' || true
for MODE in light dark; do
  [ $MODE = dark ] && osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' || osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'
  sleep 2
  open -a Finder "$HOME"; sleep 2
  osascript -e 'tell application "Finder" to set bounds of front window to {400, 200, 1320, 700}' || true
  sleep 1
  # 빈 자리 우클릭
  cliclick m:1100,640 w:400 rc:1100,640 w:900
  screencapture -x "$OUT/$MODE-menu.png"
  cliclick m:1140,665 w:700
  screencapture -x "$OUT/$MODE-menu-hover1.png"
  cliclick m:1140,735 w:700
  screencapture -x "$OUT/$MODE-menu-hover2.png"
  cliclick kp:esc w:600
  # 파일 우클릭 (항목 많은 메뉴)
  cliclick m:640,300 w:300 c:640,300 w:500 rc:640,300 w:900
  screencapture -x "$OUT/$MODE-filemenu.png"
  cliclick m:700,330 w:700
  screencapture -x "$OUT/$MODE-filemenu-hover.png"
  cliclick kp:esc w:600
  # 메뉴 막대 메뉴
  cliclick c:167,14 w:900
  screencapture -x "$OUT/$MODE-menubar.png"
  cliclick m:200,60 w:700
  screencapture -x "$OUT/$MODE-menubar-hover.png"
  cliclick kp:esc w:600
  osascript -e 'tell application "Finder" to close every window' || true
done
