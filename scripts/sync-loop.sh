#!/bin/sh
# Samodejni ponovni zagon AJPES sinhronizacije.
# Izkoristi GeocodeCache (SQLite): vsak ponovni zagon nadaljuje, kjer je
# prejšnji proces ostal; začasne napake (429/5xx) se poskusijo znova.
# Ko sync uspe (izhodni kod 0 = baza posodobljena), se zanka zaključi.
LOG=/tmp/sync-ajpes.log
cd /home/z/my-project || exit 1
while true; do
  echo "[$(date -u +%FT%TZ)] === ZAGON (sync-loop) ===" >> "$LOG"
  bun run scripts/sync-ajpes.ts >> "$LOG" 2>&1
  code=$?
  echo "[$(date -u +%FT%TZ)] === sync izhodni kod: $code ===" >> "$LOG"
  if [ "$code" -eq 0 ]; then
    echo "[$(date -u +%FT%TZ)] === USPEH — zanka zaključena ===" >> "$LOG"
    break
  fi
  echo "[$(date -u +%FT%TZ)] === ponovni zagon čez 5 s ===" >> "$LOG"
  sleep 5
done
