# Start-Animationen

Gemeinsame Komponente: `packages/design-system/src/boot/BootAnimation.tsx` (+ `boot.css`).

## Varianten
- `full` – volle Animation
- `basic` – Basis-Modus, höchstens 1 Sekunde: D und Name erscheinen sofort, kein Raster, kein Tippen
- `static` – bei „Bewegung reduzieren“: nur das stehende Logo mit Namen

Klick oder beliebige Taste überspringt. Nur SVG, CSS oder Canvas, keine Videos.

## Glyph (bleibt unverändert)
Das Dulidan D erscheint, daneben blinkt ein Schreibstrich, dann schreibt sich
„Dulidan Glyph“ aus. Diese Tipp-Animation wird von den anderen Programmen geteilt.

## Andere Programme
- Pixel: eigene Szene (`apps/pixel/src/renderer/src/start/pixelScene.ts`) über `scene`.
- Relay, Cortex: Dulidan D mit Programmnamen. Eigene Logos und Animationen kommen später.
