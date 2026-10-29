# Lizenzen von Drittanbietern

Diese Datei listet alle fremden Bibliotheken, die Dulidan Works verwendet.
Erlaubt sind nur MIT, Apache 2.0, BSD und ISC, bei Schriften die SIL Open
Font License (OFL). Keine GPL, keine AGPL.

## In Dulidan Cortex enthalten

Cortex nutzt dieselben Grundbausteine wie Glyph (electron, react, TipTap mit
Checklisten und Tabellen, lucide-react, Schriften) und zusätzlich diese
Bibliotheken. Der Suchindex ist `node:sqlite`, das in Electron/Node.js schon
eingebaut ist (keine zusätzliche Bibliothek).

| Bibliothek | Version | Lizenz | Wofür |
| --- | --- | --- | --- |
| marked | 18.1.2 | MIT | Markdown-Dateien lesen |
| @tiptap/suggestion | 3.32.1 | MIT | Vorschlagsliste beim Verknüpfen mit `[[` |
| @tiptap/extension-list (Checklisten), @tiptap/extension-table | 3.32.1 | MIT | wie in Glyph |

## In Dulidan Relay enthalten

Relay nutzt dieselben Grundbausteine wie Glyph (electron, react, TipTap für den
Mail-Editor, lucide-react, Schriften) und zusätzlich diese Bibliotheken für Mail
und Kalender. Die Datenbank ist `node:sqlite`, das in Electron/Node.js schon
eingebaut ist (keine zusätzliche Bibliothek).

| Bibliothek | Version | Lizenz | Wofür |
| --- | --- | --- | --- |
| imapflow | 2.9.1 | MIT | Mails abrufen (IMAP) |
| nodemailer | 10.3.0 | MIT-0 | Mails zusammenbauen und senden (SMTP) |
| mailparser | 3.13.0 | MIT | Mails lesen und zerlegen |
| @zone-eu/mailsplit | 5.4.29 | MIT (wahlweise MIT oder EUPL; wir nutzen MIT) | von mailparser |
| libmime, libbase64, libqp | 5.6.3, 1.4.1, 3.0.1 | MIT | Mail-Kodierungen |
| node-ical | 0.27.3 | Apache-2.0 | Kalenderdateien (.ics) lesen |
| rrule-temporal, temporal-polyfill, temporal-utils | 2.2.8, 1.0.6, 1.0.3 | MIT | Wiederholungen in .ics-Dateien |
| temporal-spec | 1.0.1 | Apache-2.0 | von node-ical |
| dompurify | 3.4.17 | Apache-2.0 (wahlweise MPL-2.0 oder Apache-2.0; wir nutzen Apache-2.0) | HTML-Mails säubern |
| html-to-text, selderee, parseley, leac, peberminta | 10.0.1, 0.12.0, 0.13.1, 0.7.0, 0.10.0 | MIT | von mailparser |
| htmlparser2, dom-serializer | 10.1.0, 2.0.0 | MIT | von mailparser |
| domhandler, domutils, domelementtype, entities | 5.0.3, 3.2.2, 2.3.0, 4.5.0/7.0.1 | BSD-2-Clause | von mailparser |
| deepmerge-ts | 8.0.2 | BSD-3-Clause | von node-ical |
| pino, pino-std-serializers, pino-abstract-transport, @pinojs/redact, sonic-boom, thread-stream, on-exit-leak-free, atomic-sleep, quick-format-unescaped, safe-stable-stringify, real-require, process-warning | 10.x und andere | MIT | von imapflow (Protokoll ist in Relay ausgeschaltet) |
| split2 | 4.2.0 | ISC | von imapflow |
| socks, ip-address, smart-buffer | 2.8.10, 10.7.5, 4.2.0 | MIT | von imapflow |
| encoding-japanese, iconv-lite, safer-buffer, he, punycode.js, linkify-it, uc.micro, tlds | verschiedene | MIT | Zeichensätze und Links in Mails |

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

## In allen Programmen enthalten (automatische Updates)

| Bibliothek | Version | Lizenz | Wofür |
| --- | --- | --- | --- |
| electron-updater | 6.8.11 | MIT | Prüft auf neue Versionen und installiert sie |
| builder-util-runtime | 9.7.0 | MIT | von electron-updater (Download) |
| fs-extra, jsonfile, universalify | 10.1.0, 6.2.1, 2.0.1 | MIT | von electron-updater (Dateien) |
| graceful-fs | 4.2.11 | ISC | von fs-extra |
| js-yaml | 4.3.2 | MIT | liest die Update-Dateien (latest/glyph.yml usw.) |
| lazy-val, tiny-typed-emitter | 1.0.5, 2.1.0 | MIT | von electron-updater |
| lodash.escaperegexp, lodash.isequal | 4.1.2, 4.5.0 | MIT | von electron-updater |
| semver | 7.7.4 | ISC | Versionsvergleich |
| debug, ms | 4.4.3, 2.1.3 | MIT | von builder-util-runtime |
| sax | 1.6.1 | BlueOak-1.0.0 | von builder-util-runtime. **Noch nicht in der erlaubten Liste, bitte bestätigen.** |
| argparse | 2.0.1 | Python-2.0 | von js-yaml (nur Kommandozeile). **Noch nicht in der erlaubten Liste, bitte bestätigen.** |

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
| smtp-server (lokaler Test-Mailserver) | 3.21.2 | MIT-0 |
| hoodiecrow-imap (lokaler Test-IMAP-Server) | 3.3.1 | MIT |
| @types/nodemailer, @types/mailparser, @types/smtp-server | | MIT |

Hinweis: Diese Bauwerkzeuge nutzen intern ein paar Pakete mit anderen
Lizenzen: `lightningcss` (MPL-2.0) und `caniuse-lite` (CC-BY-4.0) über Vite,
`sanitize-filename`, `truncate-utf8-bytes` und `utf8-byte-length` (WTFPL,
teils wahlweise ISC/MIT) über electron-builder. Sie arbeiten nur beim Bauen
und landen nicht in den Programmen.
