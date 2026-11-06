// ?debug=1                 draws the real hitboxes and logs how each run ended (build too)
// ?overlay=start|fail|win  design PNG over the stage, dev only; &overlayMode=diff, key O cycles
const params = new URLSearchParams(window.location.search);

export const debugFlags = {
  debug: params.get('debug') === '1',
  overlay: params.get('overlay'),
  overlayMode: params.get('overlayMode') === 'diff' ? 'diff' : 'fade',
};

const DESIGNS = {
  start: '01-start.png',
  fail: '02-fail-endcard.png',
  win: '03-win-endcard.png',
};

// Inside the stage, so it gets the same scale and offset as the real layers.
export function mountDesignOverlay(stage) {
  // import.meta.env.DEV: Vite drops this from the build, no design file ends up in dist/.
  if (!import.meta.env.DEV || !debugFlags.overlay) return;

  const file = DESIGNS[debugFlags.overlay];
  if (!file) {
    console.warn(`[debug] unknown overlay "${debugFlags.overlay}", use one of: ${Object.keys(DESIGNS).join(', ')}`);
    return;
  }

  const img = new Image();
  img.src = `design/${file}`;
  img.alt = '';
  Object.assign(img.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '360px',
    height: '640px',
    pointerEvents: 'none',
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
