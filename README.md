# Dulidan Works

Die Programmfamilie von Dulidan Studios: Einmalkauf, kein Abo, keine Cloud.
Als erstes Programm entsteht **Dulidan Glyph**, die Textverarbeitung.

## Aufbau

```
apps/
  glyph/            Die App (Electron, React)
packages/
  design-system/    Farben, Schrift, Bausteine, Logo, Animationen
  core/             Modus-Logik, Einstellungen, Dateiformat
THIRD_PARTY_LICENSES.md
```

## Starten

Voraussetzung: Node.js 22 oder neuer.

```
npm install        # einmalig, lädt alle Bausteine
npm run dev        # startet Glyph mit Live-Neuladen
```

Weitere Befehle:

- `npm run build` baut die App in `apps/glyph/out`.
- `npm run typecheck` prüft den ganzen Code auf Typfehler.
