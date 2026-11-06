# We The Folks – take-home (SF-FE-01-BAM)

Two rich media ads built from the provided designer layouts and 2x assets:

- **Variant A – Game Ad „Gut Run”**: mobile fullscreen tap-to-jump mini game (`variant-a-game/`)
- **Variant B – Fireplace Ad**: three-part animated desktop skin (`variant-b-fireplace/`) – *in progress*

Plain HTML, CSS and modern JavaScript (ES6+), built down to iOS 12 / Chrome 64. GSAP 3.15.0 is the only runtime library. Vite is used as dev server and bundler.

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
tools/                measure.mjs, compress.mjs, hitboxes.mjs, size-report.mjs (see DECISIONS.md)
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

Tests: `npm test` (Vitest, game logic, collision, level and audio).

Tools (only needed to regenerate what is already committed):

```bash
npm run measure:a    # positions and sizes from assets + designs → variant-a-game/src/data/measured.json (~3 min)
npm run compress:a   # assets/ → assets-opt/ (needs ffmpeg-static, an optional dependency, for MP3)
npm run size         # weight report of dist/ (also runs automatically after npm run build)
```

## Weight

Budget: 3 MB for all shipped files.

| | raw | gzip |
|---|---:|---:|
| Variant A (`dist/variant-a-game/`) | 1102.6 KB (37.6%) | 985.3 KB |
| Variant B | _TODO_ | |

Variant A assets went from 1969 KB to 975 KB. PNGs were converted to palette PNG (quality 80, checked at ≥ 44 dB PSNR against the originals). Sound effects went from 320 to 128 kbps MP3. The music loop was already 64 kbps and is shipped unchanged. Most of the weight is audio: music 452 KB plus applause 236 KB. JS with GSAP is 122 KB (41 KB gzip). Full tables are in `reports/`.

## What I would do next with more time

- **Test on real iPhones**, including an old one on iOS 12–13, to confirm the fallback paths instead of trusting forced tests in Chrome.
- **Move the Playwright checks into the repo.** The pixel checks I ran during development (seams at the stage edge, endcard end state vs the static design, replay leaving no sounds or timers behind) live in local scripts. They should run with `npm test`.
- **Ask the designer** about the "tab to run" typo, the missing "Bauchgrummeln" asset and which scale is right where the mockups differ from 50%.
- **Proper landscape handling.** In an app placement I'd ask the SDK to keep the ad in portrait (`mraid.setOrientationProperties({ allowOrientationChange: false, forceOrientation: 'portrait' })`). In a mobile browser the orientation can't be locked, so I'd ask the designer for a rotate-your-phone screen instead of the frozen stage.
- **Lighter audio.** Music and applause are about 60% of the weight. A shorter music loop or a lower bitrate for the applause would cut the ad to around half its size, after a listening check.
- **Load audio after the start screen.** The sounds (about 810 KB) are fetched at the same time as the images the start screen waits for. Fetching them once the start screen is visible would show it sooner on slow networks.

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

## How I used AI

I worked with Claude Code as a pair programmer: research (browser support, ad specs), the measurement, compression and hitbox scripts, the game engine modules, and Playwright checks that read real pixels in Chrome. I wrote the layout and UI parts myself and went through every module before committing it. Where it went wrong:

- **It built for a typical web app, not for an ad.** The first build targeted ES2020, and fallbacks for older phones were filed as "known issues". With paid impressions a broken older phone is lost budget, so I set the floor to iOS 12. Checking the *built* CSS afterwards showed that the minifier silently deleted the `-webkit-clip-path` I had added for old Safari, which would have covered the whole game there. Lesson: check the build, not the source.
- **It guessed instead of measuring.** A thin grey line showed along the stage edge. Claude judged it by eye from a screenshot and snapped the scale to whole pixels. That looked right on one screenshot, but the line was still there. From then on I made it a rule: visual problems get a measuring script, not a guess. A Playwright script that scanned the edge pixels with layers hidden one by one found the real cause: the browser softens the outer pixel row of scaled images. The fix is the edge cover described in DECISIONS.md.
- **It assumed instead of checking.** On tall phones the space around the stage is filled by extending the colours at the edges of the design. Claude's first version sampled only the left edge and mirrored that gradient to the right, on the assumption that the design is symmetric. It wasn't, and the pink frame band ended in a visible step on the right. I caught it on a screenshot and told Claude to measure both sides instead of guessing. Measuring the outer columns of `border.png` showed the bands really differ (169–190.5 px on the left, 169–181 px on the right), so each side now has its own gradient.
- **"Solvable" isn't "playable".** A path search said the first level was passable, but in play the get-ready hover ended right above the worm. I moved the start-screen obstacles out of the run.
