// onChange(visible) when the ad is hidden or shown again: background tab, page closed,
// less than 50% on screen (IAB viewability), or a phone turned to landscape.
export function watchVisibility(el, onChange) {
  let tabVisible = !document.hidden;
  let inView = true;
  let last = true;

  // max-height keeps desktop windows out: a phone in landscape is at most ~430 px high.
  const landscape = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
  let portrait = !landscape.matches;

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
  else landscape.addListener(onTurn); // Safari < 14

  // Works in a cross-origin iframe too. Missing before iOS 12.2: then only the tab events count.
  if (window.IntersectionObserver) {
    new IntersectionObserver(
      ([e]) => {
        inView = e.intersectionRatio >= 0.5;
        update();
      },
      { threshold: [0, 0.5, 1] },
    ).observe(el);
  }

  update();
}
