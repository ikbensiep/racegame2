export default class HeadsupDisplay {
  constructor(game) {
    this.game = game;
    this.element = document.querySelector('#hud');
    this.domBestLap = this.element.querySelector('.timing .bestlap');
    this.domCurrentLap = this.element.querySelector('.timing .thislap');
    this.domLastLap = this.element.querySelector('.timing .lastlap');

    this.competitorsContainer = this.element.querySelector('.competitors');

    this.domCache = {};
    this.messages = {};
    this.autohideTime = 10000;
    this.sessionTime = this.game.sessionTime;
    this.sessionElapsed = 0;
  }

  // Efficiënte cache van DOM-elementen
  getContainer(section, type) {
    const key = `${section}-${type}`;
    if (!this.domCache[key]) {
        this.domCache[key] = this.element.querySelector(`.${section} .${type}`);
    }
    return this.domCache[key];
  }

  // Geoptimaliseerde postMessage (gebaseerd op lofigame/js/Hud.js)
  postMessage(section, type, message, autohideMilliseconds = 0) {
      if (!this.messages[section]) this.messages[section] = {};

      // Voorkom onnodige DOM updates
      if (this.messages[section][type] === message) return;
      this.messages[section][type] = message;
      
      const container = this.getContainer(section, type);
      if (container) {
          container.innerHTML = message;
          // we use this dataset as a CSS hook (ie style purple on fastest lap status, yellow/red flag session status etc)
          if (type === 'status') container.dataset.status = message;

          if (autohideMilliseconds) {
              setTimeout(() => {
                  if (this.messages[section][type] === message) {
                      container.innerHTML = '';
                      this.messages[section][type] = '';
                  }
              }, Number.isInteger(autohideMilliseconds) ? autohideMilliseconds : this.autohideTime);
          }
      }
  }

  // Competitor beheer
  // TODO: repurpose (clone?) player-tag
  // instead of creating a card here
  // also: announce via race control

  addCompetitor(fren) {

    let playerTag = fren.element?.querySelector('.player-tag');
    let competitorEl = playerTag.cloneNode(true);
    const li = document.createElement('li');
    li.dataset.vehicleId = playerTag.parentElement.dataset.vehicleId
    li.style.setProperty('--driver-color', fren.color);
    li.appendChild(competitorEl)
    if (this.competitorsContainer) this.competitorsContainer.appendChild(li);
  }

  // TODO: outdated selector 
  // also: remove light element
  // also: announce via race control
  removeCompetitor(playerId) {
    const competitor = this.element.querySelector(`[data-carnumber="${playerId}"]`);
    if (competitor) competitor.remove();
  }

  millisToMinutesAndSeconds(millis) {
    const absoluteMillis = Math.max(0, millis);
    
    // Puur rekenen met echte milliseconden
    const minutes = Math.floor(absoluteMillis / 60000);
    const seconds = Math.floor((absoluteMillis % 60000) / 1000);
    
    const strMinutes = minutes.toString();
    const strSeconds = seconds.toString().padStart(2, '0');
    
    return `${strMinutes}:${strSeconds}`;
  }

  updateSessionTime () {
    let clock = this.millisToMinutesAndSeconds(this.sessionTime);
    this.postMessage('session','time', clock);
  }

  update(deltaTime) {
     if (this.sessionTime > 0) {

      // deltaTime komt binnen als frames (~1.0). 
      // Door te vermenigvuldigen met 16.66 maken we er echte milliseconden van!
      const deltaMillis = deltaTime * 16.66;
      this.sessionTime -= deltaMillis;
      this.sessionElapsed += deltaMillis;

      if(this.sessionTime <= 0) {
        this.sessionTime = 0;
        this.postMessage('session','status','finished')
        this.postMessage('racecontrol','notice' ,'Session Finished');
      } else {
        this.updateSessionTime();
      }
      return this.sessionTime;
    }
  }
}
