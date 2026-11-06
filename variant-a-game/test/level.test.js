// The fixed level (D13): every obstacle once, readable, and passed before the gut ends.
import { test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { LEVEL, PLAYER_HIT } from '../src/core/level.js';
import { GUT } from '../src/core/config.js';
import { computeFit } from '../src/view/stage.js';
import hitboxes from '../src/data/hitboxes.json';

// Obstacle files in the asset folder: bac1–6, txt1–9.
const files = readdirSync(new URL('../assets/01_game', import.meta.url))
  .filter((f) => /^(bac|txt)\d+\.png$/.test(f))
  .map((f) => f.slice(0, -4));

test('every obstacle asset appears exactly once, and nothing else', () => {
  expect(LEVEL.map((o) => o.name).sort()).toEqual([...files].sort());
  expect(files).toHaveLength(15);
});

test('every obstacle has a hitbox mask', () => {
  for (const o of LEVEL) expect(hitboxes.obstacles[o.name], o.name).toBeDefined();
});

// 236–566.5 = the band that is cloud-free over the whole width (notes/drafts/cloud-band.mjs),
// so a text obstacle is never half hidden under the clouds.
test('every obstacle sits fully inside the always cloud-free band (236–566.5)', () => {
  for (const o of LEVEL) {
    expect(o.y, o.name).toBeGreaterThanOrEqual(236);
    expect(o.y + o.h, o.name).toBeLessThanOrEqual(566.5);
  }
});

// The wider the visible screen, the earlier the gut ends (scrollEnd = width − visible right edge).
test('on every phone size, all obstacles are passed before the gut ends', () => {
  let widest = 0;
  for (let vw = 320; vw <= 430; vw++) {
    for (let vh = 480; vh <= 932; vh++) {
      const { scale, x } = computeFit(vw, vh);
      widest = Math.max(widest, (vw - x) / scale);
    }
  }
  const scrollEnd = GUT.width - widest;
  const passLine = PLAYER_HIT.cx - PLAYER_HIT.r; // left edge of the player's circle
  for (const o of LEVEL) expect(o.x + o.w - scrollEnd, o.name).toBeLessThan(passLine);
});
