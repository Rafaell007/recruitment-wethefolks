// Debug switches, read once from the URL. Later milestones add ?debug=1 (hitboxes, FPS) and ?god=1.
//
// ?overlay=start|fail|win   lays the design PNG over the stage, 1:1 with the 360x640 logical stage
// &overlayMode=fade|diff     fade (default): design at 50% opacity on top of the build
//                            diff: difference blend, identical pixels turn black, every offset shows as an outline
// Key O cycles fade → diff → hidden, so you can compare without reloading.
//
// Dev only: the design PNGs are not part of the ad, so `import.meta.env.DEV` lets Vite drop this
// whole branch from the production bundle and no design file ends up in dist/.

const params = new URLSearchParams(window.location.search);

export const debugFlags = {
  overlay: params.get('overlay'), // 'start' | 'fail' | 'win' | null
  overlayMode: params.get('overlayMode') === 'diff' ? 'diff' : 'fade',
};

const DESIGNS = {
  start: '01-start.png',
  fail: '02-fail-endcard.png',
  win: '03-win-endcard.png',
};

/**
 * Mounts the design overlay inside the stage element, so it gets exactly the same
 * scale and offset as the real layers. Does nothing without ?overlay=… or in a production build.
 * @param {HTMLElement} stage the 360x640 logical stage (the element stage.js scales)
 */
export function mountDesignOverlay(stage) {
  if (!import.meta.env.DEV || !debugFlags.overlay) return;

  const file = DESIGNS[debugFlags.overlay];
  if (!file) {
    console.warn(`[debug] unknown overlay "${debugFlags.overlay}", use one of: ${Object.keys(DESIGNS).join(', ')}`);
    return;
  }

  const img = new Image();
  // Relative to variant-a-game/index.html; the dev server serves the whole repo, design/ included.
  img.src = `design/${file}`;
  img.alt = '';
  // Drawn at the same 50% as every other @2x asset: 720x1280 → 360x640.
  Object.assign(img.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '360px',
    height: '640px',
    pointerEvents: 'none', // taps must still reach the game underneath
    zIndex: '9999',
  });

  const modes = ['fade', 'diff', 'hidden'];
  let mode = debugFlags.overlayMode;
  const apply = () => {
    img.style.display = mode === 'hidden' ? 'none' : 'block';
    img.style.opacity = mode === 'fade' ? '0.5' : '1';
    img.style.mixBlendMode = mode === 'diff' ? 'difference' : 'normal';
  };
  apply();

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'o' && e.key !== 'O') return;
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    apply();
    console.info(`[debug] overlay: ${mode}`);
  });

  stage.append(img);
}
