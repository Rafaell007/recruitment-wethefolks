// Task: "Pause the game and sound when the tab or ad is not visible (visibilitychange)".
// Calls onChange(visible) when the ad is hidden or shown again: tab in the background,
// page closed (iOS pagehide), the ad scrolled out of the publisher's page (< 50% visible), or a
// phone turned to landscape (the ad is portrait only).
export function watchVisibility(el, onChange) {
  let tabVisible = !document.hidden;
  let inView = true; // until the observer says otherwise
  let last = true;

  // Portrait only (the task's format): a phone turned sideways counts as "not visible", so the
  // run freezes like in a background tab and resumes with the hand prompt. max-height keeps
  // desktop windows (landscape, but tall) out: a phone in landscape is at most ~430 px high.
  const landscape = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
  let portrait = !landscape.matches;

  // Four sources, one signal: onChange fires only when the combined answer changes.
  function update() {
    const visible = tabVisible && inView && portrait;
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

  const onTurn = () => {
    portrait = !landscape.matches;
    update();
  };
  if (landscape.addEventListener) landscape.addEventListener('change', onTurn);
  else landscape.addListener(onTurn); // Safari < 14 (D10: iOS 12+)

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

  update(); // loaded in landscape: paused from the start
}
