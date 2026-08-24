#!/usr/bin/env bash
#
# Skriver ut en mobil-URL til en kjørende dev-server, og VERIFISERER at den
# faktisk virker fra telefonen — ikke bare at HTTP svarer 200.
#
# Bakgrunnen (funnet 2026-08-24): at siden svarer 200 over LAN-IP-en beviser
# ingenting. Turbopacks dev-runtime booter appen først når HMR-websocketen har
# koblet til, og den avvises hvis maskinens nåværende IP ikke står i
# `allowedDevOrigins`. Lista regnes ut ved OPPSTART, så en dev-server som har
# stått over natta har gårsdagens adresse. Symptomet er en blank side der
# HTML og alle JS-chunks kom fram med 200 — det ser ut som et nettverksproblem,
# men er en avvist websocket. Derfor er WS-handshaken den ENESTE sjekken som
# betyr noe her, og den er det denne scriptet gjør.
#
# Bruk:
#   scripts/mobile-url.sh                      # sjekk alle dev-servere
#   scripts/mobile-url.sh 3003                 # sjekk én port
#   scripts/mobile-url.sh 3003 --restart       # restart porten hvis WS er død
#   scripts/mobile-url.sh 3003 --path /eiendom/placy-demo/strindfjordvegen-10/rapport-board
#
set -uo pipefail

PORT_ARG=""
RESTART=0
URL_PATH="/"

while [ $# -gt 0 ]; do
  case "$1" in
    --restart) RESTART=1 ;;
    --path) shift; URL_PATH="${1:-/}" ;;
    [0-9]*) PORT_ARG="$1" ;;
    *) echo "Ukjent argument: $1" >&2; exit 2 ;;
  esac
  shift
done

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "Fant ingen LAN-IP på en0/en1 — er maskinen på wifi?" >&2
  exit 1
fi

# Én sjekk som betyr noe: godtar dev-serveren en websocket-handshake der
# Origin er LAN-IP-en? Alt annet (HTTP 200, chunks, brannmur) kan være grønt
# mens siden er blank.
# MERK: en vellykket upgrade holder forbindelsen åpen, så curl returnerer
# alltid timeout-exit (28) her — statuskoden er det eneste svaret vi kan lese.
# Resultatet MÅ derfor fanges i en variabel, ikke pipes: med `set -o pipefail`
# ville curls exit 28 overstyrt et grep-treff og gjort hver sjekk falsk negativ.
ws_ok() {
  local port="$1" code
  code="$(curl -s -m 3 -o /dev/null -w "%{http_code}" \
    "http://${IP}:${port}/_next/webpack-hmr?id=mobile-url-check" \
    -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Origin: http://${IP}:${port}" 2>/dev/null)"
  [ "$code" = "101" ]
}

cwd_of_port() {
  local pid
  pid="$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1)"
  [ -z "$pid" ] && return 1
  # next-server er et barn — dev-serverens rot ligger i forelderens cwd
  local ppid cwd
  ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  for p in "$ppid" "$pid"; do
    [ -z "$p" ] && continue
    cwd="$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)"
    if [ -n "$cwd" ] && [ -f "$cwd/package.json" ]; then echo "$cwd"; return 0; fi
  done
  return 1
}

restart_port() {
  local port="$1" dir
  dir="$(cwd_of_port "$port")" || { echo "  Fant ikke mappa til porten — restart manuelt." >&2; return 1; }
  echo "  Restarter dev-server i $dir …"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | xargs -r kill
  sleep 3
  ( cd "$dir" && PORT="$port" nohup npm run dev >/tmp/dev-$port.log 2>&1 & )
  for _ in $(seq 1 15); do
    sleep 2
    ws_ok "$port" && return 0
  done
  return 1
}

if [ -n "$PORT_ARG" ]; then
  PORTS="$PORT_ARG"
else
  PORTS="$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/node/ {print $9}' \
    | sed 's/.*://' | sort -un | awk '$1 >= 3000 && $1 <= 3020')"
fi

[ -z "$PORTS" ] && { echo "Ingen dev-server lytter på 3000-3020. Start én først." >&2; exit 1; }

STATUS=0
for PORT in $PORTS; do
  DIR="$(cwd_of_port "$PORT" || echo "?")"
  if ws_ok "$PORT"; then
    echo "✅ http://${IP}:${PORT}${URL_PATH}"
    echo "   ($(basename "$DIR"), HMR-websocket godtar IP-origin — mobilen vil rendre)"
  else
    echo "❌ :${PORT} ($(basename "$DIR")) — HMR-websocketen avvises fra ${IP}."
    echo "   Siden vil svare 200 men bli BLANK på mobilen."
    if [ "$RESTART" = "1" ]; then
      if restart_port "$PORT"; then
        echo "✅ http://${IP}:${PORT}${URL_PATH}"
        echo "   (restartet, WS-handshake OK — logg i /tmp/dev-${PORT}.log)"
      else
        echo "   Restart hjalp ikke. Sjekk at allowedDevOrigins i $DIR/next.config.mjs"
        echo "   dekker ${IP} (private IP-områder som mønstre)."
        STATUS=1
      fi
    else
      echo "   Kjør på nytt med --restart, eller restart dev-serveren i $DIR selv."
      STATUS=1
    fi
  fi
done
exit $STATUS
