# We The Folks – take-home (SF-FE-01-BAM)

Two rich media ads built from the provided designer layouts and 2x assets:

- **Variant A – Game Ad „Gut Run”**: mobile fullscreen tap-to-jump mini game (`variant-a-game/`)
- **Variant B – Fireplace Ad**: three-part animated desktop skin (`variant-b-fireplace/`)

## Try it online

No setup needed, these are the production builds on GitHub Pages:

- **Variant A, the game:** https://rafaell007.github.io/recruitment-wethefolks/variant-a-game/. Best on a phone, so scan the QR code. Sound starts after the first tap. Add `?debug=1` to see the hitboxes.
- **Variant B, the fireplace:** https://rafaell007.github.io/recruitment-wethefolks/variant-b-fireplace/preview.html. Use a wide desktop window and reload to watch the intro again.

<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Frafaell007.github.io%2Frecruitment-wethefolks%2Fvariant-a-game%2F" alt="QR code for Variant A" width="160" height="160">

Plain HTML, CSS and modern JavaScript (ES6+), built down to iOS 12 / Chrome 64. GSAP 3.15.0 is the only runtime library. Vite is used as dev server and bundler.

## Run it locally

You need Node.js 20.19 or newer. Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173/. The landing page links to both variants:

| What | URL |
|---|---|
| Variant A, the game | http://localhost:5173/variant-a-game/ |
| Variant B, all three parts together | http://localhost:5173/variant-b-fireplace/preview.html |
| Variant B, one part on its own | `…/variant-b-fireplace/top/top.html`, `…/left/left.html`, `…/right/right.html` |

Tips for looking at it:

- **Variant A is a mobile ad.** On a computer, open DevTools device mode (F12, then Ctrl+Shift+M) and pick a phone. To try it on a real phone on the same Wi-Fi, run `npm run dev:host` instead and open the "Network" URL it prints. Sound starts after the first tap.
- **Variant B needs a wide screen.** The fireplace is 1672 px wide. On a smaller window the preview page scales it down. Add `?actual` to the URL to see it 1:1. Reload the page to watch the intro again.
- **Debug views (dev server only):**
  - `?debug=1` on the game draws the hitboxes.
  - `?overlay=start`, `?overlay=fail` or `?overlay=win` on the game lays the matching design over the build.
  - `?overlay=1` on a fireplace part does the same with `layout.png`.
  - With an overlay on, the O key switches between fade, difference and off.

### Production build

```bash
npm run build
npm run preview
```

`npm run build` writes the shipped ads to `dist/` and prints the weight report. `npm run preview` serves them at http://localhost:4173/variant-a-game/ and http://localhost:4173/variant-b-fireplace/preview.html.

Every ad is self-contained, with relative paths and no files shared between ads. The three fireplace parts each get their own folder (`dist/variant-b-fireplace/top/` and so on), so zipping one folder gives an upload-ready creative.

Tests: `npm test`.

## Repository layout

```
index.html            dev landing page (not shipped)
vite.config.js        one build per variant (`vite build --mode variant-a`)
variant-a-game/       Variant A: design/ + assets/ (originals, untouched), assets-opt/ (shipped), src/, index.html
variant-b-fireplace/  Variant B: design/ + assets/ (originals, untouched), assets-opt/ (shipped), top/ left/ right/ (one creative each), preview.html, src/
tools/                measure*.mjs, compress.mjs, hitboxes.mjs, prepare-b.mjs, build-b.mjs, size-report.mjs (see DECISIONS.md)
reports/              generated: measurements, compression table, size report
```

Variant A source (`variant-a-game/src/`):

```
main.js      wires everything together: load, intro, tap, end, replay, pause
assets.js    images and sounds loaded from JS
core/        game logic without the DOM: config, level, game state + physics, collision, fixed-step loop
view/        stage scaling to the viewport, canvas drawing
ui/          start screen intro, endcards, mute button (DOM + GSAP)
platform/    browser APIs: Web Audio, visibility/pause, tap input with old iOS fallback
dev/         ?debug=1 flags (hitboxes), ?overlay= design overlay (dev server only, not in the build)
data/        generated JSON: measured positions, hitbox masks
styles/      CSS split by screen, colour tokens
```

Variant B source (`variant-b-fireplace/src/`):

