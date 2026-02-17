import Vehicle from './Vehicle.js';
export default class AIOpoonent extends Vehicle {
    constructor(id, color, game) {
      
      super(id, `🤖-${id}`, 88, color, game);
      this.trackPath = game.world.paths.racetrack;
      this.pathLength = this.trackPath.getTotalLength();
      this.progress = 0; 
      this.speed = 0.001;
    }

    update() {
        // Progress along track
        this.progress += this.speed;
        if (this.progress > 1) this.progress = 0;

        // Current point
        const currentPos = this.trackPath.getPointAtLength(this.progress * this.pathLength);
        
        // Lookahead for angle
        const lookAhead = this.trackPath.getPointAtLength(((this.progress + 0.01) % 1) * this.pathLength);
        
        // Update physics/visuals
        this.x = currentPos.x;
        this.y = currentPos.y;
        this.angle = Math.atan2(lookAhead.y - this.y, lookAhead.x - this.x);

        this.draw();
    }
}