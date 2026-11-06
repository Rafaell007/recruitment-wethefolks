import './part.css';
import layout from '../data/layout.json';
import { openClickTag } from './clicktag.js';
import { mountDesignOverlay } from './dev/overlay.js';

// Static end state of one part. Positions come from layout.json, not CSS: the background
// slice changes whenever the camera does.
export function mountPart(part, size) {
  const ad = document.getElementById('ad');
  ad.style.width = `${size.width}px`;
  ad.style.height = `${size.height}px`;

  for (const img of ad.querySelectorAll('img[data-layer]')) {
    const { x, y, w, h } = layout[part][img.dataset.layer];
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.transform = `translate(${x}px, ${y}px)`;
  }

  ad.addEventListener('click', openClickTag);
  mountDesignOverlay(ad, part, size);
  return ad;
}
