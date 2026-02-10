export default class Vehicle {
  constructor (id, name, driverNumber, color, game) {
    this.id = id;
    this.name = name;
    this.driverNumber = driverNumber;
    this.color = color;
    this.game = game;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.radius = 64;
    this.element = this._createVisual();
  }

  _createVisual() {
    const template = document.getElementById("racecar");
    const clone = document.importNode(template.content, true);
    const carElement = clone.querySelector('.car');
    carElement.id = `vehicle-${this.id}`;
    
    // FIXME: determine how to set .player, .opponent or .npc here instead 
    // if NPCs at some point intherit the vehicle class
    carElement.classList.add('player'); 
    const body = carElement.querySelector('.car-body');

    if (body) {
      body.style.setProperty('--radius', this.radius)
      body.style.setProperty('--player-color', this.color);
      body.dataset.drivername = this.name;
      body.querySelector('.livery').dataset.drivernum = this.driverNumber;
      console.log(body);
    }

    try {
      this.game.world.element.appendChild(carElement);
    } catch (e) {
      console.log(this.game)
    }
    return carElement;
  }

  draw () {
    // Elke auto update zijn eigen element via transforms
    // this.element.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.angle}rad)`;
    this.element.style.setProperty('--x', Math.floor(this.x));
    this.element.style.setProperty('--y', Math.floor(this.y));
    this.element.style.setProperty('--angle', parseFloat(this.angle.toFixed(3)));
  }
}
