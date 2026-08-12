// js/CameraTweaker.js
export default class CameraTweaker {
  constructor(game) {
    this.game = game;
    this.element = document.querySelector('#camera-menu');
    this.cameraTargetList = this.element.querySelector('.target-list');

    this.init();
  }

  init() {

    this.element.querySelector('#cam-freeroam').addEventListener('change', (e) => {
      this.game.camera.freeRoam = e.target.checked;
    });

    let postProcessOptions = this.element.querySelectorAll('fieldset#post-processing input');

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

    this.refresh();
  }

  
  refresh () {

    this.cameraTargetList.innerHTML = '';

    // turning the opponents Map into a `targets` Array
    const targets = [
      { id: 'local', name: `🚗 ${this.game.localPlayer.name} (Local Player)`, ref: this.game.localPlayer },
      
      // Uitlezen van de opponents Map (Network + AI)
      ...Array.from(this.game.opponents.values()).map(opp => ({
        id: opp.id,
        name: `${opp.isAI ? '🤖' : '👤'} ${opp.name || 'Opponent'}`,
        ref: opp
      })),
    ];

    // create selector UI element for each target
    targets.forEach(t => {
      const li = document.createElement('li')
      const label = document.createElement('label');
      label.className = 'camera-radio';

      // if this item is the cameras current target, check the radio button
      const isChecked = this.game.camera.target === t.ref ? 'checked' : '';
      
      label.innerHTML = `
        <input type="radio" name="cam-target" value="${t.id}" ${isChecked}>
        <span>${t.name}</span>
      `;

      label.querySelector('input').addEventListener('change', () => {
        this.game.camera.setTarget(t.ref);
      });

      li.appendChild(label);
      this.cameraTargetList.appendChild(li);
    });
  }
}