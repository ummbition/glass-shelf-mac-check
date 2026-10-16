#!/bin/bash
# 사파리 탭 여러 개를 띄워 탭 컨테이너·탭 크기를 잰다: 화면 캡처 + 접근성 트리 (hovertest=safaritabs/safaritabsdark)
OUT="$1"
[ "$2" = dark ] && osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' && sleep 2
brew install cliclick > /dev/null 2>&1 || true
swiftc -O scripts/axdump.swift -o axdump 2>&1 | tail -5
open -a Safari https://example.com; sleep 6
screencapture -x "$OUT/one-tab.png"
for i in 1 2 3; do cliclick kd:cmd t:t ku:cmd w:1200; done
cliclick kp:esc w:800
screencapture -x "$OUT/four-tabs.png"
./axdump Safari > "$OUT/ax.txt" 2>&1 || true
cliclick m:900,114 w:1500; screencapture -x "$OUT/four-tabs-hover.png"
system_profiler SPDisplaysDataType | grep -i "resolution\|retina" > "$OUT/display.txt" || true
