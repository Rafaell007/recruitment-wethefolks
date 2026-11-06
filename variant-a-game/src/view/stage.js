// Scales the 360x640 design stage to the visible screen (decision D4: hybrid safe-area fit + bleed).

const STAGE_W = 360;
const STAGE_H = 640;

// Safe area = everything important, measured from the design files.
// Width: x 11–349. The fail headline (hl.png at 50%) ends at x=345, plus 4 px so its full stop
// never sits flush with the screen edge (measured on 430x932: 0 px gap at 345). The stage is
// centred, so the area is symmetric around x=180. Outside are only decorations.
// Height: y 0–606 (from the logo bar down to the bottom of the win CTA).
const SAFE_W = 338;
const SAFE_H = 606;

// Pure maths, no DOM: easy to reason about and to test with any screen size.
export function computeFit(vw, vh) {
  // Scale at which the stage covers the whole screen; going bigger would only crop more.
  const cover = Math.max(vw / STAGE_W, vh / STAGE_H);
  // As big as possible, but the safe area must still fit in both directions.
  const scale = Math.min(cover, vw / SAFE_W, vh / SAFE_H);

  // Centre horizontally (negative x = equal crop on both sides).
  const x = Math.round((vw - STAGE_W * scale) / 2);
  // Centre vertically when there is spare height; otherwise pin to the top so only the
  // decorative bottom of the frame is cropped, never the logo bar.
  const y = Math.max(0, Math.round((vh - STAGE_H * scale) / 2));

  return { scale, x, y };
}

/**
 * Keeps the stage fitted to the visible screen.
 * @param {HTMLElement} viewport the visible screen (#ad): the whole tab, or the iframe the ad runs in
 * @param {HTMLElement} stage the 360x640 design stage (#stage)
 * @param {(fit: {scale: number, x: number, y: number}, vw: number) => void} [onFit]
 *   called after every re-fit, so the game canvas can match the new size and sharpness
 */
export function initStage(viewport, stage, onFit) {
  let current = { scale: 1, x: 0, y: 0 };

  function fit() {
    current = computeFit(viewport.clientWidth, viewport.clientHeight);
    stage.style.transform = `translate(${current.x}px, ${current.y}px) scale(${current.scale})`;
    if (onFit) onFit(current, viewport.clientWidth);
  }

  // Browsers without dvh: there 100vh includes the area under the toolbars, so the bottom
  // of the ad would hide behind them. Size #ad from visualViewport, the really visible part.
  // The new height then triggers the ResizeObserver below, which re-fits the stage.
  if (!CSS.supports('height', '100dvh') && window.visualViewport) {
    const syncHeight = () => {
      viewport.style.height = `${window.visualViewport.height}px`;
    };
    window.visualViewport.addEventListener('resize', syncHeight);
    syncHeight();
  }

  if ('ResizeObserver' in window) {
    // Fires whenever #ad changes size: rotation, mobile toolbars showing or hiding (#ad is 100dvh),
    // the publisher resizing the iframe. One observer instead of resize + orientationchange + visualViewport.
    new ResizeObserver(fit).observe(viewport);
  } else {
    // Browsers without ResizeObserver (iOS < 13.4): fall back to the window events that cover the
    // same cases. The visualViewport listener is registered after syncHeight above, so #ad already
    // has its new height when fit() measures it.
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  }
  fit();

  return {
    // The game (M3+) needs the scale for canvas sharpness and the visible right edge for spawning.
    getFit: () => current,
  };
}
