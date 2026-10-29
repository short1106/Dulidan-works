#!/bin/sh
# Startet Dulidan Cortex aus dem Quellcode (macOS und Linux).
# Auf dem Mac: Rechtsklick -> Oeffnen. Im Terminal: ./cortex-starten.command
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt noch. Bitte installiere die LTS-Version von https://nodejs.org"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Erster Start: Ich lade einmalig die Bausteine ..."
  npm install || exit 1
fi
# CORTEX_FRESH=1 startet wie beim ersten Mal, mit eigenem Test-Ordner
# und einer Kopie der Beispielnotizen (deine echten Notizen bleiben unberuehrt).
if [ "$CORTEX_FRESH" = "1" ]; then
  test_dir="$(mktemp -d)"
  export CORTEX_USER_DATA="$test_dir/Einstellungen"
  export CORTEX_NOTES_DIR="$test_dir/Notizen"
  cp -R apps/cortex/test/beispiel-notizen "$CORTEX_NOTES_DIR"
fi
npm run dev --workspace @dulidan/cortex
