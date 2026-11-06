import { describe, it, expect } from 'vitest';
import { keyOutBlack, evenBox } from '../../tools/lib/image.mjs';
import { sliceRect } from '../../tools/lib/overscan.mjs';
import fireplace from '../src/data/fireplace.json';

const px = (...rgba) => Buffer.from(rgba);

describe('keyOutBlack', () => {
  it('makes only pure black transparent', () => {
    const img = { data: px(0, 0, 0, 255, 1, 0, 0, 255, 184, 0, 0, 255, 255, 255, 255, 255), width: 4, height: 1 };
    const out = keyOutBlack(img);
    expect([...out.data]).toEqual([0, 0, 0, 0, 1, 0, 0, 255, 184, 0, 0, 255, 255, 255, 255, 255]);
    expect(img.data[3]).toBe(255); // input untouched
  });
});

describe('evenBox', () => {
  it('grows outwards to even edges', () => {
    expect(evenBox({ x: 133, y: 120, w: 376, h: 261 })).toEqual({ x: 132, y: 120, w: 378, h: 262 });
    expect(evenBox({ x: 0, y: 0, w: 640, h: 1950 })).toEqual({ x: 0, y: 0, w: 640, h: 1950 });
  });
});

describe('sliceRect', () => {
  const bounds = { w: 1680, h: 975 };
  const camera = { origin: [840, 487.5], maxScale: 1.1, maxDrift: 6 };

  // Background point shown at screen point p for scale s and drift d (the camera model).
  const source = (p, o, s, d) => o + (p - o - d) / s;

  it('covers everything the camera can show, for every part', () => {
    for (const part of Object.values(fireplace.parts)) {
      const r = sliceRect(part, camera, bounds);
      for (const s of [1, 1.05, camera.maxScale]) {
        for (const d of [-camera.maxDrift, 0, camera.maxDrift]) {
          for (const x of [part.x, part.x + part.w]) {
            const sx = source(x, camera.origin[0], s, d);
            // Outside bg-big there is nothing to show; everything inside must be in the slice.
            if (sx >= 0) expect(sx).toBeGreaterThanOrEqual(r.x);
            if (sx <= bounds.w) expect(sx).toBeLessThanOrEqual(r.x + r.w);
          }
          for (const y of [part.y, part.y + part.h]) {
            const sy = source(y, camera.origin[1], s, d);
            if (sy >= 0) expect(sy).toBeGreaterThanOrEqual(r.y);
            if (sy <= bounds.h) expect(sy).toBeLessThanOrEqual(r.y + r.h);
          }
        }
      }
    }
  });

  it('keeps a margin on every cut edge and stays inside the background', () => {
    for (const part of Object.values(fireplace.parts)) {
      const r = sliceRect(part, { origin: [840, 487.5], maxScale: 1, maxDrift: 0 }, bounds);
      if (part.x > 0) expect(r.x).toBeLessThanOrEqual(part.x - 2);
      if (part.x + part.w < bounds.w) expect(r.x + r.w).toBeGreaterThanOrEqual(part.x + part.w + 2);
      if (part.y + part.h < bounds.h) expect(r.y + r.h).toBeGreaterThanOrEqual(part.y + part.h + 2);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(bounds.w);
      expect(r.y + r.h).toBeLessThanOrEqual(bounds.h);
    }
  });
});
