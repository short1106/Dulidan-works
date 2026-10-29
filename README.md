# Dulidan Works

Die Programmfamilie von Dulidan Studios: Einmalkauf, kein Abo, keine Cloud.
Alle Dateien bleiben auf deinem Computer.

| Programm | Was es ist | Stand |
| --- | --- | --- |
| **Dulidan Glyph** | Textverarbeitung | Version 1 fertig |
| **Dulidan Pixel** | Malen und Bildbearbeitung | Version 1 fertig |

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

## Fertigen Windows-Installer herunterladen

Bei jedem Hochladen baut GitHub den Installer automatisch auf einem Windows-Rechner:
GitHub → Reiter **Actions** → **Windows-Installer** → neuester Lauf → unten bei
**Artifacts** die Datei `Dulidan-glyph-Windows-Installer` bzw. `Dulidan-pixel-Windows-Installer`
herunterladen und entpacken.

Hinweis: Der Installer ist noch nicht digital signiert. Windows zeigt deshalb beim
ersten Start „Der Computer wurde durch Windows geschützt“. Mit **Weitere Informationen →
Trotzdem ausführen** geht es weiter.

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
packages/
  design-system/    Farben, Schriften, Bausteine, Logos, Start-Animation, Moduswahl, Icon-Export
  core/             Modus-Logik, Einstellungen, Dateiformate, Rückgängig, sicheres Speichern, Autosave
THIRD_PARTY_LICENSES.md
```

## Für Entwickler

```
npm install          # einmalig
npm run dev          # Glyph mit Live-Neuladen
npm run dev:pixel    # Pixel mit Live-Neuladen
npm test             # Tests (Dateiformate, Speichern, Autosave, Rückgängig, Modi, Malwerkzeuge)
npm run typecheck    # Typprüfung
npm run dist:win     # Glyph-Installer (auf Windows)
npm run dist:win:pixel  # Pixel-Installer (auf Windows)
```

Logo und App-Icon: das Dulidan D (`packages/design-system/src/logo/dulidan-d.svg`, als App-Icon
`dulidan-app-icon.svg`). Die Icons (ICO, ICNS, PNG 1024 px) werden daraus erzeugt:
`npm run icons --workspace @dulidan/glyph` bzw. `--workspace @dulidan/pixel`.

Start-Animation: `BootAnimation` aus dem Design-System. Jedes Programm übergibt nur seinen
Namen (`programName="Glyph"`); Pixel nutzt zusätzlich seine eigene Pixel-Szene.
