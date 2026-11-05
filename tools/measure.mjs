// Measurements as code: every position and size the ad uses is derived here from the
// original assets and design files, so "measured, not by eye" can be re-checked at any time.
//
//   node tools/measure.mjs variant-a-game
//
// Writes <variant>/src/measured.json (read by the game config) and reports/measure-<variant>.md.
// All output values are CSS px = asset px / 2 (assets are exported at 2x).
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { loadRGBA, alphaBBox, locate } from './lib/image.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SCALE = 2; // asset px per CSS px
const css = (px) => px / SCALE;
const cssBox = (b) => b && { x: css(b.x), y: css(b.y), w: css(b.w), h: css(b.h) };
// A sprite counts as found in a design if its mean RGB difference over opaque pixels is below this.
const MATCH_THRESHOLD = 12;
// At or below this score a 1:1 match is treated as exact and no scaled search is run.
const EXACT_SCORE = 3;
// Two found sprites may not cover the same part of a design: if the overlap is more than this
// share of the smaller box, only the better-scoring sprite is kept (e.g. "Blut" inside "Tabu").
const MAX_OVERLAP = 0.5;

async function listImages(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const posix = (p) => p.split('\\').join('/');

/**
 * Template search over scales 0.5–1.2 (relative to the 50% render size): a quick coarse sweep
 * in 0.05 steps, then 0.01 steps around the best two, then a full-precision locate of the best three.
 */
async function locateScaled(file, design) {
  const meta = await sharp(file).metadata();
  const at = async (s, opts) => {
    const w = Math.round(meta.width * s), h = Math.round(meta.height * s);
    if (w > design.width || h > design.height || w < 4 || h < 4) return null;
    const { data, info } = await sharp(file).resize(w, h, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hit = locate(design, { data, width: info.width, height: info.height }, opts);
    return hit && { hit, scale: s };
  };
  const fast = { step: 4, samples: 300 };
  const sweep = async (from, to, by) => {
    const out = [];
    for (let s = from; s <= to + 1e-9; s += by) {
      const r = await at(+s.toFixed(2), fast);
      if (r) out.push(r);
    }
    return out.sort((p, q) => p.hit.score - q.hit.score);
  };
  const coarse = await sweep(0.5, 1.2, 0.05);
  if (coarse.length === 0) return null;
  const fine = [];
  for (const { scale } of coarse.slice(0, 2)) fine.push(...(await sweep(scale - 0.04, scale + 0.04, 0.01)));
  fine.sort((p, q) => p.hit.score - q.hit.score);
  // The fast pass scores a sparse sample; confirm the best three scales with a full-precision search.
  let best = null;
  for (const { scale } of fine.slice(0, 3)) {
    const r = await at(scale);
    if (r && (!best || r.hit.score < best.hit.score)) best = r;
  }
  return best;
}

function resolveOverlaps(images) {
  const found = Object.entries(images)
    .filter(([, e]) => e.inDesign && e.inDesign.found !== false)
    .sort((a, b) => a[1].inDesign.score - b[1].inDesign.score);
  const kept = [];
  for (const [rel, e] of found) {
    const a = e.inDesign;
    const clash = kept.find(([, k]) => {
      const b = k.inDesign;
      if (a.design !== b.design) return false;
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return (ix * iy) / Math.min(a.w * a.h, b.w * b.h) > MAX_OVERLAP;
    });
    if (clash) e.inDesign = { design: a.design, found: false, rejected: `overlaps ${clash[0]} (better match)` };
    else kept.push([rel, e]);
  }
}

// ---------------------------------------------------------------- Variant A

async function measureVariantA(variantDir) {
  const assetsDir = join(variantDir, 'assets');
  const designs = {
    start: await loadRGBA(join(variantDir, 'design/01-start.png')),
    fail: await loadRGBA(join(variantDir, 'design/02-fail-endcard.png')),
    win: await loadRGBA(join(variantDir, 'design/03-win-endcard.png')),
  };
  const { width: DW, height: DH } = designs.start;

  // Which design screen a cropped sprite has to be searched in.
  const designFor = (rel) => (rel.includes('02_endcard/fail') ? 'fail' : rel.includes('02_endcard/win') ? 'win' : 'start');

  const images = {};
  const loaded = {};
  for (const file of await listImages(assetsDir)) {
    const rel = posix(relative(assetsDir, file));
    const img = await loadRGBA(file);
    loaded[rel] = img;
    const fullFrame = img.width === DW && img.height === DH;
    const entry = {
      size: { w: css(img.width), h: css(img.height) },
      fullFrame, // full 720x1280 layer: placed at (0,0), the artwork is already positioned inside it
      bbox: cssBox(alphaBBox(img)),
    };
    if (!fullFrame && img.width <= DW && img.height <= DH) {
      const design = designFor(rel);
      let hit = locate(designs[design], img);
      let scale = 1;
      if (!hit || hit.score > EXACT_SCORE) {
        // Not an exact 1:1 match – the mockup may show the sprite scaled. Keep 1:1 unless a
        // scaled version fits clearly better.
        const scaled = await locateScaled(file, designs[design]);
        if (scaled && (!hit || scaled.hit.score < hit.score - 0.5)) ({ hit, scale } = scaled);
      }
      entry.inDesign = hit && hit.score < MATCH_THRESHOLD
        ? { design, x: css(hit.x), y: css(hit.y), w: +(css(img.width) * scale).toFixed(1), h: +(css(img.height) * scale).toFixed(1), scale, score: +hit.score.toFixed(2) }
        : { design, found: false };
    }
    images[rel] = entry;
  }
  resolveOverlaps(images);

  // --- Gut strip (gameplay.png is 5056 px wide): horizontal scroll offset shown in the start design.
  // Compare the design against the strip shifted by dx, on the strip's opaque pixels in the playfield.
  const gut = loaded['01_game/gameplay.png'];
  const border = loaded['border.png'];
  const borderBox = alphaBBox(border);
  const gutOffset = (() => {
    let best = { dx: 0, dy: 0, score: Infinity };
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -20; dx <= 200; dx++) {
        let s = 0, n = 0;
        for (let y = borderBox.y; y < DH; y += 2) {
          const gy = y - dy;
          if (gy < 0 || gy >= gut.height) continue;
          for (let x = 0; x < DW; x += 2) {
            const gx = x + dx;
            if (gx < 0 || gx >= gut.width) continue;
            const gi = (gy * gut.width + gx) * 4;
            if (gut.data[gi + 3] < 250) continue;
            const di = (y * DW + x) * 4;
            const d = designs.start.data;
            s += Math.abs(d[di] - gut.data[gi]) + Math.abs(d[di + 1] - gut.data[gi + 1]) + Math.abs(d[di + 2] - gut.data[gi + 2]);
            n += 3;
          }
        }
        if (n && s / n < best.score) best = { dx, dy, score: s / n };
      }
    }
    return { scrollX: css(best.dx), offsetY: css(best.dy), score: +best.score.toFixed(2) };
  })();

  // --- Player on the start screen.
  const player = images['01_game/player.png'].inDesign;
  if (!player || player.found === false) throw new Error('player.png not found in 01-start.png');
  const pw = images['01_game/player.png'].size.w;
  const ph = images['01_game/player.png'].size.h;
  const playerBox = { x: player.x, y: player.y, w: pw, h: ph, cx: player.x + pw / 2, cy: player.y + ph / 2 };

  // --- Playfield bounds: where the clouds of border.png begin above and below the player.
  // For each column the player covers, scan from the player's centre up and down until
  // border.png becomes visibly opaque (alpha >= 128). Values in CSS px of the screen.
  const ALPHA_EDGE = 128;
  const columnLimits = (xPx) => {
    const cyPx = Math.round(playerBox.cy * SCALE);
    let top = 0, bottom = DH;
    for (let y = cyPx; y >= 0; y--) if (border.data[(y * DW + xPx) * 4 + 3] >= ALPHA_EDGE) { top = y + 1; break; }
    for (let y = cyPx; y < DH; y++) if (border.data[(y * DW + xPx) * 4 + 3] >= ALPHA_EDGE) { bottom = y; break; }
    return { top: css(top), bottom: css(bottom) };
  };
  const span = (x0, x1) => {
    let top = -Infinity, bottom = Infinity;
    for (let x = Math.round(x0 * SCALE); x < Math.round(x1 * SCALE); x++) {
      const l = columnLimits(x);
      top = Math.max(top, l.top);
      bottom = Math.min(bottom, l.bottom);
    }
    return { top, bottom, free: bottom - top };
  };
  const bounds = {
    alphaEdge: ALPHA_EDGE,
    centerColumn: (() => { const l = columnLimits(Math.round(playerBox.cx * SCALE)); return { ...l, free: l.bottom - l.top }; })(),
    spriteColumns: span(playerBox.x, playerBox.x + pw),
  };

  return {
    images,
    variantA: {
      stage: { w: css(DW), h: css(DH) },
      player: playerBox,
      gut: { ...gutOffset, scrollLength: css(gut.width - DW) },
      // The gut strip reaches above the playfield; it is clipped at the top edge of border.png.
      playfieldClipTop: css(borderBox.y),
      bounds,
    },
  };
}

