export default class LapTimer {
  constructor(game, sectors) {
    this.game = game
    this.world = game.world;
    this.sectors = sectors;

    this.currentSector = 0; 
    this.lastSectorTime = 0;
    this.laps = [];
    this.currentLap = { sectors: [] };
    this.bestLapTime = Infinity;
    
    // Hold/Freeze logica voor de HUD
    this.holdSectorTime = false;
    this.frozenDisplayTime = '0.0';
    this.timerInterval = 0;         // telt frames (deltaTime)
    this.holdDurationFrames = 270;   // 4.5 seconden (4.5 * 60 frames)

    // Haal referentie naar de speler en HUD op
    this.player = this.game.localPlayer;
    this.sessionTimesTable = window.sessionmenu?.querySelector('table');
  }

  // Tijdnotatie helpers die strings teruggeven die je oude HUD verwacht
  formatLiveTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${secs}.${tenths}`;
  }

  formatFullTime(milliseconds) {
    const mins = Math.floor(milliseconds / 60000);
    const secs = Math.floor((milliseconds % 60000) / 1000);
    const ms = Math.floor(milliseconds % 1000);

    const strMins = mins > 0 ? `${mins}:` : '';
    const strSecs = secs.toString().padStart(2, '0');
    const strMs = ms.toString().padStart(3, '0');

    return `${strMins}${strSecs}.${strMs}`;
  }

  checkSectors(x, y) {
    for (let [id, path] of this.sectors) {
      if (this.world.logicCtx.isPointInPath(path, x, y)) {
        return id; // Geeft 's0', 's1' of 's2' terug
      }
    }
    return null;
  }

  update(deltaTime) {
    if (!this.game?.hud) return;

    // 1. BEHEER DE HOLD/FREEZE FASE
    if (this.holdSectorTime) {
      this.timerInterval += deltaTime; // Tel frames op

      // Omdat de Player-klasse de split-tijd al als string naar de HUD heeft gepost,
      // overschrijven we die hier NIET met de live-tijd. We houden de laatst geposte tijd vast.
      // (Als we een volledige ronde finishen, berekent de update hieronder de Best Lap)
      
      // Na 4.5 seconden (270 frames) heffen we de hold op
      if (this.timerInterval >= this.holdDurationFrames) {
        this.holdSectorTime = false;
        this.timerInterval = 0;
        
        // ..BUT WE'RE NOT ADDING .fastest ANYWHERE YET
        const lapCounter = this.game.hud.domCurrentLap;
        if (lapCounter) lapCounter.classList.remove('fastest');
      }
    } 
    // 2. NORMALE LIVE TIKTELLER
    else if (this.player.lapStartTime) {
      const now = new Date().getTime();
      const currentElapsed = now - this.player.lapStartTime;
      
      // Toon de live klok op 1 decimaal (SS.s)
      if(this.currentLap.startTime) {
        this.game.hud.postMessage('timing', 'thislap', this.formatLiveTime(currentElapsed));
      }
      this.game.hud.domCurrentLap.dataset.lap = this.laps.length + 1;
    }

    // 3. BESTE RONDETIJD REKENEN & UPDATEN (Best Lap)
    if (this.laps.length > 1) {
      // Sorteer je .laps array op basis van jouw 'totalTime' property
      const sorted = [...this.laps].sort((a, b) => a.totalTime - b.totalTime);
      this.bestLapTime = sorted[0].totalTime;

      let bestlapNumber = this.laps.findIndex(item => item.totalTime == this.bestLapTime);
      this.game.hud.postMessage('timing', 'bestlap', this.formatFullTime(this.bestLapTime));
      this.game.hud.domBestLap.dataset.lap = 1 + bestlapNumber;

      this.game.hud.postMessage('team','radio', 'Nice. That\'s your fastest lap so far!')

      let announce = `${this.player.name} (car ${this.player.driverNumber}) set a new personal best lap time!`
      this.game.network.send({
          type: 'racecontrol',
          section: 'notice',
          message: announce
      });

      // Update ook de lap times tabel als er een nieuwe lap is bijgekomen
      // TODO: 2 tabellen, 1 met iedereen's beste tijd, 1 met al mijn lap times
      // this.updateSessionLaptimesTable();
    } else {
      // ? niks
    }
  }

  // Bouw de paddock tabel op op basis van de laps array structuur
  updateSessionLaptimesTable() {
    if (!this.sessionTimesTable) return;

    let laptimesListMarkup = '';
    this.laps.forEach((lap, index) => {
      const isBest = lap.totalTime === this.bestLapTime;
      
      // Haal de splits uit jouw lap.sectors array (index 0, 1 en 2)
      const s0 = lap.sectors[0] ? (lap.sectors[0].time / 1000).toFixed(3) : '-';
      const s1 = lap.sectors[1] ? (lap.sectors[1].time / 1000).toFixed(3) : '-';
      const s2 = lap.sectors[2] ? (lap.sectors[2].time / 1000).toFixed(3) : '-';

      laptimesListMarkup += `
        <tr class="${isBest ? 'fastest' : ''}">
          <td><strong>Ronde ${index + 1}</strong></td>
          <td><strong>${this.formatFullTime(lap.totalTime)}</strong></td> 
          <td>${s0}</td>
          <td>${s1}</td>
          <td>${s2}</td>
          <td><small></small></td>
        </tr>
      `;
    });

    if (this.sessionTimesTable.tBodies[0]) {
      this.sessionTimesTable.tBodies[0].innerHTML = laptimesListMarkup;
    }
  }
}
