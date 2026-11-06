# Decision log

Sizes are in CSS px (asset px / 2) unless noted.

## Both variants

- **Vite, one build per variant.** Each ad ends up self-contained in `dist/<variant>/` with its own copy of GSAP, because in production every creative is delivered on its own. `base: './'` so it runs from any CDN path; no data-URI inlining, so the weight report stays honest.
- **GSAP from npm, bundled and pinned (3.15.0).** No external request when the ad loads; ~28 KB gzip.
- **Support floor: iOS 12+.** Ads are paid per impression, so a creative that breaks on an older phone is wasted budget. iOS 17 and older are still ~8.6% of iOS traffic (StatCounter, Aug 2026). In practice: Vite's `build.target` rewrites `?.`/`??`, fallbacks for `dvh`, `ResizeObserver`, Pointer Events and the old `webkitAudioContext`.
- **Positions are measured by a script, not by eye.** `tools/measure.mjs` finds every sprite in the design PNGs by template matching and writes `src/data/measured.json`, which the code reads.
- **Compression by a script, originals untouched.** `tools/compress.mjs` writes `assets-opt/`: PNGs palette-quantised and accepted only at PSNR ≥ 40 dB (results 44–68 dB), the 320 kbps sound effects re-encoded to 128 kbps, the 64 kbps music copied as is. Resolution stays 2x. Variant A assets: 1969 KB → 975 KB.

## Variant A – Gut Run

### Rendering
- **Canvas 2D for the game, DOM + GSAP for everything else. No Phaser.** Phaser is 1.38 MB, almost half of the 3 MB budget, for one mechanic. CTA, replay and mute are real buttons, so the clickout opens without popup blocking.

### Scaling
- **One uniform scale with a safe area:** `scale = min(cover, vw / 338, vh / 606)`. The stage covers the screen where it can, but the important area (x 11–349, y 0–606: logo bar down to the win CTA) always stays fully visible. Plain "cover" cut the endcard headlines on tall phones, plain "contain" left 168 px empty bands on 430x932.
- **The leftover area continues the art's edge colours** (measured on the outermost column of `border.png`, left and right separately because the clouds aren't symmetric). The game canvas runs on into the side bleed, so the gut doesn't end in a hard cut.
- **An edge cover against seams.** A scaled image's outer pixel row turns semi-transparent, and the navy background showed through as a thin line along the stage edge. A copy of the bleed sits on top with a hole 1 px smaller than the stage.
- **The ad measures its own box (`#ad`, 100dvh), not the phone,** because it runs inside the publisher's iframe. A `ResizeObserver` re-fits on rotation, toolbar changes and iframe resizes.
- **Portrait only.** A phone turned sideways pauses the game like a hidden tab.

### Gameplay
- **The start screen is the mockup 1:1.** Its four obstacles are props: on the first tap they pop away, the gut eases into motion and the poo hovers for 1.5 s over an empty gut ("get ready"). The run itself then contains every obstacle exactly once.
- **A fixed, hand-made level, not a random one.** 15 obstacles, one per column, 115 px apart, always inside the cloud-free band so texts stay readable. The mockup's pairs (bacterium over "Stress", worm next to "Tabu") left too narrow a lane twice in a row; split up, the spare room around the player doubles (11 → 22.5 px). Every viewer gets the same tested run.
- **Difficulty ramp by distance:** 110 → 150 px/s.
- **Physics on a fixed step (1/120 s)** with semi-implicit Euler, so the jump is the same at 60, 90 and 120 Hz. A tap sets the upward speed instead of adding to it, so fast double taps can't launch the player.
- **Sprites at 50% of the asset, as the rules say,** even where the mockup draws them smaller (obstacles at 0.68–0.94, endcard buttons at 0.97). Obstacles are centred on their mockup position, buttons keep its top-left corner.

### Collision
- **Player = the largest circle inside its opaque pixels** (r 15.25 px); obstacles and the clouds = their opaque pixels (alpha ≥ 128), stored per row. A hit therefore always means visible pixels overlap. The same check decides the top and bottom of the playfield (touching a cloud).
- **Masks are computed at build time** (`tools/hitboxes.mjs`), not with `getImageData` in the browser, which fails on images from a CDN without CORS headers.
- **`?debug=1`** draws the real masks, not the image rectangles.

### Audio
- **Web Audio, created on the first tap.** Files download early, decode after the tap. iOS doesn't treat `touchstart` as a gesture for audio, so it's unlocked again on `touchend`/`pointerup`. Old Safari gets a silent buffer and the callback form of `decodeAudioData`.
- **Every playing sound is tracked,** so replay stops all of them and the music can't start twice.
- **The music loop isn't trimmed.** It has 0.07 s of silence at the start, but a run (~17 s) never reaches the end of the 58 s track.
- **The mute toggle is a small inline SVG,** the only graphic not from the assets: the task asks for one and the assets have no speaker icon.

### Pause and replay
- **Paused when not visible:** `visibilitychange`, `pagehide`, an `IntersectionObserver` at 50% (the IAB viewability threshold; it works in a cross-origin iframe) and landscape. The game loop, the audio context and GSAP's global timeline all stop together.
- **Resuming a run needs a tap,** shown by the start screen's hand (`gesture.png`) again. Resuming by itself would let the poo fall before the player looks back, and iOS only resumes audio inside a gesture. The design has no pause screen and I didn't want to draw one.
- **Replay goes back to the start screen** and resets every module: tweens killed, all sounds stopped, game state reset, so a second run is identical to the first.

### Animation
- **Start screen intro and endcard entrances with GSAP easing; the CTA pulses three times and then rests.** With `prefers-reduced-motion` only fades remain.
- **The intro waits for the images and for the ad to be visible,** and `gsap.ticker.lagSmoothing(50, 33)` keeps the heavy first frame from swallowing the animation on slow phones.

## Variant B – Fireplace

_TODO_
