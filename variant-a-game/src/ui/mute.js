import { isolate } from '../platform/input.js';

// The task's "small mute toggle". aria-pressed switches the icon in CSS and tells screen readers
// the state; `click` also fires from the keyboard.
export function initMute(btn, audio) {
  isolate(btn);
  btn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    btn.setAttribute('aria-pressed', String(audio.muted));
  });
}
