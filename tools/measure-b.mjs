// Measurements for the fireplace, taken from design/layout.png and the original assets.
//
//   node tools/measure-b.mjs
//
// Writes variant-b-fireplace/src/data/measured.json (read by tools/prepare-b.mjs) and
// reports/measure-variant-b-fireplace.md. Output values are CSS px of the part they belong to.
//
// layout.png is a screenshot at roughly 0.97–0.98 scale, with a 4 px grey frame around each part,
// so every position is measured relative to that part's frame and divided by that part's scale.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { loadRGBA, keyOutBlack, locate } from './lib/image.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = join(ROOT, 'variant-b-fireplace');
const asset = (f) => join(DIR, 'assets', f);
const round2 = (v) => Math.round(v * 100) / 100;
const half = (v) => Math.round(v * 2) / 2;

const PART_SIZE = { left: [320, 975], top: [1032, 250], right: [320, 975] };

// ------------------------------------------------------------ frames

const isGrey = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
  return Math.abs(r - 128) <= 4 && Math.abs(g - 128) <= 4 && Math.abs(b - 128) <= 4 && Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2;
};

/** Runs of frame-grey pixels (at least 3 long) along a row or column: [[start, end], ...]. */
function greyRuns(img, { row, col }) {
  const n = row !== undefined ? img.width : img.height;
  const runs = [];
  let start = -1;
  for (let k = 0; k <= n; k++) {
    const grey = k < n && (row !== undefined ? isGrey(img, k, row) : isGrey(img, col, k));
    if (grey && start < 0) start = k;
    if (!grey && start >= 0) {
      if (k - start >= 3) runs.push([start, k - 1]);
      start = -1;
    }
  }
  return runs;
}

/** Interior of each part's frame in design px: { x, y, w, h, sx, sy }. */
function findFrames(design) {
  const side = greyRuns(design, { row: Math.round(design.height * 0.6) }); // below the top banner
  const band = greyRuns(design, { row: Math.round(design.height * 0.15) }); // through the top banner
  if (side.length !== 4 || band.length !== 4) throw new Error(`unexpected frame layout: ${JSON.stringify({ side, band })}`);
  const between = (runs, i) => ({ x: runs[i][1] + 1, w: runs[i + 1][0] - runs[i][1] - 1 });
  const left = between(side, 0);
  const top = between(band, 1);
  const right = between(side, 2);
  const vertical = (x) => {
    const r = greyRuns(design, { col: x });
    return { y: r[0][1] + 1, h: r[1][0] - r[0][1] - 1 };
  };
  const out = {};
  for (const [name, h] of [['left', left], ['top', top], ['right', right]]) {
    const v = vertical(h.x + Math.round(h.w / 2));
    out[name] = { ...h, ...v, sx: h.w / PART_SIZE[name][0], sy: v.h / PART_SIZE[name][1] };
  }
  return out;
}

const crop = (img, r) => {
  const data = Buffer.alloc(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) img.data.copy(data, y * r.w * 4, ((r.y + y) * img.width + r.x) * 4, ((r.y + y) * img.width + r.x + r.w) * 4);
  return { data, width: r.w, height: r.h };
};

