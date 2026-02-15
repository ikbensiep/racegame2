export default class Vehicle {
  constructor (id, name, driverNumber, color, game) {
    this.id = id;
    this.name = name;
    this.driverNumber = driverNumber;
    this.color = color;
    this.game = game;

    this.speed = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0; // steering angle
    this.steerInput = 0;

    // vehicle body rotations voor coolen flips en salto's
    this.rotation = {
        pitch: 0, // X
        roll: 0,  // Y
        yaw: 0    // Z (onafhankelijk van this.angle voor debug)
    };

    this.radius = 64;
    this.element = this._createVisual();
    // this.gizmo = this._createGizmo();
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
      body.querySelector('.livery').dataset.drivernum = this.driverNumber;
      console.log(body);
    }

    try {
      this.game.world.element.appendChild(carElement);
    } catch (e) {
      console.error(e)
    }
    return carElement;
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
