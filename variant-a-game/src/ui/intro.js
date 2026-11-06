// Start screen motion (GSAP): the entrance of the start screen, the tapping hand that invites the
// first tap, and the "gut clean-up" on that tap, when the start screen's obstacles pop away before
// the run starts on an empty gut.
// Every tween is kept and killed in reset(), so a replay starts clean (no leftover tweens).
import { gsap } from 'gsap';
import { START_PROPS } from '../core/level.js';

const reducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// onFrame: redraw the canvas (main.js). The poo and the props are drawn there, and the loop
// doesn't run on the start screen.
export function createIntro({ gesture, tut, stage, onFrame }) {
  // What render.js draws on the start screen: the mockup's obstacles plus their tween values.
  const props = START_PROPS.map((o) => ({ ...o, scale: 1, alpha: 1 }));
  // The poo's entrance, drawing only: physics and the hitbox never see it.
  const player = { dy: 0, scale: 1, alpha: 1 };
  let intro = null;
  let hand = null;
  let pop = null;

  // Start screen entrance: headline, poo, the mockup's obstacles, then the hand.
  // gsap.from: the end state is the mockup itself, nothing to set "at the end".
  function play() {
    stage.classList.add('is-intro');
    if (reducedMotion()) { // decorative: a plain fade, everything at once
      intro = gsap.timeline({ onUpdate: onFrame })
        .from([tut, gesture], { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0)
        .from([player, ...props], { alpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
      return;
    }
    intro = gsap.timeline({ onUpdate: onFrame, onComplete: idle })
      .from(tut, { y: -16, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0)
      .from(player, { dy: -40, scale: 0.6, alpha: 0, duration: 0.6, ease: 'back.out(1.8)' }, 0.15)
      .from(props, { scale: 0, alpha: 0, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.08 }, 0.3)
      .from(gesture, { scale: 0.6, opacity: 0, duration: 0.4, ease: 'back.out(2)' }, 0.8);
  }

  // A tap gesture on a loop: press down a little, spring back, short rest. The origin sits near
  // the fingertip (styles/start.css), so the hand "presses" with the finger.
  function idle() {
    if (reducedMotion()) return; // decorative: the static hand still explains the tap
    hand = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      .to(gesture, { y: 5, scale: 0.92, duration: 0.22, ease: 'power2.out' })
      .to(gesture, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  // Stops the entrance where it is. Inline styles go, so the CSS fade (.is-running) takes over
  // from the current value; the poo snaps to its place (it is about to move anyway).
  function stopIntro() {
    if (intro) intro.kill();
    if (hand) hand.kill();
    intro = hand = null;
    gsap.set([tut, gesture], { clearProps: 'opacity,transform' });
    player.dy = 0; player.scale = 1; player.alpha = 1;
  }

  // First tap: the props pop one after another (a short swell, then shrink to nothing,
  // back.in) while the gut already starts moving under them. From their current values, so a
  // tap during the entrance doesn't make them jump.
  function clear() {
    stopIntro();
    if (reducedMotion()) {
      pop = gsap.to(props, { alpha: 0, duration: 0.25, ease: 'power1.out' });
      return;
    }
    pop = gsap.to(props, { scale: 0, alpha: 0, duration: 0.45, ease: 'back.in(2.2)', stagger: 0.07 });
  }

  // Replay: back to the start screen, its entrance plays again.
  function reset() {
    stopIntro();
    if (pop) pop.kill();
    pop = null;
    for (const p of props) { p.scale = 1; p.alpha = 1; }
    play();
  }

  // Pause hint (main.js): the same tapping-hand loop, shown again until the resume tap.
  function showHint() {
    gsap.set(gesture, { clearProps: 'transform' });
    idle();
  }
  function hideHint() {
    if (hand) hand.kill();
    hand = null;
  }

  return { props, player, play, clear, reset, showHint, hideHint };
}