// ---------------------------------------------------------------- report

function markdown(variant, m) {
  const f = (v) => (v === undefined || v === null ? '' : String(v));
  const lines = [
    `# Measurements – ${variant}`,
    '',
    'Generated by `node tools/measure.mjs ' + variant + '`. All values in CSS px (asset px / 2).',
    '',
    '| asset | size | alpha bbox (x, y, w, h) | position in design (x, y) | match score |',
    '|---|---|---|---|---|',
  ];
  for (const [rel, e] of Object.entries(m.images)) {
    const bb = e.bbox ? `${e.bbox.x}, ${e.bbox.y}, ${e.bbox.w}, ${e.bbox.h}` : '–';
    let pos = e.fullFrame ? 'full-frame layer at 0, 0' : '';
    let sc = '';
    if (e.inDesign) {
      const d = e.inDesign;
      pos = d.found === false ? `not in ${d.design}${d.rejected ? ` (${d.rejected})` : ''}` : `${d.x}, ${d.y} (${d.design}${d.scale !== 1 ? `, **scale ${d.scale}**` : ''})`;
      sc = f(d.score);
    }
    lines.push(`| ${rel} | ${e.size.w}x${e.size.h} | ${bb} | ${pos} | ${sc} |`);
  }
  if (m.variantA) {
    const a = m.variantA;
    lines.push(
      '',
      '## Derived values',
      '',
      `- Stage: ${a.stage.w}x${a.stage.h}`,
      `- Player on start screen: x ${a.player.x}, y ${a.player.y}, ${a.player.w}x${a.player.h}, centre (${a.player.cx}, ${a.player.cy})`,
      `- Gut strip: scroll x ${a.gut.scrollX}, y offset ${a.gut.offsetY} (score ${a.gut.score}); scroll length to the end of the gut ${a.gut.scrollLength}`,
      `- Playfield clip top (top edge of border.png): ${a.playfieldClipTop}`,
      `- Cloud limits at the player's centre column: top ${a.bounds.centerColumn.top}, bottom ${a.bounds.centerColumn.bottom} (free ${a.bounds.centerColumn.free})`,
      `- Cloud limits across the player's sprite width: top ${a.bounds.spriteColumns.top}, bottom ${a.bounds.spriteColumns.bottom} (free ${a.bounds.spriteColumns.free})`,
      '',
      `Match score = mean absolute RGB difference (0–255) over the sprite's opaque pixels; below ${MATCH_THRESHOLD} counts as found.`,
    );
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- main

const variant = process.argv[2];
const MEASURERS = { 'variant-a-game': measureVariantA };
if (!MEASURERS[variant]) {
  console.error(`usage: node tools/measure.mjs <${Object.keys(MEASURERS).join('|')}>`);
  process.exit(1);
}

const t0 = performance.now();
const result = await MEASURERS[variant](join(ROOT, variant));
const json = { generatedBy: `node tools/measure.mjs ${variant}`, unit: 'CSS px (asset px / 2)', ...result };

await writeFile(join(ROOT, variant, 'src/measured.json'), JSON.stringify(json, null, 2) + '\n');
await mkdir(join(ROOT, 'reports'), { recursive: true });
const md = markdown(variant, result);
await writeFile(join(ROOT, 'reports', `measure-${variant}.md`), md);
console.log(md);
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
