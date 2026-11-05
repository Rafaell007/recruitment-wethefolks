// One run of game.js on fixed steps: get ready, jump physics, a single end, a clean reset.
import { test, expect, vi } from 'vitest';
import { createGame } from '../src/game.js';
import { STEP, GET_READY, PHYSICS } from '../src/config.js';

// Runs fixed steps until cond() or the limit (a stuck game must fail the test, not hang it).
// Returns the simulated time in seconds.
function run(g, cond, maxSeconds = 30) {
  let t = 0;
  while (t < maxSeconds && !cond()) {
    g.update(STEP);
    t += STEP;
  }
  return t;
}
const toPlaying = (g) => {
  g.jump();
  run(g, () => g.state.phase === 'playing');
};

test('first tap = get ready: no jump, no gravity, then playing after the hover', () => {
  const g = createGame();
  g.jump();
  g.update(STEP);
  g.jump(); // a tap during get ready does nothing
  expect(g.state.player.vy).toBe(0);
  run(g, () => g.state.phase === 'playing');
  expect(g.state.runTime).toBeCloseTo(GET_READY.hover, 1);
  expect(g.state.player.y).toBe(g.state.player.prevY); // still hovering at the start height
});

test('jump: ~50 px up, apex after ~0.27 s; a double tap sets the speed, never adds', () => {
  const g = createGame();
  toPlaying(g);
  g.state.player.y = 400; // mid-gut, so the jump can't reach the clouds
  g.jump();
  g.jump();
  expect(g.state.player.vy).toBe(PHYSICS.jumpVelocity);
  const t = run(g, () => g.state.player.vy >= 0, 1);
  expect(400 - g.state.player.y).toBeCloseTo(50, 0);
  expect(t).toBeGreaterThan(0.26);
  expect(t).toBeLessThan(0.28);
});

test('no taps: falls into the clouds, onEnd fires exactly once', () => {
  const onEnd = vi.fn();
  const g = createGame({ onEnd });
  g.jump();
  run(g, () => false, 5); // keep updating long after the end
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledWith('fail', 'clouds');
});

test('reset after a run gives the same state as a new game', () => {
  const g = createGame();
  g.jump();
  run(g, () => g.state.phase === 'over');
  expect(g.state.phase).toBe('over');
  g.reset();
  expect(g.state).toEqual(createGame().state);
});
