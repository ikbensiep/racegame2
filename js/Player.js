import Emitter from './tools/Emitter.js'
import InputHandler from './InputHandler.js';
import { getDistance, sidesFromHypotenhuse } from './tools/MathUtils.js';
import Vehicle from './Vehicle.js';
import { TweakManager } from './tools/Tweaker.js';
import * as Presets from './VehicleDynamics.js';
import * as SurfaceModule from './SurfaceDynamics.js';

export default class Player extends Vehicle {
  constructor(game, id, name, driverNumber = 0, color = 'red', team = 'porsche', livery = '', isLocal = false) {
    super(game, id, name, driverNumber, color, team, livery, isLocal);
    this.game = game;

    this.x = null;
    this.y = null;
    this.radius = 32;

    this.dynamics = {};
    Object.assign(this.dynamics, Presets.DefaultDynamics);
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0; 
    this.steerInput = 0;
    this.movementAngle = 0;

    this.vehicleTweaker = new TweakManager(this.dynamics, "🚗 Dynamics", '#car-dynamics');
    this.vehicleTweaker._addPresetDropdown(Presets);

    this.SurfaceData = SurfaceModule.Surfaces;
    this.surfaceTweaker = new TweakManager(this.SurfaceData.asphalt, "🚛 Surface", '#surface-dynamics');
    this.surfaceTweaker._addPresetDropdown(this.SurfaceData);

    this.xp = 0;
    this.canScore = true;
    
    this.lastSectorId = null; // Om herhaling te voorkomen terwijl je op het vlak staat
    this.currentSector = 2; // Begin op 2, zodat s0 de eerstvolgende logische stap is
    this.lapStartTime = new Date().getTime();

    this.inputHandler = new InputHandler();
    this.intervalUpdateTimer = 0;
    this.engineShutDownTimer = 500;

    let esoUrl = '/assets/sound/570258__fritzsounds__engine_shutdown.ogg';
    this.engineShutDownSound = this.game.soundManager.load('engine-shutoff', esoUrl);

    this.fik = null;

    this.garageRules = {
      'refuel': false,
      'refuelLimit': 50,
      'repair': false
    }

    this.init();
  }

  async init () {
    this.tireTrackPool = [];
    this.maxTireTracks = 80;
    this.tireTrackInterval = 0;
    this.createTireTracks();

    this.smokePool = [];
    this.maxSmoke = 40;
    this.smokeInterval = 0;
    this.createSmokePuffs();

    this.fik = this.getSmoke('fire');
    this.element.style.setProperty('--max-speed', this.dynamics.maxSpeed);
    this.game.hud.addCompetitor(this);
    this.engineRunning = true;

    this.garageDialog = document.querySelector('dialog#garage-menu');
    this.garageSettingsForm = this.garageDialog.querySelector('form')
    this.initGarageSettings();

  }

  initGarageSettings () {

    this.garageDialog.addEventListener('toggle', (e) => {
      const dialogState = e.newState;

      switch (dialogState) {
        case 'open' :
          this.garageSettingsForm.refuelLimit.value = this.fuel;
          break;

        case 'closed':
          // hol mal den Wagen
          const formData = new FormData(this.garageSettingsForm);
          const formEntries = Object.fromEntries(formData.entries());
          this.updateGarageSettings(formEntries);
          break;
      }
    });
  }

  updateGarageSettings (settingsData) {
    
    this.garageRules = {
      ...this.garageRules,
      ...settingsData
    }

    this.game.hud.postMessage('team','status',`Alright, let's get to work!`, 3000);
    
  }

  createTireTracks () {
    for(let i=0; i<this.maxTireTracks; i++) {
      this.tireTrackPool.push(new Emitter(this.game, window.rubberTrackSprite, 128, 85, 1, false, this.game.world.element, false));
    }
  }

  getTireTrack () {
    for(let i=0; i< this.tireTrackPool.length; i++) {
      this.tireTrackPool[i].domElement.id=`tiretracc-${i}`
      if (this.tireTrackPool[i].free) {
        this.tireTrackPool[i].domElement.classList.add('fade');
        return this.tireTrackPool[i];
      }
    }
  }