```
shared/part.js      mounts a part: size, layer positions, clickTag, keyboard, starts the motion
shared/timeline.js  the intro and the calm phase, one GSAP timeline of at most 30 s
shared/camera.js    one shared zoom origin, so the background moves as one surface
shared/sync.js      postMessage handshake with the preview page, so the parts start together
shared/motion.js    runs the timeline: start time, pause when hidden, reduced motion
shared/lines.js     splits a headline image into lines for the line-by-line reveal
shared/dev/         ?overlay=1 design overlay (dev server only, not in the build)
data/               generated JSON: layout, camera, measurements
```

Tests (`npm test`, Vitest) cover game logic, collision, level and audio for A, and timeline length and end state, sync, camera and background slices for B.

Tools (only needed to regenerate what is already committed):

```bash
npm run measure:a    # positions and sizes from assets + designs → variant-a-game/src/data/measured.json (~3 min)
npm run compress:a   # assets/ → assets-opt/ (needs ffmpeg-static, an optional dependency, for MP3)
npm run measure:b    # mockup positions and box opacity → variant-b-fireplace/src/data/measured.json
npm run prepare:b    # background slices (lossless) and layer cut-outs → assets-opt/ + src/data/layout.json
npm run size         # weight report of dist/ (also runs automatically after npm run build)
```

## Weight

Budget: 3 MB for all shipped files.

| | raw | gzip |
|---|---:|---:|
| Variant A (`dist/variant-a-game/`) | 1102.6 KB (37.6%) | 985.3 KB |
| Variant B (`dist/variant-b-fireplace/`, three parts) | 1472.8 KB (50.3%) | 1334.1 KB |

Variant A assets went from 1969 KB to 975 KB. PNGs were converted to palette PNG (quality 80, checked at ≥ 44 dB PSNR against the originals). Sound effects went from 320 to 128 kbps MP3. The music loop was already 64 kbps and is shipped unchanged. Most of the weight is audio: music 452 KB plus applause 236 KB. JS with GSAP is 122 KB (41 KB gzip). Full tables are in `reports/`.

Variant B's asset folder is 3.5 MB, mostly because it holds the background twice (`bg-big.jpg` plus three pre-cut `bg.jpg`). Only `bg-big.jpg` is shipped, cut losslessly (jpegtran) into one slice per part, just big enough for the zoom. Re-encoding it instead would have cost quality: at q80 it measured 35–38.5 dB. The panels, buttons and headlines are cropped to their content and saved as palette PNGs. Each part is about 0.5 MB, of which the background is ~0.4 MB and the JS with GSAP 72 KB (28 KB gzip).

## What I would do next with more time

- **Test on real iPhones**, including an old one on iOS 12–13, to confirm the fallback paths instead of trusting forced tests in Chrome.
- **Move the Playwright checks into the repo.** The pixel checks I ran during development (seams at the stage edge, endcard end state vs the static design, replay leaving no sounds or timers behind) live in local scripts. They should run with `npm test`.
- **Ask the designer** about the "tab to run" typo, the missing "Bauchgrummeln" asset and which scale is right where the mockups differ from 50%.
- **Proper landscape handling.** In an app placement I'd ask the SDK to keep the ad in portrait (`mraid.setOrientationProperties({ allowOrientationChange: false, forceOrientation: 'portrait' })`). In a mobile browser the orientation can't be locked, so I'd ask the designer for a rotate-your-phone screen instead of the frozen stage.
- **Lighter audio.** Music and applause are about 60% of the weight. A shorter music loop or a lower bitrate for the applause would cut the ad to around half its size, after a listening check.
- **Load audio after the start screen.** The sounds (about 810 KB) are fetched at the same time as the images the start screen waits for. Fetching them once the start screen is visible would show it sooner on slow networks.
- **Fireplace sync on a real ad server.** The parts sync through the page that holds them (the preview here). Ad servers often wrap each creative in more iframes. There the parts would find each other through `parent.frames` instead and agree on a start time among themselves.
- **Fireplace checks in the repo too:** the Playwright scripts that compare the seams with `bg-big.jpg` at 100–200% display scaling, during and after the animation.

## Known issues and shortcuts

Variant A:

