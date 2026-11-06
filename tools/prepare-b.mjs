// Turns the fireplace's original assets into the files the three ads ship.
//
//   node tools/prepare-b.mjs        (after tools/measure-b.mjs)
//
// - Background: one slice of bg-big.jpg per part, so each ad loads only its own piece of the one
//   continuous surface. Each slice reaches past its part as far as the shared camera move can show
//   (tools/lib/overscan.mjs, settings in src/data/fireplace.json).
//   The slices are cut losslessly with jpegtran (JPEG blocks copied, nothing re-encoded): bg-big is
//   already a compressed photo of noisy moss, and re-encoding it fell below 40 dB at q80 and only
//   passed at sizes above the lossless cut. jpegtran snaps the cut's top-left corner to the 16 px
//   JPEG block grid, so a slice may start a few px earlier than asked; layout.json uses the real
//   corner. Run through npx (pinned) so its old download tooling stays out of the project's deps.
// - box.png, cta.png and the side copy (hl.png) were exported without transparency: pure black
//   becomes transparent, every other pixel stays as it is. The panel also gets the opacity measured
//   in the design, baked into its alpha.
// - Full-frame layers (640x1950 / 2064x500, mostly empty) are cropped to their pixels, rounded out
//   to whole CSS px. Less to decode and less GPU memory when they animate.
// - Every file is compressed with the same PSNR check as Variant A (tools/lib/encode.mjs).
//
// Writes variant-b-fireplace/assets-opt/, src/data/layout.json (where each file goes, CSS px of its
// part) and reports/prepare-variant-b-fireplace.md.
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { loadRGBA, alphaBBox, keyOutBlack, evenBox, psnr } from './lib/image.mjs';
import { encodeBest, MIN_PSNR } from './lib/encode.mjs';
import { sliceRect } from './lib/overscan.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = join(ROOT, 'variant-b-fireplace');
const SRC = join(DIR, 'assets');
const OUT = join(DIR, 'assets-opt');
const DATA = join(DIR, 'src', 'data');
const run = promisify(exec);
const JPEGTRAN = '--yes jpegtran-bin@7.0.0';
const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));

const fireplace = await readJson(join(DATA, 'fireplace.json'));
const measured = await readJson(join(DATA, 'measured.json'));

const crop = (img, r) => {
  const data = Buffer.alloc(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) img.data.copy(data, y * r.w * 4, ((r.y + y) * img.width + r.x) * 4, ((r.y + y) * img.width + r.x + r.w) * 4);
  return { data, width: r.w, height: r.h };
};

const withOpacity = (img, opacity) => {
  const data = Buffer.from(img.data);
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return { data, width: img.width, height: img.height };
};

const rows = [];
async function ship(name, pixels, type, sourceFile) {
  const best = await encodeBest(pixels, type);
  if (!best) throw new Error(`${name}: no encoding reached ${MIN_PSNR} dB`);
  const dst = join(OUT, name);
  await mkdir(dirname(dst), { recursive: true });
  await writeFile(dst, best.buf);
  rows.push({ name, source: sourceFile, before: (await stat(join(SRC, sourceFile))).size, after: best.buf.length, method: best.method, psnr: best.psnr, maxErr: best.maxErr });
  console.log(`${name.padEnd(16)} ${pixels.width}x${pixels.height}  ${(best.buf.length / 1024).toFixed(1)} KB  ${best.method}  ${best.psnr.toFixed(1)} dB`);
}

/** Crops a full-frame layer to its pixels and ships it; returns its place in the part in CSS px. */
async function layer(name, img, sourceFile) {
  const box = evenBox(alphaBBox(img));
  await ship(name, crop(img, box), 'png', sourceFile);
  return { src: name, x: box.x / 2, y: box.y / 2, w: box.w / 2, h: box.h / 2 };
}

/** Lossless crop of bg-big; returns the slice's real rect in fireplace CSS px. */
async function backgroundSlice(name, big, want, part) {
  const dst = join(OUT, name);
  await mkdir(dirname(dst), { recursive: true });
  const a = { x: want.x * 2, y: want.y * 2, w: want.w * 2, h: want.h * 2 };
  await run(`npx ${JPEGTRAN} -copy none -progressive -crop ${a.w}x${a.h}+${a.x}+${a.y} -outfile "${dst}" "${join(SRC, 'bg-big.jpg')}"`);
  const out = await loadRGBA(dst);
  // The right/bottom edges stay where asked, so any extra size is how far the corner moved.
  const got = { x: a.x + a.w - out.width, y: a.y + a.h - out.height, w: out.width, h: out.height };
  // Inside the part itself (what is on screen at rest) the slice must equal bg-big exactly.
  const onScreen = { x: part.x * 2 - got.x, y: part.y * 2 - got.y, w: part.w * 2, h: part.h * 2 };
  const exact = psnr(crop(big, { ...onScreen, x: part.x * 2, y: part.y * 2 }), crop(out, onScreen));
  if (exact.maxErr !== 0) throw new Error(`${name}: on-screen pixels differ from bg-big (max err ${exact.maxErr})`);
  const q = psnr(crop(big, got), out);
  rows.push({ name, source: 'bg-big.jpg', before: (await stat(join(SRC, 'bg-big.jpg'))).size, after: (await stat(dst)).size, method: 'jpegtran lossless crop', ...q });
  console.log(`${name.padEnd(16)} ${got.w}x${got.h}  ${((await stat(dst)).size / 1024).toFixed(1)} KB  lossless, on screen identical`);
  return { x: got.x / 2, y: got.y / 2, w: got.w / 2, h: got.h / 2 };
}

