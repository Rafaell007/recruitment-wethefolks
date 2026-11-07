# Decision log

Sizes are in CSS px (asset px / 2) unless noted.

## Both variants

- **Vite, one build per variant.** Each ad ends up self-contained in `dist/<variant>/` with its own copy of GSAP, because in production every creative is delivered on its own. `base: './'` lets it run from any CDN path. Nothing is inlined as a data URI, so the weight report stays honest.

- **GSAP from npm, bundled and pinned (3.15.0).** The ad makes no external request when it loads, and GSAP adds ~28 KB gzip.

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
- **Desktop shows a phone-shaped frame.** A fullscreen mobile ad isn't served to desktops, but reviewers open it there. With a mouse as the main input, the ad is capped to the design's 360:640 shape on a grey page. Touch devices still fill the whole screen.

### Gameplay
- **The start screen is the mockup 1:1.** Its four obstacles are props: on the first tap they pop away, the gut eases into motion and the poo hovers for 1.5 s over an empty gut ("get ready"). The run itself then contains every obstacle exactly once.
- **A fixed, hand-made level, not a random one.** 15 obstacles, one per column, 115 px apart, always inside the cloud-free band so texts stay readable. The mockup's pairs (bacterium over "Stress", worm next to "Tabu") left too narrow a lane twice in a row. Split up, they give the player twice the spare room (11 → 22.5 px). Every viewer gets the same tested run.
- **Difficulty ramp by distance:** 110 → 150 px/s.
- **Physics on a fixed step (1/120 s)** with semi-implicit Euler, so the jump is the same at 60, 90 and 120 Hz. A tap sets the upward speed instead of adding to it, so fast double taps can't launch the player.
- **Sprites at 50% of the asset, as the rules say,** even where the mockup draws them smaller (obstacles at 0.68–0.94, endcard buttons at 0.97). Obstacles are centred on their mockup position, buttons keep its top-left corner.

### Collision
- **Player = the largest circle inside its opaque pixels** (r 15.25 px). Obstacles and clouds are their opaque pixels (alpha ≥ 128), stored per row. So a hit always means visible pixels overlap. The same check decides the top and bottom of the playfield (touching a cloud).
- **Masks are computed at build time** (`tools/hitboxes.mjs`), not with `getImageData` in the browser, which fails on images from a CDN without CORS headers.
- **`?debug=1`** draws the real masks, not the image rectangles.

### Audio
- **Web Audio, created on the first tap.** Files download early, decode after the tap. iOS doesn't treat `touchstart` as a gesture for audio, so it's unlocked again on `touchend`/`pointerup`. Old Safari gets a silent buffer and the callback form of `decodeAudioData`.
- **Every playing sound is tracked,** so replay stops all of them and the music can't start twice.
- **The music loop isn't trimmed.** It has 0.07 s of silence at the start, but a run (~17 s) never reaches the end of the 58 s track.
- **The mute toggle is a small inline SVG,** the only graphic not from the assets: the task asks for one and the assets have no speaker icon.

### Pause and replay
- **Paused when not visible:** `visibilitychange`, `pagehide`, an `IntersectionObserver` at 50% (the IAB viewability threshold, and it works in a cross-origin iframe) and landscape. The game loop, the audio context and GSAP's global timeline all stop together.
- **Resuming a run needs a tap,** shown by the start screen's hand (`gesture.png`) again. Resuming by itself would let the poo fall before the player looks back, and iOS only resumes audio inside a gesture. The design has no pause screen and I didn't want to draw one.
- **Replay goes back to the start screen** and resets every module: tweens killed, all sounds stopped, game state reset, so a second run is identical to the first.

### Animation
- **Start screen intro and endcard entrances use GSAP easing.** The CTA pulses three times and then rests. With `prefers-reduced-motion` only fades remain.
- **The intro waits for the images and for the ad to be visible,** and `gsap.ticker.lagSmoothing(50, 33)` keeps the heavy first frame from swallowing the animation on slow phones.

## Variant B – Fireplace

