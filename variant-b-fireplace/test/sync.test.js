import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TAG, waitForStart } from '../src/shared/sync.js';

let listeners, parent;

function fakeWindow() {
  listeners = new Set();
  const win = {
    addEventListener: (type, fn) => type === 'message' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
  };
  parent = { postMessage() {} };
  win.parent = parent;
  vi.stubGlobal('window', win);
}

const deliver = (data, source = parent) => {
  for (const fn of [...listeners]) fn({ data, source });
};

// Lets a test check whether the promise has resolved yet, and with what.
async function settle(promise) {
  let at = null;
  promise.then((v) => (at = v));
  return { get value() { return at; } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('waitForStart', () => {
  it('runs alone after 300 ms when nobody answers', async () => {
    fakeWindow();
    const r = await settle(waitForStart('left'));
    await vi.advanceTimersByTimeAsync(299);
    expect(r.value).toBe(null);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.value).toBe(1_000_300);
    expect(listeners.size).toBe(0);
  });

  it('waits up to 3 s for the start once the coordinator holds', async () => {
    fakeWindow();
    const r = await settle(waitForStart('left'));
    await vi.advanceTimersByTimeAsync(100);
    deliver({ tag: TAG, kind: 'hold' });
    await vi.advanceTimersByTimeAsync(2999);
    expect(r.value).toBe(null);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.value).toBe(1_003_100);
  });

  it('resolves with the shared start time from the coordinator', async () => {
    fakeWindow();
    const r = await settle(waitForStart('right'));
    deliver({ tag: TAG, kind: 'hold' });
    deliver({ tag: TAG, kind: 'start', at: 1_000_150 });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.value).toBe(1_000_150);
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores messages from other windows, other tags and broken start times', async () => {
    fakeWindow();
    const r = await settle(waitForStart('left'));
    deliver({ tag: TAG, kind: 'start', at: 5 }, { postMessage() {} });
    deliver({ tag: 'other', kind: 'start', at: 5 });
    deliver({ tag: TAG, kind: 'start', at: 'soon' });
    deliver({ tag: TAG, kind: 'hold' }, { postMessage() {} });
    deliver(null);
    await vi.advanceTimersByTimeAsync(300);
    expect(r.value).toBe(1_000_300);
  });
});
