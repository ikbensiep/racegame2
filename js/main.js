// @ts-check
import GameEngine from './GameEngine.js';

// Wacht tot de DOM geladen is en start de engine
window.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    window.game = game;
});