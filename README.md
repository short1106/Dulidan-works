# Dulidan Works

Die Programmfamilie von Dulidan Studios: Einmalkauf, kein Abo, keine Cloud.
Alle Dateien bleiben auf deinem Computer.

| Programm | Was es ist | Stand |
| --- | --- | --- |
| **Dulidan Glyph** | Textverarbeitung | Version 1 fertig |

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

## Fertigen Windows-Installer herunterladen

Bei jedem Hochladen baut GitHub den Installer automatisch auf einem Windows-Rechner:
GitHub → Reiter **Actions** → **Windows-Installer** → neuester Lauf → unten bei
**Artifacts** die Datei `Dulidan-glyph-Windows-Installer` herunterladen und entpacken.

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
packages/
  design-system/    Farben, Schriften, Bausteine, Logo, Icon-Export
  core/             Modus-Logik, Einstellungen, Dateiformat, sicheres Speichern, Autosave
THIRD_PARTY_LICENSES.md
```

## Für Entwickler

```
npm install          # einmalig
npm run dev          # Glyph mit Live-Neuladen
npm test             # Tests (Dateiformat, Speichern, Autosave, Modi)
npm run typecheck    # Typprüfung
npm run dist:win     # Windows-Installer (auf Windows)
```

Das App-Icon wird aus dem SVG-Logo erzeugt: `npm run icons --workspace @dulidan/glyph`.
