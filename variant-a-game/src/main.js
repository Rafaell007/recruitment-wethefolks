// Entry point of the Gut Run ad: creates the modules and runs the flow of a run
// (start screen → first tap → run → endcard → replay), plus the pause while the ad isn't visible.
import './styles/main.css';
import { gsap } from 'gsap';
import { initStage } from './view/stage.js';
import { createCanvas } from './view/render.js';
import { createGame } from './core/game.js';
import { createLoop } from './core/loop.js';
import { LEVEL } from './core/level.js';
import { createIntro } from './ui/intro.js';
import { createEndcard } from './ui/endcard.js';
import { initMute } from './ui/mute.js';
import { createAudio } from './platform/audio.js';
import { watchVisibility } from './platform/visibility.js';
import { onTap, onRelease, isolate } from './platform/input.js';
import { mountDesignOverlay, debugFlags } from './dev/debug.js';
import { SOUNDS, loadGameImages } from './assets.js';

const viewport = document.getElementById('ad');
const stage = document.getElementById('stage');
const endcard = createEndcard({ fail: document.getElementById('fail'), win: document.getElementById('win') });

// Task: every CTA opens the landing page in a new window through the click tag.
const clickTag = window.clickTag || 'https://example.com/landing';

// Created right away: the sounds download in the background while the start screen shows.
const audio = createAudio({ urls: SOUNDS });
initMute(document.getElementById('mute'), audio);

let endDelay = null; // GSAP delayed call: paused with the rest while hidden, killed on replay
let paused = false; // run frozen while hidden; the next tap resumes it
let hidden = false; // watchVisibility says no: background tab, scrolled away, or landscape
let introReady = false; // images loaded and painted: the intro may start

// The run is over: freeze on the last frame, then the endcard.
function onEnd(result, hitBy) {
  loop.stop();
  audio.music(false); // fades out instead of cutting off
  audio.play(result === 'fail' ? 'crash' : 'win');
  render(1);
  // Fail: the crash stays on screen for a moment, so the player sees what they hit.
  endDelay = gsap.delayedCall(result === 'fail' ? 0.7 : 0.3, () => showEndcard(result));
  if (debugFlags.debug) console.info(`[debug] run over: ${result}${hitBy ? ` (hit ${hitBy})` : ''}`);
}

function showEndcard(result) {
  stage.classList.add('is-end');
  endcard.show(result);
  if (result === 'fail') audio.play('fail');
}

// Back to the start screen; the next tap starts a new run the same way the first one did.
function replay() {
  if (endDelay) endDelay.kill();
  endDelay = null;
  audio.stopAll(); // no sound carried into the next run
  endcard.reset(); // kills the entrance, hides both cards
  stage.classList.remove('is-end', 'is-running', 'is-paused');
  paused = false;
  intro.reset(); // start screen props back, the hand taps again
  game.reset();
  render(1);
}

document.querySelectorAll('.endcard button').forEach((btn) => {
  isolate(btn);
  btn.addEventListener('click', () => {
    if (btn.dataset.click === 'cta') window.open(clickTag, '_blank');
    else replay();
  });
});

const game = createGame({ onEnd });
const canvas = createCanvas(document.getElementById('game'));
const intro = createIntro({
  gesture: document.getElementById('gesture'),
  tut: document.getElementById('tut'),
  stage,
  onFrame: () => render(1), // the loop doesn't run on the start screen
});
let images = null; // drawn only once loaded

function render(alpha) {
  if (images) canvas.draw(game.state, images, alpha, intro.props, intro.player);
}
const loop = createLoop(game.update, render);

// Created before initStage: its first fit() runs right away and already needs the canvas.
initStage(viewport, stage, (fit, vw) => {
  canvas.resize(fit, vw);
  const v = canvas.view;
  game.setVisibleRight(v.left + v.width);
  render(1); // resizing clears the canvas: redraw even when the loop is stopped (start screen)
});
mountDesignOverlay(stage);

// The intro starts once its images are ready AND the ad is seen (portrait, on screen), so it is
// never played to nobody nor shown half-set. Once only: a replay uses intro.reset().
function startIntro() {
  if (!introReady || hidden || stage.classList.contains('is-intro')) return;
  intro.play();
  // Not earlier: a tap before play() would start the entrance in the middle of a run.
  onTap(viewport, tap);
  onRelease(viewport, audio.unlock); // iOS: audio may only start when the finger lifts
}

// Task: pause game and sound while the tab or ad is hidden, resume cleanly. There is no pause
// screen in the design, so the start screen's "tab to run" hand comes back as the resume prompt.
watchVisibility(viewport, (visible) => {
  hidden = !visible;
  if (!visible) {
    audio.suspend();
    gsap.globalTimeline.pause(); // every tween: hand, pop, endcards
    if (loop.running) { // only a run can be frozen
      loop.stop();
      paused = true;
    }
    return;
  }
  gsap.globalTimeline.resume();
  startIntro(); // the ad loaded while hidden (landscape, below the fold): its entrance starts now
  if (paused) {
    stage.classList.add('is-paused'); // the "tab to run" hand again
    intro.showHint();
  } else {
    audio.resume(); // start screen / endcard: nothing to miss, carry on
  }
});

function tap() {
  if (hidden) return; // landscape: taps still arrive, the game waits for portrait
  if (paused) { // this tap only resumes, the next one jumps
    paused = false;
    stage.classList.remove('is-paused');
    intro.hideHint();
    audio.unlock(); // a gesture: iOS lets the audio resume
    loop.start(); // resets the frame clock: no time jump after the pause
    return;
  }
  if (game.state.phase === 'over') return; // only the endcard's buttons act now
  audio.unlock(); // first tap creates the audio context (autoplay rules)
  if (game.state.phase === 'ready') {
    audio.music(true);
    intro.clear(); // start screen obstacles pop away
  }
  game.jump();
  stage.classList.add('is-running'); // tutorial + headline fade out on the first tap
  loop.start(); // idempotent
}

loadGameImages(LEVEL.map((o) => o.name)).then((loaded) => {
  images = loaded;
  render(1);
  // The first frame after the images load is a heavy one (decoding full-screen layers): start
  // two frames later, and never let one slow frame skip more than 33 ms of a tween (GSAP's
  // default kicks in only at 500 ms).
  gsap.ticker.lagSmoothing(50, 33);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    introReady = true;
    startIntro();
  }));
});
