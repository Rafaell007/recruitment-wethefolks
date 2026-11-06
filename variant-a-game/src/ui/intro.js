import { gsap } from 'gsap';
import { START_PROPS } from '../core/level.js';

const reducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// The poo and the props are drawn on the canvas, so every tween frame calls onFrame to redraw.
export function createIntro({ gesture, tut, stage, onFrame }) {
  const props = START_PROPS.map((o) => ({ ...o, scale: 1, alpha: 1 }));
  const player = { dy: 0, scale: 1, alpha: 1 };
  let intro = null;
  let hand = null;
  let pop = null;

  function play() {
    stage.classList.add('is-intro');
    if (reducedMotion()) {
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

  function idle() {
    if (reducedMotion()) return;
    hand = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      .to(gesture, { y: 5, scale: 0.92, duration: 0.22, ease: 'power2.out' })
      .to(gesture, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  // Inline styles are cleared, so the CSS fade-out (.is-running) starts from the current value.
  function stopIntro() {
    if (intro) intro.kill();
    if (hand) hand.kill();
    intro = hand = null;
    gsap.set([tut, gesture], { clearProps: 'opacity,transform' });
    player.dy = 0; player.scale = 1; player.alpha = 1;
  }

  function clear() {
    stopIntro();
    if (reducedMotion()) {
      pop = gsap.to(props, { alpha: 0, duration: 0.25, ease: 'power1.out' });
      return;
    }
    pop = gsap.to(props, { scale: 0, alpha: 0, duration: 0.45, ease: 'back.in(2.2)', stagger: 0.07 });
  }

  function reset() {
    stopIntro();
    if (pop) pop.kill();
    pop = null;
    for (const p of props) { p.scale = 1; p.alpha = 1; }
    play();
  }

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
