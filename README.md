# Dulidan Works

Die Programmfamilie von Dulidan Studios: Einmalkauf, kein Abo, keine Cloud.
Alle Dateien bleiben auf deinem Computer.

| Programm | Was es ist | Stand |
| --- | --- | --- |
| **Dulidan Glyph** | Textverarbeitung | Version 1 fertig |
| **Dulidan Pixel** | Malen und Bildbearbeitung | Version 1 fertig |
| **Dulidan Relay** | Mail und Kalender | Version 1 fertig |
| **Dulidan Cortex** | Notizen | Version 1 fertig |

## Glyph starten (Windows)

1. Einmalig **Node.js** installieren: <https://nodejs.org> (die LTS-Version).
2. Doppelklick auf **`Glyph starten.bat`**.
   Beim ersten Mal lädt sie ein paar Minuten lang die Bausteine, danach geht es schnell.

Weitere Doppelklick-Dateien:

- **`Glyph testen (wie neu).bat`** startet Glyph wie beim allerersten Mal, mit
  Start-Animation und Moduswahl. Deine echten Einstellungen bleiben dabei unberührt.
- **`Glyph-Installer bauen.bat`** baut die Setup-Datei für Windows auf deinem Rechner
  (liegt danach in `apps\glyph\release`).

Auf dem Mac oder unter Linux: `glyph-starten.command` (im Terminal oder per Rechtsklick → Öffnen).

## Pixel starten (Windows)

Genauso wie Glyph: Doppelklick auf **`Pixel starten.bat`**.
**`Pixel testen (wie neu).bat`** zeigt Start-Animation und Moduswahl wie beim ersten Mal,
**`Pixel-Installer bauen.bat`** baut die Setup-Datei (liegt danach in `apps\pixel\release`).
Auf dem Mac oder unter Linux: `pixel-starten.command`.

### Was du in Pixel ausprobieren kannst

- **Werkzeuge:** Pinsel (Größe, Härte, Deckkraft, Glättung, Stift-Druckstärke), Radierer,
  Füllen, Formen (Linie, Rechteck, Ellipse, mit Umschalt gerade/quadratisch), Text, Pipette,
  im Experten-Modus Zuschneiden.
- **Farben:** Farbfeld, Farbton, Farbcode, Palette und zuletzt benutzte Farben.
- **Ebenen** (Experte/Pro): hinzufügen, löschen, Reihenfolge, ein-/ausblenden, Deckkraft,
  Umbenennen per Doppelklick.
- **Bild:** Zuschneiden und Größe ändern. **Zoom:** Strg + Mausrad, **Verschieben:**
  Leertaste halten und ziehen (oder Mausrad).
- **Speichern** als `.pixel`-Projekt, **Als Bild speichern** als PNG oder JPG, PNG und JPG öffnen.
- **Rückgängig:** mindestens 50 Schritte. **Autosave** alle 30 Sekunden mit Wiederherstellung
  nach einem Absturz.

| Taste | Werkzeug / Aktion |
| --- | --- |
| B / E / G / U / T / I / C | Pinsel / Radierer / Füllen / Formen / Text / Pipette / Zuschneiden |
| [ und ] | Pinsel kleiner / größer |
| Alt + Klick | Farbe aufnehmen |
| Strg+Z / Strg+Y | Rückgängig / Wiederholen |
| Strg+S / Strg+Umschalt+S | Speichern / Speichern unter |
| Strg+Umschalt+E | Als PNG speichern |
| Strg+Umschalt+N | Neue Ebene |
| Strg+0 / Strg+1 | Einpassen / 100 % |

## Relay starten (Windows)

Genauso wie Glyph: Doppelklick auf **`Relay starten.bat`**.
**`Relay testen (wie neu).bat`** zeigt Start-Animation, Moduswahl und Konto-Einrichtung wie beim
ersten Mal, **`Relay-Installer bauen.bat`** baut die Setup-Datei (liegt danach in `apps\relay\release`).
Auf dem Mac oder unter Linux: `relay-starten.command`.

### Was du in Relay ausprobieren kannst