  createSmokePuffs () {
    for(let i=0; i<this.maxSmoke; i++) {
      this.smokePool.push(new Emitter(this.game, window.smokeSprite, 256, 256, 11, false, this.game.world.element, false));
    }
  }

  getSmoke (type, x, y) {
    for(let i=0; i< this.smokePool.length; i++) {
      this.smokePool[i].domElement.id=`smoke-${i}`
      if (this.smokePool[i].free) {
        this.smokePool[i].domElement.classList.add(type);
        return this.smokePool[i];
      }
    }
  }

  _applyPhysics(input, dt) {
      const d = this.dynamics;
      const s = this.SurfaceData[this.activeSurface] || this.SurfaceData.asphalt;
      
      // 0. Inputs uitlezen (geabstraheerd)
      const gas = input.gas;
      const brake = input.brake;
      const handbrake = input.handbrake;
      const steerInput = Math.max(-1, Math.min(1, input.steer)); // Clamp tussen -1 en 1
      
      this.isBraking = brake > 0;

      // Multipliers
      let currentAccel = d.acceleration * s.power;
      let currentFriction = d.friction * s.drag;
      const currentDrift = handbrake ? d.handbrakeDrift : d.driftFactor;
      const currentGrip = (1 - currentDrift) * s.grip;

      this.element.dataset.drift = currentDrift.toFixed(2);
      this.element.dataset.accel = currentAccel.toFixed(2);
      this.element.dataset.friction = currentFriction.toFixed(2);
      this.element.dataset.grip = currentGrip.toFixed(2);

      if (this.fuel <= 0 && Math.abs(this.speed) > 0) {
        // Define how fast it should coast to a stop when empty
        const coastingFriction = currentFriction * .2; 
        const reduction = coastingFriction * dt * .25;

        if (Math.abs(Math.floor(this.speed)) <= reduction) {
          this.speed = 0;
        } else {
          // Math.sign returns 1 for positive, -1 for negative
          currentAccel = 0;
          currentFriction = 1;
          this.speed -= Math.sign(this.speed) * reduction;
          
        }
      }

      // 1. Versnelling & Remmen
      if (gas > 0) this.speed += (gas * currentAccel) * dt;
      if (brake > 0 && Math.abs(this.speed) > 0) this.speed -= (brake * currentFriction) * (dt / 2);

      // Snelheidslimiet
      if (this.speed > d.maxSpeed) this.speed = d.maxSpeed;
      if (this.speed < -d.maxSpeed) this.speed = -d.maxSpeed;

      // 2. Wrijving
      this.speed *= (1 - (1 - d.friction) * dt);

      // 3. Verbeterd Sturen
      if (Math.abs(steerInput) > 0.1) {
          // speedFactor: voorkomt sturen bij stilstand
          const speedFactor = Math.min(Math.abs(this.speed) / 5, 1.0); 
          
          // High-speed stability: verminder de stuurkracht naarmate je harder gaat
          // Hoe hoger de deler (bijv. 1.5), hoe stabieler op hoge snelheid
          const stabilityFactor = 1 / (1 + (Math.abs(this.speed) / (d.maxSpeed / 1.5)));
          
          const direction = this.speed >= 0 ? 1 : -1;
          
          // Combineer alles voor de uiteindelijke hoek-verandering
          const steerAmount = (steerInput * d.steeringSensitivity * speedFactor * stabilityFactor * direction) * dt;
          
          this.angle += steerAmount;
      }

      // 4. Grip & Drift 
      
      const targetVX = Math.cos(this.angle) * this.speed;
      const targetVY = Math.sin(this.angle) * this.speed;

      const lerpFactor = 1 - Math.pow(1 - currentGrip, dt);
      this.vx += (targetVX - this.vx) * lerpFactor;
      this.vy += (targetVY - this.vy) * lerpFactor;

      this.movementAngle = Math.atan2(this.vy, this.vx);

      // 5. Beweging
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // TODO: move to function
      if( 
        (this.tireTrackInterval > 3) 
        &&
        (
          (brake && this.speed > 10) || 
          (this.speed > 10 && (currentGrip < .2 || currentDrift > .5))
        )
        ) {
        let smoke = this.getSmoke();
        let tiretrack = this.getTireTrack();
        let offset = sidesFromHypotenhuse(this.width, this.movementAngle)
        if(tiretrack) {
          tiretrack.domElement.dataset.speed = Math.floor(this.speed);
          tiretrack.domElement.style.setProperty('--speed', Math.floor(this.speed * 2));
          tiretrack.domElement.className = `emitter-object sprite rubber ${this.activeSurface} fade`;
          tiretrack.start(this.x - offset.width, this.y - offset.height, `${this.movementAngle}rad`); // Use movement direction for sprite rotation
          if(smoke) {
            const imgEl = smoke.imgEl?.tagName === 'IMG' ? smoke.imgEl : smoke.domElement.querySelector('img');
            if (imgEl) {
              imgEl.src = '';
            }
            smoke.domElement.className = `emitter-object sprite smoke ${this.activeSurface}`;
            // TODO: investigate why this *appears* to have 
            // 0 (zip, zilch, nada) influence on 
            // where the sprite starts?
            smoke.start(this.x + offset.width * 2 , this.y + offset.height * 2, `${((Math.random() * 720) - 360)}deg`);
          }
        }
        this.tireTrackInterval = 0;
      } else {
        this.tireTrackInterval += dt;
      }
  }
  
