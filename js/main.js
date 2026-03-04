// @ts-check
import GameEngine from './GameEngine.js';

let savedata = JSON.parse(localStorage.getItem('savedata')) || {};

const urlParams = new URLSearchParams(window.location.search);
for (const key of urlParams.keys()) {
  savedata[key] = urlParams.get(key)
}
const joinId = urlParams.get('join');

localStorage.setItem('savedata', JSON.stringify(savedata));

const settingsForm = document.forms[0];
console.info(savedata, settingsForm)

const lobbyDialog = document.getElementById('lobby-menu');
const playerForm = document.getElementById('player-settings');

// Toon de dialoog zodra de pagina geladen is
window.addEventListener('load', () => {
  for (const setting in savedata) {
    if (settingsForm.elements[setting]) {
      
      try {
        let radioElement = [...settingsForm.elements[setting]].filter ( element => element.value == savedata[setting]);
        radioElement.checked = true;
      } catch (e) {
      }
      settingsForm.elements[setting].value = savedata[setting];
    }
    console.log(`${setting}: ${savedata[setting]}`)
  }
  lobbyDialog.showModal();
});

settingsForm.addEventListener('change', (e) => {
  
  console.log(e.target);

  if(e.target.type == 'checkbox') {
    
  }

  if(e.target.name == "track" ) {
      // let imgElem = document.querySelector('.backdrops img');
      // imgElem.src = `/assets/track/${e.target.value}/${e.target.value}_track.png`;
  }

  let formData = new FormData(e.target.form)
  let newsavedata = {}

  for (const [key, value] of formData) {
    newsavedata[key] = value;
  }

  // save to storage, update current values
  localStorage.setItem('savedata', JSON.stringify(newsavedata));
  savedata = {...newsavedata};

  // update UI
  
  if(newsavedata['camera']) {
    worldMap.classList.remove('camera-follow');
    worldMap.classList.remove('camera-drone');
    worldMap.classList.add(`camera-${newsavedata['camera']}`);
  } 
  
})

settingsForm.addEventListener('submit', (e) => {
  
  let formData = new FormData(e.target)
  let newsavedata = {}

  for (const [key, value] of formData) {
    newsavedata[key] = value;
  }

  localStorage.setItem('savedata', JSON.stringify(newsavedata));
  
  if (!window.game) {
    // startGame();
  } else {
    document.querySelector('body').classList.remove('menu');
  }
  return false;
});


// Luister naar het sluiten van de dialoog
lobbyDialog.addEventListener('close', () => {
  console.log('en hie zoujiu de gtame moeten starten')
  // Haal de data op
  // const settings = {
  //   name: document.getElementById('player-name').value,
  //   color: document.getElementById('player-color').value,
  //   driverNumber: parseInt(document.getElementById('player-number').value),
  //   track: document.querySelector('input[name=track]:checked').value,
  //   audioPanScreenSpace: document.getElementById('audio-pan-screen').checked
  // };

  // Initialiseer de game met deze settings
  
  initGame(savedata);
});

function initGame(playerSettings) {
  console.log("Starting game with:", playerSettings);
  
  window.game = new GameEngine(playerSettings);
}