- **Konto einrichten:** IONOS oder Gmail auswählen, Adresse und Passwort eingeben, fertig.
  Für Gmail brauchst du ein App-Passwort; Relay zeigt Schritt für Schritt, wie du es bekommst.
  Relay prüft die Verbindung, bevor es das Konto speichert.
- **Mails:** Ordner, Lesen, Antworten, Allen antworten, Weiterleiten (mit Anhängen), neue Mail
  mit Signatur und Anhängen, Entwürfe, Suche in allen abgerufenen Mails, Benachrichtigungen.
  Neue Mails holt Relay alle paar Minuten (einstellbar) oder sofort mit **F5**.
- **Kalender:** Monats- und Wochenansicht, Termine mit Ort, Notiz und Erinnerung, Serien
  (täglich, wöchentlich, monatlich), Kalenderdateien (.ics) importieren, auch direkt aus einem
  Mail-Anhang. Alle Zeiten in deutscher Zeit mit Sommer- und Winterzeit.
- **Modi:** Basis (nur Posteingang, Lesen, Antworten, Neue Mail, Anhang, Papierkorb und
  Monatskalender), Experte (alles) und Pro (wie Experte, mit April-Platzhalter).

### So schützt Relay dich

- **Nur lesen und senden:** Löschen legt Mails in den Papierkorb deines Anbieters.
  Endgültiges Löschen gibt es in Version 1 nicht.
- **HTML-Mails** werden gesäubert und ohne Skripte in einem abgeschotteten Fenster gezeigt.
- **Bilder aus dem Internet** lädt Relay nicht von selbst (Schutz vor Verfolgung).
  Der Knopf **Bilder laden** erlaubt sie nur für diese eine Mail.
- **Links** öffnen sich erst nach einer Rückfrage, die die echte Zieladresse zeigt. Steht im Text
  eine andere Adresse als im Link, warnt Relay ausdrücklich.
- **Mehr als zehn Empfänger** auf einmal: Relay fragt vorher nach.
- **Passwörter** liegen nur verschlüsselt im Schlüsselspeicher von Windows (Electron safeStorage).
  Gibt es keinen sicheren Speicher, speichert Relay gar kein Passwort.
- **Netzwerk:** Relay spricht nur mit deinen Mailservern. Das Fenster selbst darf nichts aus dem
  Internet laden.
- **April** ist nur ein Platzhalter: Er sendet nichts und verschickt keine Daten.

| Taste | Aktion |
| --- | --- |
| Strg+N | Neue Mail |
| F5 | Mails abrufen |
| Entf | In den Papierkorb |
| R / Umschalt+R | Antworten / Allen antworten |
| Pfeil hoch / runter | Vorherige / nächste Mail |

## Cortex starten (Windows)

Genauso wie Glyph: Doppelklick auf **`Cortex starten.bat`**.
**`Cortex testen (wie neu).bat`** zeigt Start-Animation und Moduswahl wie beim ersten Mal und
arbeitet mit einer Kopie der Beispielnotizen (deine echten Notizen bleiben unberührt).
**`Cortex-Installer bauen.bat`** baut die Setup-Datei (liegt danach in `apps\cortex\release`).
Auf dem Mac oder unter Linux: `cortex-starten.command`.

### Was du in Cortex ausprobieren kannst

- **Notizen als normale Dateien:** Jede Notiz ist eine Markdown-Datei (`.md`) im Notizordner
  (Standard: `Dokumente\Cortex`, änderbar in den Einstellungen). Bilder liegen im Unterordner
  `attachments`. Die Notizen lassen sich ohne Cortex lesen und mit jedem Backup sichern.
- **Schreiben:** Überschriften, Fett, Kursiv, Listen, Checklisten zum Abhaken, Links, Bilder
  (auch per Einfügen oder Hineinziehen, Größe mit der Maus ändern), Tabellen, Zitate, Code.
  Cortex speichert 2 Sekunden nach der letzten Eingabe von selbst.
- **Wiederfinden:** Suche über Titel und Text, auch bei tausenden Notizen sofort.
  Notizen anheften, Liste oder Karten-Ansicht.
- **Experte:** Ordner (auch verschachtelt), Schlagwörter, Verknüpfungen mit `[[Notiztitel]]`
  samt Vorschlagsliste beim Tippen und „Diese Notizen verlinken hierher“, Dateien anhängen,
  Export als PDF oder Markdown, Import von Markdown- und Textdateien.
