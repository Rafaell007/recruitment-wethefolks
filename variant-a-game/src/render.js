// Canvas for the playfield (gut, obstacles, player). Lives in #game, between the texture and border.png.
import { STAGE, PLAYER, GUT, PHYSICS, BLEED_GUT_BAND } from './config.js';

const MAX_DPR = 2; // 3x phones: ~2.25x more pixels to fill each frame for almost no visible gain

const lerp = (a, b, t) => a + (b - a) * t;

// Where the gut may show: the stage below the navy headline band, and in the side bleed only
// the navy gut band (out there no clouds of border.png hide the gut's top and bottom).
// The bleed rects overlap the stage by 1 px, so their joint can't leave a hairline.
function clipPlayfield(ctx, view) {
  const right = view.left + view.width;
  const L = BLEED_GUT_BAND.left;
  const R = BLEED_GUT_BAND.right;
  ctx.beginPath();
  ctx.rect(0, GUT.clipTop, STAGE.w, STAGE.h - GUT.clipTop);
  ctx.rect(view.left, L.top, 1 - view.left, L.bottom - L.top);
  ctx.rect(STAGE.w - 1, R.top, right - STAGE.w + 1, R.bottom - R.top);
  ctx.clip();
}

// Draws only the visible slice of the 5056 px wide image. The source rect is clamped to the
// image: older Safari draws nothing at all when it reaches outside.
function drawGut(ctx, view, img, scroll) {
  const k = img.naturalWidth / GUT.width; // 2: asset px per stage px
  const x0 = Math.max(view.left, -scroll); // visible part of the image, in stage px
  const x1 = Math.min(view.left + view.width, GUT.width - scroll);
  if (x1 <= x0) return;
  ctx.drawImage(img, (x0 + scroll) * k, 0, (x1 - x0) * k, img.naturalHeight,
    x0, 0, x1 - x0, STAGE.h);
}

export function createCanvas(gameEl) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  gameEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let view = { left: 0, width: STAGE.w, ratio: 1 };

  // fit = { scale, x, y } from stage.js, vw = visible screen width in CSS px.
  function resize(fit, vw) {
    // Visible part of the screen in stage px. With side bleed it is wider than the stage,
    // so the gut continues into the bleed instead of ending in a hard vertical cut.
    const left = Math.min(0, -fit.x / fit.scale);
    const width = Math.max(STAGE.w, vw / fit.scale);
    // Canvas pixels per stage px: stage scale × screen density, so it is sharp on every phone.
    const ratio = fit.scale * Math.min(window.devicePixelRatio || 1, MAX_DPR);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(STAGE.h * ratio);
    canvas.style.left = `${left}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${STAGE.h}px`;
    view = { left, width, ratio };
  }

  // state comes from game.js, alpha from the loop (0..1 between the last two physics steps).
  function draw(state, images, alpha) {
    const v = view;
    // 1 unit = 1 stage px; the canvas starts at v.left, so shift by it.
    ctx.setTransform(v.ratio, 0, 0, v.ratio, -v.left * v.ratio, 0);
    ctx.clearRect(v.left, 0, v.width, STAGE.h);

    ctx.save();
    clipPlayfield(ctx, v);
    drawGut(ctx, v, images.gut, lerp(state.prevScroll, state.scroll, alpha));

    const p = state.player;
    const y = lerp(p.prevY, p.y, alpha);
    // Visual tilt only (the hitbox is a circle): nose up when rising, down when falling.
    const tilt = (p.vy / PHYSICS.maxFall) * PLAYER.maxTilt;
    ctx.translate(PLAYER.x + PLAYER.w / 2, y + PLAYER.h / 2);
    ctx.rotate(tilt);
    ctx.drawImage(images.player, -PLAYER.w / 2, -PLAYER.h / 2, PLAYER.w, PLAYER.h);
    ctx.restore();
  }

  return { canvas, ctx, resize, draw, get view() { return view; } };
}
