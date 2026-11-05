# Decision log

Short log of the decisions behind both ads, with the reason for each. Measurements are in CSS px (= asset px / 2) unless stated otherwise.

## Tooling (both variants)

- **Vite 8.3.5 as dev server and bundler, pinned to an exact version.** Fast reload while matching positions to the designs, `base: './'` so the ad works from any folder or CDN path, one minified bundle per page (fewer requests at ad load), and a reproducible build for the weight report. Running it stays at two commands (`npm install`, `npm run dev`).
- **One build per variant, not one shared multi-page build.** Each ad lands in its own `dist/<variant>/` folder with its own copy of GSAP. In production every creative is delivered on its own, so no ad may depend on a chunk that belongs to another one.
- **No base64 inlining of assets (`assetsInlineLimit: 0`).** Data URIs are ~33% bigger than the file and hide weight inside the JS; separate files keep the size report honest.
- **GSAP 3.15.0 from npm, pinned, bundled – not from a CDN.** The ad stays self-contained (no external dependency at serve time) and GSAP counts towards the 3 MB budget honestly (~28 KB gzip). 3.15.1 was skipped on purpose: it was released one day before work started.

## Variant A – Gut Run

- **Game on a plain 2D `<canvas>`, UI (start screen, endcards, CTA, replay, mute) in the DOM with GSAP. No Phaser.** Phaser 4 is 1.38 MB minified, about 46% of the whole 3 MB budget, for a game with one mechanic and 15 obstacles. A custom fixed-timestep loop gives full control over pause, resume and a clean restart. CTA and replay are real `<a>`/`<button>` elements, so they are accessible and the clickout opens in a new window without popup blocking.

_More entries (scaling, collision, playfield bounds, audio, compression) are added as the features land._

## Variant B – Fireplace

_TODO_
