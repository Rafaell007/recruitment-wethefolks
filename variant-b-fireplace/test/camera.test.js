import { describe, it, expect } from 'vitest';
import { CAMERA, cameraOrigin } from '../src/shared/camera.js';
import fireplace from '../src/data/fireplace.json';
import layout from '../src/data/layout.json';

const PARTS = ['left', 'top', 'right'];

// What the browser does with translate(x, y) scale(s) and a px transform-origin:
// a point u of the image lands at  t + origin + s·(u − origin)  in part-local px.
function place(partName, { s, dx, dy }) {
  const bg = layout[partName].bg;
  const [ox, oy] = cameraOrigin(partName, bg).split(' ').map(parseFloat);
  return {
    x: (u) => bg.x + dx + ox + s * (u - ox),
    y: (v) => bg.y + dy + oy + s * (v - oy),
  };
}

// Extreme camera states the slices were cut for (tools/lib/overscan.mjs).
const extremes = [];
for (const s of [1, CAMERA.maxScale])
  for (const dx of [-CAMERA.maxDrift, CAMERA.maxDrift])
    for (const dy of [-CAMERA.maxDrift, CAMERA.maxDrift]) extremes.push({ s, dx, dy });

describe('cameraOrigin', () => {
  it('matches the camera model: background point q shows at o + d + s·(q − o)', () => {
    const [ox, oy] = CAMERA.origin;
    const state = { s: 1.07, dx: 3, dy: -2 };
    for (const name of PARTS) {
      const part = fireplace.parts[name];
      const bg = layout[name].bg;
      const at = place(name, state);
      for (const u of [0, 100, bg.w]) {
        const q = part.x + bg.x + u;
        expect(part.x + at.x(u)).toBeCloseTo(ox + state.dx + state.s * (q - ox), 9);
      }
      for (const v of [0, 100, bg.h]) {
        const q = part.y + bg.y + v;
        expect(part.y + at.y(v)).toBeCloseTo(oy + state.dy + state.s * (q - oy), 9);
      }
    }
  });
});

describe('background slices', () => {
  it.each(PARTS)('%s: covers the whole part at every camera extreme (re-run prepare:b after changing the camera)', (name) => {
    const { w, h } = fireplace.parts[name];
    const bg = layout[name].bg;
    for (const state of extremes) {
      const at = place(name, state);
      expect(at.x(0)).toBeLessThanOrEqual(0);
      expect(at.y(0)).toBeLessThanOrEqual(0);
      expect(at.x(bg.w)).toBeGreaterThanOrEqual(w);
      expect(at.y(bg.h)).toBeGreaterThanOrEqual(h);
    }
  });
});
