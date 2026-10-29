# Lizenzen von Drittanbietern

Diese Datei listet alle fremden Bibliotheken, die Dulidan Works verwendet.
Erlaubt sind nur MIT, Apache 2.0, BSD und ISC, bei Schriften die SIL Open
Font License (OFL). Keine GPL, keine AGPL.

## In Dulidan Pixel enthalten

Pixel nutzt keine eigenen zusätzlichen Bibliotheken. Ausgeliefert werden:
electron 45.1.0 (MIT), react und react-dom 19.3.1 (MIT), scheduler 0.28.0 (MIT),
fflate 0.8.3 (MIT, für das .pixel-Format), lucide-react 1.63.0 (ISC, Symbole)
sowie die Schriften Inter und Rajdhani (OFL, siehe unten). Malen, Füllen,
Ebenen und Start-Animation sind selbst geschrieben, mit Canvas 2D aus Chromium.

## In Dulidan Glyph enthalten

Diese Bibliotheken werden mit Glyph ausgeliefert.

| Bibliothek | Version | Lizenz |
| --- | --- | --- |
| electron | 45.1.0 | MIT |
| react, react-dom | 19.3.1 | MIT |
| scheduler (von react-dom) | 0.28.0 | MIT |
| use-sync-external-store (von TipTap) | 1.7.0 | MIT |
| @tiptap/core, @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/extensions und die einzelnen @tiptap/extension-* (Text, Absatz, Überschrift, Listen, Link, Bild, Tabelle, Textstil, Ausrichtung u. a.) | 3.32.1 | MIT |
| prosemirror-model, -state, -view, -transform, -commands, -keymap, -history, -inputrules, -schema-list, -tables, -dropcursor, -gapcursor, -changeset | 1.x / 2.x | MIT |
| orderedmap | 2.1.1 | MIT |
| rope-sequence | 1.3.4 | MIT |
| w3c-keyname | 2.2.8 | MIT |
| linkifyjs (von TipTap Link) | 4.4.0 | MIT |
| @floating-ui/dom (von TipTap) | 1.8.0 | MIT |
| fast-deep-equal (von TipTap) | 3.1.3 | MIT |
| fflate (ZIP für das .glyph-Format) | 0.8.3 | MIT |
| lucide-react (Symbole) | 1.63.0 | ISC |

### Schriften

| Schrift | Lizenz | Lizenztext |
| --- | --- | --- |
| Inter | SIL Open Font License 1.1 | `packages/design-system/src/fonts/Inter-OFL.txt` |
| Rajdhani | SIL Open Font License 1.1 | `packages/design-system/src/fonts/Rajdhani-OFL.txt` |

Electron bringt Chromium und Node.js mit. Deren Lizenztexte liefert Electron
selbst in `LICENSES.chromium.html` mit, der Installer übernimmt diese Datei.

## Nur zum Bauen und Testen

Diese Werkzeuge laufen nur auf dem Entwicklerrechner oder bei GitHub und
werden nicht mit den Programmen ausgeliefert.

| Bibliothek | Version | Lizenz |
| --- | --- | --- |
| electron-vite | 6.0.0 | MIT |
| vite | 8.3.5 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| electron-builder | 26.18.0 | MIT |
| vitest | 5.0.5 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| @types/node, @types/react, @types/react-dom | 22.x, 19.x | MIT |

Hinweis: Diese Bauwerkzeuge nutzen intern ein paar Pakete mit anderen
Lizenzen: `lightningcss` (MPL-2.0) und `caniuse-lite` (CC-BY-4.0) über Vite,
`sanitize-filename`, `truncate-utf8-bytes` und `utf8-byte-length` (WTFPL,
teils wahlweise ISC/MIT) über electron-builder. Sie arbeiten nur beim Bauen
und landen nicht in den Programmen.
