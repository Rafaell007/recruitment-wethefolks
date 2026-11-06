// Files the game loads from JS. The DOM layers (background, frame, tutorial, endcards) are
// <img> tags in index.html. Vite turns every import into a hashed URL in the build.
import gutUrl from '../assets-opt/01_game/gameplay.png';
import playerUrl from '../assets-opt/01_game/player.png';
import musicUrl from '../assets-opt/music/background_music/funny-game-loop.mp3';
import crashUrl from '../assets-opt/music/crash/cartoon-crash-boing.mp3';
import failUrl from '../assets-opt/music/endcard_fail/fail.mp3';
import cheerUrl from '../assets-opt/music/endcard_win/celebrative-happy-woohoo-cheer-2.mp3';
import applauseUrl from '../assets-opt/music/endcard_win/applause.mp3';

export const SOUNDS = { music: musicUrl, crash: crashUrl, fail: failUrl, cheer: cheerUrl, applause: applauseUrl };

// bac1–6 and txt1–9, keyed by path.
const obstacleUrls = import.meta.glob('../assets-opt/01_game/{bac,txt}*.png', {
  eager: true, query: '?url', import: 'default',
});
const obstacleUrl = (name) => obstacleUrls[`../assets-opt/01_game/${name}.png`];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed to load: ${src}`));
    img.src = src;
  });
}

// Resolves with everything the canvas draws: { gut, player, obstacles: { bac1: img, … } }.
export function loadGameImages(obstacleNames) {
  return Promise.all([
    loadImage(gutUrl),
    loadImage(playerUrl),
    Promise.all(obstacleNames.map((name) => loadImage(obstacleUrl(name)))),
  ]).then(([gut, player, imgs]) => {
    const obstacles = {}; // not Object.fromEntries: Safari 12.0 doesn't have it
    obstacleNames.forEach((name, i) => { obstacles[name] = imgs[i]; });
    return { gut, player, obstacles };
  });
}
