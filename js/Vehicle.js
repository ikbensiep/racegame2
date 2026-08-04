import VehicleSound from './VehicleSound.js';

export default class Vehicle {
  get id () {
    return this._id;
  }

  set id (value) {
    this._id = value ?? this._createFallbackId();
    this._syncElementId();
  }

  constructor (game, id, name, driverNumber, color, team, livery, isLocal = false) {
    console.warn(team)
    this._id = null;
    this.id = id ?? this._createFallbackId();
    this.name = name;
    this.driverNumber = driverNumber;
    this.color = color;
    this.team = team;
    this.livery = livery;
    this.game = game;
    this.isLocal = isLocal;

    this.x = Math.floor(Math.random() * 100);
    this.y = Math.floor(Math.random() * 100);
    this.radius = 64;
    this.height = undefined;
    this.width = undefined;
    // we use radius for collision, width & height pertain mostly to the vehicle/emitter Sprite end of the business.


    this.speed = 0;
    this.angle = 0;
    this.steerInput = 0;
    this.isBraking = false;
    
    this.engineSound = undefined;

    this.fuel = 15;
    this.maxFuel = 100;
    this.health = 100;
    this.statusIndicators = {};

    // vehicle body rotations voor coolen flips en salto's
    this.rotation = {
        pitch: 0, // X
        roll: 0,  // Y
        yaw: 0    // Z (this.angle = facing direction, yaw is used to rotate the vehicle body parts)
    };

    this.element = this._createVisual();
    this.updateStyle();
    this.lightsElement = this._createLightsVisual();
    
    // this.gizmo = this._createGizmo(); // 3D axis viz gizmo
  }

