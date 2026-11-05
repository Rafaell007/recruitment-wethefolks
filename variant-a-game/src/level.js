// The level: all 15 obstacles, each exactly once per run (D13: a fixed, hand-made level).
// x = left edge in gut-world coordinates (on screen: x − scroll), y = top edge on the stage.
import M from './measured.json';
import { GUT, SPEED, PLAYER } from './config.js';
import hitboxes from './hitboxes.json';

// Obstacle size in CSS px (asset px / 2), straight from the measured PNGs.
const size = (name) => M.images[`01_game/${name}.png`].size;

// The first four obstacles copy design/01-start.png (D12). The mockup draws them smaller
// (scale 0.68–0.94), but we render at 1.0 (the "50% of the asset" rule), centred on the
// mockup's box, so they sit where the designer put them.
function fromDesign(name) {
  const d = M.images[`01_game/${name}.png`].inDesign;
  const s = size(name);
  return {
    name,
    x: GUT.startScroll + d.x + d.w / 2 - s.w / 2,
    y: d.y + d.h / 2 - s.h / 2,
  };
}

// The four obstacles of the start screen. During get ready they pass below the hovering player,
// so the real game starts on an empty stretch of gut instead of right above the worm.
const DESIGN_OBSTACLES = ['bac6', 'txt1', 'bac2', 'txt2'].map(fromDesign);

// Hand-placed after those, 145 px apart. The first one arrives ~1.5 s after get ready ends.
// y keeps every obstacle inside the band that is always cloud-free (236–566.5,
// notes/drafts/cloud-band.mjs), so texts are always readable.
export const LEVEL = [
  ...DESIGN_OBSTACLES,
  { name: 'txt3', x: 560, y: 250 },
  { name: 'bac3', x: 705, y: 470 },
  { name: 'txt7', x: 850, y: 236 },
  { name: 'bac4', x: 995, y: 420 },
  { name: 'txt4', x: 1140, y: 470 },
  { name: 'bac5', x: 1285, y: 260 },
  { name: 'txt6', x: 1430, y: 236 },
  { name: 'bac1', x: 1575, y: 480 },
  { name: 'txt8', x: 1720, y: 413 },
  { name: 'txt9', x: 1865, y: 236 },
  { name: 'txt5', x: 2010, y: 385 },
].map((o) => ({ ...o, ...size(o.name) })); // add w, h

// Gentle difficulty ramp: 110 → 150 px/s over the distance travelled.
export function rampSpeed(scroll, scrollEnd) {
  const t = (scroll - GUT.startScroll) / (scrollEnd - GUT.startScroll);
  return SPEED.start + (SPEED.end - SPEED.start) * Math.min(Math.max(t, 0), 1);
}

// Player hitbox: the largest circle inside the sprite's alpha (tools/hitboxes.mjs), in stage px.
// The tilt is only drawn, the circle doesn't turn, so the hitbox never grows.
// cx = fixed x of the centre, dy = centre below the sprite's top edge. Shared by game.js and render.js.
export const PLAYER_HIT = {
  cx: PLAYER.x + hitboxes.player.x / 2,
  dy: hitboxes.player.y / 2,
  r: hitboxes.player.r / 2,
};

// Get ready ends by distance, not time: once the last start-screen obstacle is fully behind the
// player's circle (+8 px), whatever the speed or frame rate. ≈ 284.5.
export const GET_READY_END =
  Math.max(...DESIGN_OBSTACLES.map((o) => o.x + size(o.name).w)) - (PLAYER_HIT.cx - PLAYER_HIT.r) + 8;
