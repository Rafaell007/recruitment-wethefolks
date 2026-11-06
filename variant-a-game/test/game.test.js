// One run of game.js on fixed steps: a single end, a clean reset.
import { test, expect, vi } from 'vitest';
import { createGame } from '../src/core/game.js';
import { STEP } from '../src/core/config.js';

// Runs fixed steps until cond() or the limit (a stuck game must fail the test, not hang it).
function run(g, cond, maxSeconds = 30) {
  for (let t = 0; t < maxSeconds && !cond(); t += STEP) g.update(STEP);
}

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
