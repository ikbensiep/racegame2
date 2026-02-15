// js/CameraTweaker.js
export default class CameraTweaker {
  constructor(game) {
    this.game = game;
    this.container = document.createElement('details');
    this.container.name = "tweaker"
    this.container.className = 'tweak-group camera-panel';
    this._setupUI();
  }

  _setupUI() {
    this.container.innerHTML = `
      <summary class="tweak-group__summary">🎥 Camera</summary>
      <fieldset>
      <label class="tweak-field">
        <span>Free Roam Mode</span>
        <input type="checkbox" id="cam-freeroam">
      </label>
      </fieldset>
      <fieldset>
      <ul class="target-list"></ul>
      </fieldset>
    `;

    this.container.querySelector('#cam-freeroam').onchange = (e) => {
      this.game.camera.freeRoam = e.target.checked;
    };

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