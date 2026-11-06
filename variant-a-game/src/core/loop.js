// Fixed-timestep game loop ("Fix Your Timestep!", G. Fiedler).
// Physics runs in equal STEP slices whatever the screen's refresh rate;
// render gets alpha (0..1) to draw between the last two physics states.
import { STEP } from './config.js';

const MAX_FRAME = 0.25; // s; after a long hitch drop the time instead of running hundreds of steps

export function createLoop(update, render) {
  let rafId = 0; // 0 = not running
  let last = 0;  // timestamp of the previous frame (ms)
  let acc = 0;   // time not yet simulated (s)

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
      if (rafId) return; // idempotent: a second start() can't double the speed (replay bug)
      acc = 0;
      rafId = requestAnimationFrame((now) => {
        last = now; // first frame: dt = 0, so no time jump after a pause
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
