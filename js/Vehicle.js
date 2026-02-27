import VehicleSound from './VehicleSound.js';

export default class Vehicle {
  constructor (id, name, driverNumber, color, game) {
    this.id = id;
    this.name = name;
    this.driverNumber = driverNumber;
    this.color = color;
    this.game = game;

    this.x = 0;
    this.y = 0;
    this.radius = 64;
    this.height = undefined;
    this.width = undefined;
    // we use radius for collision, width & height pertain mostly to the vehicle/emitter Sprite end of the business.


    this.speed = 0;
    this.angle = 0;
    this.steerInput = 0;

    this.engineSound = undefined;

    // vehicle body rotations voor coolen flips en salto's
    this.rotation = {
        pitch: 0, // X
        roll: 0,  // Y
        yaw: 0    // Z (this.angle = facing direction, yaw is used to rotate the vehicle body parts)
    };

    this.element = this._createVisual();
    this._createEngineSound();
    // this.gizmo = this._createGizmo(); // 3D axis viz gizmo
  }

  _createVisual () {

    const template = document.getElementById("racecar");
    const clone = document.importNode(template.content, true);
    const carElement = clone.querySelector('.car');
    
    carElement.id = `vehicle-${this.id}`;
    
    // FIXME: determine how to set .player, .opponent or .npc here instead 
    // if NPCs at some point intherit the vehicle class
    carElement.classList.add('player'); 
    carElement.style.setProperty('--player-color', this.color);
    const body = carElement.querySelector('.car-body');

    if (body) {
      carElement.style.setProperty('--radius', this.radius)
      body.dataset.drivername = this.name;
      body.dataset.drivernum = this.driverNumber;
      let rect = body.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      console.log(body);
    }

    try {
      this.game.world.element.appendChild(carElement);
    } catch (e) {
      console.error(e)
    }
    return carElement;
  }

async _createEngineSound() {
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

  _createGizmo() {
      const gizmo = document.createElement('div');
      gizmo.className = 'gizmo';
      gizmo.innerHTML = `
          <div class="ring x"></div>
          <div class="ring y"></div>
          <div class="ring z"></div>
      `;
      let body = this.element.querySelector('.car-body')
      this.element.dataset.debug = "true";
      body.appendChild(gizmo);
      console.log(body)
  }

  draw () {
    // Elke auto update zijn eigen element via transforms
    // this.element.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.angle}rad)`;
    this.element.style.setProperty('--x', Math.floor(this.x));
    this.element.style.setProperty('--y', Math.floor(this.y));
    this.element.style.setProperty('--angle', parseFloat(this.angle.toFixed(3)));

  }
}
