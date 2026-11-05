// Entry point of the Gut Run ad.
// Will hold the state machine LOADING → START → GET_READY → PLAYING → CRASH → FAIL | WIN (M4+).
import './styles.css';
import { initStage } from './stage.js';
import { mountDesignOverlay } from './debug.js';
import { createCanvas } from './render.js';
import { createGame } from './game.js';
import { createLoop } from './loop.js';
import gutUrl from '../assets-opt/01_game/gameplay.png';
import playerUrl from '../assets-opt/01_game/player.png';

const viewport = document.getElementById('ad');
const stage = document.getElementById('stage');

const game = createGame();
const canvas = createCanvas(document.getElementById('game'));
let images = null; // drawn only once loaded

function render(alpha) {
  if (images) canvas.draw(game.state, images, alpha);
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

function onTap(e) {
  if (e.type === 'touchstart') e.preventDefault(); // no emulated mouse event = no double jump
  game.jump();
  loop.start(); // idempotent
}

Promise.all([loadImage(gutUrl), loadImage(playerUrl)]).then(([gut, player]) => {
  images = { gut, player };
  render(1);
  // Pointer Events exist from iOS 13; iOS 12 (D10) only has touch events.
  if (window.PointerEvent) {
    viewport.addEventListener('pointerdown', onTap);
  } else {
    viewport.addEventListener('touchstart', onTap, { passive: false });
    viewport.addEventListener('mousedown', onTap);
  }
});
