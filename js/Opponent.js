import Vehicle from './Vehicle.js';

export default class Opponent extends Vehicle {
constructor(id, name, driverNumber, color, game) {
    super(id, name, driverNumber, color, game);
}

    updateFromNetwork(data) {
        // Hier kun je eventueel LERP (smoothing) toevoegen
        if(data.type && data.type !== 'bang') {
          this.x = data.x;
          this.y = data.y;
          this.angle = data.angle;
        }
    }
}