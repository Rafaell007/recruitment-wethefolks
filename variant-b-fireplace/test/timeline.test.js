import { describe, it, expect } from 'vitest';
import { buildTimeline } from '../src/shared/timeline.js';

// GSAP tweens plain objects too: each layer starts in its static (design) state,
// the same state the real layers have from CSS and gsap.set before the timeline is built.
const layer = () => ({ x: 0, y: 0, scale: 1, scaleY: 1, opacity: 1, autoAlpha: 1 });
const lines = (n) => Array.from({ length: n }, () => ({ ...layer(), parentNode: { offsetHeight: 40, ...layer() } }));
const headline = (n) => ({ lines: lines(n), whole: { ...layer(), autoAlpha: 0 } });

const PARTS = {
  skyscraper: () => ({ bg: layer(), logo: layer(), box: layer(), cta: layer(), hl: headline(2) }),
  top: () => ({ bg: layer(), hl: headline(3) }),
};

const STATIC = { x: 0, y: 0, scale: 1, scaleY: 1, opacity: 1, autoAlpha: 1 };

describe.each(Object.entries(PARTS))('buildTimeline (%s)', (_, make) => {
  it('stops looping within ~30 s', () => {
    const tl = buildTimeline(make()).pause();
    expect(tl.duration()).toBeLessThanOrEqual(30);
  });

  it('ends exactly in the design: what reduced motion shows and the end of the animation match', () => {
    const layers = make();
    buildTimeline(layers).pause().progress(1);
    const { hl, ...rest } = layers;
    for (const el of [...Object.values(rest), ...hl.lines]) {
      expect({ ...el, parentNode: undefined }).toMatchObject(STATIC);
    }
    // At rest the original headline is back, the line windows are hidden.
    expect(hl.whole.autoAlpha).toBe(1);
    for (const l of hl.lines) expect(l.parentNode.autoAlpha).toBe(0);
  });
});
