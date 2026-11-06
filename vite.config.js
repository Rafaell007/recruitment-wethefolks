import { basename, resolve } from 'node:path';
import { defineConfig } from 'vite';
import { Features } from 'lightningcss';

// One build per creative, self-contained in dist/<dir>/. The fireplace parts are three separate
// ads, so each is its own build rooted in its own folder: no shared JS chunk, and every path is
// relative to the part's HTML, so the folder still works when zipped and unpacked under any name.
// tools/build-b.mjs runs the fireplace builds.
const fireplacePart = (part) => ({ dir: `variant-b-fireplace/${part}`, page: `${part}.html` });

const VARIANTS = {
  'variant-a': { dir: 'variant-a-game', page: 'index.html' },
  'variant-b-top': fireplacePart('top'),
  'variant-b-left': fireplacePart('left'),
  'variant-b-right': fireplacePart('right'),
  // Built last into the parent folder, so it must not empty it.
  'variant-b-preview': { dir: 'variant-b-fireplace', page: 'preview.html', keepOutDir: true },
};

const shared = {
  css: {
    // Lightning CSS would delete the hand-written -webkit-clip-path that Safari < 13.1 needs.
    lightningcss: { exclude: Features.VendorPrefixes },
  },
  // The ad must work from whatever folder or CDN path the ad server puts it in.
  base: './',
  build: {
    // No data URIs: they are ~33% bigger and would hide weight inside the JS.
    assetsInlineLimit: 0,
    // Support floor iOS 12+: ?. and ?? are rewritten for these browsers.
    target: ['safari12', 'chrome64', 'firefox67', 'edge79'],
    modulePreload: { polyfill: false },
  },
};

export default defineConfig(({ command, mode }) => {
  if (command !== 'build') {
    return { ...shared, root: '.', build: { ...shared.build, outDir: 'dist' } };
  }

  const variant = VARIANTS[mode];
  if (!variant) {
    throw new Error(`Unknown build mode "${mode}". Use one of: ${Object.keys(VARIANTS).join(', ')}`);
  }

  const root = resolve(import.meta.dirname, variant.dir);
  return {
    ...shared,
    root,
    build: {
      ...shared.build,
      outDir: resolve(import.meta.dirname, 'dist', variant.dir),
      emptyOutDir: !variant.keepOutDir,
      rolldownOptions: {
        input: { [basename(variant.page, '.html')]: resolve(root, variant.page) },
      },
    },
  };
});
