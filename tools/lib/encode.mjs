// Shared encoder for the asset tools: smallest encoding that still passes a PSNR check.
import sharp from 'sharp';
import { psnr } from './image.mjs';

export const MIN_PSNR = 40; // dB. Above ~40 dB the differences are not visible on flat ad artwork
const PNG_QUALITIES = [80, 90, 100];
const JPG_QUALITIES = [80, 88];

/** `input` is a file path, an encoded file in a Buffer, or raw RGBA { data, width, height }. */
const toSharp = (input) =>
  typeof input === 'string' || Buffer.isBuffer(input)
    ? sharp(input)
    : sharp(input.data, { raw: { width: input.width, height: input.height, channels: 4 } });

export async function decode(input) {
  const { data, info } = await toSharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Tries encoders from the smallest settings up and returns the first result that passes MIN_PSNR
 * and is smaller than `maxBytes`. null if none does.
 */
export async function encodeBest(input, type, { maxBytes = Infinity } = {}) {
  const original = await decode(input);
  const attempts =
    type === 'png'
      ? [
          ...PNG_QUALITIES.map((quality) => ({
            label: `png palette q${quality}`,
            encode: () => toSharp(input).png({ palette: true, quality, effort: 10, compressionLevel: 9 }).toBuffer(),
          })),
          { label: 'png lossless', encode: () => toSharp(input).png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toBuffer() },
        ]
      : JPG_QUALITIES.map((quality) => ({
          label: `mozjpeg q${quality}`,
          encode: () => toSharp(input).jpeg({ mozjpeg: true, quality }).toBuffer(),
        }));
  for (const { label, encode } of attempts) {
    const buf = await encode();
    if (buf.length >= maxBytes) continue;
    const q = psnr(original, await decode(buf));
    if (q.psnr >= MIN_PSNR) return { buf, method: label, ...q };
  }
  return null;
}