  _resolveCollision(hit) {

    const hitRadius = hit.r !== undefined ? hit.r : hit.radius;
    
    const dx = this.x - hit.x;
    const dy = this.y - hit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Voorkom delen door nul als objecten exact op elkaar staan
    if (distance === 0) return;

    const angle = Math.atan2(dy, dx);
    const minDist = this.radius + hitRadius;

    // 1. Positionele correctie (NaN-veilig)
    this.x = hit.x + Math.cos(angle) * (minDist + 1);
    this.y = hit.y + Math.sin(angle) * (minDist + 1);

    // 2. Physics aanpassing
    // Tunable rotation + realistic velocity reflection across the collision normal.
    const speedMag = Math.hypot(this.vx, this.vy);

    // Tunables from dynamics (visible in the Dynamics tweaker)
    const rotFactor = (this.dynamics && this.dynamics.collisionRotationFactor) || 1.0;
    const reflectFactor = (this.dynamics && this.dynamics.collisionReflection) || 0.9;

    if (speedMag > 0.001) {
      const movementAngle = Math.atan2(this.vy, this.vx);
      const impactAngle = angle; // hoek vanaf hit-centrum naar speler

      // Normaliseer verschil naar [-PI, PI]
      let angleDiff = movementAngle - impactAngle;
      while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      // Roteer tegen de rij-as in met geschaalde afwijking
      this.angle -= angleDiff * rotFactor;

      // Normaliseer speler-hoek naar [-PI, PI]
      if (this.angle <= -Math.PI || this.angle > Math.PI) {
        this.angle = ((this.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
      }

      // Reflecteer velocity over de collision-normal (realistischer bounce)
      const nx = Math.cos(angle); // normale richting (van hit naar speler)
      const ny = Math.sin(angle);
      const dot = this.vx * nx + this.vy * ny;
      const reflectedVX = this.vx - 2 * dot * nx;
      const reflectedVY = this.vy - 2 * dot * ny;

      this.vx = reflectedVX * reflectFactor;
      this.vy = reflectedVY * reflectFactor;

      // Update scalar speed projected op de nieuwe forward vector
      this.speed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
    } else {
      // fallback — houd het oude invert/dampen-gedrag voor zeer lage snelheden
      //this.speed *= 0.975;
      this.vx *= -0.999;
      this.vy *= -0.999;
    }

    this.handleCollision(speedMag);
  }

  handleCollision (speedMag) {

    // 1. Controller Trillen (Rumble)
    // De meeste moderne gamepads ondersteunen 'dual-rumble'
    this.playHapticFeedBack ( 
      {
        startDelay: 0,
        duration: 50 * this.speed,     
        weakMagnitude: 1, // De lichte trilmotor
        strongMagnitude: (this.speed / 50) / 100
      });
    

    // 2. Geluid afspelen
    // We gebruiken een simpele Audio-object check
    // const crashSound = document.getElementById('sfx-crash');
    // if (crashSound) {
    //     crashSound.currentTime = 0; // Reset naar begin (voor snelle herhaling)
    //     crashSound.play().catch(e => {}); // Catch om browser-autostart fouten te voorkomen
    // }

    // 3. Reduce car health
    let pain = speedMag * -.1;
    this.updateHealth(pain);

  }

  handleSectorPass(num) {
    const now = new Date().getTime();
    const previousSector = this.currentSector;
    const splitTime = now - this.game.world.lapTimer.lastSectorTime;
    const lapTimer = this.game.world.lapTimer;

    if (!lapTimer.currentLap) {
      lapTimer.currentLap = { sectors: [] };
    }

    const sectorEntry = {
      time: splitTime,
      penalty: false
    };

    lapTimer.currentLap.sectors.push(sectorEntry);
    
    // console.log(lapTimer.currentLap)

    // Finishlijn gepasseerd (Sector 0)
    if (num === 0) { 
      
      // Alleen als we s1 en s2 hebben gehad
      if (previousSector === 2) { 
        const lapTime = now - this.lapStartTime;
        this.xp += 100; // Bonus voor voltooide ronde
        this.game.hud.postMessage('team', 'radio',  '+ 100xp', 1500);

        lapTimer.holdSectorTime = true;
        
        // only after 1 (install) lap?
        if(this.game.world.lapTimer.currentLap.startTime) {
          this.game.hud.postMessage('timing','lastlap', this.game.world.lapTimer.formatFullTime(lapTime))
        }
        
        if(lapTimer.currentLap.sectors.length === 3) {

          lapTimer.laps.push({
            sectors: lapTimer.currentLap.sectors,
            totalTime: lapTime,
            startTime: this.lapStartTime
          });
        }
        this.lapStartTime = now;
        lapTimer.currentLap = { sectors: [], startTime: now};
      }
    } else {
      this.xp += 50; // Kleine XP bonus voor tussen-sector
      console.log(`Sector ${num} split: ${(splitTime/1000).toFixed(3)}s`);
      // show sector split times
      lapTimer.holdSectorTime = true;
      this.game.hud.postMessage('timing', 'thislap',  (splitTime/1000).toFixed(3));
      this.game.hud.postMessage('team', 'radio',  '+ 50xp', 1500);
    }

    this.currentSector = num;
    lapTimer.currentSector = num;
    lapTimer.lastSectorTime = now;
  }

  playHapticFeedBack (haptics) {
    // Always get a fresh gamepad reference from navigator for vibrationActuator
    // Using a stale reference can fail, especially in Chrome
    const gamepad = navigator.getGamepads()[0];
    if(!gamepad || !gamepad.vibrationActuator ) return;
    
    gamepad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: haptics.startDelay || 0,
      duration: haptics.duration || 20,      // Kort maar krachtig
      weakMagnitude: haptics.weakMagnitude || 0.5, // De lichte trilmotor
      strongMagnitude: haptics.strongMagnitude || 0.2 // De zware trilmotor (voor de klap)
    }).catch(err => {
      // Gracefully handle any vibration API errors
      console.warn('Haptic feedback failed:', err);
    });
  }

