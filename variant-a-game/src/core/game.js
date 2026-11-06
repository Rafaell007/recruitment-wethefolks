import { STAGE, PLAYER, GUT, PHYSICS, GET_READY } from './config.js';
import { LEVEL, PLAYER_HIT as HIT, rampSpeed } from './level.js';
import hitboxes from '../data/hitboxes.json';
import { circleHitsMask } from './collision.js';

const CX = HIT.cx;

// onEnd(result, hitBy) fires once per run: 'win' | 'fail', hitBy 'clouds' | obstacle name.
export function createGame({ onEnd = () => {} } = {}) {
  const state = {
    phase: 'ready', // 'ready' | 'getReady' | 'playing' | 'over'
    runTime: 0,
    result: null,
    hitBy: null,
    scroll: GUT.startScroll,
    prevScroll: GUT.startScroll,
    player: { y: PLAYER.startY, prevY: PLAYER.startY, vy: 0 },
  };
  let scrollEnd = GUT.width - STAGE.w;

  function reset() {
    state.phase = 'ready';
    state.runTime = 0;
    state.result = state.hitBy = null;
    state.scroll = state.prevScroll = GUT.startScroll;
    const p = state.player;
    p.y = p.prevY = PLAYER.startY;
    p.vy = 0;
  }

  function jump() {
    if (state.phase === 'ready') {
      state.phase = 'getReady';
      return;
    }
    if (state.phase !== 'playing') return;
    state.player.vy = PHYSICS.jumpVelocity; // set, not added: double taps can't stack
  }

  function update(dt) {
    const p = state.player;
    state.prevScroll = state.scroll;
    p.prevY = p.y;
    if (state.phase !== 'getReady' && state.phase !== 'playing') return;

    state.runTime += dt;
    const k = Math.min(state.runTime / GET_READY.easeIn, 1);
    const ease = k * k * (3 - 2 * k); // smoothstep
    state.scroll = Math.min(state.scroll + rampSpeed(state.scroll, scrollEnd) * ease * dt, scrollEnd);

    if (state.phase === 'getReady') {
      if (state.runTime >= GET_READY.hover) state.phase = 'playing';
    } else {
      // Semi-implicit Euler: velocity first, then position.
      p.vy = Math.min(p.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
      p.y += p.vy * dt;
    }

    const hit = touching();
    if (hit) return end('fail', hit);
    if (state.scroll >= scrollEnd) end('win');
  }

  function touching() {
    const cy = state.player.y + HIT.dy;
    if (circleHitsMask(CX, cy, HIT.r, hitboxes.clouds, hitboxes.clouds.x / 2, 0)) return 'clouds';
    if (cy + HIT.r < 0 || cy - HIT.r > STAGE.h) return 'clouds'; // safety net
    for (const o of LEVEL) {
      const sx = o.x - state.scroll;
      if (sx > CX + HIT.r || sx + o.w < CX - HIT.r) continue;
      if (circleHitsMask(CX, cy, HIT.r, hitboxes.obstacles[o.name], sx, o.y)) return o.name;
    }
    return null;
  }

  function end(result, hitBy = null) {
    state.phase = 'over';
    state.result = result;
    state.hitBy = hitBy;
    onEnd(result, hitBy);
  }

  return {
    state,
    reset,
    jump,
    update,
    // The run ends when the gut's right edge reaches the visible right edge (past 360 with side bleed).
    setVisibleRight(visibleRight) {
      scrollEnd = GUT.width - visibleRight;
    },
  };
}
