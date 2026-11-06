import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { Features } from 'lightningcss';

// Every variant is built on its own so that each shipped ad is self-contained:
// its own folder in dist/, its own copy of GSAP, no chunks shared with another ad.
// `vite build --mode <name>` picks the variant; `vite` (dev) serves the whole repo
// with the landing page at / linking to each variant.
const VARIANTS = {
  'variant-a': {
    dir: 'variant-a-game',
    pages: ['index.html'],
  },
  // 'variant-b': { dir: 'variant-b-fireplace', pages: ['top.html', 'left.html', 'right.html', 'preview.html'] },
};

const shared = {
  css: {
    // The CSS minifier (Lightning CSS) believes Safari 12 needs no -webkit-clip-path and deletes
    // the prefixed line we wrote by hand; on iOS 12–13.3 the stage would then be covered by the
    // edge cover. Vendor prefixes are therefore left exactly as written in the stylesheets.
    lightningcss: { exclude: Features.VendorPrefixes },
  },
  // Relative URLs: the ad has to work from whatever folder or CDN path the ad server puts it in.
  base: './',
  build: {
    // No base64 inlining: every asset stays a separate, compressed file, so the weight
    // report is honest and images are not 33% bigger as data URIs.
    assetsInlineLimit: 0,
    // Support floor: iOS 12+ (last iOS for iPhone 5s/6; GSAP 3 runs there; <script type="module">
    // needs Safari 11+ anyway). Newer syntax in our code (?., ??) is rewritten for these browsers.
    target: ['safari12', 'chrome64', 'firefox67', 'edge79'],
    // One bundle per page, nothing to preload: skip Vite's modulepreload polyfill.
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
