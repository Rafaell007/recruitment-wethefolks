// Circle vs mask on small hand-made masks (asset px), plus the real start position.
import { test, expect } from 'vitest';
import { circleHitsMask } from '../src/core/collision.js';
import hb from '../src/data/hitboxes.json';
import { variantA as m } from '../src/data/measured.json';

// 2x2 asset px square at x 4–6, y 4–6 (= stage px 2–3) in a 10x10 mask.
const square = { w: 10, h: 10, rows: Array.from({ length: 10 }, (_, y) => (y === 4 || y === 5 ? [4, 6] : [])) };

test('circle exactly touching the left edge is not a hit, 0.05 px overlap is', () => {
  // r = 1 stage px = 2 asset px; centre at stage x 1 → right edge at asset x 4 = square's left edge.
  expect(circleHitsMask(1, 2.5, 1, square, 0, 0)).toBe(false);
  expect(circleHitsMask(1.05, 2.5, 1, square, 0, 0)).toBe(true);
});

test('circle near a corner: bounding boxes overlap, pixels do not', () => {
  // Centre 1.5 asset px left of and above the corner (4, 4): distance 2.12 > R = 2.
  expect(circleHitsMask(1.25, 1.25, 1, square, 0, 0)).toBe(false);
  expect(circleHitsMask(1.4, 1.4, 1, square, 0, 0)).toBe(true); // distance 1.7 < 2
});

test('circle inside a hole (like the inside of a letter) is not a hit', () => {
  // 10x10 ring, 1 px thick: free inside is x/y 1–9 asset px.
  const ring = { w: 10, h: 10, rows: Array.from({ length: 10 }, (_, y) => (y === 0 || y === 9 ? [0, 10] : [0, 1, 9, 10])) };
  expect(circleHitsMask(2.5, 2.5, 1.9, ring, 0, 0)).toBe(false); // R = 3.8 < 4
  expect(circleHitsMask(2.5, 2.5, 2.05, ring, 0, 0)).toBe(true); // R = 4.1 > 4
});

test('real data: player at the start position touches no cloud', () => {
  const cx = m.player.x + hb.player.x / 2;
  const cy = m.player.y + hb.player.y / 2;
  const r = hb.player.r / 2;
  expect(circleHitsMask(cx, cy, r, hb.clouds, hb.clouds.x / 2, 0)).toBe(false);
  // Measured cloud limit on the centre column is 231.5 (top) / 577.5 (bottom): a circle that
  // reaches 0.5 px past it must hit. (No "just inside = no hit" check: the circle is wider than
  // one column and the clouds hang lower beside it, see bounds.spriteColumns in measured.json.)
  expect(circleHitsMask(cx, 231.5 - 0.5 + r, r, hb.clouds, hb.clouds.x / 2, 0)).toBe(true);
  expect(circleHitsMask(cx, 577.5 + 0.5 - r, r, hb.clouds, hb.clouds.x / 2, 0)).toBe(true);
});
