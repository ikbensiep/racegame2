import Emitter from './tools/Emitter.js'
import InputHandler from './InputHandler.js';
import { sidesFromHypotenhuse } from './tools/MathUtils.js';
import Vehicle from './Vehicle.js';
import { TweakManager } from './tools/Tweaker.js';
import * as Presets from './VehicleDynamics.js';
import * as SurfaceModule from './SurfaceDynamics.js';

export default class Player extends Vehicle {
  constructor(id, name, driverNumber = 0, color = 'red', isLocal = false, game) {
    super(id, name, driverNumber, color, game);
    this.game = game;

    this.id = id;
    this.isLocal = isLocal;
    this.x = null;
    this.y = null;
    this.radius = 64;
    
    this.dynamics = {};
    Object.assign(this.dynamics, Presets.DefaultDynamics);
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0; 
    this.steerInput = 0;
    this.movementAngle = 0;

    this.isBraking = false;

    this.vehicleTweaker = new TweakManager(this.dynamics, "🚗 Dynamics tweaker");
    this.vehicleTweaker._addPresetDropdown(Presets);

    this.SurfaceData = SurfaceModule.Surfaces;
    this.surfaceTweaker = new TweakManager(this.SurfaceData.asphalt, "🚛 Surface tweaker");
    this.surfaceTweaker._addPresetDropdown(this.SurfaceData);

    this.xp = 0;
    this.canScore = true;
    
    this.lastSectorId = null; // Om herhaling te voorkomen terwijl je op het vlak staat
    this.currentSector = 2; // Begin op 2, zodat s0 de eerstvolgende logische stap is
    this.lapStartTime = performance.now();
    this.inputHandler = new InputHandler();
    this.intervalUpdateTimer = 0;
    this.engineShutDownTimer = 0;

    this.init();
  }

