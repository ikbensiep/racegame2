import Vehicle from './Vehicle.js';

export default class Opponent extends Vehicle {
    constructor(id, color, isLocal = false, game) {
        super(id, color, game);
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