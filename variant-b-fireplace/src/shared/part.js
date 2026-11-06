import { gsap } from 'gsap';
import './part.css';
import layout from '../data/layout.json';
import { openClickTag } from './clicktag.js';
import { CAMERA, cameraOrigin } from './camera.js';
import { waitForStart } from './sync.js';
import { runMotion } from './motion.js';
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
    const { x, y, w, h } = layout[part][img.dataset.layer];
    gsap.set(img, { x, y, width: w, height: h });
    layers[img.dataset.layer] = img;
  }
  gsap.set(layers.bg, { transformOrigin: cameraOrigin(part, layout[part].bg) });

  // A failed decode should not leave an empty frame: start anyway.
  await Promise.all(Object.values(layers).map((img) => img.decode().catch(() => {})));
  const at = await waitForStart(part);

  const tl = gsap.timeline();
  // TEMP until B5: only the shared background zoom, to check sync and seams.
  tl.fromTo(layers.bg, { scale: CAMERA.maxScale }, { scale: 1, duration: 5, ease: 'power2.out' });

  ad.classList.add('is-ready', 'is-moving');
  tl.then(() => {
    ad.classList.remove('is-moving');
    // At scale 1 the origin changes nothing in theory, but Chrome places a far-away origin
    // with a rounding error and the background lands off the whole pixel (measured at DPR 1).
    gsap.set(layers.bg, { transformOrigin: '0 0' });
  });
  runMotion(tl, at);
}
