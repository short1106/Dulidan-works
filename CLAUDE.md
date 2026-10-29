# Dulidan Works – Projektregeln für Claude

Sprich Deutsch mit dem Nutzer. Er ist Gründer von Dulidan Studios, arbeitet allein und ist kein
ausgebildeter Entwickler: neue Begriffe kurz und einfach erklären.

## Projekt

Programmfamilie als Gegenstück zu Microsoft Office. Electron-Apps mit TypeScript und React in
einem npm-Monorepo. Hersteller: Dulidan Studios (Einzelgründer).
Einmalkauf ohne Abo, alle Dateien lokal, keine Cloud, keine Konten, keine Telemetrie.
Zielgruppe: Privatleute, Senioren, PC-Einsteiger, Kleinbetriebe (z. B. Handwerker).

## Programme und Status (Stand 30.10.2026)

| Programm | Aufgabe (Gegenstück) | Status |
| --- | --- | --- |
| Glyph | Text (Word) | fertig (Version 1), `.glyph`-Format |
| Pixel | Malen, Bildbearbeitung (Paint) | fertig (Version 1), `.pixel`-Format |
| Relay | Mail und Kalender (Outlook) | fertig (Version 1), Logik in `packages/mail-core` |
| Cortex | Notizen (OneNote) | fertig (Version 1), Notizen als `.md`, Logik in `packages/notes-core` |
| Radar | Akquise per Mail (Brief fehlt noch) | Version 1 gebaut (30.10.2026), `apps/radar`. Vorlage: `dulidan-akquise/` (s. u.) |
| Ledger | Rechnungen und Angebote | nicht angelegt |
| Grid / Prism / Vertex | Tabelle / Folien / Vektordesign | nicht angelegt |
| April | KI in allen Programmen (Pro-Modus) | nur Platzhalter-Seitenleiste, sendet nichts |

Als Nächstes, in dieser Reihenfolge:
1. ~~Eigenes App-Icon für Glyph, Pixel, Relay und Cortex~~ (erledigt 30.10.2026).
2. Automatische Updates: umgesetzt (30.10.2026), aber noch nicht end-to-end getestet. Offen:
   Das Repo muss öffentlich sein (macht der Nutzer selbst), dann ein Release prüfen.
   Ablauf: Beim Start prüft die installierte Version GitHub (Release „neueste-version“),
   lädt eine neuere Version im Hintergrund und installiert sie beim Beenden.
   Baustein: `packages/core/src/electron/updater.ts`. Jede App hat eine eigene Feed-Datei
   (`glyph.yml` usw.). Build-Version: `1.0.<Lauf-Nummer>` (in der CI gesetzt).
   Die portable EXE aktualisiert sich nicht selbst.
3. ~~Radar Version 1~~ (gebaut 30.10.2026): Suche über Google Places, Website-Prüfung auf E-Mail,
   Firmenliste mit Status und Notiz, Sperrliste, Versand mit Pausen und Tageslimit (Standard 20),
   Modi. Offen für Radar: Antworten per IMAP erkennen, Brief-Export, Test mit echtem Konto.
4. Als Nächstes: unklar. Der Nutzer entscheidet zwischen Ledger, Grid, Prism und Vertex.

Details je Programm: `docs/programme.md`.

## Dulidan Akquise (`dulidan-akquise/`)

Das bestehende Python-Werkzeug des Nutzers (Flask-Oberfläche `app.py`, Kern `akquise.py`, Start mit
`start.bat`). Es sucht Firmen über die Google Places API, prüft deren Websites, findet Mailadressen
(auch per Brave-Suche) und versendet Mails mit Vorlagen über IONOS (SMTP/IMAP), mit Tageslimit
und Sperrliste. Es ist die Vorlage für Radar, das später in TypeScript neu entsteht.
`secrets.json`, `*.csv`, `usage.json` und `logs/` enthalten Schlüssel und echte Firmendaten:
nie committen, nie lesen oder ausgeben, außer der Nutzer verlangt es ausdrücklich.

## Ordnerstruktur

- `apps/<programm>/` – je ein Electron-Programm: `src/main` (Hauptprozess), `src/preload`
  (schmale Brücke), `src/renderer` (React-Oberfläche), `src/shared/ipc.ts`, `test/`
- `packages/core` – Modus-Logik, Einstellungen, atomares Speichern, Wiederherstellung,
  Verlauf (Rückgängig), Dateiformate, SQLite (`node:sqlite`, eingebaut), PDF
