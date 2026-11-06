// Taps on the ad, across browsers. Pointer Events exist from iOS 13; iOS 12 (our support floor)
// only has touch events, plus mouse events for desktop.
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

// Finger lifted. iOS doesn't count touchstart / pointerdown as a gesture that may start audio,
// so the audio is unlocked again here.
export function onRelease(el, handler) {
  el.addEventListener(window.PointerEvent ? 'pointerup' : 'touchend', handler);
}

// Taps on a button must not reach the ad behind it: no game start, no jump, no resume from pause.
// All three types, because iOS 12 sends touchstart / mousedown instead of pointerdown.
export function isolate(el) {
  ['pointerdown', 'touchstart', 'mousedown'].forEach((type) => {
    el.addEventListener(type, (e) => e.stopPropagation());
  });
}
