import { STAGE, PLAYER, GUT, PHYSICS, BLEED_GUT_BAND } from '../core/config.js';
import { LEVEL, PLAYER_HIT } from '../core/level.js';
import hitboxes from '../data/hitboxes.json';
import { debugFlags } from '../dev/debug.js';

const MAX_DPR = 2; // 3x adds ~2.25x the pixels per frame for almost no visible gain

const lerp = (a, b, t) => a + (b - a) * t;

// The gut shows below the headline band, and in the side bleed only within the navy band
// (no clouds out there to cover its top and bottom). 1 px overlap so the joints leave no hairline.
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

// Only the visible slice of the 5056 px image. The source rect is clamped because older
// Safari draws nothing when it reaches outside the image.
function drawGut(ctx, view, img, scroll) {
  const k = img.naturalWidth / GUT.width;
  const x0 = Math.max(view.left, -scroll);
  const x1 = Math.min(view.left + view.width, GUT.width - scroll);
  if (x1 <= x0) return;
  ctx.drawImage(img, (x0 + scroll) * k, 0, (x1 - x0) * k, img.naturalHeight,
    x0, 0, x1 - x0, STAGE.h);
}

function drawObstacles(ctx, view, images, scroll) {
  const right = view.left + view.width;
  for (const o of LEVEL) {
    const x = o.x - scroll;
    if (x + o.w < view.left || x > right) continue;
    ctx.drawImage(images.obstacles[o.name], x, o.y, o.w, o.h);
  }
}

// Scaled around their centre, so the pop shrinks them in place.
function drawProps(ctx, props, images, scroll) {
  for (const o of props) {
    if (o.alpha <= 0 || o.scale <= 0) continue;
    const cx = o.x - scroll + o.w / 2;
    const cy = o.y + o.h / 2;
    ctx.save();
    ctx.globalAlpha = o.alpha;
    ctx.translate(cx, cy);
    ctx.scale(o.scale, o.scale);
    ctx.drawImage(images.obstacles[o.name], -o.w / 2, -o.h / 2, o.w, o.h);
    ctx.restore();
  }
}

// Gentle bob during get ready, so the ignored taps don't look like a freeze. Drawing only.
const BOB = { amp: 1.5, hz: 2 };
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
function bobOffset(state) {
  if (state.phase !== 'getReady' || (reducedMotion && reducedMotion.matches)) return 0;
  return Math.sin(state.runTime * BOB.hz * 2 * Math.PI) * BOB.amp;
}

// ?debug=1: the masks the game really tests, not the image rectangles.
function drawMask(ctx, mask, mx, my) {
  for (let y = 0; y < mask.rows.length; y++) {
    const row = mask.rows[y];
    for (let i = 0; i < row.length; i += 2) {
      ctx.fillRect(mx + row[i] / 2, my + y / 2, (row[i + 1] - row[i]) / 2, 0.5);
    }
  }
}

function drawHitboxes(ctx, view, state, scroll, y) {
  const right = view.left + view.width;
  ctx.fillStyle = 'rgba(255, 0, 80, 0.45)';
  drawMask(ctx, hitboxes.clouds, hitboxes.clouds.x / 2, 0);
  ctx.fillStyle = 'rgba(0, 200, 255, 0.6)'; // cyan: pink would vanish on the pink texts
  for (const o of LEVEL) {
    const x = o.x - scroll;
    if (x + o.w < view.left || x > right) continue;
    drawMask(ctx, hitboxes.obstacles[o.name], x, o.y);
  }
  ctx.beginPath();
  ctx.arc(PLAYER_HIT.cx, y + PLAYER_HIT.dy, PLAYER_HIT.r, 0, 2 * Math.PI);
  ctx.fillStyle = state.result === 'fail' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 255, 120, 0.5)';
  ctx.fill();
}

export function createCanvas(gameEl) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  gameEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // On its own canvas above the whole stage: border.png covers the game canvas and would hide
  // the cloud masks.
  let dbg = null;
  if (debugFlags.debug) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;top:0;pointer-events:none;';
    gameEl.parentNode.appendChild(c);
    dbg = { canvas: c, ctx: c.getContext('2d') };
  }
  const sized = dbg ? [canvas, dbg.canvas] : [canvas];
  let view = { left: 0, width: STAGE.w, ratio: 1 };

  function resize(fit, vw) {
    // Visible part of the screen in stage px: wider than the stage with side bleed,
    // so the gut runs on into the bleed.
    const left = Math.min(0, -fit.x / fit.scale);
    const width = Math.max(STAGE.w, vw / fit.scale);
    const ratio = fit.scale * Math.min(window.devicePixelRatio || 1, MAX_DPR);

    for (const c of sized) {
      c.width = Math.round(width * ratio);
      c.height = Math.round(STAGE.h * ratio);
      c.style.left = `${left}px`;
      c.style.width = `${width}px`;
      c.style.height = `${STAGE.h}px`;
    }
    view = { left, width, ratio };
  }

  function draw(state, images, alpha, props = [], intro = { dy: 0, scale: 1, alpha: 1 }) {
    const v = view;
    ctx.setTransform(v.ratio, 0, 0, v.ratio, -v.left * v.ratio, 0); // 1 unit = 1 stage px
    ctx.clearRect(v.left, 0, v.width, STAGE.h);

    ctx.save();
    clipPlayfield(ctx, v);
    const scroll = lerp(state.prevScroll, state.scroll, alpha);
    drawGut(ctx, v, images.gut, scroll);
    drawProps(ctx, props, images, scroll);
    drawObstacles(ctx, v, images, scroll);

    const p = state.player;
    const y = lerp(p.prevY, p.y, alpha);
    const tilt = (p.vy / PHYSICS.maxFall) * PLAYER.maxTilt;
    ctx.save();
    ctx.globalAlpha = intro.alpha;
    ctx.translate(PLAYER.x + PLAYER.w / 2, y + intro.dy + bobOffset(state) + PLAYER.h / 2);
    ctx.rotate(tilt);
    ctx.scale(intro.scale, intro.scale);
    ctx.drawImage(images.player, -PLAYER.w / 2, -PLAYER.h / 2, PLAYER.w, PLAYER.h);
    ctx.restore();

    ctx.restore();

    if (dbg) {
      const d = dbg.ctx;
      d.setTransform(v.ratio, 0, 0, v.ratio, -v.left * v.ratio, 0);
      d.clearRect(v.left, 0, v.width, STAGE.h);
      drawHitboxes(d, v, state, scroll, y);
    }
  }

  return { canvas, ctx, resize, draw, get view() { return view; } };
}
