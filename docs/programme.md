# Programme im Detail

Ausführliche Beschreibung für Nutzer: `README.md`.

## Glyph (Text) – fertig
Eigenes Dateiformat `.glyph` (ZIP mit fflate). TipTap-Editor, Suchen und Ersetzen, Bilder,
Drucken und PDF, Versionen, Autosave und Wiederherstellung. Moduswahl beim ersten Start.
Hat als einziges Programm noch keinen eigenen `test/`-Ordner; Speichern, Wiederherstellung und
Modus-Logik sind über `packages/core/test` abgedeckt.

## Pixel (Malen) – fertig
Eigenes Format `.pixel`, Export PNG/JPG. Pinsel, Radierer, Füllen, Formen, Text, Pipette,
Zuschneiden, Ebenen (Experte/Pro), mind. 50 Schritte Rückgängig, Autosave alle 30 s.
Eigene Start-Szene (`start/pixelScene.ts`) über die BootAnimation.

## Relay (Mail und Kalender) – fertig
IONOS und Gmail (App-Passwort). Passwörter nur über Electron safeStorage. HTML-Mails gesäubert
(dompurify), externe Bilder erst auf Knopfdruck, Link-Warnung, Rückfrage ab 10 Empfängern,
kein endgültiges Löschen. Kalender mit Serien und .ics-Import. Logik in `packages/mail-core`,
damit Radar später darauf aufbauen kann. Tests mit lokalem Test-Mailserver.

## Cortex (Notizen) – fertig
Notizen als `.md` im Notizordner (Standard `Dokumente\Cortex`), Bilder in `attachments`,
Papierkorb 30 Tage (`.papierkorb`). Suche, Anheften, Ordner, Schlagwörter, `[[Verknüpfungen]]`,
Schnellnotiz (Strg+Umschalt+Leertaste), Export PDF/Markdown. Erkennt Änderungen von außen.
Nutzt `packages/editor` und `packages/notes-core`.

## Später
- **Radar:** Akquise per Mail und Brief, baut auf mail-core auf. Erst nach rechtlicher Prüfung
  verkaufen (UWG, DSGVO).
- **Ledger:** Rechnungen und Angebote. Erst nach Prüfung durch Steuerberater/Anwalt verkaufen.
- **Grid** (Tabelle), **Prism** (Folien), **Vertex** (Vektordesign).
- **April:** KI im Pro-Modus. Bisher nur Platzhalter-Seitenleiste in Glyph, Pixel, Relay, Cortex.
