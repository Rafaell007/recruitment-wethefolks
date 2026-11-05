// node --test: circle vs mask on small hand-made masks (asset px), plus the real start position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circleHitsMask } from '../src/collision.js';

// 2x2 asset px square at x 4–6, y 4–6 (= stage px 2–3) in a 10x10 mask.
const square = { w: 10, h: 10, rows: Array.from({ length: 10 }, (_, y) => (y === 4 || y === 5 ? [4, 6] : [])) };

test('circle exactly touching the left edge is not a hit, 0.05 px overlap is', () => {
  // r = 1 stage px = 2 asset px; centre at stage x 1 → right edge at asset x 4 = square's left edge.
  assert.equal(circleHitsMask(1, 2.5, 1, square, 0, 0), false);
  assert.equal(circleHitsMask(1.05, 2.5, 1, square, 0, 0), true);
});

test('circle near a corner: bounding boxes overlap, pixels do not', () => {
  // Centre 1.5 asset px left of and above the corner (4, 4): distance 2.12 > R = 2.
  assert.equal(circleHitsMask(1.25, 1.25, 1, square, 0, 0), false);
  assert.equal(circleHitsMask(1.4, 1.4, 1, square, 0, 0), true); // distance 1.7 < 2
});

test('mask position is applied (mx, my in stage px)', () => {
  assert.equal(circleHitsMask(1.05, 2.5, 1, square, 0, 0), true);
  assert.equal(circleHitsMask(1.05 + 100, 2.5 + 50, 1, square, 100, 50), true);
  assert.equal(circleHitsMask(1.05, 2.5, 1, square, 100, 50), false);
});

test('circle inside a hole (like the inside of a letter) is not a hit', () => {
  // 10x10 ring, 1 px thick: free inside is x/y 1–9 asset px.
  const ring = { w: 10, h: 10, rows: Array.from({ length: 10 }, (_, y) => (y === 0 || y === 9 ? [0, 10] : [0, 1, 9, 10])) };
  assert.equal(circleHitsMask(2.5, 2.5, 1.9, ring, 0, 0), false); // R = 3.8 < 4
  assert.equal(circleHitsMask(2.5, 2.5, 2.05, ring, 0, 0), true); // R = 4.1 > 4
});

test('rows outside the mask are ignored (no out-of-range access)', () => {
  assert.equal(circleHitsMask(-50, -50, 5, square, 0, 0), false);
  assert.equal(circleHitsMask(2.5, 30, 5, square, 0, 0), false);
});

test('real data: player at the start position touches no cloud', () => {
  const hb = JSON.parse(readFileSync(new URL('../src/hitboxes.json', import.meta.url), 'utf8'));
  const m = JSON.parse(readFileSync(new URL('../src/measured.json', import.meta.url), 'utf8')).variantA;
  const cx = m.player.x + hb.player.x / 2;
  const cy = m.player.y + hb.player.y / 2;
  const r = hb.player.r / 2;
  assert.equal(circleHitsMask(cx, cy, r, hb.clouds, hb.clouds.x / 2, 0), false);
  // Measured cloud limit on the centre column is 231.5 (top) / 577.5 (bottom): a circle that
  // reaches 0.5 px past it must hit. (No "just inside = no hit" check: the circle is wider than
  // one column and the clouds hang lower beside it, see bounds.spriteColumns in measured.json.)
  assert.equal(circleHitsMask(cx, 231.5 - 0.5 + r, r, hb.clouds, hb.clouds.x / 2, 0), true);
  assert.equal(circleHitsMask(cx, 577.5 + 0.5 - r, r, hb.clouds, hb.clouds.x / 2, 0), true);
});
