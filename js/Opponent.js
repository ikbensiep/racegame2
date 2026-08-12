import Vehicle from './Vehicle.js';

export default class Opponent extends Vehicle {
constructor(game, id, name, driverNumber, color, team = 'ferrari', livery = '') {
  super(game, id, name, driverNumber, color, team, livery, false);
  this.element.classList.remove('player');
}

  updateFromNetwork(data) {
    // FIXME: probably needs opponent(s) id(s) here to correctly handly incoming collisions?
    if(data.type && data.type !== 'bang') {
      // this.x = data.x;
      // this.y = data.y;
      // this.angle = data.angle;
      // this.speed = data.speed;
    }
  }
}