- **Schnellnotiz:** **Strg+Umschalt+Leertaste** öffnet überall ein kleines Fenster (solange
  Cortex geöffnet ist). Die Notiz landet im Ordner „Posteingang“.
- **Modi:** Basis (bunte Zettel, große Knöpfe, Checkliste, Bild, Papierkorb), Experte (alles)
  und Pro (wie Experte, mit April-Platzhalter).

### So schützt Cortex deine Notizen

- **Sicheres Speichern:** Erst in eine Temporärdatei, dann umbenennen. Eine Notiz ist nie halb
  geschrieben.
- **Absturzschutz:** Ungespeicherter Text wird zusätzlich gesichert und nach einem Absturz
  zur Wiederherstellung angeboten.
- **Papierkorb:** Gelöschte Notizen bleiben 30 Tage im Papierkorb (Ordner `.papierkorb` im
  Notizordner). Erst danach kannst du sie endgültig löschen, und Cortex fragt vorher nach.
- **Änderungen von außen:** Ändert ein anderes Programm eine Notiz, zeigt Cortex die neue
  Fassung. Hast du gleichzeitig daran geschrieben, fragt Cortex, welche Fassung bleiben soll.
- **Kein Internet:** Cortex hat keinen Netzwerkzugriff und verschickt nichts. April ist nur ein
  Platzhalter.

| Taste | Aktion |
| --- | --- |
| Strg+N | Neue Notiz |
| Strg+F | Suchen |
| Strg+S | Sofort speichern |
| Strg+B / Strg+I | Fett / Kursiv |
| Strg+K | Link |
| `[[` | Notiz verknüpfen (Vorschlagsliste) |
| Strg + Klick | Link oder verknüpfte Notiz öffnen |
| Strg+Umschalt+Leertaste | Schnellnotiz (Experte und Pro) |

## Fertige EXE-Dateien herunterladen (ohne Node.js)

Bei jedem Hochladen baut GitHub die Programme automatisch auf einem Windows-Rechner und legt sie
auf der Seite **Releases → „Dulidan Works – neueste Version“** ab. Die Links bleiben immer gleich:

