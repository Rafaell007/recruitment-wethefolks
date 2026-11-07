// Small image helpers shared by the tools. Everything works on raw RGBA buffers decoded by sharp.
import sharp from 'sharp';

/** Decodes any image sharp understands into { data: RGBA Buffer, width, height }. */
export async function loadRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Bounding box of pixels with alpha >= minAlpha, in image px. null if the image is fully transparent. */
export function alphaBBox(img, minAlpha = 1) {
  const { data, width, height } = img;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * PSNR between two RGBA images of the same size, in dB.
 * RGB is premultiplied by alpha first, so colour changes inside fully transparent pixels
 * (invisible on screen) do not count as error. Alpha itself is compared as a fourth channel.
 */
export function psnr(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('psnr: size mismatch');
  let sum = 0;
  let maxErr = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n * 4; i += 4) {
    const aa = a.data[i + 3], ba = b.data[i + 3];
    for (let c = 0; c < 3; c++) {
      const d = (a.data[i + c] * aa - b.data[i + c] * ba) / 255;
      sum += d * d;
      if (Math.abs(d) > maxErr) maxErr = Math.abs(d);
    }
    const da = aa - ba;
    sum += da * da;
    if (Math.abs(da) > maxErr) maxErr = Math.abs(da);
  }
  const mse = sum / (n * 4);
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse), maxErr: Math.round(maxErr) };
}

/**
 * Finds where a sprite (template with alpha) sits inside a flattened screenshot (design file).
 * Score = mean absolute RGB difference over the template's fully opaque pixels (0 = perfect).
 * Semi-transparent edge pixels are skipped because in the design they are blended with
 * whatever lies underneath.
 *
 * Shape guard: a one-colour sprite (white text) would otherwise "match" any flat white area
 * (e.g. the logo bar). In a real match the design around the shape (under the sprite's fully
 * transparent pixels) is background, so it mostly does NOT have the sprite's colour. If more
 * than `maxSimilar` of those pixels are within `similarDiff` of the sprite's mean colour,
 * the position is rejected.
 *
 * Coarse-to-fine so a full search over 720x1280 stays fast:
 *   1. every `step`-th position, scored on a sparse sample of pixels,
 *   2. the best few candidates refined pixel by pixel with all pixels.
 */
export function locate(image, tpl, { step = 3, samples = 500, keep = 8, refine = 4, maxSimilar = 0.5, similarDiff = 24 } = {}) {
  const opaque = [];
  const clear = [];
  for (let y = 0; y < tpl.height; y++) {
    for (let x = 0; x < tpl.width; x++) {
      const i = (y * tpl.width + x) * 4;
      const a = tpl.data[i + 3];
      if (a >= 250) opaque.push([x, y, tpl.data[i], tpl.data[i + 1], tpl.data[i + 2]]);
      else if (a === 0) clear.push([x, y]);
    }
  }
  if (opaque.length === 0) return null;

  const sparsify = (pts) => {
    const stride = Math.max(1, Math.floor(pts.length / samples));
    return pts.filter((_, i) => i % stride === 0);
  };
  const sparse = { opaque: sparsify(opaque), clear: sparsify(clear) };
  const full = { opaque, clear };

  const spriteColour = [2, 3, 4].map((c) => opaque.reduce((sum, p) => sum + p[c], 0) / opaque.length);
  const similarShare = (ox, oy, pts) => {
    let similar = 0;
    for (const [x, y] of pts) {
      const i = ((oy + y) * image.width + (ox + x)) * 4;
      const d = (Math.abs(image.data[i] - spriteColour[0]) + Math.abs(image.data[i + 1] - spriteColour[1]) + Math.abs(image.data[i + 2] - spriteColour[2])) / 3;
      if (d < similarDiff) similar++;
    }
    return similar / pts.length;
  };

  // `bar`: the score a position has to beat to matter. Only then does the (slower) contrast check run.
  const score = (ox, oy, set, bar) => {
    let s = 0;
    for (const [x, y, r, g, b] of set.opaque) {
      const i = ((oy + y) * image.width + (ox + x)) * 4;
      s += Math.abs(image.data[i] - r) + Math.abs(image.data[i + 1] - g) + Math.abs(image.data[i + 2] - b);
    }
    s /= set.opaque.length * 3;
    if (s < bar && set.clear.length > 0 && similarShare(ox, oy, set.clear) > maxSimilar) return Infinity;
    return s;
  };

  const maxX = image.width - tpl.width;
  const maxY = image.height - tpl.height;
  let best = [];
  for (let oy = 0; oy <= maxY; oy += step) {
    for (let ox = 0; ox <= maxX; ox += step) {
      const s = score(ox, oy, sparse, best.length < keep ? Infinity : best[best.length - 1].s);
      if (best.length < keep || s < best[best.length - 1].s) {
        best.push({ ox, oy, s });
        best.sort((p, q) => p.s - q.s);
        if (best.length > keep) best.pop();
      }
    }
  }

  let winner = { x: 0, y: 0, score: Infinity };
  for (const { ox, oy } of best) {
    for (let y = Math.max(0, oy - refine); y <= Math.min(maxY, oy + refine); y++) {
      for (let x = Math.max(0, ox - refine); x <= Math.min(maxX, ox + refine); x++) {
        const s = score(x, y, full, winner.score);
        if (s < winner.score) winner = { x, y, score: s };
      }
    }
  }
  return Number.isFinite(winner.score) ? winner : null;
}

/**
 * Some fireplace layers were exported without transparency: what should be transparent is pure
 * black (0,0,0), with no blended edge pixels (checked: every other colour in them is artwork).
 * Returns a copy where pure black is fully transparent and every other pixel is left as it is.
 */
export function keyOutBlack(img) {
  const data = Buffer.from(img.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) data[i + 3] = 0;
  }
  return { data, width: img.width, height: img.height };
}

/** Grows a box outwards to even pixel edges, so it maps to whole CSS px at 2x. */
export function evenBox(b) {
  const x0 = b.x - (b.x % 2), y0 = b.y - (b.y % 2);
  const x1 = b.x + b.w + ((b.x + b.w) % 2), y1 = b.y + b.h + ((b.y + b.h) % 2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
