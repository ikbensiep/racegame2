import Vehicle from './Vehicle.js';
export default class AIOpponent extends Vehicle {
    constructor(id, color, game) {
      
      super(id, `🤖-${id}`, 88, color, game);
      this.trackPath = game.world.trackElement;
      this.pathLength = this.trackPath.getTotalLength();
      this.progress = 0; 
      this.speed = 30;
      this.frameTime = 0;
    }

    update() {
        // Progress along track
        this.progress += this.speed / 10000;
        if (this.progress > 1) this.progress = 0;
        
        // Current point
        const currentPos = this.trackPath.getPointAtLength(this.progress * this.pathLength);
        
        // Lookahead for angle
        const lookAhead = this.trackPath.getPointAtLength(((this.progress + 0.02) % 1) * this.pathLength);
        
        // Update physics/visuals
        this.x = currentPos.x;
        this.y = currentPos.y;
        
        this.frameTime++;
        
        this.draw();
        
        if (this.frameTime > 2) {
            let oldAngle = this.angle;
            let newAngle = Math.atan2((lookAhead.y + Math.random() * 128) - this.y, (lookAhead.x + Math.random() * 128) - this.x);
            if (Math.abs(oldAngle - newAngle) > .2) {
                this.speed -= 2.5;
            } else if (this.speed < 30){
                this.speed += .25;
            }
            this.angle = newAngle;
            this.frameTime = 0;
            return;
        }

    }
}