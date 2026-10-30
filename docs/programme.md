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

## Radar (Akquise) – Version 1 gebaut
Suche über Google Places (eigener Schlüssel des Nutzers), Website-Prüfung auf Mailadressen,
Firmenliste mit Status und Notiz, Sperrliste (Adresse oder ganze Domain mit @), Versand über
den eigenen Mailserver mit Pausen (Standard 90–240 s) und Tageslimit (Standard 20). Firmen
aus fremden Branchen werden beim Suchen ausgelassen. Vorlagen: Zimmerei mit und ohne Website.
Passwörter und Schlüssel nur verschlüsselt im Schlüsselspeicher von Windows.
Noch nicht drin: Antworten per IMAP erkennen, Brief-Export. Erst nach rechtlicher Prüfung
verkaufen (UWG, DSGVO).

## Ledger (Rechnungen und Angebote) – Version 1 gebaut
Kunden, Angebote und Rechnungen mit Positionen, MwSt. 0/7/19 %, PDF über den Druck des Fensters.
Feste Regeln: Nur Entwürfe lassen sich ändern oder löschen. Ausstellen vergibt eine lückenlose
Nummer (RE-2026-0001, AN-2026-0001) und friert das Dokument ein. Ausgestellte Dokumente werden
nur storniert, nie gelöscht. Anschrift und Firmendaten werden beim Ausstellen gespeichert.
Kleinunternehmer (§ 19 UStG) ist eine Einstellung mit dem nötigen Hinweis.
Noch nicht drin: Rechnungs-Export für den Steuerberater (DATEV), Zahlungseingänge, Mahnungen.
Vor dem Verkauf rechtlich prüfen lassen (Steuerberater).

## Später
- **Grid** (Tabelle), **Prism** (Folien), **Vertex** (Vektordesign).
- **April:** KI im Pro-Modus. Bisher nur Platzhalter-Seitenleiste in Glyph, Pixel, Relay, Cortex.