// ---------------------------------------------------------------- main

await rm(OUT, { recursive: true, force: true });
const layout = {};

const big = await loadRGBA(join(SRC, 'bg-big.jpg'));
const bounds = { w: big.width / 2, h: big.height / 2 };
const slices = {};
for (const [part, rect] of Object.entries(fireplace.parts)) {
  const s = await backgroundSlice(`${part}/bg.jpg`, big, sliceRect(rect, fireplace.camera, bounds), rect);
  slices[part] = s;
  layout[part] = { bg: { src: `${part}/bg.jpg`, x: s.x - rect.x, y: s.y - rect.y, w: s.w, h: s.h } };
}

layout.top.hl = await layer('top/hl.png', await loadRGBA(join(SRC, 'top/hl.png')), 'top/hl.png');

// Shared by both skyscrapers: written once, each part's build copies what it uses.
const panel = withOpacity(keyOutBlack(await loadRGBA(join(SRC, 'box.png'))), measured.boxOpacity);
const panelBox = evenBox(alphaBBox(panel));
await ship('box.png', crop(panel, panelBox), 'png', 'box.png');
const cta = keyOutBlack(await loadRGBA(join(SRC, 'cta.png')));
await ship('cta.png', cta, 'png', 'cta.png');

for (const part of ['left', 'right']) {
  layout[part].logo = await layer(`${part}/logo.png`, await loadRGBA(join(SRC, `${part}/logo.png`)), `${part}/logo.png`);
  layout[part].box = { src: 'box.png', x: panelBox.x / 2, y: panelBox.y / 2, w: panelBox.w / 2, h: panelBox.h / 2 };
  layout[part].hl = await layer(`${part}/hl.png`, keyOutBlack(await loadRGBA(join(SRC, `${part}/hl.png`))), `${part}/hl.png`);
  layout[part].cta = { src: 'cta.png', x: measured.cta.x, y: measured.cta.y, w: cta.width / 2, h: cta.height / 2 };
}

await writeFile(join(DATA, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');

// ---------------------------------------------------------------- report

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
const byPart = (p) => [...new Set(Object.values(layout[p]).map((l) => l.src))];
const size = (name) => rows.find((r) => r.name === name).after;
const md = [
  '# Asset preparation – variant-b-fireplace',
  '',
  'Generated by `node tools/prepare-b.mjs`. Source: `variant-b-fireplace/assets/` (untouched originals) → `variant-b-fireplace/assets-opt/`.',
  `Quality check: PSNR on premultiplied RGBA against the prepared (sliced / keyed / cropped) image, minimum ${MIN_PSNR} dB.`,
  'Background slices: pixel-identical to bg-big inside the part (checked, max err 0). The PSNR / max err below come only from the outermost pixel row of each cut edge, which lies in the off-screen margin.',
  '',
  '| file | from | original file | shipped | method | PSNR | max err |',
  '|---|---|---:|---:|---|---:|---:|',
  ...rows.map((r) => `| ${r.name} | ${r.source} | ${kb(r.before)} | ${kb(r.after)} | ${r.method} | ${r.psnr === Infinity ? '∞' : r.psnr.toFixed(1) + ' dB'} | ${r.maxErr} |`),
  '',
  '## Background slices',
  '',
  `Camera: scale 1–${fireplace.camera.maxScale} around ${fireplace.camera.origin.join(', ')}, drift ±${fireplace.camera.maxDrift} px (fireplace CSS px).`,
  '',
  '| part | part in fireplace | slice in fireplace | extra |',
  '|---|---|---|---|',
  ...Object.entries(fireplace.parts).map(([p, r]) => {
    const s = slices[p];
    return `| ${p} | ${r.x}, ${r.y} (${r.w} x ${r.h}) | ${s.x}, ${s.y} (${s.w} x ${s.h}) | left ${r.x - s.x}, right ${s.x + s.w - r.x - r.w}, bottom ${s.y + s.h - r.y - r.h} |`;
  }),
  '',
  '## Images per ad',
  '',
  '| part | files | images total |',
  '|---|---|---:|',
  ...['left', 'top', 'right'].map((p) => `| ${p} | ${byPart(p).join(', ')} | ${kb(byPart(p).reduce((s, n) => s + size(n), 0))} |`),
  '',
].join('\n');
await writeFile(join(ROOT, 'reports', 'prepare-variant-b-fireplace.md'), md);