- `packages/design-system` – Farben, Schriften, Komponenten, Dulidan D, BootAnimation, ModeChooser
- `packages/editor` – gemeinsamer TipTap-Editor (genutzt von Cortex und Relay; Glyph hat
  einen eigenen Editor-Aufbau in `apps/glyph/src/renderer/src/editor`)
- `packages/mail-core` – IMAP, SMTP, Mail-Cache, Kalender, .ics
- `packages/notes-core` – Notizordner, Markdown, Suche, Papierkorb, Verknüpfungen
- App-Texte: `apps/<programm>/src/renderer/src/i18n/de.ts`
- Doppelklick-Dateien im Hauptordner: `<Programm> starten.bat`, `<Programm> testen (wie neu).bat`,
  `<Programm>-Installer bauen.bat`; für Mac/Linux `*-starten.command`
- `.github/workflows/windows-installer.yml` – baut bei jedem Push die EXE-Dateien als Release

## Befehle (im Hauptordner)

- Starten: `npm run dev` (Glyph), `npm run dev:pixel`, `npm run dev:relay`, `npm run dev:cortex`
- Tests: `npm test` (alle) oder `npm test --workspace @dulidan/<name>`
- Typprüfung: `npm run typecheck`
- Bauen: `npm run build`; Windows-Installer: `npm run dist:win`, `dist:win:pixel`,
  `dist:win:relay`, `dist:win:cortex` (Ergebnis in `apps/<programm>/release`)
- Node.js 22 oder neuer

## Design

Dunkles Jarvis-HUD, hell/dunkel umschaltbar (`data-theme`). Lila #8122b5, Magenta #c020b8,
Hellakzent #f5b8f2, Hintergrund #0b0614, Flächen #150b24, Text #f3eaff. Schriften Inter und
Rajdhani, lokal gebündelt. Das Dulidan D wird nie verändert. Werte stehen in
`packages/design-system/src/tokens.css`. Mehr: `docs/design.md`, `docs/animationen.md`.

## Modi (gleiche Logik überall, `packages/core/src/mode.ts`)

- **Basis:** Senioren und Einsteiger. Knöpfe mind. 48 px, Schrift ab 18 px, Worte statt nur
  Symbole, nur das Wichtigste.
- **Experte:** voller Funktionsumfang, ohne KI.
- **Pro:** wie Experte plus April als Seitenleiste. Pro ist ein Abo, Basis und Experte Einmalkauf.

## Regeln

- Lizenzen: MIT, MIT-0, Apache 2.0, BSD, ISC, BlueOak-1.0.0, Python-2.0; für Schriften SIL OFL 1.1. Bei Bibliotheken mit
  zwei Lizenzen zur Wahl die erlaubte wählen und das vermerken. Keine GPL/AGPL. Jede Bibliothek in
  `THIRD_PARTY_LICENSES.md` eintragen. Bei Unsicherheit den Nutzer fragen.
- Nichts von Microsoft oder anderen Herstellern kopieren (Code, Icons, Schriften, Namen).
  Dateiformate nur über offene Spezifikationen.
- Keine Telemetrie. Netzwerk nur zu Servern, die der Nutzer selbst einrichtet (Mailserver), und
  für die Update-Prüfung der Programme (einzige Ausnahme, sobald gebaut). Radar braucht zusätzlich
  Google Places und Brave mit eigenem Schlüssel des Nutzers.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, schmales Preload.
- Kein Datenverlust: atomar speichern (Temporärdatei, dann umbenennen), Autosave,
  Wiederherstellung nach Absturz. Fertige Bausteine in `packages/core`.
- Barrierefreiheit: volle Tastaturbedienung, Kontrast nach WCAG AA.
- Sprache: App-Texte Deutsch, einfache Sätze, in der Sprachdatei. Code, Namen, Commits Englisch.
- Tests für Speichern/Laden, Autosave, Modus-Logik und Kernfunktionen. Nie mit echten Daten
  des Nutzers testen, nur mit Testdaten oder Testkonten.
- Recht: Ledger und Radar erst nach Prüfung durch Steuerberater/Anwalt verkaufen.
  E-Mail-Akquise: UWG und DSGVO beachten.

## Arbeitsweise

- Nur bauen, was beauftragt ist. Sonst vorher fragen.
- Immer nur ein Schritt. Danach zwei Sätze: was fertig ist und wie der Nutzer es startet.
- Nutzung ist begrenzt: kurze Antworten, nur nötige Dateien lesen, keine unnötigen Umbauten.
  Routinearbeit wenn möglich mit einem kleineren Modell.
- Commits nur, wenn der Nutzer es sagt.
- Diese CLAUDE.md nach jedem abgeschlossenen Schritt selbst aktualisieren (Status, Nächstes).
