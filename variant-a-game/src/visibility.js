// Task: "Pause the game and sound when the tab or ad is not visible (visibilitychange)".
// Calls onChange(visible) when the ad is hidden or shown again: tab in the background,
// page closed (iOS pagehide), or the ad scrolled out of the publisher's page (< 50% visible).
export function watchVisibility(el, onChange) {
  let tabVisible = !document.hidden;
  let inView = true; // until the observer says otherwise
  let last = true;

  // Three sources, one signal: onChange fires only when the combined answer changes.
  function update() {
    const visible = tabVisible && inView;
    if (visible !== last) onChange((last = visible));
  }

  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
    update();
  });
  window.addEventListener('pagehide', () => {
    tabVisible = false;
    update();
  });
  window.addEventListener('pageshow', () => {
    tabVisible = !document.hidden;
    update();
  });

  // IAB viewability: at least 50% of the ad on screen. Works in a cross-origin iframe too.
  // Missing before iOS 12.2: then only the tab events above pause the game.
  if (window.IntersectionObserver) {
    new IntersectionObserver(
      ([e]) => {
        inView = e.intersectionRatio >= 0.5;
        update();
      },
      { threshold: [0, 0.5, 1] },
    ).observe(el);
  }
}
