import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { Features } from 'lightningcss';

// One build per variant, each self-contained in dist/<variant>/ (in production every creative
// is delivered on its own). Dev serves the whole repo with a landing page at /.
const VARIANTS = {
  'variant-a': {
    dir: 'variant-a-game',
    pages: ['index.html'],
  },
  // 'variant-b': { dir: 'variant-b-fireplace', pages: ['top.html', 'left.html', 'right.html', 'preview.html'] },
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
      emptyOutDir: true,
      rolldownOptions: {
        input: Object.fromEntries(variant.pages.map((p) => [p.replace(/\.html$/, ''), resolve(root, p)])),
      },
    },
  };
});