### Three separate ads
- **Each part is its own build in its own folder** (`top/top.html` + `top/assets/` and so on), with its own copy of GSAP and nothing shared between them, because in production they are delivered as three separate ads. That costs ~28 KB gzip of GSAP per part, but any folder can be handed over on its own.
- **`preview.html` is only a test page.** It puts the three parts in iframes like in `layout.png`, with the empty website area in the middle. It doesn't count towards the weight. On windows narrower than the fireplace (1672 px) it scales down to fit, and `?actual` shows it 1:1.
- **Fixed sizes from the task** (1032x250 and 320x975). Real fireplaces only run on wide screens, so the parts don't stretch.

### Background
- **One `bg-big.jpg`, not the pre-cut `bg.jpg` files.** I measured the pre-cut ones: they don't line up at the seams and aren't cut from `bg-big.jpg` either. With one image there is only one moss surface, and the seams line up by construction.
- **The parts sit edge to edge with no gaps.** The thin grey frames in `layout.png` are artboard borders, not spacing, and the task describes the parts as one surface side by side. The fireplace takes 1672 of the 1680 px of `bg-big.jpg` (4 px left over on each side).
- **Cut losslessly, one slice per part.** Each part gets only the area of `bg-big.jpg` it can show during the zoom, plus 2 px of margin, cut with jpegtran without re-encoding. Re-encoding at q80 measured only 35–38.5 dB and needed q90+ to look right, which was heavier than the lossless cut. Checked in Chrome at 100–200% display scaling: the three parts side by side differ from `bg-big.jpg` drawn as one image by at most 1/255.

### Layout
- **Positions come from the asset layers.** Most layers are exported full-frame (640x1950 / 2064x500), so their position is already in the file. A script crops them to their content and writes `src/data/layout.json`. The mockup is drawn at ~0.98 scale, so where it differs by a pixel the assets win (50% rule). Checked with `?overlay=1`.
- **The CTA has no full-frame export,** so its position is measured in the mockup: the average of the left and right part, since it is the same button.
- **Box, CTA and the skyscraper headlines came without transparency** (on black). The black was pure, with no soft edges, so it's keyed out exactly. The box opacity (0.92) was fitted against the mockup and baked into the PNG.
- **The top headline is the asset as delivered,** even though its text differs from the mockup. I gave the delivered asset priority and treated the mockup as a preview of the overall look. Which copy is right would be a question for the designer or the client.

### Animation
- **One timeline per part, the same in all three.** Intro (about 3.5 s): the moss fades in and starts zooming, logos scale in, the top headline builds line by line, the text panel opens from below, the skyscraper headlines rise, the CTA appears last.
- **The product is part of the background.** The packshots are painted into `bg-big.jpg`, with no separate layer, so "product slides in" can't be done literally without cutting the image apart. The camera zoom moves the products into their final place instead.
- **One shared camera.** All three backgrounds zoom around the same point of `bg-big.jpg`, so they move as one surface and the seams stay aligned during the motion too.
- **Calm phase:** a barely visible zoom (1.08 → 1) that runs evenly almost the whole time and lands softly on the design at 29 s, plus a small CTA pulse every 4 s until ~26 s. Then everything stops in the static design. I read "about 30 seconds" as the upper limit, and a test checks that the timeline ends within 30 s exactly in the design. A back-and-forth "breathing" zoom looked odd, so the camera moves one way only.
- **Only `transform` and `opacity` are animated,** with `will-change` only while something moves.
- **Headline lines** are windows over the same image, cut where the alpha shows a gap between lines. Once they've arrived the original image takes over, so at rest there are no cut lines.
- **`prefers-reduced-motion` shows the final state straight away,** also if the setting changes while the animation runs.

### Sync and pause
- **The parts start in sync through postMessage.** Each part reports "ready" once its images are decoded. The preview answers "hold" and, when all three are ready, sends one start time slightly in the future. Every part places its timeline by that time, so a part that got the message a bit later is still on the same frame. Without a preview (a real placement) nobody answers within 300 ms and a part starts on its own.
- **Pause only on `visibilitychange`.** The three parts are always on screen together, so pausing each one on its own visibility (IntersectionObserver) would only let them drift apart.
- **Hidden until ready.** Each part stays invisible until its images are decoded, so it never flashes half-loaded before the intro.

### Clickout
- **The whole part opens the clickTag** in a new window, read at click time so a value set by the ad server later still applies. Each part is also a link for the keyboard (Tab, Enter).
