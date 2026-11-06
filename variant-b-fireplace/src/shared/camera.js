import fireplace from '../data/fireplace.json';

export const CAMERA = fireplace.camera;

// The three backgrounds move as one surface: the same scale around one shared point of the whole
// fireplace. Expressed as the slice's own transform-origin, a plain GSAP scale tween does that,
// with the slice placed at x/y = bg.x/bg.y (plus any drift).
export function cameraOrigin(partName, bg) {
  const part = fireplace.parts[partName];
  const [ox, oy] = CAMERA.origin;
  return `${ox - part.x - bg.x}px ${oy - part.y - bg.y}px`;
}
