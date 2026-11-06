// ?overlay=1  design over the part, dev only; key O cycles 50% fade / difference / hidden.
import measured from '../../data/measured.json';

// layout.png shows all three parts, so each part shows only its own frame, scaled by that
// frame's own scale (the design is a screenshot at roughly 0.97–0.98).
export function mountDesignOverlay(ad, part, { width, height }) {
  // import.meta.env.DEV: Vite drops this from the build, the design file never ends up in dist/.
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('overlay') !== '1') return;

  const { design, frames } = measured;
  const f = frames[part];
  const sx = f.w / width;
  const sy = f.h / height;

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    backgroundImage: 'url(../design/layout.png)',
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${design.w / sx}px ${design.h / sy}px`,
    backgroundPosition: `${-f.x / sx}px ${-f.y / sy}px`,
    pointerEvents: 'none',
    zIndex: '9999',
  });

  const modes = ['fade', 'diff', 'hidden'];
  let mode = 'fade';
  const apply = () => {
    el.style.display = mode === 'hidden' ? 'none' : 'block';
    el.style.opacity = mode === 'fade' ? '0.5' : '1';
    el.style.mixBlendMode = mode === 'diff' ? 'difference' : 'normal';
  };
  apply();

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'o' && e.key !== 'O') return;
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    apply();
  });

  ad.append(el);
}
