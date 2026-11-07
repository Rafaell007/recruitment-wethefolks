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

const clickTag = window.clickTag || 'https://example.com/landing';

const audio = createAudio({ urls: SOUNDS });
initMute(document.getElementById('mute'), audio);

let endDelay = null;
let paused = false; // a run frozen while hidden, resumed by the next tap
let hidden = false;
let introReady = false;

function onEnd(result, hitBy) {
  loop.stop();
  audio.music(false);
  audio.play(result === 'fail' ? 'crash' : 'win');
  render(1);
  // A short look at the crash before the endcard covers it.
  endDelay = gsap.delayedCall(result === 'fail' ? 0.7 : 0.3, () => showEndcard(result));
  if (debugFlags.debug) console.info(`[debug] run over: ${result}${hitBy ? ` (hit ${hitBy})` : ''}`);
}

function showEndcard(result) {
  stage.classList.add('is-end');
  endcard.show(result);
  if (result === 'fail') audio.play('fail');
}

function replay() {
  if (endDelay) endDelay.kill();
  endDelay = null;
  audio.stopAll();
  endcard.reset();
  stage.classList.remove('is-end', 'is-running', 'is-paused');
  paused = false;
  intro.reset();
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
  onFrame: () => render(1),
});
let images = null;

function render(alpha) {
  if (images) canvas.draw(game.state, images, alpha, intro.props, intro.player);
}
const loop = createLoop(game.update, render);

// After the canvas exists: the first fit runs immediately.
initStage(viewport, stage, (fit, vw) => {
  canvas.resize(fit, vw);
  const v = canvas.view;
  game.setVisibleRight(v.left + v.width);
  render(1); // resizing clears the canvas
});
mountDesignOverlay(stage);

// Only once the images are ready and the ad is actually seen.
function startIntro() {
  if (!introReady || hidden || stage.classList.contains('is-intro')) return;
  intro.play();
  // Not earlier: a tap before play() would start the entrance in the middle of a run.
  onTap(viewport, tap);
  onRelease(viewport, audio.unlock);
}

watchVisibility(viewport, (visible) => {
  hidden = !visible;
  if (!visible) {
    audio.suspend();
    gsap.globalTimeline.pause();
    if (loop.running) {
      loop.stop();
      paused = true;
    }
    return;
  }
  gsap.globalTimeline.resume();
  startIntro();
  if (paused) {
    stage.classList.add('is-paused');
    intro.showHint();
  } else {
    audio.resume();
  }
});

function tap() {
  if (hidden) return;
  if (paused) { // this tap only resumes, the next one jumps
    paused = false;
    stage.classList.remove('is-paused');
    intro.hideHint();
    audio.unlock();
    loop.start();
    return;
  }
  if (game.state.phase === 'over') return;
  audio.unlock();
  if (game.state.phase === 'ready') {
    audio.music(true);
    intro.clear();
  }
  game.jump();
  stage.classList.add('is-running');
  loop.start();
}

loadGameImages(LEVEL.map((o) => o.name)).then((loaded) => {
  images = loaded;
  render(1);
  // The first frame after load decodes the full-screen layers and is slow: start two frames
  // later, and don't let one slow frame skip more than 33 ms of a tween.
  gsap.ticker.lagSmoothing(50, 33);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    introReady = true;
    startIntro();
  }));
});
