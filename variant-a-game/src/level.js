// The level: all 15 obstacles, each exactly once per run (D13: a fixed, hand-made level).
// x = left edge in gut-world coordinates (on screen: x − scroll), y = top edge on the stage.
import M from './measured.json';
import { GUT, SPEED, PLAYER } from './config.js';
import hitboxes from './hitboxes.json';

// Obstacle size in CSS px (asset px / 2), straight from the measured PNGs.
const size = (name) => M.images[`01_game/${name}.png`].size;

// Obstacle as placed in design/01-start.png (D12). The mockup draws them smaller
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

// Start screen props: the four obstacles of the mockup, exactly where it shows them. They are
// not part of the run: on the first tap they pop away (intro.js) and the run starts on an
// empty gut. Each obstacle then appears exactly once in the run itself (LEVEL).
export const START_PROPS = ['bac6', 'txt1', 'bac2', 'txt2']
  .map(fromDesign)
  .map((o) => ({ ...o, ...size(o.name) }));

// The run opens with the start screen's obstacles at their design heights (Stress, Tabu, ...),
// then the rest. One obstacle per column, evenly spaced: the mockup's pairs (bacterium over
// Stress, worm next to Tabu) left only an ~86 px lane under the clouds twice in a row; split up,
// the spare room around the player's circle doubles (11 → 22 px, BFS on game.js).
// y keeps every obstacle inside the band that is always cloud-free (236–566.5,
// notes/drafts/cloud-band.mjs), so texts are always readable.
const FIRST_X = 400; // off screen at the tap even on the widest phone (visible right ≤ 383)
const GAP = 115;     // 15 obstacles between 400 and 2010, the last fully passed before the gut ends
export const LEVEL = [
  { name: 'bac6', y: fromDesign('bac6').y },
  { name: 'txt1', y: fromDesign('txt1').y }, // Stress
  { name: 'bac2', y: fromDesign('bac2').y },
  { name: 'txt2', y: fromDesign('txt2').y }, // Tabu
  { name: 'txt3', y: 250 },
  { name: 'bac3', y: 470 },
  { name: 'txt7', y: 236 },
  { name: 'bac4', y: 420 },
  { name: 'txt4', y: 470 },
  { name: 'bac5', y: 260 },
  { name: 'txt6', y: 236 },
  { name: 'bac1', y: 480 },
  { name: 'txt8', y: 413 },
  { name: 'txt9', y: 236 },
  { name: 'txt5', y: 385 },
].map((o, i) => ({ ...o, x: FIRST_X + i * GAP, ...size(o.name) })); // add x, w, h

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
