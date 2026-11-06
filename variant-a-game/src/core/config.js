// All game constants in one place. Positions come from measured.json (tools/measure.mjs);
// physics numbers are first guesses, tuned in M8.
import { variantA as M } from '../data/measured.json';

export const STAGE = { w: 360, h: 640 };

export const PLAYER = {
  x: M.player.x,      // 55.5: the fixed vertical line (D6)
  startY: M.player.y, // 258.5, as in design/01-start.png
  w: M.player.w,      // 42
  h: M.player.h,      // 41
  maxTilt: 0.35,      // rad (~20°) at full fall speed; visual only, the hitbox is a circle
};

export const GUT = {
  startScroll: M.gut.scrollX,              // 2: the design shows the image shifted 2 px left
  width: STAGE.w + M.gut.scrollLength,     // 2528
  // Gut hidden under the navy headline band. 168.5 is the top edge of border.png; its outermost
  // pixel row is soft when scaled (alpha 252, then blurred by resampling), so the gut showed
  // through as a light line. 1 px lower the frame is fully opaque (alpha 255 from y=169).
  // Measured: +0.5 still leaks at DPR 1 and 3, +1 is clean on every tested screen.
  clipTop: M.playfieldClipTop + 1,         // 169.5
};

// Navy gut band of the side bleed (outermost columns of border.png, see styles/stage.css .bleed).
export const BLEED_GUT_BAND = {
  left: { top: 223, bottom: 574 },
  right: { top: 226, bottom: 571.5 },
};

export const PHYSICS = {
  gravity: 1400,      // px/s²
  jumpVelocity: -380, // px/s → jump height v²/2g ≈ 52 px ≈ 1.3 × player height
  maxFall: 520,       // px/s, so a long fall stays readable
};

export const SPEED = { start: 110, end: 150 }; // px/s world scroll, ramped by distance (level.js)
// Get ready (task: "a short 'get ready' moment before obstacles arrive"): after the first tap the
// start screen's obstacles pop away, the gut eases into motion from standstill and the player
// hovers over an empty gut. Gravity starts after `hover`; the first obstacle comes ~1.3 s later.
export const GET_READY = {
  easeIn: 0.6, // s from standstill to full speed
  hover: 1.5,  // s
};
export const STEP = 1 / 120;                   // s, fixed physics step (same jump at 60/90/120 Hz)
