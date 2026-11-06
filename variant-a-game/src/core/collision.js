// Collision of the player's circle with the masks from hitboxes.json (tools/hitboxes.mjs).
// One rule for obstacles and for the clouds at the top and bottom of the playfield.

// Circle (stage px) against a mask from hitboxes.json placed at (mx, my) in stage px.
// Masks are in asset px (2 per stage px), so the circle is moved into the mask instead.
// Exact for pixel squares: in each mask row the circle covers [u - half, u + half],
// where half is its widest chord inside that row. Touching edges is not a hit.
export function circleHitsMask(cx, cy, r, mask, mx, my) {
  const u = (cx - mx) * 2;
  const v = (cy - my) * 2;
  const R = r * 2;
  const y0 = Math.max(0, Math.floor(v - R));
  const y1 = Math.min(mask.h - 1, Math.floor(v + R));
  for (let y = y0; y <= y1; y++) {
    const dy = v < y ? y - v : v > y + 1 ? v - (y + 1) : 0; // nearest point of the row to the centre
    if (dy >= R) continue;
    const half = Math.sqrt(R * R - dy * dy);
    const row = mask.rows[y];
    for (let i = 0; i < row.length; i += 2) {
      if (row[i] < u + half && row[i + 1] > u - half) return true;
    }
  }
  return false;
}
