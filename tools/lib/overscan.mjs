// How much of bg-big each part's background slice needs beyond the part itself.
//
// The background of all three parts moves as one surface: scale s (1..maxScale) around one shared
// point of the whole fireplace, plus a drift of up to ±maxDrift CSS px. A screen point p then
// shows the background point  o + (p − o − d) / s.  That is linear in d and in 1/s, so the
// furthest-reaching source points are found at the extremes of both.

// Extra CSS px on every side that is cut out of bg-big (not on its own outer edges): covers
// sub-pixel rendering, and the outermost pixel row of a cut JPEG decodes slightly differently
// (its colour is smoothed with a neighbour block that the cut removed), so it must stay off screen.
const PAD = 2;

/** Source range a part's screen span [a, b] can show along one axis. */
function reach(a, b, o, { maxScale, maxDrift }) {
  let lo = Infinity, hi = -Infinity;
  for (const s of [1, maxScale]) {
    for (const d of [-maxDrift, maxDrift]) {
      lo = Math.min(lo, o + (a - o - d) / s);
      hi = Math.max(hi, o + (b - o - d) / s);
    }
  }
  return [lo, hi];
}

/**
 * The slice of the fireplace background a part needs, in fireplace CSS px, rounded out to whole
 * px and clamped to the background (outside it there is nothing to show anyway).
 */
export function sliceRect(part, camera, bounds) {
  const [ox, oy] = camera.origin;
  const [x0, x1] = reach(part.x, part.x + part.w, ox, camera);
  const [y0, y1] = reach(part.y, part.y + part.h, oy, camera);
  const grow = (lo, hi, a, b, max) => [
    Math.max(0, Math.floor(Math.min(lo, a)) - PAD),
    Math.min(max, Math.ceil(Math.max(hi, b)) + PAD),
  ];
  const [left, right] = grow(x0, x1, part.x, part.x + part.w, bounds.w);
  const [top, bottom] = grow(y0, y1, part.y, part.y + part.h, bounds.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}