  async init () {
    this.tireTrackPool = [];
    this.maxTireTracks = 80;
    this.tireTrackInterval = 0;
    this.createTireTracks();

    this.smokePool = [];
    this.maxSmoke = 10;
    this.smokeInterval = 0;
    // this.createSmokePuffs();

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
      const currentAccel = d.acceleration * s.power;
      const currentFriction = d.friction * s.drag;
      const currentDrift = handbrake ? d.handbrakeDrift : d.driftFactor;
      const currentGrip = (1 - currentDrift) * s.grip;

      this.element.dataset.drift = currentDrift.toFixed(2);
      this.element.dataset.accel = currentAccel.toFixed(2);
      this.element.dataset.friction = currentFriction.toFixed(2);
      this.element.dataset.grip = currentGrip.toFixed(2);

      // 1. Versnelling & Remmen
      if (gas > 0) this.speed += (gas * currentAccel) * dt;
      if (brake > 0) this.speed -= (brake * currentFriction) * (dt / 2);

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


      if( (this.tireTrackInterval > 3) && 
        (
          (brake && this.speed > 10) || 
          (this.speed > 10 && (currentGrip < .2 || currentDrift > .5))
          
        )
        ) {
        let tiretrack = this.getTireTrack();
        if(tiretrack) {
          console.warn(this.activeSurface)
          let offset = sidesFromHypotenhuse(this.width * .25, this.angle)
          tiretrack.domElement.dataset.velocity = Math.floor(this.speed);
          tiretrack.domElement.style.setProperty('--speed', Math.floor(this.speed * 2));
          tiretrack.domElement.classList.add(this.activeSurface);
          
          tiretrack.start(this.x - offset.width, this.y - offset.height, this.movementAngle);  // Use movement direction for sprite rotation
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

    this.handleCollision();
  }

  handleCollision () {

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


  }

  handleSectorPass(num) {
    const now = performance.now();
    const splitTime = now - this.game.world.lapTimer.lastSectorTime;
    
    if (num === 0) { // Finishlijn gepasseerd (Sector 0)
      if (this.currentSector === 2) { // Alleen als we s1 en s2 hebben gehad
        const lapTime = now - this.lapStartTime;
        this.xp += 500; // Bonus voor voltooide ronde
        console.log(`Ronde voltooid in: ${(lapTime/1000).toFixed(2)}s`);
        this.lapStartTime = now;
      }
    } else {
      this.xp += 50; // Kleine XP bonus voor tussen-sector
      console.log(`Sector ${num} split: ${(splitTime/1000).toFixed(2)}s`);
    }

    this.currentSector = num;
    this.game.world.lapTimer.lastSectorTime = now;
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

  onLevelUp() {
    // Voorbeeld: elke 500 XP gaat je topsnelheid omhoog
    const level = Math.floor(this.xp / 500);
    this.maxSpeed = 10 + (level * 0.5);
    
    // Update eventueel de visual van de auto
    if (level > 2) {
        this.element.classList.add('pro-spoiler');
    }
  }

  update(dt) {

    if (!this.isLocal) return;
    
    // Debug: track calls per frame
    if (!window.__playerUpdateCount) window.__playerUpdateCount = 0;
    window.__playerUpdateCount++;
    
    const input = this.inputHandler.getInputs();
    const surface = this.game.world.getSurfaceType(this.x, this.y);

    if(this.intervalUpdateTimer < 10) {
      this.intervalUpdateTimer += dt;
    } else {

      this.intervalUpdateTimer = 0;
      this.element.dataset.speed = Math.floor(Math.abs(this.speed));
      this.element.dataset.vx = Math.floor(this.vx);
      this.element.dataset.vy = Math.floor(this.vy);
      this.element.dataset.angle = Math.floor(this.angle);
      
      let playHaptics = false;

      if(this.activeSurface !== surface) {
        this.activeSurface = surface;
        this.element.dataset.state = surface;

        /* Maybe later? */
        // this.game.effects.trigger(this, surface, 500);
  
        let haptics = {
          startDelay: 0,
          duration: 1000,
          weakMagnitude: 1, // De lichte trilmotor
          strongMagnitude: 0
        }
        
        switch(this.activeSurface) {
          case 'sand':
          case 'gravel': 
            haptics.strongMagnitude = this.speed / 20;
            playHaptics = true;
            break;
          case 'asphalt':
            haptics.weakMagnitude = this.speed / 100;
            haptics.strongMagnitude = .1;
            playHaptics = true;
            break;
          default:
            // playHaptics = false;
            break;
        }
      }
      
      playHaptics ?? this.playHapticFeedBack (haptics)

      // Update our own engine sound (pitch only - listener is self so pan stays centered)
      
      if (this.engineSound) {
        this.engineSound.update(
          (Math.abs(Math.floor(this.speed)) * .025),
          { source: this, screenSpace: !!this.game.settings.audioPanScreenSpace, maxDistance: 8192 }
        );
        let targetValue = .2 + (Math.abs(this.speed) / this.dynamics.maxSpeed);
        
        this.engineSound.gainNode.gain.setTargetAtTime(targetValue, this.engineSound.source.context.currentTime + 1, 2.5);
      }

      // if(this.speed == 0) {
      //   this.engineShutDownTimer += dt;

      //   if (this.engineShutDownTimer > 10) {
      //     this.engineSound && this.engineSound.stop();
      //     this.engineShutDownTimer = 0;
      //   }

      // }

      // if(this.speed == 0 && this.engineShutDownTimer > 10) {
        
      // } else if ((Math.abs(this.speed) > 1) && this.engineShutDownTimer == 0) {
      //   console.log('starting engine?')
      //   this.engineSound.start();
      // } else {
      //   this.engineShutDownTimer += dt;
      // }
    }

    const sectorId = this.game.world.lapTimer.checkSectors(this.x, this.y);

    if (sectorId) {
      if (sectorId !== this.lastSectorId) {
        const sectorNum = parseInt(sectorId.replace('s', ''));
        
        // Bereken wat de volgende sector zou moeten zijn
        // s0 -> s1, s1 -> s2, s2 -> s0
        const nextSector = (this.currentSector + 1) % 3;

        if (sectorNum === nextSector) {
          console.log("Sector gehaald!", sectorId);
          this.currentSector = sectorNum;
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
      this.game.effects?.trigger(this, 'colliding', 300);
    } else if (!wallHit) {
      this.isColliding = false;
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
          impact: true // Een vlaggetje zodat zij ook sfx kunnen afspelen
        });
      } else {
        this.isColliding = false;
      }
    });


  }

  draw() {
    if (!this.game?.world) return;

    super.draw();

    this.game.world.element.style.setProperty('--player-x', this.x.toFixed(3));
    this.game.world.element.style.setProperty('--player-y', this.y.toFixed(3));
    this.game.world.element.style.setProperty('--player-angle', this.angle.toFixed(3));

    if (this.isLocal) {
      //TODO: update to use CameraManager class
      // this.element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    }
  }
}