const resized = async (img, w, h) => {
  const { data, info } = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

// ------------------------------------------------------------ layers in the design

/** Finds a layer (cropped to its pixels) inside one part of the design; returns its CSS box in the part. */
async function findLayer(design, frame, layer) {
  const part = crop(design, frame);
  const s = (frame.sx + frame.sy) / 2;
  const tpl = await resized(layer, Math.round((layer.width / 2) * s), Math.round((layer.height / 2) * s));
  const hit = locate(part, tpl, { step: 2 });
  if (!hit) return null;
  return { x: round2(hit.x / frame.sx), y: round2(hit.y / frame.sy), w: round2(tpl.width / frame.sx), h: round2(tpl.height / frame.sy), score: round2(hit.score) };
}

/** Crops a full-frame layer to its visible pixels; returns the image and its box in asset px. */
function trimmed(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return { img: crop(img, box), box };
}

// ------------------------------------------------------------ box opacity

/**
 * The text panel is see-through in the design. Over rows where the panel has no text, the design
 * is  colour·a + background·(1 − a). A per-channel least-squares fit of design vs background gives
 * a slope of (1 − a). The same fit over plain moss (no panel) gives the slope that blur and
 * resampling alone produce, which is used as the reference for "fully visible" background.
 */
function slope(design, bg, rows, xs) {
  const out = [];
  for (let c = 0; c < 3; c++) {
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const y of rows) {
      for (const x of xs) {
        const i = (y * design.width + x) * 4;
        const b = bg.data[i + c], d = design.data[i + c];
        n++; sx += b; sy += d; sxx += b * b; sxy += b * d;
      }
    }
    const k = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    out.push({ k, a: (sy - k * sx) / n });
  }
  return out;
}

async function boxOpacity(design, frame) {
  const part = crop(design, frame);
  const bg = await resized(await loadRGBA(asset('left/bg.jpg')), frame.w, frame.h); // the design was made on the pre-cut background
  const rowsAt = (from, to) => {
    const r = [];
    for (let y = Math.ceil(from * frame.sy); y <= Math.floor(to * frame.sy); y++) r.push(y);
    return r;
  };
  const xs = [];
  for (let x = Math.ceil(6 * frame.sx); x <= Math.floor(314 * frame.sx); x++) xs.push(x);
  // Panel without text: between its top edge and the first copy line, and below the CTA.
  const panel = slope(part, bg, [...rowsAt(749, 767), ...rowsAt(886, 909)], xs);
  // Plain moss above and below the panel (no product there).
  const moss = slope(part, bg, [...rowsAt(600, 735), ...rowsAt(925, 970)], xs);
  const alpha = panel.map((p, c) => 1 - p.k / moss[c].k);
  const opacity = alpha.reduce((s, v) => s + v, 0) / 3;
  const colour = panel.map((p) => Math.round(p.a / opacity));
  return { opacity: round2(opacity), perChannel: alpha.map(round2), mossSlope: moss.map((m) => round2(m.k)), colourInDesign: colour };
}

// ------------------------------------------------------------ left pre-cut vs bg-big

/** Where the pre-cut left background sits in bg-big, searched 1:1 in asset px. */
async function leftOffset() {
  const big = await loadRGBA(asset('bg-big.jpg'));
  const pre = await loadRGBA(asset('left/bg.jpg'));
  let best = { dx: 0, dy: 0, diff: Infinity };
  for (let dy = -16; dy <= 16; dy++) {
    for (let dx = 0; dx <= 16; dx++) {
      let sum = 0, n = 0;
      for (let y = Math.max(0, -dy) + 40; y < pre.height - 40; y += 7) {
        for (let x = 0; x < pre.width - 16; x += 5) {
          const i = (y * pre.width + x) * 4, j = ((y + dy) * big.width + x + dx) * 4;
          sum += Math.abs(pre.data[i] - big.data[j]) + Math.abs(pre.data[i + 1] - big.data[j + 1]) + Math.abs(pre.data[i + 2] - big.data[j + 2]);
          n += 3;
        }
      }
      if (sum / n < best.diff) best = { dx, dy, diff: round2(sum / n) };
    }
  }
  return best;
}

// ------------------------------------------------------------ main

const design = await loadRGBA(join(DIR, 'design', 'layout.png'));
const frames = findFrames(design);
console.log('frames', frames);

