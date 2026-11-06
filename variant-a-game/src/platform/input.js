// iOS 12 has no Pointer Events, only touch (and mouse on desktop).
export function onTap(el, handler) {
  if (window.PointerEvent) {
    el.addEventListener('pointerdown', handler);
    return;
  }
  el.addEventListener('touchstart', (e) => {
    e.preventDefault(); // no emulated mousedown afterwards = no double jump
    handler(e);
  }, { passive: false });
  el.addEventListener('mousedown', handler);
}

// iOS doesn't count touchstart / pointerdown as a gesture that may start audio.
export function onRelease(el, handler) {
  el.addEventListener(window.PointerEvent ? 'pointerup' : 'touchend', handler);
}

// Taps on a button must not reach the ad behind it (no start, no jump, no resume).
export function isolate(el) {
  ['pointerdown', 'touchstart', 'mousedown'].forEach((type) => {
    el.addEventListener(type, (e) => e.stopPropagation());
  });
}