  honk () {
    console.log('HONMK')
  }

  toggleHighbeam () {
    this.lightsElement.classList.toggle('highbeam');
  }

  onLevelUp() {
    // Voorbeeld: elke 500 XP gaat je ranking omhoog
    const level = Math.floor(this.xp / 500);
    this.game.hud.postMessage('racecontrol','notice', `Level up! ${level} (${this.xp}xp)`)
  }

  update(dt) {

    if (!this.isLocal) return;
    
    // Debug: track calls per frame
    if (!window.__playerUpdateCount) window.__playerUpdateCount = 0;
    window.__playerUpdateCount++;
    
    
    let sessionTime = this.game.hud.update(dt);

    const input = this.inputHandler.getInputs();
    
    const surface = this.game.world.getSurfaceType(this.x, this.y, this);

    if(this.intervalUpdateTimer < 10) {
      this.intervalUpdateTimer += dt;
    } else {

      this.intervalUpdateTimer = 0;
      this.element.dataset.vx = Math.floor(this.vx);
      this.element.dataset.vy = Math.floor(this.vy);
      this.element.dataset.angle = Math.floor(this.angle);
      
      let playHaptics = false;

      if(this.activeSurface !== surface) {
        this.activeSurface = surface;
        this.element.dataset.state = surface;
        if (!surface || surface == '') {
          this.element.removeAttribute('data-state')
        }
      }
  
      let haptics = {
        startDelay: 0,
        duration: 1000,
        weakMagnitude: 1, 
        strongMagnitude: 0
      }

      switch(this.activeSurface) {
        case 'sand':
        case 'gravel':
          this.health -= 0.001;
          haptics.strongMagnitude = this.speed / 20;
          playHaptics = true;
          this.game.hud.postMessage('team','radio', 'Lap invalidated, track limits', 3500);
          break;
        case 'asphalt':
          haptics.weakMagnitude = this.speed / 100;
          haptics.strongMagnitude = .1;
          playHaptics = true;
          break;
        case 'pitbox':
          if(Math.abs(this.speed) < 1) this.speed = 0;
          
          // this is a bit houtje towtje checking for standing still and 
          // then if we're allowed to refuel and then if we're below the 
          // desired refuel limit. Probably better ways to handle this..
          // we're only setting refuel to {not falsy} using the dialog close
          // (toggle) event just so that the pit crew doesnt start refueling right away
          if((this.fuel < this.maxFuel) && (Math.floor(this.speed) == 0)) {
            if(this.garageRules.refuel && this.garageRules.refuelLimit > this.fuel){
            this.fuel += 2.5;
            }
          }

          // this needs to be implemented for repairs as well.. manjaana.
          if((this.health < this.maxFuel) && Math.floor(this.speed) == 0 && this.garageRules.repair) {
            this.health += .25;
          }
          break;
        default:
          // playHaptics = false;
          break;
      }

      playHaptics ?? this.playHapticFeedBack (haptics)

      // Update our own engine sound (pitch only - listener is self so pan stays centered)
       
      if (this.engineSound) {
        if (this.activeSurface === 'tunnel') {
          const nextTunnel = Math.min(1, (this.engineSound.tunnelReverbAmount || 0) + 0.15);
          this.engineSound.setTunnelReverbLevel(nextTunnel);
        } else {
          const nextTunnel = Math.max(0, (this.engineSound.tunnelReverbAmount || 0) - 0.05);
          this.engineSound.setTunnelReverbLevel(nextTunnel);
        }
 
        this.engineSound.update(
          (Math.abs(Math.floor(this.speed)) * .025),
          {
            source: this,
            listener: this,
            screenSpace: !!this.game.settings.audioPanScreenSpace,
            maxDistance: 8192
          }
        );
        // compute target gain safely — guard against divide-by-zero or missing dynamics
        let base = 0.2;
        let targetValue = base;
        try {
          if (this.dynamics && this.dynamics.maxSpeed && this.dynamics.maxSpeed > 0) {
            targetValue = base + (Math.abs(this.speed) / this.dynamics.maxSpeed);
          }
        } catch (e) {
          // fallback to base if anything unexpected happens
          targetValue = base;
        }

        // ensure the value is a finite number and clamp to a reasonable range
        if (!Number.isFinite(targetValue) || isNaN(targetValue)) {
          console.warn('Player: computed non-finite targetValue, falling back to base', targetValue);
          targetValue = base;
        }
        targetValue = Math.max(0, Math.min(targetValue, 4)); // clamp to [0,4]

        // Apply the gain change using the shared AudioContext time
        try {
          const now = (this.engineSound && this.engineSound.manager && this.engineSound.manager.context)
            ? this.engineSound.manager.context.currentTime
            : (this.engineSound && this.engineSound.source && this.engineSound.source.context)
              ? this.engineSound.source.context.currentTime
              : 0;

          if (this.engineSound && this.engineSound.gainNode && this.engineSound.gainNode.gain) {
            this.engineSound.gainNode.gain.setTargetAtTime(targetValue, now + 1, 2.5);
          }
        } catch (e) {
          console.error('[targetValue]', targetValue);
          console.error(e);
        }
      }

    }

    //TODO move to function
    const sectorId = this.game.world.lapTimer.checkSectors(this.x, this.y);

    if (sectorId) {
      if (sectorId !== this.lastSectorId) {
        const sectorNum = parseInt(sectorId.replace('s', ''));
        
        // Bereken wat de volgende sector zou moeten zijn
        // s0 -> s1, s1 -> s2, s2 -> s0
        const nextSector = (this.currentSector + 1) % 3;

        if (sectorNum === nextSector) {
          this.handleSectorPass(sectorNum);
        }

        // Voorkom dat we deze frame nog een keer checken voor ditzelfde vlak
        this.lastSectorId = sectorId;
      }
    } else {
      // We rijden niet meer op een sector-vlak
      this.lastSectorId = null;
    }

    this._applyPhysics(input, dt)

    // Validate new position — guard against physics glitches that produce NaN/Infinity or teleport to 0,0
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || isNaN(this.x) || isNaN(this.y)) {
      console.warn('Player: invalid position detected:', { x: this.x, y: this.y });
      if (this.lastValidPos) console.log('Reverting to ', this.lastValidPos.x, this.lastValidPos.y);
      if (this.lastValidPos && Number.isFinite(this.lastValidPos.x) && Number.isFinite(this.lastValidPos.y)) {
        this.x = this.lastValidPos.x;
        this.y = this.lastValidPos.y;
      } else {
        const safeSurface = ['asphalt', 'pitlane', 'paddock'].includes(this.activeSurface);
        if (safeSurface) {
          this.lastValidPos = { x: this.x, y: this.y };
        }
      }
      // also sanitize velocities, speed, and angles to prevent downstream NaNs
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
      this.angle = 0;
      this.movementAngle = 0;
    } else if (this.x === 0 && this.y === 0 && this.lastValidPos && (this.lastValidPos.x !== 0 || this.lastValidPos.y !== 0)) {
      // unexpected teleport to origin — likely a physics/collision bug. revert to last known good position.
      console.warn('Player: unexpectedly at origin, reverting to lastValidPos', this.lastValidPos);
      this.x = this.lastValidPos.x;
      this.y = this.lastValidPos.y;
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
    } else {
      // position looks sane — record as last valid
      this.lastValidPos = { x: this.x, y: this.y };
    }

