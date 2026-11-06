const STAGE_W = 360;
const STAGE_H = 640;

// Safe area: x 11–349 (the fail headline ends at 345, +4 px margin), y 0–606 (logo bar to the
// bottom of the win CTA). Outside it there are only decorations, which may be cropped.
const SAFE_W = 338;
const SAFE_H = 606;

// As big as covering the screen needs, but never so big that the safe area stops fitting.
export function computeFit(vw, vh) {
  const cover = Math.max(vw / STAGE_W, vh / STAGE_H);
  const scale = Math.min(cover, vw / SAFE_W, vh / SAFE_H);
  const x = Math.round((vw - STAGE_W * scale) / 2);
  // Too short: pin to the top, so only the bottom of the frame is cropped, never the logo bar.
  const y = Math.max(0, Math.round((vh - STAGE_H * scale) / 2));
  return { scale, x, y };
}

// onFit(fit, vw) runs after every re-fit, so the canvas can follow.
export function initStage(viewport, stage, onFit) {
  let current = { scale: 1, x: 0, y: 0 };

  function fit() {
    current = computeFit(viewport.clientWidth, viewport.clientHeight);
    stage.style.transform = `translate(${current.x}px, ${current.y}px) scale(${current.scale})`;
    if (onFit) onFit(current, viewport.clientWidth);
  }

  // Without dvh, 100vh includes the area under the mobile toolbars.
  if (!CSS.supports('height', '100dvh') && window.visualViewport) {
    const syncHeight = () => {
      viewport.style.height = `${window.visualViewport.height}px`;
    };
    window.visualViewport.addEventListener('resize', syncHeight);
    syncHeight();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(fit).observe(viewport);
  } else {
    // iOS < 13.4. Registered after syncHeight, so #ad already has its new height here.
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  }
  fit();

  return {
    getFit: () => current,
  };
}
