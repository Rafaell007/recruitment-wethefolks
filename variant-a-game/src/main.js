// Entry point of the Gut Run ad.
// Will hold the state machine LOADING → START → GET_READY → PLAYING → CRASH → FAIL | WIN (M4+).
import './styles.css';
import { gsap } from 'gsap';
import { initStage } from './stage.js';
import { mountDesignOverlay, debugFlags } from './debug.js';
import { createCanvas } from './render.js';
import { createGame } from './game.js';
import { createLoop } from './loop.js';
import { LEVEL } from './level.js';
import { createIntro } from './intro.js';
import { createAudio } from './audio.js';
import { watchVisibility } from './visibility.js';
import gutUrl from '../assets-opt/01_game/gameplay.png';
import playerUrl from '../assets-opt/01_game/player.png';
import musicUrl from '../assets-opt/music/background_music/funny-game-loop.mp3';
import crashUrl from '../assets-opt/music/crash/cartoon-crash-boing.mp3';
import failUrl from '../assets-opt/music/endcard_fail/fail.mp3';
import cheerUrl from '../assets-opt/music/endcard_win/celebrative-happy-woohoo-cheer-2.mp3';
import applauseUrl from '../assets-opt/music/endcard_win/applause.mp3';

// bac1–6 and txt1–9: Vite turns each file into a hashed URL, keyed by path.
const obstacleUrls = import.meta.glob('../assets-opt/01_game/{bac,txt}*.png', {
  eager: true, query: '?url', import: 'default',
});
const obstacleUrl = (name) => obstacleUrls[`../assets-opt/01_game/${name}.png`];

const viewport = document.getElementById('ad');
const stage = document.getElementById('stage');
const muteBtn = document.getElementById('mute');
const endcards = { fail: document.getElementById('fail'), win: document.getElementById('win') };

// Task: every CTA opens the landing page in a new window through the click tag.
const clickTag = window.clickTag || 'https://example.com/landing';

// Created right away: the sounds download in the background while the start screen shows.
const audio = createAudio({
  urls: { music: musicUrl, crash: crashUrl, fail: failUrl, cheer: cheerUrl, applause: applauseUrl },
});

// Taps on a button must not reach #ad: no game start, no jump, no resume from pause.
// All three types, because iOS 12 (D10) sends touchstart/mousedown instead of pointerdown.
function isolate(el) {
  ['pointerdown', 'touchstart', 'mousedown'].forEach((type) => {
    el.addEventListener(type, (e) => e.stopPropagation());
  });
}

isolate(muteBtn);
muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
});

let endDelay = null; // GSAP delayed call: paused with the rest while hidden, killed on replay

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
  endcards[result].hidden = false;
  if (result === 'fail') audio.play('fail');
}

// Back to the start screen; the next tap starts a new run the same way the first one did.
function replay() {
  if (endDelay) endDelay.kill();
  endDelay = null;
  audio.stopAll(); // no sound carried into the next run
  endcards.fail.hidden = true;
  endcards.win.hidden = true;
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
const intro = createIntro(document.getElementById('gesture'));
let images = null; // drawn only once loaded

function render(alpha) {
  if (images) canvas.draw(game.state, images, alpha, intro.props);
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed to load: ${src}`));
    img.src = src;
  });
}

let paused = false; // run frozen while hidden; the next tap resumes it

// Task: pause game and sound while the tab or ad is hidden, resume cleanly. There is no pause
// screen in the design, so the start screen's "tab to run" hand comes back as the resume prompt.
watchVisibility(viewport, (visible) => {
  if (!visible) {
    audio.suspend();
    gsap.globalTimeline.pause(); // every tween: hand, pop, later the endcards
    if (loop.running) { // only a run can be frozen
      loop.stop();
      paused = true;
    }
    return;
  }
  gsap.globalTimeline.resume();
  if (paused) {
    stage.classList.add('is-paused'); // the "tab to run" hand again
    intro.showHint();
  } else {
    audio.resume(); // start screen / endcard: nothing to miss, carry on
  }
});

function onTap(e) {
  if (e.type === 'touchstart') e.preventDefault(); // no emulated mouse event = no double jump
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
  if (game.state.phase === 'ready') audio.music(true);
  if (game.state.phase === 'ready') intro.clear(); // start screen obstacles pop away
  game.jump();
  stage.classList.add('is-running'); // D5: tutorial + headline fade out on the first tap
  loop.start(); // idempotent
}

Promise.all([
  loadImage(gutUrl),
  loadImage(playerUrl),
  Promise.all(LEVEL.map((o) => loadImage(obstacleUrl(o.name)))),
]).then(([gut, player, obstacleImgs]) => {
  const obstacles = {};
  LEVEL.forEach((o, i) => { obstacles[o.name] = obstacleImgs[i]; });
  images = { gut, player, obstacles };
  render(1);
  // Pointer Events exist from iOS 13; iOS 12 (D10) only has touch events.
  if (window.PointerEvent) {
    viewport.addEventListener('pointerdown', onTap);
  } else {
    viewport.addEventListener('touchstart', onTap, { passive: false });
    viewport.addEventListener('mousedown', onTap);
  }
  // Touchstart / pointerdown aren't a "user activation" for audio on iOS:
  // unlock again when the finger lifts (idempotent).
  viewport.addEventListener(window.PointerEvent ? 'pointerup' : 'touchend', audio.unlock);
});