  _createFallbackId () {
    return `vehicle-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  _syncElementId () {
    if (!this.element) return;
    this.element.id = `player-${this.id}`;
    this.element.dataset.vehicleId = String(this.id);
  }

  _createVisual () {

    const template = document.getElementById("racecar");
    if (!template) {
      throw new Error('Missing racecar template');
    }

    const clone = document.importNode(template.content, true);
    const carElement = clone.querySelector('.car');

    if (!carElement) {
      throw new Error('Missing .car element in racecar template');
    }

    this.element = carElement;
    this._syncElementId();
    
    // FIXME: determine how to set .player, .opponent or .npc here instead 
    // if NPCs at some point intherit the vehicle class
    carElement.classList.add('player'); 
    carElement.style.setProperty('--player-color', this.color);
    const carBody = carElement.querySelector('.car-body');

    if (!carBody) {
      console.error('No vehicle body element!');
    } else {
      carElement.style.setProperty('--radius', this.radius)
      carElement.querySelector('.player-tag i').textContent = this.name;
      carElement.querySelector('.player-tag b').textContent = this.driverNumber;
      carElement.dataset.team = this.team;
      carBody.dataset.drivernum = this.driverNumber;
      let rect = carBody.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      
      let livery = carElement.querySelector('.livery');
      livery.className = `livery ${this.livery}`;

      this.statusIndicators.fuel = carElement.querySelector('meter.fuel')
      this.statusIndicators.health = carElement.querySelector('meter.health')
    } 

    try {
      this.game.world.element.appendChild(carElement);
    } catch (e) {
      console.error(e)
      console.log(this.game)
    }
    return carElement;
  }

  _createLightsVisual () {
    if (!this.game?.world?.lightLayer) return null;

    const layer = this.game.world.lightLayer;
    let lightElement = null;

    if (this.isLocal) {
      lightElement = layer.querySelector('.vehicle-lights.player');
      if (lightElement) {
        lightElement.dataset.vehicleId = this.id;
        return lightElement;
      }
    }

    lightElement = document.createElement('b');
    lightElement.classList.add('vehicle-lights');
    lightElement.classList.add(this.isLocal ? 'player' : 'opponent');
    lightElement.dataset.vehicleId = this.id;
    lightElement.id = `vehicle-lights-${this.id}`;
    layer.appendChild(lightElement);
    return lightElement;
  }

  async _createEngineSound () {
      const soundId = `engine-${this.driverNumber}-${this.name}`;
      const soundPath = '/assets/sound/porsche-onboard-acc-full.ogg';

      try {
          // STAP 1: Wacht tot het bestand geladen en gedecodeerd is
          await this.game.soundManager.load(soundId, soundPath);

          // STAP 2: Maak de instance aan
          this.engineSound = new VehicleSound(this.game.soundManager, soundId);

          // STAP 3: Start de loop
          this.engineSound.start();
          
          console.log(`Motor geluid gestart voor ${this.name}`);
      } catch (error) {
          console.error("Geluidsbestand laden mislukt:", error);
      }
  }

  // Public helper to initialize engine sound after vehicle has been positioned
  async initEngineSound () {
    // Avoid double-initialization
    if (this.engineSound) return;
    await this._createEngineSound();
  }

  _createGizmo () {
      const gizmo = document.createElement('div');
      gizmo.className = 'gizmo';
      gizmo.innerHTML = `
          <div class="ring x"></div>
          <div class="ring y"></div>
          <div class="ring z"></div>
      `;
      let carBody = this.element.querySelector('.car-body')
      this.element.dataset.debug = "true";
      carBody.appendChild(gizmo);
      console.log(carBody)
  }

  updateFuel () {
    if (this.fuel > 0) {
      this.fuel -= Math.abs(this.speed) / 10000;
    }
    return this.fuel;
  }

  // negative value = oof owie, 
  // positive value = positive natuurlijk jonge jezus
  updateHealth (value) {

    this.health += value;

    // 🧢
    if(this.health > 100) this.health = 100;

    // 🚑
    if (this.health <= 50) {
      // add (sticky, looping) smoke emitter 
    }

    // ⚰️
    if (this.health <= 1) {
      // add (sticky, looping) smoke emitter but make it fire

      setTimeout( () => {
        console.log("DED. TERUG NAAR DE PITS!")
        const player = this.game.localPlayer;
        if (player) {
          const garage = this.game.world.garages[player.garageIndex];
          if (garage && garage.circlePos) {
            player.speed = 0;
            player.vx = 0;
            player.vy = 0;
            player.angle = 0;
            player.movementAngle = 0;
            const { x, y } = garage.circlePos;
            player.x = x;
            player.y = y;
            player.lastValidPos = { x, y };
          }
        }
      }, 1000)
    }

    return this.health
  }

  updateStyle () {
    const color = this.color || (this.game && this.game.settings && this.game.settings['player-color']) || 'blue';
    this.element.style.setProperty('--player-color', color);
    let livery = this.element.querySelector('.livery');
    const liveryClass = this.livery || (this.game && this.game.settings && this.game.settings['player-livery']) || '';
    if (livery) livery.className = `livery ${liveryClass}`;
  }

  draw () {

    let fuelLeft = this.updateFuel();

    // Elke auto update zijn eigen element via transforms
    
    this.element.style.setProperty('--x', Math.floor(this.x));
    this.element.style.setProperty('--y', Math.floor(this.y));
    this.element.style.setProperty('--angle', parseFloat(this.angle.toFixed(3)));
    this.element.style.setProperty('--speed', this.speed ? Math.floor(this.speed) : 0);
    this.element.dataset.speed = this.speed ? this.speed.toFixed(2) : 0;
    this.element.style.setProperty('--fuel', `"${fuelLeft.toFixed(2)}"`);
    this.element.style.setProperty('--health', this.health.toFixed(2) || 0);

    this.statusIndicators.fuel.value = fuelLeft;
    this.statusIndicators.health.value = this.health;

    /* update vehicle lights */
    if (this.lightsElement) {
      /* correctly orient to player's orientation */
      this.lightsElement.style.setProperty('--player-x', this.x.toFixed(3));
      this.lightsElement.style.setProperty('--player-y', this.y.toFixed(3));
      this.lightsElement.style.setProperty('--player-angle', this.angle.toFixed(3));

      /* set brake, reverse lights */
      let lightsState = '';
      
      if (this.isBraking && this.speed > 0) {
        lightsState = 'braking';
      }
  
      if (this.speed < -0.05) {
        lightsState = 'reversing';
      }
  
      this.lightsElement.dataset.lights = lightsState;
      this.highbeam 
        ? this.lightsElement.classList.add('highbeam')
        : this.lightsElement.classList.remove('highbeam');
    }
    
    
  }
}
