import { gsap } from 'gsap';

// Cuts a text layer into one clipping window per line, so lines can slide in one by one.
// cuts: measured gaps between lines, in CSS px from the layer top.
// The original image stays in place, hidden, to take over once the lines are in.
export function splitLines(img, box, cuts) {
  const edges = [0, ...cuts, box.h];
  const lines = edges.slice(0, -1).map((top, i) => {
    const win = document.createElement('div');
    win.className = 'line';
    gsap.set(win, { x: box.x, y: box.y + top, width: box.w, height: edges[i + 1] - top });
    const copy = img.cloneNode();
    copy.alt = '';
    gsap.set(copy, { x: 0, y: -top, width: box.w, height: box.h });
    // The copy is the whole image: clip it to its own line, or the line above slides in with it.
    const clip = `inset(${top}px 0 ${box.h - edges[i + 1]}px 0)`;
    copy.style.webkitClipPath = clip;
    copy.style.clipPath = clip;
    win.append(copy);
    return copy;
  });
  gsap.set(img, { x: box.x, y: box.y, width: box.w, height: box.h, autoAlpha: 0 });
  img.after(...lines.map((copy) => copy.parentNode));
  return { lines, whole: img };
}
