// Entry point of the Gut Run ad.
// Will hold the state machine LOADING → START → GET_READY → PLAYING → CRASH → FAIL | WIN (M3+).
import './styles.css';
import { initStage } from './stage.js';
import { mountDesignOverlay } from './debug.js';

const viewport = document.getElementById('ad');
const stage = document.getElementById('stage');

initStage(viewport, stage);
mountDesignOverlay(stage);
