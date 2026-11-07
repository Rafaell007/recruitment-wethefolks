import { gsap } from 'gsap';
import './part.css';
import layout from '../data/layout.json';
import { openClickTag } from './clicktag.js';
import { CAMERA, cameraOrigin } from './camera.js';
import { waitForStart } from './sync.js';
import { runMotion } from './motion.js';
import { splitLines } from './lines.js';
import { mountDesignOverlay } from './dev/overlay.js';

// One part: layers placed from layout.json (GSAP owns their transforms from the start),
// shown and animated only once every image is decoded and the shared start time is known.
export async function mountPart(part, size) {
  const ad = document.getElementById('ad');
  ad.style.width = `${size.width}px`;
  ad.style.height = `${size.height}px`;
  ad.addEventListener('click', openClickTag);
  mountDesignOverlay(ad, part, size);

  const layers = {};
  for (const img of ad.querySelectorAll('img[data-layer]')) {
    const name = img.dataset.layer;
    const box = layout[part][name];
    if (img.dataset.lines) {
      layers[name] = splitLines(img, box, img.dataset.lines.split(' ').map(Number));
    } else {
      gsap.set(img, { x: box.x, y: box.y, width: box.w, height: box.h });
      layers[name] = img;
    }
  }
  gsap.set(layers.bg, { transformOrigin: cameraOrigin(part, layout[part].bg) });
  if (layers.box) gsap.set(layers.box, { transformOrigin: '50% 100%' });

  // A failed decode should not leave an empty frame: start anyway.
  await Promise.all([...ad.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  const at = await waitForStart(part);

  const tl = gsap.timeline();
  // Shared camera, one long move: quick with the intro, then slower and slower until it
  // settles in the end state at 29 s. The product, baked into the background, eases in with it.
  tl.fromTo(layers.bg, { scale: CAMERA.maxScale }, { scale: 1, duration: 29, ease: 'power1.out' }, 0);
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

  ad.classList.add('is-ready', 'is-moving');
  tl.then(() => {
    ad.classList.remove('is-moving');
    // At scale 1 the origin changes nothing in theory, but Chrome places a far-away origin
    // with a rounding error and the background lands off the whole pixel (measured at DPR 1).
    gsap.set(layers.bg, { transformOrigin: '0 0' });
  });
  runMotion(tl, at);
}
