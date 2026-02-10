import Vehicle from './Vehicle.js';
export default class AIOpoonent extends Vehicle {
    constructor(id, color, game) {
        
        super(id, `🤖-${id}`, 88, color, game);
        this.trackPath = game.world.trackElement; // Het SVGPathElement uit je config
        console.log(this.trackPath);
        this.pathLength = this.trackPath.getTotalLength();
        this.progress = 0; // Waarde tussen 0 en 1
        this.speed = 0.0005; // De 'lap time' snelheid
    }

    update() {
        
        // 1. Verhoog progressie over het circuit
        this.progress += this.speed;
        if (this.progress > 1) this.progress = 0;

        // 2. Vraag de browser om de coördinaten op dit punt
        const currentPos = this.trackPath.getPointAtLength(this.progress * this.pathLength);
        
        // 3. Kijk een klein stukje vooruit voor de hoek (angle)
        const lookAhead = this.trackPath.getPointAtLength(((this.progress + 0.01) % 1) * this.pathLength);
        
        // 4. Update de physics/visuals
        this.x = currentPos.x;
        this.y = currentPos.y;
        this.angle = Math.atan2(lookAhead.y - this.y, lookAhead.x - this.x);

        // Update het DOM element
        this.draw();
    }
}