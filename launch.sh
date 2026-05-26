#!/bin/bash
# Church System — Launcher
ROOT="/Users/Valentin/Desktop/church-system-alpha"

# Abrir dos tabs en Terminal
osascript <<ASCRIPT
tell application "Terminal"
  activate
  -- Tab 1: Backend
  do script "echo '⛪ Church System — Backend' && cd '$ROOT/backend' && node src/server.js"
  delay 2
  -- Tab 2: Frontend
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "echo '🌐 Church System — Frontend' && cd '$ROOT/frontend' && npm run dev" in front window
  delay 3
  -- Abrir browser
  do script "sleep 3 && open http://localhost:5173" in front window
end tell
ASCRIPT
