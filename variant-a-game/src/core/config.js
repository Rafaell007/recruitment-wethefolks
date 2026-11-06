import { variantA as M } from '../data/measured.json';

export const STAGE = { w: 360, h: 640 };

export const PLAYER = {
  x: M.player.x,
  startY: M.player.y,
  w: M.player.w,
  h: M.player.h,
  maxTilt: 0.35, // rad at full fall speed, drawing only
};

export const GUT = {
  startScroll: M.gut.scrollX,
  width: STAGE.w + M.gut.scrollLength,
  // border.png's top row turns semi-transparent when scaled and the gut leaked through it.
  // +1 px was the first value that stayed clean at every tested DPR.
  clipTop: M.playfieldClipTop + 1,
};

// Navy gut band at the outermost columns of border.png.
export const BLEED_GUT_BAND = {
  left: { top: 223, bottom: 574 },
  right: { top: 226, bottom: 571.5 },
};

export const PHYSICS = {
  gravity: 1400,      // px/s²
  jumpVelocity: -380, // px/s, jump height v²/2g ≈ 52 px
  maxFall: 520,       // px/s
};

export const SPEED = { start: 110, end: 150 }; // px/s

export const GET_READY = {
  easeIn: 0.6, // s
  hover: 1.5,  // s
};

export const STEP = 1 / 120; // s, fixed physics step
