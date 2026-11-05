// audio.js against a fake AudioContext: autoplay rules, no doubled loops, a clean replay.
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAudio } from '../src/audio.js';

const param = () => ({
  value: 1,
  setTargetAtTime(v) { this.value = v; },
  setValueAtTime() {},
  linearRampToValueAtTime() {},
});

// Just enough of AudioContext for audio.js; it records what was created and played.
class FakeCtx {
  constructor() {
    FakeCtx.instances.push(this);
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.gains = [];
    this.sources = [];
  }
  createGain() {
    const g = { gain: param(), connect() {} };
    this.gains.push(g);
    return g;
  }
  createBuffer() { return {}; }
  createBufferSource() {
    const s = {
      buffer: null, loop: false, started: false, stopped: false, onended: null,
      connect() {},
      start() { this.started = true; },
      stop() { this.stopped = true; },
    };
    this.sources.push(s);
    return s;
  }
  decodeAudioData(data, ok) { ok({ name: data.name }); } // callback form, like old Safari
  resume() { this.state = 'running'; }
  suspend() { this.state = 'suspended'; }
}

const URLS = { music: 'music', crash: 'crash', fail: 'fail', cheer: 'cheer', applause: 'applause' };
const flush = () => new Promise((r) => setTimeout(r)); // let the fetch promises settle

// Sounds that are playing now, by name.
const live = (ctx) => ctx.sources.filter((s) => s.started && !s.stopped && s.buffer.name).map((s) => s.buffer.name);
const master = (ctx) => ctx.gains[0];

beforeEach(() => {
  FakeCtx.instances = [];
  vi.stubGlobal('fetch', (url) => Promise.resolve({ arrayBuffer: () => Promise.resolve({ name: url }) }));
});
afterEach(() => vi.unstubAllGlobals());

test('nothing is created before the first tap; music asked for early starts on unlock', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  await flush();
  audio.music(true);
  audio.play('crash');
  expect(FakeCtx.instances).toHaveLength(0);
  audio.unlock();
  const ctx = FakeCtx.instances[0];
  expect(ctx.state).toBe('running');
  expect(live(ctx)).toEqual(['music']);
});

test('unlock twice = one context; music twice = one loop', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  await flush();
  audio.unlock();
  audio.unlock();
  audio.music(true);
  audio.music(true);
  expect(FakeCtx.instances).toHaveLength(1);
  expect(live(FakeCtx.instances[0])).toEqual(['music']);
});

test('music that finishes downloading after the tap starts by itself', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  audio.unlock(); // fetches still pending
  audio.music(true);
  expect(live(FakeCtx.instances[0])).toEqual([]);
  await flush();
  expect(live(FakeCtx.instances[0])).toEqual(['music']);
});

test('3 runs with replay: never more than one loop, nothing left over', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  await flush();
  audio.unlock();
  const ctx = FakeCtx.instances[0];
  for (let run = 0; run < 3; run++) {
    audio.music(true);
    audio.play('crash');
    audio.music(false); // fade-out: stop() is scheduled
    audio.play('fail');
    audio.stopAll(); // replay
    expect(live(ctx)).toEqual([]);
  }
  audio.music(true);
  expect(live(ctx)).toEqual(['music']);
});

test('win plays the cheer and the applause together', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  await flush();
  audio.unlock();
  audio.play('win');
  expect(live(FakeCtx.instances[0]).sort()).toEqual(['applause', 'cheer']);
});

test('mute before the first tap is kept; unmute brings the sound back', async () => {
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  audio.setMuted(true);
  audio.unlock();
  const ctx = FakeCtx.instances[0];
  expect(master(ctx).gain.value).toBe(0);
  audio.setMuted(false);
  expect(master(ctx).gain.value).toBe(1);
  expect(audio.muted).toBe(false);
});

test('suspend / resume, also out of iOS "interrupted"', () => {
  const audio = createAudio({ urls: {}, Ctx: FakeCtx });
  audio.suspend(); // before the first tap: nothing to do, no error
  audio.resume();
  audio.unlock();
  const ctx = FakeCtx.instances[0];
  audio.suspend();
  expect(ctx.state).toBe('suspended');
  audio.resume();
  expect(ctx.state).toBe('running');
  ctx.state = 'interrupted';
  audio.unlock(); // the next tap wakes it up
  expect(ctx.state).toBe('running');
});

test('no Web Audio, or a sound that fails to load: the game runs silent, nothing throws', async () => {
  const silent = createAudio({ urls: URLS, Ctx: null }) // = window.AudioContext missing;
  expect(() => {
    silent.unlock(); silent.music(true); silent.play('win'); silent.setMuted(true);
    silent.suspend(); silent.resume(); silent.stopAll();
  }).not.toThrow();

  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  const audio = createAudio({ urls: URLS, Ctx: FakeCtx });
  await flush();
  audio.unlock();
  audio.music(true);
  audio.play('crash');
  expect(live(FakeCtx.instances[0])).toEqual([]);
});