| Datei | Was sie macht |
| --- | --- |
| [Dulidan-Glyph.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Glyph.exe) | Glyph direkt starten, ohne Installation |
| [Dulidan-Glyph-Setup.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Glyph-Setup.exe) | Glyph installieren (Startmenü, Desktop-Symbol, .glyph-Dateien per Doppelklick) |
| [Dulidan-Pixel.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Pixel.exe) | Pixel direkt starten, ohne Installation |
| [Dulidan-Pixel-Setup.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Pixel-Setup.exe) | Pixel installieren (Startmenü, Desktop-Symbol, .pixel-Dateien per Doppelklick) |
| [Dulidan-Relay.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Relay.exe) | Relay direkt starten, ohne Installation |
| [Dulidan-Relay-Setup.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Relay-Setup.exe) | Relay installieren (Startmenü, Desktop-Symbol) |
| [Dulidan-Cortex.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Cortex.exe) | Cortex direkt starten, ohne Installation |
| [Dulidan-Cortex-Setup.exe](https://github.com/short1106/Dulidan-works/releases/latest/download/Dulidan-Cortex-Setup.exe) | Cortex installieren (Startmenü, Desktop-Symbol) |

Das Repository ist privat: Die Links funktionieren, wenn du bei GitHub angemeldet bist.

Die Dateien sind noch nicht digital signiert. Windows zeigt deshalb beim ersten Start
„Der Computer wurde durch Windows geschützt“. Mit **Weitere Informationen → Trotzdem ausführen**
geht es weiter. Die Direkt-EXE braucht beim Start ein paar Sekunden länger, weil sie sich
jedes Mal kurz entpackt; die installierte Version startet schneller.

## Was du in Glyph ausprobieren kannst

- **Moduswahl:** Basis (große Knöpfe), Experte (alles mit Menüs) und Pro (mit April-Platzhalter).
  Umschalten jederzeit über **Einstellungen**.
- **Schreiben und Formatieren:** Fett, Kursiv, Unterstrichen, Schriftart, Größe, Farbe,
  Ausrichtung, Überschriften, Listen, Links, Bilder (auch per Einfügen oder Hineinziehen),
  Tabellen im Experten-Modus.
- **Speichern** als `.glyph`, **PDF** und **Drucken**.
- **Suchen und Ersetzen** (Strg+F / Strg+H), **Zoom** (Strg + Mausrad).
- **Frühere Stände** (Datei-Menü): Glyph sichert alle 30 Sekunden, die letzten zehn Stände
  kannst du zurückholen.
- **Absturzschutz:** Stürzt Glyph ab, bietet es beim nächsten Start die ungespeicherten
  Dokumente zur Wiederherstellung an.

### Tastenkürzel

| Kürzel | Aktion |
| --- | --- |
| Strg+N / Strg+O / Strg+S | Neu / Öffnen / Speichern |
| Strg+Umschalt+S | Speichern unter |
| Strg+P / Strg+Umschalt+P | Drucken / Als PDF speichern |
| Strg+B / Strg+I / Strg+U | Fett / Kursiv / Unterstrichen |
| Strg+F / Strg+H | Suchen / Ersetzen |
| Strg+K | Link |
| Strg+Plus / Strg+Minus / Strg+0 | Zoom |

## Aufbau

```
apps/
  glyph/            Die Textverarbeitung (Electron, React, TipTap)
  pixel/            Malen und Bildbearbeitung (Electron, React, Canvas 2D)
  relay/            Mail und Kalender (Electron, React)
  cortex/           Notizen (Electron, React, TipTap), Beispielnotizen in test/beispiel-notizen
packages/
  mail-core/        Mail ohne Oberfläche: Konten, IMAP, SMTP, Zwischenspeicher, Vorlagen,
                    Antwort-Erkennung, Kalender mit Zeitzonen und Serien
  editor/           Schlanker Text-Editor für Mails (TipTap)
  notes-core/       Notizen ohne Oberfläche: Markdown-Dateien, Suchindex, Papierkorb,
                    Verknüpfungen, Import und Export
  design-system/    Farben, Schriften, Bausteine, Logos, Start-Animation, Moduswahl, Icon-Export
  core/             Modus-Logik, Einstellungen, Dateiformate, Rückgängig, sicheres Speichern, Autosave,
                    SQLite-Hilfen, PDF-Export (gemeinsam für Glyph und Cortex)
THIRD_PARTY_LICENSES.md
```

## Für Entwickler

```
npm install          # einmalig
npm run dev          # Glyph mit Live-Neuladen
npm run dev:pixel    # Pixel mit Live-Neuladen
npm run dev:relay    # Relay mit Live-Neuladen
npm run dev:cortex   # Cortex mit Live-Neuladen
npm test             # Tests (Dateiformate, Speichern, Autosave, Rückgängig, Modi, Malwerkzeuge,
                     #  Mail-Konten, Zwischenspeicher, Vorlagen, Antworten, Zeitzonen, Papierkorb,
                     #  Notiz-Dateien, Suchindex, Verknüpfungen)
npm run typecheck    # Typprüfung
npm run dist:win     # Glyph-Installer (auf Windows)
npm run dist:win:pixel  # Pixel-Installer (auf Windows)
npm run dist:win:relay  # Relay-Installer (auf Windows)
npm run dist:win:cortex # Cortex-Installer (auf Windows)
```

Logo und App-Icon: das Dulidan D (`packages/design-system/src/logo/dulidan-d.svg`, als App-Icon
`dulidan-app-icon.svg`). Die Icons (ICO, ICNS, PNG 1024 px) werden daraus erzeugt:
`npm run icons --workspace @dulidan/glyph` bzw. `--workspace @dulidan/pixel`.

Start-Animation: `BootAnimation` aus dem Design-System. Jedes Programm übergibt nur seinen
Namen (`programName="Glyph"`); Pixel nutzt zusätzlich seine eigene Pixel-Szene.

Relay-Tests laufen nur gegen lokale Test-Server (`hoodiecrow-imap` und `smtp-server` auf
127.0.0.1), nie gegen ein echtes Postfach.
