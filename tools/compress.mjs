// Compresses a variant's original assets into <variant>/assets-opt/ (the files the ad ships).
//
//   node tools/compress.mjs variant-a-game
//
// - PNG: palette quantisation (libimagequant via sharp). Every result is compared with the
//   original (PSNR on premultiplied RGBA); if it is below MIN_PSNR a higher quality is tried,
//   then lossless PNG. A file is never allowed to get bigger than the original.
// - JPG: mozjpeg re-encode, same PSNR check.
// - MP3: re-encoded to 128 kbps only if the source bitrate is higher (the 320 kbps effects);
//   sources at or below 128 kbps are copied bit for bit (no second lossy generation).
//   Tags and embedded cover art are removed in both cases.
// - File names: lower case, spaces → "-" (originals have names like "Funny Game Loop.mp3").
// - Resolution is never changed: the assets stay 2x for sharp rendering on retina screens.
//
// Writes reports/compress-<variant>.md.
import { readdir, mkdir, rm, stat, copyFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve, extname } from 'node:path';
import sharp from 'sharp';
import { psnr } from './lib/image.mjs';

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');

const MIN_PSNR = 40; // dB; above ~40 dB differences are not visible on flat ad artwork
const PNG_QUALITIES = [80, 90, 100];
const JPG_QUALITIES = [80, 88];
const MP3_MAX_KBPS = 128;

const variant = process.argv[2];
if (!variant) {
  console.error('usage: node tools/compress.mjs <variant-dir>');
  process.exit(1);
}
const srcDir = join(ROOT, variant, 'assets');
const outDir = join(ROOT, variant, 'assets-opt');

const outName = (rel) => rel.split('/').map((part) => part.toLowerCase().replace(/\s+/g, '-')).join('/');

const decode = async (input) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

/** Tries encoders in order (smallest settings first) and returns the first one that passes MIN_PSNR. */
async function firstGood(original, attempts) {
  for (const { label, encode } of attempts) {
    const buf = await encode();
    if (buf.length >= original.bytes) continue;
    const q = psnr(original.pixels, await decode(buf));
    if (q.psnr >= MIN_PSNR) return { buf, method: label, ...q };
  }
  return null;
}

async function compressImage(src, dst, type) {
  const bytes = (await stat(src)).size;
  const original = { bytes, pixels: await decode(src) };
  const attempts =
    type === 'png'
      ? [
          ...PNG_QUALITIES.map((quality) => ({
            label: `png palette q${quality}`,
            encode: () => sharp(src).png({ palette: true, quality, effort: 10, compressionLevel: 9 }).toBuffer(),
          })),
          { label: 'png lossless', encode: () => sharp(src).png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toBuffer() },
        ]
      : JPG_QUALITIES.map((quality) => ({
          label: `mozjpeg q${quality}`,
          encode: () => sharp(src).jpeg({ mozjpeg: true, quality }).toBuffer(),
        }));
  const best = await firstGood(original, attempts);
  if (!best) {
    await copyFile(src, dst);
    return { method: 'copied (no smaller encoding passed the quality check)' };
  }
  await writeFile(dst, best.buf);
  return { method: best.method, psnr: best.psnr, maxErr: best.maxErr };
}

async function compressMp3(src, dst, ffmpeg) {
  const probe = await run(ffmpeg, ['-hide_banner', '-i', src]).catch((e) => e); // exits 1 without output file; stderr has the info
  const kbps = Number(/Audio:.*?(\d+) kb\/s/.exec(probe.stderr)?.[1]);
  // -map 0:a drops embedded cover art, -map_metadata -1 drops tags.
  const common = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-map', '0:a', '-map_metadata', '-1'];
  if (kbps > MP3_MAX_KBPS) {
    await run(ffmpeg, [...common, '-c:a', 'libmp3lame', '-b:a', `${MP3_MAX_KBPS}k`, dst]);
    return { method: `mp3 ${kbps} → ${MP3_MAX_KBPS} kbps` };
  }
  await run(ffmpeg, [...common, '-c:a', 'copy', dst]);
  if ((await stat(dst)).size >= (await stat(src)).size) {
    // Nothing to strip – ffmpeg only added its own header bytes. Ship the original file.
    await copyFile(src, dst);
    return { method: `mp3 ${kbps} kbps, copied (already ≤ ${MP3_MAX_KBPS} kbps, no tags to strip)` };
  }
  return { method: `mp3 ${kbps} kbps, stream copy (tags removed)` };
}

async function loadFfmpeg() {
  try {
    return (await import('ffmpeg-static')).default;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- main

const ffmpeg = await loadFfmpeg();
await rm(outDir, { recursive: true, force: true });

const files = (await readdir(srcDir, { withFileTypes: true, recursive: true }))
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath, e.name))
  .sort();

const rows = [];
for (const src of files) {
  const rel = relative(srcDir, src).split('\\').join('/');
  const dst = join(outDir, outName(rel));
  await mkdir(dirname(dst), { recursive: true });
  const ext = extname(src).toLowerCase();
  let result;
  if (ext === '.png') result = await compressImage(src, dst, 'png');
  else if (ext === '.jpg' || ext === '.jpeg') result = await compressImage(src, dst, 'jpg');
  else if (ext === '.mp3' && ffmpeg) result = await compressMp3(src, dst, ffmpeg);
  else {
    await copyFile(src, dst);
    result = { method: ext === '.mp3' ? 'copied (ffmpeg-static not installed)' : 'copied' };
  }
  const before = (await stat(src)).size;
  const after = (await stat(dst)).size;
  rows.push({ rel, out: outName(rel), before, after, ...result });
  console.log(`${rel.padEnd(58)} ${kb(before).padStart(9)} → ${kb(after).padStart(9)}  ${result.method}`);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const total = rows.reduce((a, r) => ({ before: a.before + r.before, after: a.after + r.after }), { before: 0, after: 0 });
const saved = (1 - total.after / total.before) * 100;
console.log(`\nTOTAL ${kb(total.before)} → ${kb(total.after)} (−${saved.toFixed(1)}%)`);

const md = [
  `# Asset compression – ${variant}`,
  '',
  `Generated by \`node tools/compress.mjs ${variant}\`. Source: \`${variant}/assets/\` (untouched originals) → \`${variant}/assets-opt/\`.`,
  `Quality check: PSNR on premultiplied RGBA against the original, minimum ${MIN_PSNR} dB; max err = largest single channel difference (0–255).`,
  '',
  '| file (shipped name) | original | optimised | saved | method | PSNR | max err |',
  '|---|---:|---:|---:|---|---:|---:|',
  ...rows.map(
    (r) =>
      `| ${r.out} | ${kb(r.before)} | ${kb(r.after)} | ${((1 - r.after / r.before) * 100).toFixed(0)}% | ${r.method} | ${
        r.psnr === undefined ? '' : r.psnr === Infinity ? '∞' : r.psnr.toFixed(1) + ' dB'
      } | ${r.maxErr ?? ''} |`,
  ),
  `| **total** | **${kb(total.before)}** | **${kb(total.after)}** | **${saved.toFixed(0)}%** | | | |`,
  '',
].join('\n');
await mkdir(join(ROOT, 'reports'), { recursive: true });
await writeFile(join(ROOT, 'reports', `compress-${variant}.md`), md);