    // Prevent going out of bounce 🔊🔊🔊
    const oldPos = { x: this.x, y: this.y };

    if (this.game.world.isOutOfBounds(this.x, this.y, this.radius)) {
      this.x = oldPos.x;
      this.y = oldPos.y;
      this.speed *= -1; 
    }

    const wallHit = this.game.world.getCollision(this.x, this.y, this.radius);

    if (wallHit && !this.isColliding) {
      this._resolveCollision(wallHit)
      this.game.effects?.trigger(this, 'colliding', 3000);
    } else if (!wallHit) {
      this.isColliding = false;
    }

    // Update laptimer while there's time left in the session
    if(this.game.hud.sessionTime) {
      this.game.world.lapTimer.update(dt);
    } else {
      // clear current + last lap timing displays, leaving the best laptime up
      // while the player drives back to their pitbox/garage
      this.game.hud.postMessage('timing','lastlap','')
      this.game.hud.postMessage('timing','thislap','')
    }

    // Update opponents (pitch + spatial sound) and check collisions
    this.game.opponents.forEach(opp => {
      // make sure the engine sound follows opponent's speed and position
      if (opp.engineSound) {
        const pitch = (Math.abs(Math.floor(opp.speed)) * .025);
        opp.engineSound.update(pitch, { 
          source: opp, 
          listener: this,
          screenSpace: !!this.game.settings.audioPanScreenSpace,
          maxDistance: 8192
        });
      }

      const dx = this.x - opp.x;
      const dy = this.y - opp.y;
      const distanceSq = dx * dx + dy * dy;
      const minDistance = this.radius + opp.radius;

      if (distanceSq < minDistance * minDistance && !this.isColliding) {
        // We hebben een botsing met een andere speler!
        // console.log('🚑 HIT VEHICLE', opp)
        this._resolveCollision(opp);
        this.game.network.send({
          type: 'bang',
          id: this.id,
          x: this.x,
          y: this.y,
          angle: this.angle,
          health: this.health,
          impact: true // Een vlaggetje zodat zij ook sfx kunnen afspelen
        });
      } else {
        this.isColliding = false;
      }
    });

