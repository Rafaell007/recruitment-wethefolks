// Fixed timestep ("Fix Your Timestep!", G. Fiedler): the same physics at 60, 90 or 120 Hz.
// render() gets alpha 0..1 to interpolate between the last two states.
import { STEP } from './config.js';

const MAX_FRAME = 0.25; // s, after a long hitch drop the time instead of catching up

export function createLoop(update, render) {
  let rafId = 0;
  let last = 0;
  let acc = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(acc / STEP);
  }

  return {
    start() {
      if (rafId) return; // a second start() must not double the speed
      acc = 0;
      rafId = requestAnimationFrame((now) => {
        last = now; // no time jump after a pause
        frame(now);
      });
    },
    stop() {
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    get running() {
      return rafId !== 0;
    },
  };
}
