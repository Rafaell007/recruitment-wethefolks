// Sound for the ad: Web Audio, started only by the first tap (browser autoplay rules).
// No DOM here: the mute button (UI) and visibility handling only call this API.

// urls: name → URL (Vite's hashed asset URLs, passed in from main.js).
// Ctx is injectable so the tests can pass a fake AudioContext.
// webkitAudioContext: iOS < 14.5 (D10, support floor iOS 12).
export function createAudio({ urls = {}, Ctx = window.AudioContext || window.webkitAudioContext } = {}) {
  let ctx = null;    // created on the first tap (autoplay rules)
  let master = null; // GainNode: mute = gain 0
  const raw = {};     // name → ArrayBuffer (fetched before the first tap)
  const buffers = {}; // name → AudioBuffer (decoded after unlock)
  let musicWanted = false; // the game asked for music; it may still be decoding
  let muted = false;

  // Start downloading right away; nothing is decoded or played before the tap.
  for (const [name, url] of Object.entries(urls)) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => {
        raw[name] = data;
        if (ctx) decode(name); // arrived after the tap: decode now
      })
      .catch(() => {}); // a missing sound must never break the game
  }

  // Called on every tap; creates the context only once, later taps only wake it up.
  function unlock() {
    if (!Ctx) return; // no Web Audio at all: the game runs silent
    if (!ctx) {
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1; // mute clicked before the first tap
      master.connect(ctx.destination);
      // Old WebKit unlocks only after something is played inside the gesture.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(master);
      s.start(0);
      decodeAll(); // ArrayBuffers fetched earlier → AudioBuffers
    }
    resume();
  }

  function decode(name) {
    const data = raw[name];
    delete raw[name]; // decodeAudioData detaches the ArrayBuffer: decode each one once
    // Callback form: Safari < 14.5 doesn't return a Promise.
    ctx.decodeAudioData(data, (buf) => {
      buffers[name] = buf;
      if (name === 'music' && musicWanted) startMusic();
    }, () => {});
  }

  function decodeAll() {
    Object.keys(raw).forEach(decode);
  }

  const playing = new Set(); // every sound playing now: stopAll() reaches all of them
  let musicNode = null;

  // One sound with its own GainNode, so it can fade out on its own.
  function playBuffer(name, loop = false) {
    const buf = buffers[name];
    if (!ctx || !buf) return null; // not decoded yet: skip (a late SFX would be off-sync)
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop = loop;
    src.connect(gain);
    gain.connect(master);
    const node = { src, gain };
    src.onended = () => playing.delete(node);
    playing.add(node);
    src.start(0);
    return node;
  }

  function startMusic() {
    if (!musicNode) musicNode = playBuffer('music', true); // second call = no second loop
  }

  // Short fade instead of a hard cut (a click in the speaker).
  function fadeOut(node, seconds) {
    const t = ctx.currentTime;
    node.gain.gain.setValueAtTime(node.gain.gain.value, t);
    node.gain.gain.linearRampToValueAtTime(0, t + seconds);
    node.src.stop(t + seconds);
  }

  function music(on) {
    musicWanted = on;
    if (on) startMusic();
    else if (musicNode) {
      fadeOut(musicNode, 0.25);
      musicNode = null;
    }
  }

  // win = cheer + applause together (both files are in endcard_win/).
  const SOUNDS = { crash: ['crash'], fail: ['fail'], win: ['cheer', 'applause'] };
  function play(name) {
    SOUNDS[name].forEach((n) => playBuffer(n));
  }

  // Replay: nothing may keep playing into the next run.
  function stopAll() {
    musicWanted = false;
    musicNode = null;
    playing.forEach(({ src }) => {
      src.onended = null;
      try {
        src.stop();
      } catch (e) {
        /* old WebKit throws if it already ended */
      }
    });
    playing.clear();
  }

  // Mute = master gain 0. Works before the first tap too: unlock() applies it.
  function setMuted(on) {
    muted = on;
    if (master) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.015); // ~50 ms, no click
  }

  // Tab / ad hidden: the whole audio clock stops, so loops and fades resume where they were.
  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  // Also wakes up iOS's 'interrupted' state (e.g. after a phone call); unlock() calls it on every tap.
  function resume() {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume();
  }

  return {
    unlock, music, play, stopAll, setMuted, suspend, resume,
    get muted() { return muted; },
  };
}
