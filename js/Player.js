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
    this.x = 10500;
    this.y = 10000;
    this.radius = 64;
    
    this.dynamics = {};
    Object.assign(this.dynamics, Presets.DefaultDynamics);
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0; 
    this.steerInput = 0;

    this.isBraking = false;

    this.vehicleTweaker = new TweakManager(this.dynamics, "🚗 Dynamics tweaker initialized");
    this.vehicleTweaker._addPresetDropdown(Presets);

    this.SurfaceData = SurfaceModule.Surfaces;
    this.surfaceTweaker = new TweakManager(this.SurfaceData.asphalt, "🚛 Surface: Asphlat Multipliers");
    this.surfaceTweaker._addPresetDropdown(this.SurfaceData);

    this.xp = 0;
    this.canScore = true;
    
    this.lastSectorId = null; // Om herhaling te voorkomen terwijl je op het vlak staat
    this.currentSector = 2; // Begin op 2, zodat s0 de eerstvolgende logische stap is
    this.lapStartTime = performance.now();
  }

  /* new  */
  _applyPhysics(gamepad, dt) {
    const d = this.dynamics;
    const s = this.SurfaceData[this.activeSurface] || this.SurfaceData.asphalt; // De actieve modifier

    // 0. Inputs uitlezen
    const gas = gamepad.buttons[7].value;         // R2
    const brake = gamepad.buttons[6].value;       // L2
    const handbrake = gamepad.buttons[5].pressed; // R1
    this.isBraking = brake > 0;

    // Pas de multipliers toe op de basiswaarden
    const currentAccel = d.acceleration * s.power;
    const currentFriction = d.friction * s.drag;
    const currentGrip = (1 - d.driftFactor) * s.grip;

    // 1. Versnelling & Remmen (Gebruik acceleration uit Dynamics)
    if (gas > 0) this.speed += (gas * currentAccel) * dt;
    if (brake > 0) this.speed -= (brake * currentFriction) * dt;

    // Snelheidslimiet (Voorkom dat achteruit sneller is dan vooruit)
    // We limiteren vooruit op maxSpeed, achteruit op de helft daarvan
    if (this.speed > d.maxSpeed) this.speed = d.maxSpeed;
    if (this.speed < -d.maxSpeed / 2) this.speed = -d.maxSpeed / 2;

    // 2. Wrijving (Friction)
    // De formule die je gebruikte: (1 - (1 - friction) * dt)
    this.speed *= (1 - (1 - d.friction) * dt);

    // 3. Sturen (Steering)
    if (Math.abs(gamepad?.axes[0]) > 0.1) {
        // speedFactor zorgt dat je niet kunt sturen als je stilstaat
        const speedFactor = Math.min(Math.abs(this.speed) / 5, 1.0); 
        const steerAmount = (gamepad.axes[0] * d.steeringSensitivity * speedFactor) * dt;
        
        this.angle += steerAmount;
    }

    // 4. Grip & Drift
    // We pakken de drift-waarde uit Dynamics. Als handbrake ingedrukt is, 
    // gebruiken we de handbrakeDrift (bijv. 0.85), anders de gewone driftFactor (bijv. 0.95)
    const currentDrift = handbrake ? d.handbrakeDrift : d.driftFactor;
    
    // Hoe lager de waarde (bijv 0.05), hoe meer de auto 'glijdt'
    // Let op: we draaien de logica om zodat 'drift' uit de class logisch voelt
    const grip = 1 - currentDrift; 

    const targetVX = Math.cos(this.angle) * this.speed;
    const targetVY = Math.sin(this.angle) * this.speed;

    // Lerp met deltaTime voor consistente snelheid op alle schermen
    const lerpFactor = 1 - Math.pow(1 - currentGrip, dt);
    this.vx += (targetVX - this.vx) * lerpFactor;
    this.vy += (targetVY - this.vy) * lerpFactor;

    // 5. Beweging
    this.x += this.vx * dt;
    this.y += this.vy * dt;
}
  
  _resolveCollision(hit, gamepad) {

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
    this.speed *= -1;
    this.vx *= 0.75;
    this.vy *= 0.75;
      
    this.handleCollision(gamepad);
  }

  handleCollision (gamepad) {
    // 1. Controller Trillen (Rumble)
    // De meeste moderne gamepads ondersteunen 'dual-rumble'
    if (gamepad && gamepad.vibrationActuator && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: 20,      // Kort maar krachtig
        weakMagnitude: 0.5, // De lichte trilmotor
        strongMagnitude: 0.8 // De zware trilmotor (voor de klap)
      });
    }

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

  onLevelUp() {
    // Voorbeeld: elke 500 XP gaat je topsnelheid omhoog
    const level = Math.floor(this.xp / 500);
    this.maxSpeed = 10 + (level * 0.5);
    
    // Update eventueel de visual van de auto
    if (level > 2) {
        this.element.classList.add('pro-spoiler');
    }
  }

  update(gamepad, dt) {
    
    if (!this.isLocal || !gamepad) return;
    
    const surface = this.game.world.getSurfaceType(this.x, this.y);

    if(this.activeSurface !== surface) {
      this.activeSurface = surface;
      this.game.effects.trigger(this, surface, 500);
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

    this._applyPhysics(gamepad, dt)

    const oldPos = { x: this.x, y: this.y };

    if (this.game.world.isOutOfBounds(this.x, this.y, this.radius)) {
      this.x = oldPos.x;
      this.y = oldPos.y;
      this.speed *= -0.5; // "Bouncen" tegen de omheining van de wereld
    }

    const wallHit = this.game.world.getCollision(this.x, this.y, this.radius);

    if (wallHit && !this.isColliding) {

      console.log("⛑️ HIT WALL", wallHit)

      this._resolveCollision(wallHit, gamepad)
      this.game.effects?.trigger(this, 'colliding', 300);
      this.game.effects?.trigger(this.game.world, 'colliding', 300);

    } else if (!wallHit) {
      this.isColliding = false;
    }

    this.game.opponents.forEach(opp => {
      const dx = this.x - opp.x;
      const dy = this.y - opp.y;
      const distanceSq = dx * dx + dy * dy;
      const minDistance = this.radius + opp.radius;

      if (distanceSq < minDistance * minDistance && !this.isColliding) {
        // We hebben een botsing met een andere speler!
        console.log('🚑 HIT VEHICLE', opp)
        this._resolveCollision(opp, gamepad);
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

    this.game.world.element.style.setProperty('--player-x', Math.floor(this.x));
    this.game.world.element.style.setProperty('--player-y', Math.floor(this.y));
    this.game.world.element.style.setProperty('--player-angle', Math.floor(this.angle));

    if (this.isLocal) {
      this.element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    }
  }
}