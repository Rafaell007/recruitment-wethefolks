// Web Audio, created on the first tap (autoplay rules). Ctx is injectable for the tests.
export function createAudio({ urls = {}, Ctx = window.AudioContext || window.webkitAudioContext } = {}) {
  let ctx = null;
  let master = null;
  const raw = {};     // name → ArrayBuffer, fetched before the first tap
  const buffers = {}; // name → AudioBuffer, decoded after it
  let musicWanted = false;
  let muted = false;

  for (const [name, url] of Object.entries(urls)) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => {
        raw[name] = data;
        if (ctx) decode(name);
      })
      .catch(() => {}); // a missing sound must never break the game
  }

  function unlock() {
    if (!Ctx) return;
    if (!ctx) {
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      // Old WebKit unlocks only once something has played inside the gesture.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(master);
      s.start(0);
      decodeAll();
    }
    resume();
  }

  function decode(name) {
    const data = raw[name];
    delete raw[name]; // decodeAudioData detaches the buffer
    // Callback form: Safari < 14.5 doesn't return a Promise.
    ctx.decodeAudioData(data, (buf) => {
      buffers[name] = buf;
      if (name === 'music' && musicWanted) startMusic();
    }, () => {});
  }

  function decodeAll() {
    Object.keys(raw).forEach(decode);
  }

  const playing = new Set();
  let musicNode = null;

  function playBuffer(name, loop = false) {
    const buf = buffers[name];
    if (!ctx || !buf) return null; // not decoded yet: a late sound effect would be off-sync
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
    if (!musicNode) musicNode = playBuffer('music', true);
  }

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

  const SOUNDS = { crash: ['crash'], fail: ['fail'], win: ['cheer', 'applause'] };
  function play(name) {
    SOUNDS[name].forEach((n) => playBuffer(n));
  }

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

  function setMuted(on) {
    muted = on;
    if (master) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.015); // no click
  }

  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  // Also covers iOS's 'interrupted' state, e.g. after a phone call.
  function resume() {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume();
  }

  return {
    unlock, music, play, stopAll, setMuted, suspend, resume,
    get muted() { return muted; },
  };
}
