// Endcard entrance (GSAP). The layers are full-frame (360x640), so each one has to scale
// around the centre of its visible part (bbox from tools/measure.mjs), not the stage centre.
// Every tween lives in one timeline: reset() kills it, so a replay starts clean.
import { gsap } from 'gsap';

const reducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// Visible bbox [x, y, w, h] in design px → transform-origin at its centre.
const centre = ([x, y, w, h]) => `${x + w / 2}px ${y + h / 2}px`;
const BUBBLE = { fail: [34.5, 74, 290.5, 322.5], win: [34.5, 84, 290.5, 322.5] };
const FAIL_BAC = [
  [133.5, 94.5, 22, 78.5],
  [236.5, 207.5, 43.5, 15.5],
  [54, 215, 66, 32],
  [69, 127, 51, 42],
  [207, 141.5, 29, 27.5],
];

export function createEndcard(cards) {
  let tl = null;

  // Origins once, in CSS: GSAP only animates the transform itself.
  for (const [result, card] of Object.entries(cards)) {
    card.querySelector('.bubble').style.transformOrigin = centre(BUBBLE[result]);
  }
  cards.fail.querySelectorAll('.bac').forEach((el, i) => {
    el.style.transformOrigin = centre(FAIL_BAC[i]);
  });

  function show(result) {
    const card = cards[result];
    const q = (sel) => card.querySelectorAll(sel);
    card.hidden = false;
    tl = gsap.timeline();
    tl.from(card, { opacity: 0, duration: 0.3, ease: 'power1.out' }); // fade over the frozen game
    if (reducedMotion()) return; // only the fade: decorative motion off

    tl.from(q('.bubble'), { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(1.6)' }, 0.1);
    if (result === 'fail') {
      // Sad poo drops in and bounces. 120 px: its top (y=183) starts at 63, still below the logo bar.
      tl.from(q('.sad'), { y: -120, opacity: 0, duration: 0.8, ease: 'bounce.out' }, 0.2)
        .from(q('.bac'), { scale: 0, duration: 0.4, ease: 'back.out(2)', stagger: 0.08 }, 0.45);
    }
    tl.from(q('.hl'), { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.7)
      .from(q('button'), { scale: 0.8, opacity: 0, duration: 0.4, ease: 'back.out(2)', stagger: 0.1 }, 0.95);
  }

  function reset() {
    if (tl) tl.kill();
    tl = null;
    for (const card of Object.values(cards)) {
      card.hidden = true;
      gsap.set([card, ...card.querySelectorAll('img, button')], { clearProps: 'opacity,transform' });
    }
  }

  return { show, reset };
}
