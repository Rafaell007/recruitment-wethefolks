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
variant-a-game/       Variant A: design/ + assets/ (originals, untouched), src/, index.html
variant-b-fireplace/  Variant B: design/ + assets/ (originals, untouched)
```

## Weight

_TODO: size report per variant (raw + gzip) once the builds are complete._

## What I would do next with more time

_TODO_

## Known issues and shortcuts

_TODO_

## How I used AI

_TODO_