const cta = keyOutBlack(await loadRGBA(asset('cta.png')));
const layers = {};
for (const part of ['left', 'right']) {
  const logo = trimmed(await loadRGBA(asset(`${part}/logo.png`)));
  const hl = trimmed(keyOutBlack(await loadRGBA(asset(`${part}/hl.png`))));
  const css = (b) => ({ x: b.x / 2, y: b.y / 2, w: b.w / 2, h: b.h / 2 });
  layers[part] = {
    cta: await findLayer(design, frames[part], cta),
    logo: { asset: css(logo.box), design: await findLayer(design, frames[part], logo.img) },
    hl: { asset: css(hl.box), design: await findLayer(design, frames[part], hl.img) },
  };
  console.log(part, layers[part]);
}
const box = await boxOpacity(design, frames.left);
console.log('box', box);
const offset = await leftOffset();
console.log('left pre-cut in bg-big', offset);

// The CTA is the same layer in the same panel on both sides: one position, the mean of both
// measurements, rounded to 0.5 CSS px (= whole device pixels at 2x).
const measured = {
  cta: { x: half((layers.left.cta.x + layers.right.cta.x) / 2), y: half((layers.left.cta.y + layers.right.cta.y) / 2) },
  boxOpacity: box.opacity,
  // For the dev overlay: each part's frame interior inside layout.png, in design px.
  design: { w: design.width, h: design.height },
  frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, { x: v.x, y: v.y, w: v.w, h: v.h }])),
};
await mkdir(join(DIR, 'src', 'data'), { recursive: true });
await writeFile(join(DIR, 'src', 'data', 'measured.json'), JSON.stringify(measured, null, 2) + '\n');

const f = (b) => (b ? `${b.x}, ${b.y} (${b.w} x ${b.h})` : 'not found');
const md = [
  '# Measurements – variant-b-fireplace',
  '',
  'Generated by `node tools/measure-b.mjs`. CSS px inside each part; design positions are divided by that part\'s own scale.',
  '',
  '## Design frames (layout.png)',
  '',
  '| part | interior in design px | scale x | scale y |',
  '|---|---|---:|---:|',
  ...Object.entries(frames).map(([k, v]) => `| ${k} | ${v.x}, ${v.y} (${v.w} x ${v.h}) | ${v.sx.toFixed(3)} | ${v.sy.toFixed(3)} |`),
  '',
  '## Layers',
  '',
  'Full-frame layers already carry their position; the design column is a cross-check (score = mean RGB difference, 0 = perfect).',
  '',
  '| part | layer | asset | design | score |',
  '|---|---|---|---|---:|',
  ...['left', 'right'].flatMap((p) => [
    `| ${p} | cta | – | ${f(layers[p].cta)} | ${layers[p].cta?.score} |`,
    `| ${p} | logo | ${f(layers[p].logo.asset)} | ${f(layers[p].logo.design)} | ${layers[p].logo.design?.score} |`,
    `| ${p} | copy (hl) | ${f(layers[p].hl.asset)} | ${f(layers[p].hl.design)} | ${layers[p].hl.design?.score} |`,
  ]),
  '',
  `CTA used on both sides (mean of left and right, rounded to 0.5 px): ${measured.cta.x}, ${measured.cta.y}. Size = asset at 50% (172.5 x 46.5).`,
  '',
  '## Text panel opacity',
  '',
  `Least-squares fit over panel rows without text, against the pre-cut background the design was made on: opacity **${box.opacity}** (R, G, B: ${box.perChannel.join(', ')}). Reference slope over plain moss: ${box.mossSlope.join(', ')}. Panel colour implied by the design: rgb(${box.colourInDesign.join(', ')}); asset: rgb(15, 108, 161).`,
  '',
  '## Left pre-cut background vs bg-big',
  '',
  `Best 1:1 match of left/bg.jpg inside bg-big.jpg: offset ${offset.dx}, ${offset.dy} asset px (mean difference ${offset.diff}). bg-big is 1680 = 320 + 4 + 1032 + 4 + 320 CSS px wide, so the left part starts at x = 0 of bg-big. The pre-cut file is shifted by 2, 6 CSS px; that shift is not reproduced: bg-big is exactly 975 px high, so only an offset of 0, 0 lets all three parts tile it.`,
  '',
].join('\n');
await writeFile(join(ROOT, 'reports', 'measure-variant-b-fireplace.md'), md);
