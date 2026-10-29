#!/bin/sh
# Startet Dulidan Radar aus dem Quellcode (macOS und Linux).
# Auf dem Mac: Rechtsklick -> Oeffnen. Im Terminal: ./radar-starten.command
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt noch. Bitte installiere die LTS-Version von https://nodejs.org"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Erster Start: Ich lade einmalig die Bausteine ..."
  npm install || exit 1
fi
# RADAR_FRESH=1 startet wie beim ersten Mal, mit eigenem Test-Ordner.
if [ "$RADAR_FRESH" = "1" ]; then
  export RADAR_USER_DATA="$(mktemp -d)"
fi
npm run dev --workspace @dulidan/radar
