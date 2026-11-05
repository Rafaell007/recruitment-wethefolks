# We The Folks – take-home (SF-FE-01-BAM)

Two rich media ads built from the provided designer layouts and 2x assets:

- **Variant A – Game Ad „Gut Run”**: mobile fullscreen tap-to-jump mini game (`variant-a-game/`)
- **Variant B – Fireplace Ad**: three-part animated desktop skin (`variant-b-fireplace/`) – *in progress*

Plain HTML, CSS and ES2020+ JavaScript. GSAP 3.15.0 is the only runtime library. Vite is used as dev server and bundler.

## Run it locally

Requires Node.js ≥ 20.19.

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173/) – the landing page links to each variant.
To test on a phone in the same Wi-Fi: `npm run dev:host` and open the network URL on the phone.

Production build: `npm run build` → self-contained ads in `dist/<variant>/` (relative paths, no shared files between ads).

## Repository layout

```
index.html            dev landing page (not shipped)
vite.config.js        one build per variant (`vite build --mode variant-a`)
variant-a-game/       Variant A: design/ + assets/ (originals, untouched), assets-opt/ (shipped), src/, index.html
variant-b-fireplace/  Variant B: design/ + assets/ (originals, untouched)
tools/                measure.mjs, compress.mjs, size-report.mjs (see DECISIONS.md)
reports/              generated: measurements, compression table, size report
```

Tools (only needed to regenerate what is already committed):

```bash
npm run measure:a    # positions and sizes from assets + designs → variant-a-game/src/measured.json (~3 min)
npm run compress:a   # assets/ → assets-opt/ (needs ffmpeg-static, an optional dependency, for MP3)
npm run size         # weight report of dist/ (also runs automatically after npm run build)
```

## Weight

_TODO: size report per variant (raw + gzip) once the builds are complete._

## What I would do next with more time

_TODO_

## Known issues and shortcuts

_TODO_

## How I used AI

_TODO_
