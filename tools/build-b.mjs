// Builds the fireplace: top, left and right as three separate creatives, then the preview page.
// Each build writes only its own HTML file and folder, so the output folder is cleared once here.
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');

await rm(resolve(ROOT, 'dist', 'variant-b-fireplace'), { recursive: true, force: true });
for (const part of ['top', 'left', 'right', 'preview']) {
  await build({ configFile: resolve(ROOT, 'vite.config.js'), mode: `variant-b-${part}`, logLevel: 'warn' });
  console.log(`built ${part}`);
}