    // dispatch nearby marshals when offroad
    // TODO: move to function
    
    if(surface === 'grass' || surface === 'gravel' || surface === 'out-of-bounds') {

      this.game.world.element.dataset.flag = 'yellow';

      let nearestMarshalPosts = Array.from(this.game.world.marshalPosts).filter (post => {
        let postLocation = {x: post.cx.baseVal.value,y: post.cy.baseVal.value};
        let distanceToPlayer = getDistance(postLocation, this);
        if( distanceToPlayer < this.game.camera.viewPortSize.width) {
          post.distance = distanceToPlayer;
          return post;
        }
      });


      let nearest = nearestMarshalPosts.sort((a, b) => a.distance - b.distance);
      let lilguys = this.game.world.marshals.filter (dude => dude.base == nearest[0] && dude.status !== 'dead');

      // run towards player vehicle
      lilguys.forEach(dude => dude.status = 'rescue');
      
    } else {

      this.game.world.element.dataset.flag = 'green';

      this.game.world.marshals.map (dude => {
        if(dude.status !== 'dead') {
          // anyone still alive, if you can move yr legs: go home.
          dude.status = 'idle'
        }
      });
    }

    this.game.world.marshals.forEach(marshal => marshal.update(dt))
    this.smokePool.forEach(smoke => smoke.update(dt));

