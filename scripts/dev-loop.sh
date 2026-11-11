#!/bin/sh
# Nadzorna zanka za dev strežnik (port 3000).
# Če proces umre (SIGTERM/OOM), ga čez 3 s samodejno zažene.
LOG=/home/z/my-project/dev.log
cd /home/z/my-project || exit 1
while true; do
  echo "[$(date -u +%FT%TZ)] === DEV STREŽNIK: zagon ===" >> "$LOG"
  bun run dev >> "$LOG" 2>&1
  echo "[$(date -u +%FT%TZ)] === DEV STREŽNIK: proces končan (izhod $?), ponovni zagon čez 3 s ===" >> "$LOG"
  sleep 3
done
