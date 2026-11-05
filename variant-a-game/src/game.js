// One run of the game: player physics and the gut scroll. No DOM, no canvas (render.js draws it),
// so it can be tested and reset without touching the page.
import { STAGE, PLAYER, GUT, PHYSICS, GET_READY } from './config.js';
import { LEVEL, PLAYER_HIT as HIT, rampSpeed } from './level.js';
import hitboxes from './hitboxes.json';
import { circleHitsMask } from './collision.js';

const CX = HIT.cx; // fixed x line of the circle's centre

// onEnd(result, hitBy) fires once per run: result 'win' | 'fail', hitBy 'clouds' | obstacle name.
export function createGame({ onEnd = () => {} } = {}) {
  const state = {
    // 'ready' = start screen, player waits | 'getReady' = hover after the first tap | 'playing' | 'over'
    phase: 'ready',
    getReadyLeft: 0, // s
    result: null,    // null | 'win' | 'fail'
    hitBy: null,     // null | 'clouds' | obstacle name
    scroll: GUT.startScroll,
    prevScroll: GUT.startScroll,
    player: { y: PLAYER.startY, prevY: PLAYER.startY, vy: 0 },
  };
  // Scroll at which the image's right edge reaches the visible right edge (D11).
  let scrollEnd = GUT.width - STAGE.w;

  function reset() {
    state.phase = 'ready';
    state.getReadyLeft = 0;
    state.result = state.hitBy = null;
    state.scroll = state.prevScroll = GUT.startScroll;
    const p = state.player;
    p.y = p.prevY = PLAYER.startY;
    p.vy = 0;
  }

  // A tap. The first one starts the run with the get-ready hover (no jump yet). While playing,
  // every tap sets the upward speed (not adds to it), so fast double taps can't launch the
  // player into the ceiling. Taps during get ready / after the end do nothing.
  function jump() {
    if (state.phase === 'ready') {
      state.phase = 'getReady';
      state.getReadyLeft = GET_READY;
      return;
    }
    if (state.phase !== 'playing') return;
    state.player.vy = PHYSICS.jumpVelocity;
  }

  function update(dt) {
    const p = state.player;
    state.prevScroll = state.scroll;
    p.prevY = p.y;
    if (state.phase !== 'getReady' && state.phase !== 'playing') return;

    // The world already moves during get ready (the level solver assumes the same).
    state.scroll = Math.min(state.scroll + rampSpeed(state.scroll, scrollEnd) * dt, scrollEnd);
    if (state.phase === 'getReady') { // hover: no gravity, the first obstacles pass below
      state.getReadyLeft -= dt;
      if (state.getReadyLeft <= 0) state.phase = 'playing';
    } else {
      // Semi-implicit Euler: speed first, then position with the new speed (stable, Flappy feel).
      p.vy = Math.min(p.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
      p.y += p.vy * dt;
    }

    // Checked in get ready too: the solver assumes it, and the game stays fair if the level changes.
    const hit = touching();
    if (hit) return end('fail', hit);
    if (state.scroll >= scrollEnd) end('win');
  }

  // What the circle touches at the current position, or null.
  function touching() {
    const cy = state.player.y + HIT.dy;
    if (circleHitsMask(CX, cy, HIT.r, hitboxes.clouds, hitboxes.clouds.x / 2, 0)) return 'clouds';
    // Safety net only: at max fall the player moves 4.3 px per step and the circle is 30 px wide,
    // so it always touches the clouds before it could leave the stage.
    if (cy + HIT.r < 0 || cy - HIT.r > STAGE.h) return 'clouds';
    for (const o of LEVEL) {
      const sx = o.x - state.scroll;
      if (sx > CX + HIT.r || sx + o.w < CX - HIT.r) continue; // far away in x: skip the mask
      if (circleHitsMask(CX, cy, HIT.r, hitboxes.obstacles[o.name], sx, o.y)) return o.name;
    }
    return null;
  }

  // update() returns early in 'over', so this runs once per run (no doubled sounds).
  function end(result, hitBy = null) {
    state.phase = 'over';
    state.result = result;
    state.hitBy = hitBy;
    onEnd(result, hitBy); // main.js: endcard + sounds (M5/M6)
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
