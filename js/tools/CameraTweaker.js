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
      <summary class="tweak-group__summary">Craphics & Gamera</summary>
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
        <label for="time-of-day"><input type="range" name="time-of-day" id="time-of-day" value="0" min="-1" max="1" step=".0725" />time <output for="time-of-day"></output></label>
      </fieldset>
      <fieldset class="post-processing">
        <legend>compositing</legend>
        <label><input type="radio" name="postProcessing" value="" checked /> OFF</label>
        <label><input type="radio" name="postProcessing" value="crt" /> CRT</label>
        <label for="opacity"><input type="range" name="opacity" id="opacity" value="0.5" min="0" max="1" step=".1" />opacity <output for="opacity"></output></label>
        <label for="blur"><input type="range" name="blur" id="blur" value="0" min="0" max="128" step="1" />blur <output for="blur"></output></label>
        <label for="saturate"><input type="range" name="saturate" id="saturate" value="0" min="0" max="5" step=".1"/>saturate <output for="saturate"></output></label>
        <label for="brightness"><input type="range" name="brightness" id="brightness" value="1" min="0" max="10" step=".05"/>brightness <output for="brightness"></output></label>
        <label for="contrast"><input type="range" name="contrast" id="contrast" value="1" min="0" max="2.5" step=".01"/>contrast <output for="contrast"></output></label>
        <label for="hue"><input type="range" name="hue" id="hue" value="0" min="0" max="360" step="1" />hue <output for="hue"></output></label>
      </fieldset>
    `;

    this.container.querySelector('#cam-freeroam').onchange = (e) => {
      this.game.camera.freeRoam = e.target.checked;
    };

    let postProcessOptions = this.container.querySelectorAll('fieldset input');

    postProcessOptions.forEach ( option => {
      option.addEventListener('input', (e) => {
        if (e.target.type == 'radio') {
          console.log('hoi')
          this.game.camera.element.dataset[e.target.name] = e.target.value;
        }
        if(e.target.type == 'range') { 
          this.game.camera.element.style.setProperty(`--pp-${e.target.name}`, e.target.value)
        }

      });
    })

    document.getElementById('debug').appendChild(this.container);
    this.refresh();
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