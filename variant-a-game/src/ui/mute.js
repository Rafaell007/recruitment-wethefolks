import { isolate } from '../platform/input.js';

// aria-pressed switches the icon in CSS.
export function initMute(btn, audio) {
  isolate(btn);
  btn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    btn.setAttribute('aria-pressed', String(audio.muted));
  });
}