- **"tab to run" typo.** `gesture.png` says "tab to run" instead of "tap to run" (the task text says "tap"). The concept slide mixes both spellings in one sentence ("Per Tap springt es hoch, ohne Tab fällt es herunter"), so it looks like a copy typo that went into the artwork. The task says not to redraw or replace assets, so I shipped it as is and would flag it to the designer.
- **9 text obstacles, 10 phrases in the concept.** The concept slide lists 10 phrases, but there are only 9 text assets (no "Bauchgrummeln"). The game uses txt1–txt9, each once per run.
- **Mute icon is the only graphic that isn't from the asset pack.** The task asks for a mute toggle, but there is no speaker asset. It is a small inline SVG in the frame colour.
- **Layout follows the 50% rule, not the mockups.** Some layers in the mockups are drawn at a different scale than 50% of their asset: obstacles on the start screen at 0.68–0.94, CTA and replay on the endcards at about 0.97. I render everything at 50% as the rules say and take positions from the mockups. That is why headlines and buttons are slightly larger than in the designs.
- **iPhone silent switch mutes the game.** iOS treats Web Audio as "ambient" sound, so with the ringer switch off there is no sound even though the ad isn't muted.
- **Landscape pauses the game.** The ad is portrait only. On a phone turned sideways the game freezes, the stage stays small in the middle with plain sides, and taps are ignored. After turning back, the "tap to run" hint shows and one tap resumes. There is no "rotate your phone" screen because there is no asset for one.
- **Flat colour next to the clouds.** On very tall or wide screens the space beside the stage is filled with the edge colours of the design. Next to the wavy cloud border that fill is flat, and the bean texture stops at the stage edge.
- **No iPhone test.** On a real device I tested on an Android phone (Xiaomi). The build targets iOS 12, with fallbacks for missing `dvh`, missing `ResizeObserver` and old Web Audio, but those paths were only tested by forcing them in Chrome, not on an iPhone.

Variant B:

- **The top headline differs from the mockup.** The asset says something different from the headline in `layout.png`. I shipped the asset (no redrawing) and kept its position.
- **Headline seam during its entrance.** The top headline rises line by line from three cut windows. At fractional display scaling (Windows 125% / 150%) a faint line can show in its shadow at the cuts for the 1–2 s of the movement. After that the windows are replaced by the original image, so at rest there is no seam (measured 0/255).
- **Fixed sizes.** The parts have the sizes from the task (1032x250 and 320x975), so the whole fireplace needs a window of at least 1672 px. On narrower windows the preview page scales everything down.

## How I used AI

I used Claude Code the whole time, a bit like a second developer sitting next to me. It did the research (browser support, ad specs), wrote the scripts that measure, compress and build the hitboxes, most of the game engine, and the Playwright checks that look at real pixels in Chrome. I did the layout and UI parts myself and read through every module before it went into a commit. It got things wrong quite a few times. These are the ones worth telling:

- **It thought "web app", not "ad".** The first build only supported fairly new browsers, and older phones went on the known issues list. But an ad is paid per view, so if it breaks on someone's older phone that's the client's money gone. I moved the floor down to iOS 12. Afterwards I checked the built CSS and found the minifier had quietly removed a prefix I'd added for old Safari. Without it the game would have been covered up there. Since then I check the build, not just the source.
- **It guessed from a screenshot.** There was a thin grey line along the edge of the game. Claude looked at a screenshot and tweaked the scaling. That looked fine on one screenshot, but the line was still there. From then on the rule was: no guessing on visual bugs, measure them. A script that read the pixels along the edge found the real cause: the browser softens the outermost row of pixels when it scales an image.
- **It assumed the design was symmetric.** On tall phones the empty space around the game is filled with the colours from the edge of the design. Claude only looked at the left edge and mirrored it to the right. The design isn't symmetric, so you could see a step in the pink frame on the right. I spotted it and asked for both sides to be measured. Now each side has its own fill.
- **"Possible to finish" isn't "fun to play".** A script said the level could be finished, but when I played it, the get-ready moment ended right above the worm. I moved the start-screen obstacles out of the run.
- **It read the mockup's frames as gaps.** `layout.png` has a thin grey frame around each part of the fireplace, and Claude took those for 4 px gaps between the parts. Everything after that was built around them. I noticed the moss didn't look like one surface. The task says the parts sit side by side, so the gaps went and the background was cut again.
- **It tested only the easy screens, then fixed things on paper.** The fireplace was checked at 100% and 200% screen zoom only. On my laptop at 125% I saw a faint line in the top headline's shadow. Claude's first idea was to round the cut positions, and measuring showed that made it worse. In the end the headline gets cut into lines only while it animates in, and then the normal image takes over. Now every check also runs at 125% and 150%.
- **It wanted to test everything.** Claude kept writing tests for things you see in a second just by using the ad: does a tap make the poo jump, does mute turn the sound off. It got to 38 tests, and they only made every change slower. My rule became: only test what you can't easily check by eye. That means hard rules from the task (each obstacle exactly once, the animation is done within 30 s), data that comes out of a script, and timing logic. 29 tests now, and they still catch it when I break the code on purpose.
