// Hitboxes as code: collision shapes are measured from the alpha of the shipped assets
// (assets-opt/), at build time. Reading pixels in the browser (getImageData) would throw on
// images served from another domain without CORS headers, which is common for ad CDNs.
//
//   node tools/hitboxes.mjs variant-a-game
//
// Writes <variant>/src/data/hitboxes.json. Everything is in asset px (2x); the game converts.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadRGBA } from './lib/image.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const ALPHA = 128; // the same "is this pixel visible" threshold as the cloud limits in measure.mjs

// One row of the mask = list of opaque runs [x0, x1) in asset px.
// Collision later asks: does the player's circle cover any run in the rows it spans?
// Only columns [from, to) are scanned; the runs are stored relative to `from`.
function rowSpans(img, from = 0, to = img.width) {
  const rows = [];
  for (let y = 0; y < img.height; y++) {
    const row = [];
    let start = -1;
    for (let x = from; x <= to; x++) {
      const opaque = x < to && img.data[(y * img.width + x) * 4 + 3] >= ALPHA;
      if (opaque && start < 0) start = x - from;
      if (!opaque && start >= 0) { row.push(start, x - from); start = -1; }
    }
    rows.push(row);
  }
  return rows;
}

// Largest circle that fits inside the opaque pixels: for every opaque pixel centre, the distance
// to the nearest clear pixel (its square, not its centre). Outside the image counts as clear.
// Circle ⊂ visible player, so a hit can only happen where the poo is really drawn.
function inscribedCircle(img) {
  const { width: w, height: h, data } = img;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] >= ALPHA;
  const clear = [];
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!opaque(x, y)) clear.push(x, y);

  let best = { x: 0, y: 0, r: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      let r2 = Infinity;
      for (let i = 0; i < clear.length; i += 2) {
        const dx = Math.max(Math.abs(clear[i] - x) - 0.5, 0);
        const dy = Math.max(Math.abs(clear[i + 1] - y) - 0.5, 0);
        r2 = Math.min(r2, dx * dx + dy * dy);
      }
      if (r2 > best.r * best.r) best = { x: x + 0.5, y: y + 0.5, r: Math.sqrt(r2) };
    }
  }
  return best; // asset px
}

// ---------------------------------------------------------------- main

const OBSTACLES = ['bac1', 'bac2', 'bac3', 'bac4', 'bac5', 'bac6',
  'txt1', 'txt2', 'txt3', 'txt4', 'txt5', 'txt6', 'txt7', 'txt8', 'txt9'];

const variant = process.argv[2];
if (variant !== 'variant-a-game') {
  console.error('usage: node tools/hitboxes.mjs variant-a-game');
  process.exit(1);
}
const dir = join(ROOT, variant);
const assets = join(dir, 'assets-opt');
const { variantA: measured } = JSON.parse(await readFile(join(dir, 'src/data/measured.json'), 'utf8'));

const player = await loadRGBA(join(assets, '01_game/player.png'));
const circle = inscribedCircle(player);

const obstacles = {};
for (const name of OBSTACLES) {
  const img = await loadRGBA(join(assets, `01_game/${name}.png`));
  obstacles[name] = { w: img.width, h: img.height, rows: rowSpans(img) };
}

// Clouds: border.png is full-screen, but the player never leaves its column (D6), so only the
// columns of the player's sprite are kept. The circle (incl. its shift when tilted) stays inside.
const border = await loadRGBA(join(assets, 'border.png'));
const from = measured.player.x * 2;
const to = from + player.width;
const clouds = { x: from, w: to - from, h: border.height, rows: rowSpans(border, from, to) };

const round = (v) => Math.round(v * 100) / 100;
const json = {
  generatedBy: `node tools/hitboxes.mjs ${variant}`,
  unit: 'asset px (2x); rows[y] = opaque runs [x0, x1, x0, x1, ...], x relative to the mask',
  alpha: ALPHA,
  player: { x: round(circle.x), y: round(circle.y), r: round(circle.r) },
  obstacles,
  clouds,
};
const out = JSON.stringify(json);
await writeFile(join(dir, 'src/data/hitboxes.json'), out + '\n');

// Cross-check against measure.mjs: first and last cloud rows on the player's centre column,
// counted from the player's start centre (should equal measured.bounds.centerColumn).
const cx = Math.round(measured.player.cx * 2) - from;
const hit = (y) => { const r = clouds.rows[y]; for (let i = 0; i < r.length; i += 2) if (r[i] <= cx && cx < r[i + 1]) return true; return false; };
let top = Math.round(measured.player.cy * 2), bottom = top;
while (top > 0 && !hit(top)) top--;
while (bottom < clouds.h && !hit(bottom)) bottom++;
const spans = Object.values(obstacles).reduce((n, o) => n + o.rows.reduce((m, r) => m + r.length / 2, 0), 0);
console.log(`player circle (CSS px): centre ${circle.x / 2}, ${circle.y / 2}, r ${round(circle.r / 2)}`);
console.log(`obstacles: ${OBSTACLES.length}, runs: ${spans}`);
console.log(`clouds on the centre column: top ${(top + 1) / 2}, bottom ${bottom / 2} (measure.mjs: ${measured.bounds.centerColumn.top}, ${measured.bounds.centerColumn.bottom})`);
console.log(`hitboxes.json: ${(out.length / 1024).toFixed(1)} KB`);
