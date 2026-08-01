// js/CameraTweaker.js
export default class CameraTweaker {
  constructor(game) {
    this.game = game;
    this.container = document.createElement('details');
    this.container.setAttribute('open','');
    this.container.name = "camming"
    this.container.className = 'tweak-group camera-panel';
    this._setupUI();
  }

  _setupUI() {
    this.container.innerHTML = `
      <summary class="tweak-group__summary">📹 Graphics</summary>
      <fieldset>
      <legend>Camera target</legend>
      <label class="tweak-field">
        <span>Free Roam Mode</span>
        <input type="checkbox" id="cam-freeroam">
      </label>
      <ul class="target-list"></ul>
      </fieldset>
      <fieldset class="time">
        <legend>Time of Day</legend>
        ⌚<label for="time-of-day">
            <input type="range" name="time-of-day" id="time-of-day" value="0.0625" min="0" max="1" step=".0125" list="hours" />
            <datalist id="hours">
              <option value="0">12 am</option>
              <option value=".25">6 am</option>
              <option value=".5">12 pm</option>
              <option value=".75">6 pm</option>
              <option value="1">12 am</option>
            </datalist>
            <output for="time-of-day"></output>
        </label>
      </fieldset>
      <fieldset class="post-processing">
        <legend>compositing</legend>
        <label><input type="radio" name="postProcessing" value="" /> OFF</label>
        <label><input type="radio" name="postProcessing" value="on" checked/> ON</label>
        <label><input type="radio" name="postProcessing" value="crt" checked/> CRT</label>
      </fieldset>
      <fieldset class="post-processing-settings">
        <label for="opacity"><span>opacity</span><input type="range" name="opacity" id="opacity" value="0.5" min="0" max="1" step=".1" /><output for="opacity">0.6</output></label>
        <label for="blur"><span>blur</span><input type="range" name="blur" id="blur" value="1" min="0" max="64" step="1" /><output for="blur">16</output></label>
        <label for="saturate"><span>saturate</span><input type="range" name="saturate" id="saturate" value="1.4" min="0" max="5" step=".1"/><output for="saturate">2</output></label>
        <label for="brightness"><span>brightness</span><input type="range" name="brightness" id="brightness" value=".9" min="0" max="10" step=".05"/><output for="brightness">0.8</output></label>
        <label for="contrast"><span>contrast</span><input type="range" name="contrast" id="contrast" value="1.2" min="0" max="2.5" step=".01"/><output for="contrast">1.7</output></label>
        <label for="hue"><span>hue</span><input type="range" name="hue" id="hue" value="0" min="0" max="360" step="1" /><output for="hue">0</output></label>
      </fieldset>
      <style> 
      .post-processing-settings {
        display: flex; flex-direction: column;
        gap: 1ex;
        padding: 1ex;
        label {
          display: flex;
          gap: 1ex;
          span {
            flex: 0 0 5ch;
            overflow: hidden;
            font-size: smaller;
          }
            input {max-width: 5rem}
           output {font-size: smaller;}
        }
       } 
      </style>
    `;

    this.container.querySelector('#cam-freeroam').onchange = (e) => {
      this.game.camera.freeRoam = e.target.checked;
    };

    let postProcessOptions = this.container.querySelectorAll('fieldset input');

    postProcessOptions.forEach ( option => {
      option.addEventListener('input', (e) => {
        if (e.target.type == 'radio') {
          this.game.camera.element.dataset[e.target.name] = e.target.value;
        }
        if(e.target.type == 'range') {
          this.game.camera.element.style.setProperty(`--pp-${e.target.name}`, e.target.value)
          e.target.parentNode.querySelector('output').textContent = Number(e.target.value).toFixed(2)
          if(e.target.name == 'time-of-day') {
            const timeOfDay = Number(e.target.value).toFixed(2);
            this.game.camera.updateSunPosition(timeOfDay);
            if (this.game.network?.isHost) {
              this.game.network.send({ type: 'daytime', value: timeOfDay });
            }
          }
        }

      });
      let initEvent = new Event('input');
      option.dispatchEvent(initEvent);
    })

    document.getElementById('debug').appendChild(this.container);
    this.refresh();
  }

  setTimeOfDay (value) {
    const range = this.container.querySelector('#time-of-day');
    const output = this.container.querySelector('output[for="time-of-day"]');
    if (range) {
      range.value = value;
    }
    if (output) {
      output.textContent = Number(value).toFixed(2);
    }
    this.game.camera.element.style.setProperty(`--pp-time-of-day`, value);
    this.game.camera.updateSunPosition(Number(value).toFixed(2));
  }

  // js/CameraTweaker.js
  refresh () {
    const list = this.container.querySelector('.target-list');
    list.innerHTML = '';

    // 1. Verzamel targets uit de verschillende Maps
    // We zetten de Maps om naar arrays van waarden voor de weergave
    const targets = [
      { id: 'local', name: '🚗 Local Player', ref: this.game.localPlayer },
      
      // Uitlezen van de opponents Map (Network + AI)
      ...Array.from(this.game.opponents.values()).map(opp => ({
        id: opp.id,
        name: `${opp.isAI ? '🤖' : '👤'} ${opp.name || 'Opponent'}`,
        ref: opp
      })),
      /*
      // Uitlezen van de worldObjects Map (Huisjes, Paddock, etc.)
      ...Array.from(this.game.worldObjects.values()).map(obj => ({
        id: obj.id,
        name: `🏠 ${obj.name || 'Object'}`,
        ref: obj
      }))
      */
    ];

    // 2. Bouw de radio buttons
    targets.forEach(t => {
      const label = document.createElement('label');
      label.className = 'camera-radio';
      // Check of dit de huidige actieve target is
      const isChecked = this.game.camera.target === t.ref ? 'checked' : '';
      
      label.innerHTML = `
        <input type="radio" name="cam-target" value="${t.id}" ${isChecked}>
        <span>${t.name}</span>
      `;

      label.querySelector('input').onchange = () => {
        this.game.camera.setTarget(t.ref);
      };

      list.appendChild(label);
    });
  }
}