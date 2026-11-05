// Start screen motion (GSAP): the tapping hand that invites the first tap, and the "gut clean-up"
// on that tap, when the start screen's obstacles pop away before the run starts on an empty gut.
// Every tween is kept and killed in reset(), so a replay starts clean (no leftover tweens).
import { gsap } from 'gsap';
import { START_PROPS } from './level.js';

const reducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function createIntro(gestureEl) {
  // What render.js draws on the start screen: the mockup's obstacles plus their tween values.
  const props = START_PROPS.map((o) => ({ ...o, scale: 1, alpha: 1 }));
  let hand = null;
  let pop = null;

  // A tap gesture on a loop: press down a little, spring back, short rest. Origin near the
  // fingertip, so the hand "presses" with the finger instead of shrinking around its middle.
  function idle() {
    if (reducedMotion()) return; // decorative: the static hand still explains the tap
    hand = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      .to(gestureEl, { y: 5, scale: 0.92, duration: 0.22, ease: 'power2.out', transformOrigin: '30% 20%' })
      .to(gestureEl, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  // First tap: the hand stops, the props pop one after another (a short swell, then shrink to
  // nothing, back.in) while the gut already starts moving under them.
  function clear() {
    if (hand) hand.kill();
    hand = null;
    if (reducedMotion()) {
      pop = gsap.to(props, { alpha: 0, duration: 0.25, ease: 'power1.out' });
      return;
    }
    pop = gsap.to(props, { scale: 0, alpha: 0, duration: 0.45, ease: 'back.in(2.2)', stagger: 0.07 });
  }

  function reset() {
    if (hand) hand.kill();
    if (pop) pop.kill();
    hand = pop = null;
    gsap.set(gestureEl, { clearProps: 'transform' });
    for (const p of props) { p.scale = 1; p.alpha = 1; }
    idle();
  }

  idle();
  return { props, clear, reset };
}
