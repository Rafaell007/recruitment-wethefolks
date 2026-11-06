import { openClickTag } from '../src/shared/clicktag.js';
import { mountDesignOverlay } from '../src/shared/dev/overlay.js';

const ad = document.getElementById('ad');
ad.addEventListener('click', openClickTag);
mountDesignOverlay(ad, 'top', { width: 1032, height: 250 });
