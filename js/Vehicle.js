export default class Vehicle {
    constructor(id, color, game) {
        this.id = id;
        this.game = game;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.radius = 64;
        this.element = this._createVisual(color);
    }

    _createVisual(color) {
        const template = document.getElementById("racecar");
        const clone = document.importNode(template.content, true);
        const carElement = clone.querySelector('.car');
        carElement.id = `vehicle-${this.id}`;
        carElement.classList.add('opponent');
        const body = carElement.querySelector('.car-body');

        if (body) {
           body.style.backgroundColor = color;
           body.style.setProperty('--radius', this.radius)
          console.log(body)
        }

        try {
          this.game.world.element.appendChild(carElement);
        } catch (e) {
          console.log(this.game)
        }
        return carElement;
    }

    draw() {
      // Elke auto update zijn eigen element via transforms
      // this.element.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.angle}rad)`;
      this.element.style.setProperty('--x', Math.floor(this.x));
      this.element.style.setProperty('--y', Math.floor(this.y));
      this.element.style.setProperty('--angle', parseFloat(this.angle.toFixed(3)));
    }
}
