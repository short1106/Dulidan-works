# Lizenzen von Drittanbietern

Diese Datei listet alle fremden Bibliotheken, die Dulidan Works verwendet.
Erlaubt sind nur MIT, Apache 2.0, BSD und ISC. Keine GPL, keine AGPL.

## In der App enthalten

Diese Bibliotheken werden mit Glyph ausgeliefert.

| Bibliothek | Version | Lizenz |
| --- | --- | --- |
| electron | 45.1.0 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| scheduler (von react-dom) | 0.28.0 | MIT |

Electron bringt Chromium und Node.js mit. Deren Lizenztexte liefert Electron
selbst in `LICENSES.chromium.html` mit, der Installer übernimmt diese Datei.

## Nur zum Bauen

Diese Werkzeuge laufen nur auf dem Entwicklerrechner und werden nicht mit
Glyph ausgeliefert.

| Bibliothek | Version | Lizenz |
| --- | --- | --- |
| electron-vite | 6.0.0 | MIT |
| vite | 8.3.5 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| @types/node, @types/react, @types/react-dom | 22.x, 19.x | MIT |

Hinweis: Vite nutzt intern `lightningcss` (MPL-2.0) und `caniuse-lite`
(CC-BY-4.0). Beide arbeiten nur beim Bauen und landen nicht in der App.
