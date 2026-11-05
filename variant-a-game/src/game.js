// One run of the game: player physics and the gut scroll. No DOM, no canvas (render.js draws it),
// so it can be tested and reset without touching the page.
import { STAGE, PLAYER, GUT, PHYSICS, SPEED } from './config.js';

export function createGame() {
  const state = {
    phase: 'ready', // 'ready' = start screen, player waits | 'playing' | 'over' (M4)
    scroll: GUT.startScroll,
    prevScroll: GUT.startScroll,
    player: { y: PLAYER.startY, prevY: PLAYER.startY, vy: 0 },
  };
  // Scroll at which the image's right edge reaches the visible right edge (D11).
  let scrollEnd = GUT.width - STAGE.w;

  function reset() {
    state.phase = 'ready';
    state.scroll = state.prevScroll = GUT.startScroll;
    const p = state.player;
    p.y = p.prevY = PLAYER.startY;
    p.vy = 0;
  }

  // A tap: the first one starts the run, every one sets the upward speed (not adds to it),
  // so fast double taps can't launch the player into the ceiling.
  function jump() {
    if (state.phase === 'over') return;
    state.phase = 'playing';
    state.player.vy = PHYSICS.jumpVelocity;
  }

  function update(dt) {
    const p = state.player;
    state.prevScroll = state.scroll;
    p.prevY = p.y;
    if (state.phase !== 'playing') return;

    // Semi-implicit Euler: speed first, then position with the new speed (stable, Flappy feel).
    p.vy = Math.min(p.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
    p.y += p.vy * dt;
    state.scroll = Math.min(state.scroll + SPEED.start * dt, scrollEnd);
  }

  return {
    state,
    reset,
    jump,
    update,
    // visibleRight = view.left + view.width from render.js, in stage px (≥ 360).
    setVisibleRight(visibleRight) {
      scrollEnd = GUT.width - visibleRight;
    },
  };
}
