// @ts-check
import GameEngine from './GameEngine.js';
import Tuna from './lib/tuna.js';

window.Tuna = window.Tuna || Tuna;

let savedata = JSON.parse(localStorage.getItem('savedata') || '') || {};

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

function applySavedDataToForm() {
  for (const setting in savedata) {
    if (!settingsForm.elements[setting]) continue;

    try {
      const element = settingsForm.elements[setting];

      if (element instanceof RadioNodeList || element.length > 1) {
        const radioToSelect = [...element].find(el => el.value === savedata[setting]);
        if (radioToSelect) radioToSelect.checked = true;
      } else if (element.type === 'checkbox') {
        element.checked = savedata[setting] === true || savedata[setting] === 'true' || savedata[setting] === 'on' || savedata[setting] === 1 || savedata[setting] === '1';
      } else {
        element.value = savedata[setting];
      }
    } catch (e) {
      console.error(`[${setting}]`, e);
    }

    const matchedElement = settingsForm.querySelector(`[name="${setting}"]`);
    if (matchedElement) {
      const initEvent = new Event('input');
      matchedElement.dispatchEvent(initEvent);
    }
  }
}

// Toon de dialoog zodra de pagina geladen is
window.addEventListener('load', () => {
  applySavedDataToForm();
  lobbyDialog.showModal();
});

settingsForm.addEventListener('change', (e) => {
  
  console.log(e.target);

  if(e.target.type == 'checkbox') {
    
  }

  if(e.target.name == "track" ) {
      document.body.classList.add('busy')
      let track = e.target.value;
      let trackPreview = document.querySelector('.track-preview img');
      trackPreview.style.filter = 'blur(16px)'
      let img = new Image()
      img.src = `/levels/${track}/${track}.svg`;
      img.onload = () => {
        trackPreview.src = img.src;
        setTimeout(()=>{
          trackPreview.style.filter = 'blur(0px)'
          document.body.classList.remove('busy')
        }, 1000);
      }
      
  }

  let formData = new FormData(e.target.form)
  let newsavedata = {}

  for (const [key, value] of formData) {
    newsavedata[key] = value;
  }

  for (const checkbox of settingsForm.querySelectorAll('input[type="checkbox"]')) {
    if (checkbox.name) {
      newsavedata[checkbox.name] = checkbox.checked;
    }
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
  e.preventDefault();
  
  document.body.classList.add('busy');
  let formData = new FormData(e.target)
  let newsavedata = {}

  for (const [key, value] of formData) {
    newsavedata[key] = value;
  }

  for (const checkbox of settingsForm.querySelectorAll('input[type="checkbox"]')) {
    if (checkbox.name) {
      newsavedata[checkbox.name] = checkbox.checked;
    }
  }

  localStorage.setItem('savedata', JSON.stringify(newsavedata));
  savedata = {...newsavedata};

  initGame(savedata);
  return false;
});


// Luister naar het sluiten van de dialoog
lobbyDialog.addEventListener('close', () => {
  console.warn('en hie zoujiu de gtame moeten starten')
  document.body.dataset['screen'] = 'game';
});

function initGame(playerSettings) {
  console.groupCollapsed('Starting game with settings:')
  console.log(playerSettings);
  console.groupEnd()
  
  window.game = new GameEngine(playerSettings);
  
}