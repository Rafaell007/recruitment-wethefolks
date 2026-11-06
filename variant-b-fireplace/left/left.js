import './left.css';
import layout from '../src/data/layout.json';
import { openClickTag } from '../src/shared/clicktag.js';
import { mountDesignOverlay } from '../src/shared/dev/overlay.js';

const ad = document.getElementById('ad');

// Positions come from layout.json: the background slice changes whenever the camera does.
for (const img of ad.querySelectorAll('img[data-layer]')) {
  const { x, y, w, h } = layout.left[img.dataset.layer];
  img.style.width = `${w}px`;
  img.style.height = `${h}px`;
  img.style.transform = `translate(${x}px, ${y}px)`;
}

ad.addEventListener('click', openClickTag);
mountDesignOverlay(ad, 'left', { width: 320, height: 975 });
