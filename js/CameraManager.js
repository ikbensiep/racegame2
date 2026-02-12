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
  setTarget(newTarget) {
    this.target = newTarget;
    console.log(`🎬 Camera Lock:`, this.target);
  }

  update() {
    if (!this.target) return;

    // 1. Lineaire positie (geen lerp, geen vertraging)
    const lookahead = 5; 
    const tx = this.target.x + (this.target.vx || 0) * lookahead;
    const ty = this.target.y + (this.target.vy || 0) * lookahead;

    // 2. Bereken het exacte middelpunt
    let scrollX = tx - (this.viewPortSize.width / 2);
    let scrollY = ty - (this.viewPortSize.height / 2);

    // 3. Harde Clamping (geen grijze randen)
    scrollX = Math.max(0, Math.min(scrollX, this.worldSize - this.viewPortSize.width));
    scrollY = Math.max(0, Math.min(scrollY, this.worldSize - this.viewPortSize.height));

    // 4. Forceer de browser naar de coördinaten
    // We gebruiken 'auto' om ELKE vorm van browser-smoothing uit te schakelen
    this.element.scrollTo({
        left: scrollX,
        top: scrollY,
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