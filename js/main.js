// @ts-check
import GameEngine from './GameEngine.js';

const lobbyDialog = document.getElementById('lobby-dialog');
const playerForm = document.getElementById('player-setup-form');

// Toon de dialoog zodra de pagina geladen is
window.addEventListener('load', () => {
  lobbyDialog.showModal();
});

// Luister naar het sluiten van de dialoog
lobbyDialog.addEventListener('close', () => {
  // Haal de data op
  const settings = {
    name: document.getElementById('player-name').value,
    color: document.getElementById('player-color').value,
    driverNumber: parseInt(document.getElementById('player-number').value)
  };

  // Initialiseer de game met deze settings
  initGame(settings);
});

function initGame(playerSettings) {
  console.log("Starting game with:", playerSettings);
  // Hier roep je jouw bestaande GameEngine aan
  window.game = new GameEngine(playerSettings);
}