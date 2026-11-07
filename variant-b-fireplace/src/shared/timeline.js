import { gsap } from 'gsap';
import { CAMERA } from './camera.js';

// The part's whole animation, finite (done at 29 s) and ending in the static end state.
// layers: { bg, hl: { lines, whole }, logo?, box?, cta? } — the top banner has only bg and hl.
export function buildTimeline(layers) {
  const tl = gsap.timeline();
  // Shared camera, one long move in a single direction; the product, baked into the
  // background, comes with it. Steady, barely-there zoom for most of the 30 s, then a soft
  // landing on the design at 29 s. Speeds match where the two tweens meet
  // (power1.out starts at 2× its average speed).
  const LAND = 8;
  const speed = (CAMERA.maxScale - 1) / (29 - LAND / 2);
  const landFrom = 1 + (speed * LAND) / 2;
  tl.fromTo(layers.bg, { scale: CAMERA.maxScale }, { scale: landFrom, duration: 29 - LAND, ease: 'none' }, 0);
  tl.to(layers.bg, { scale: 1, duration: LAND, ease: 'power1.out' }, 29 - LAND);
  tl.from(layers.bg, { opacity: 0, duration: 0.6, ease: 'power1.out' }, 0);
  if (layers.logo) tl.from(layers.logo, { opacity: 0, scale: 0.85, duration: 0.8, ease: 'back.out(1.6)' }, 0.3);

  // Lines rise into their windows from just below, one after another.
  const rise = ({ lines, whole }, at) => {
    tl.from(lines, {
      y: (i, el) => `+=${el.parentNode.offsetHeight}`, opacity: 0,
      duration: 0.7, stagger: 0.25, ease: 'power3.out',
    }, at);
    // At rest it is the one original image again: a cut on a fractional device pixel
    // (Windows 125/150 %, zoomed preview) leaves a faint line through the text shadow.
    tl.set(whole, { autoAlpha: 1 }, '>').set(lines.map((l) => l.parentNode), { autoAlpha: 0 }, '<');
  };
  if (layers.box) {
    rise(layers.hl, 2.2);
    tl.from(layers.box, { scaleY: 0, duration: 0.6, ease: 'power2.inOut' }, 1.8);
    tl.from(layers.cta, { opacity: 0, scale: 0.6, duration: 0.6, ease: 'back.out(2)' }, 2.9);
  } else {
    rise(layers.hl, 0.8); // top banner headline
  }

  // A gentle CTA pulse every 4 s; stops before the 30 s mark.
  if (layers.cta) {
    for (let t = 5; t < 26; t += 4) {
      tl.to(layers.cta, { scale: 1.04, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, t);
    }
  }
  return tl;
}