    if (input.highbeamPressed) {
      this.highbeam = !this.highbeam;
      this.toggleHighbeam();
    }

    // 1. Check if the player is "stopped"
    const isStopped = this.speed > -0.5 && this.speed < 0.5;

    if (isStopped) {
      if (this.engineRunning) {
        // Count down using game delta time (assuming dt is in milliseconds, e.g., ~16.6ms)
        // If your game uses seconds for dt (e.g., 0.016), use: this.engineShutDownTimer -= dt;

        this.engineShutDownTimer -= dt; 

        if (this.engineShutDownTimer <= 0) {
          this.engineRunning = false;
          
          // Play the shutoff sound
          this.game.soundManager.play('engine-shutoff', { volume: 1, loop: false, pitch: 1 });
          
          // Safely stop the idle/running sound immediately without setTimeout
          if (this.engineSound) {
            setTimeout(()=>{
              this.engineSound.stop();
            }, 500)
          }
        }
      }
    } else {
      // 2. Player is moving. Reset everything.
      this.engineShutDownTimer = 500; // Reset to 5 seconds (or 5.0 if using seconds)
      
      // ONLY start the sound if it wasn't already running (prevents per-frame spamming)
      if (!this.engineRunning) {
        this.engineRunning = true;
        if (this.engineSound) {
          this.engineSound.start();
        }
      }
    }
  }

  draw() {
    if (!this.game?.world) return;

    super.draw();

    // Use lastValidPos as fallback when x/y are not finite to avoid toFixed throwing
    const px = Number.isFinite(this.x) ? this.x : (this.lastValidPos ? this.lastValidPos.x : 0);
    const py = Number.isFinite(this.y) ? this.y : (this.lastValidPos ? this.lastValidPos.y : 0);
    const pa = Number.isFinite(this.angle) ? this.angle : 0;
    this.game.world.element.style.setProperty('--player-x', px.toFixed(3));
    this.game.world.element.style.setProperty('--player-y', py.toFixed(3));
    this.game.world.element.style.setProperty('--player-angle', pa.toFixed(3));

    // Update ambient audio triggers (crowd, etc.)
    if (this.game.audioManager) {
      try {
        this.game.audioManager.updatePlayerPosition(this.x, this.y);
      } catch (e) {
        console.warn('Player: audioManager update failed', e);
      }
    }

    // these attributes *may* be used later to display an
    // add'l (warning) message, next to the <meter> elements
    // already automatically displaying this inf
    if(this.fuel < this.statusIndicators.fuel.high) {
      this.element.dataset.lowFuel = `low fuel`;
    } else {
      this.element.removeAttribute('data-low-fuel')
    }

    if(this.health < this.statusIndicators.health.high) {
      this.element.dataset.lowHealth = `low health`;
    } else {
      this.element.removeAttribute('data-low-health')
    }
  }
}