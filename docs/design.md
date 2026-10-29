# Design

Dunkles Jarvis-HUD: dünne Leuchtlinien, Eckklammern an Karten, feines Raster – sparsam.

| Rolle | Farbe |
| --- | --- |
| Primär (Lila) | #8122b5 |
| Akzent (Magenta) | #c020b8 |
| Heller Akzent | #f5b8f2 |
| Hintergrund | #0b0614 |
| Flächen | #150b24 |
| Text | #f3eaff |

- Quelle der Werte: `packages/design-system/src/tokens.css` (und `tokens.ts`).
- Hell/Dunkel über `data-theme="light" | "dark"` am `<html>`, Standard dunkel.
  Gesetzt in `state/settings.ts` jeder App.
- Schriften: Inter (Oberfläche), Rajdhani (Logo, Titel), lokal als `.woff2` in
  `packages/design-system/src/fonts`.
- Dulidan D: `packages/design-system/src/logo/dulidan-d.svg` und `DulidanMark.tsx`.
  Wird nie verändert.
- App-Icons: `packages/design-system/src/logo/icons/<programm>.svg`. Gleicher Rahmen (dunkle
  Fläche, Leuchtrand Lila→Magenta, Eckklammern, kleines D unten rechts), eigenes Symbol in der
  Mitte: Feder (Glyph), Pinsel (Pixel), Brief (Relay), Notizblatt (Cortex).
  Neu erzeugen: `npm run icons --workspace @dulidan/<programm>` → `apps/<programm>/build/`.
  `dulidan-app-icon.svg` ist das alte gemeinsame Icon.
- Komponenten (Button, Card, Dialog, Menu, Toolbar, ModeChooser …): `packages/design-system/src/components`.
- Basis-Modus: Knöpfe mind. 48 px, Schrift ab 18 px, Beschriftung mit Worten.
- Kontrast nach WCAG AA, alles per Tastatur bedienbar.
