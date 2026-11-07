import { gsap } from 'gsap';
import './part.css';
import layout from '../data/layout.json';
import { openClickTag } from './clicktag.js';
import { cameraOrigin } from './camera.js';
import { buildTimeline } from './timeline.js';
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
  ad.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openClickTag();
  });
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

  const tl = buildTimeline(layers);

  ad.classList.add('is-ready', 'is-moving');
  tl.then(() => {
    ad.classList.remove('is-moving');
    // At scale 1 the origin changes nothing in theory, but Chrome places a far-away origin
    // with a rounding error and the background lands off the whole pixel (measured at DPR 1).
    gsap.set(layers.bg, { transformOrigin: '0 0' });
  });
  runMotion(tl, at);
}
