import { gsap } from 'gsap';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

// tl: the part's whole animation, finite and ending in the static end state
// (intro, then calm loops with fixed repeats, done by ~30 s). at: shared start, Date.now() ms.
export function runMotion(tl, at) {
  // false = do fire onComplete, so whatever waits for the end (tl.then) still runs.
  const finish = () => tl.progress(1, false).pause();
  if (reduce.matches) return finish();

  // Follow the wall clock: a slow frame must not leave one part behind the other two.
  gsap.ticker.lagSmoothing(0);
  // Time 0 of tl = the shared start, whether that is still ahead or has just passed.
  tl.startTime(gsap.globalTimeline.time() + (at - Date.now()) / 1000);

  const onReduce = () => reduce.matches && finish();
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
  else reduce.addListener(onReduce); // Safari < 14

  // All three frames get this with the tab, so they pause and resume together.
  // Also checked right away: an ad opened in a background tab starts hidden, with no event.
  const onVisibility = () => {
    if (document.hidden) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();
}
