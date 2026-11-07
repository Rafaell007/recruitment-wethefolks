// x = left edge in gut coordinates (on screen: x − scroll), y = top edge on the stage.
import M from '../data/measured.json';
import { GUT, SPEED, PLAYER } from './config.js';
import hitboxes from '../data/hitboxes.json';

const size = (name) => M.images[`01_game/${name}.png`].size;

// The mockup draws obstacles at 0.68–0.94 scale, but we render them at 50% of the asset,
// centred on the mockup's box.
function fromDesign(name) {
  const d = M.images[`01_game/${name}.png`].inDesign;
  const s = size(name);
  return {
    name,
    x: GUT.startScroll + d.x + d.w / 2 - s.w / 2,
    y: d.y + d.h / 2 - s.h / 2,
  };
}

// The four obstacles of the start screen mockup. Not part of the run: they pop away on the first tap.
export const START_PROPS = ['bac6', 'txt1', 'bac2', 'txt2']
  .map(fromDesign)
  .map((o) => ({ ...o, ...size(o.name) }));

// One obstacle per column, all inside the band that is always cloud-free (y 236–566.5).
const FIRST_X = 400; // still off screen at the first tap on the widest phone
const GAP = 115;
export const LEVEL = [
  { name: 'bac6', y: fromDesign('bac6').y },
  { name: 'txt1', y: fromDesign('txt1').y },
  { name: 'bac2', y: fromDesign('bac2').y },
  { name: 'txt2', y: fromDesign('txt2').y },
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
].map((o, i) => ({ ...o, x: FIRST_X + i * GAP, ...size(o.name) }));

export function rampSpeed(scroll, scrollEnd) {
  const t = (scroll - GUT.startScroll) / (scrollEnd - GUT.startScroll);
  return SPEED.start + (SPEED.end - SPEED.start) * Math.min(Math.max(t, 0), 1);
}

// Largest circle inside the sprite's alpha, in stage px. It doesn't rotate with the tilt.
export const PLAYER_HIT = {
  cx: PLAYER.x + hitboxes.player.x / 2,
  dy: hitboxes.player.y / 2,
  r: hitboxes.player.r / 2,
};
