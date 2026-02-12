// js/CameraManager.js
export default class CameraManager {
  constructor(game, scrollContainer, worldSize = 32768) {
    this.game = game;
    this.element = scrollContainer; 
    this.target = game.localPlayer;
    this.isTransitioning = false;
    this.worldSize = worldSize;

    // VIRTUAL STATE: Lees NOOIT de DOM in de update loop
    this.camX = 0;
    this.camY = 0;
    
    // Alleen bij resize de viewport meten
    this.updateViewport();
    window.addEventListener('resize', () => this.updateViewport());
  }

  updateViewport() {
    this.viewPortSize = this.element.getBoundingClientRect();
  }

  // De switch in setTarget
  setTarget(newTarget, smooth = true) {
    if (this.target === newTarget) return;
    this.target = newTarget;

    if (smooth) {
      this.isTransitioning = true;
      
      // Pientere check: Is het een wereld-object (huisje)? 
      // Zo nee, dan is het een racer (Player, AI, of Network)
      const isStatic = this.game.worldObjects && this.game.worldObjects.has(newTarget.id);

      if (isStatic) {
        this.scrollToTarget(newTarget.element);
      } 
      // De update() doet de rest voor alles wat NIET statisch is
    }
  }

  update() {
    if (!this.target || this.freeRoam) return;

    // 1. Bereken het ideale doelpunt (DestX/Y)
    const lookahead = 10;
    const tx = this.target.x + (this.target.vx || 0) * lookahead;
    const ty = this.target.y + (this.target.vy || 0) * lookahead;

    let destX = tx - (this.viewPortSize.width / 2);
    let destY = ty - (this.viewPortSize.height / 2);

    // Clamping
    destX = Math.max(0, Math.min(destX, this.worldSize - this.viewPortSize.width));
    destY = Math.max(0, Math.min(destY, this.worldSize - this.viewPortSize.height));

    if (this.isTransitioning) {
        // 2. LERP in JS (Geen DOM-reads meer!)
        this.camX += (destX - this.camX) * 0.05;
        this.camY += (destY - this.camY) * 0.05;

        // Check of we er zijn
        if (Math.hypot(destX - this.camX, destY - this.camY) < 2) {
            this.isTransitioning = false;
        }
    } else {
        // 3. Instant lock
        this.camX = destX;
        this.camY = destY;
    }

    // 4. WRITE: Slechts één DOM-schrijfactie per frame
    this.element.scrollTo({
        left: this.camX,
        top: this.camY,
        behavior: 'auto'
    });
  }

  async scrollToTarget(targetElement) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    return new Promise((resolve) => {
      const onScrollEnd = () => {
        this.element.removeEventListener('scrollend', onScrollEnd);
        this.isTransitioning = false;
        resolve();
      };
      this.element.addEventListener('scrollend', onScrollEnd);
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    });
  }
}