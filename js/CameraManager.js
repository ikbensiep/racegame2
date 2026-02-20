// js/CameraManager.js
export default class CameraManager {
  constructor(game, scrollContainer, worldSize = 32768) {
    this.game = game;
    this.element = scrollContainer;
    this.target = game.localPlayer;
    this.isTransitioning = false;
    this.worldSize = worldSize;
    this.dayTimeUpdater = 0;
    this.cullingObserverObtions = {
      root: this.element,
      rootMargin: "256px",
      threshold: 0.05,
    };
    
    this.cullingObserver = new IntersectionObserver( (entries, self) => {
        entries.forEach (entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('off-screen')
                
            } else {
                entry.target.classList.add('off-screen')
            }
        });
    }, this.cullingObserverObtions);
  

    // VIRTUAL STATE: Lees NOOIT de DOM in de update loop
    this.camX = 0;
    this.camY = 0;
    
    // Alleen bij resize de viewport meten
    this.updateViewport();
    window.addEventListener('resize', () => this.updateViewport());
    
  }

  createCullingObserver () {
    return new IntersectionObserver( (entries, self) => {
        entries.forEach (entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('off-screen')
                
            } else {
                entry.target.classList.add('off-screen')
            }
        });
    }, this.createCullingObserver);
  }

  updateViewport() {
    this.viewPortSize = this.element.getBoundingClientRect();
  }

  // De switch in setTarget
  setTarget(newTarget) {
    this.target = newTarget;
    console.log(`🎬 Camera Lock:`, this.target);
  }

  update(dt) {
    // day / night cycle
    if(this.dayTimeUpdater < 10000) {
      let now = new Date();
      try {
        let timeEl = document.querySelector('input[name="time-of-day"]');
        timeEl.value = Math.sin(now.getTime() / 10000);
        let event = new Event('input');
        timeEl.dispatchEvent(event);
        this.dayTimeUpdater + dt;
      } catch (e) {
        console.error(e)
      }
    } else {
      this.dayTimeUpdater = 0
    }

    if (!this.target || this.freeRoam) return;

    // 1. Bereken het ideale doelpunt (DestX/Y)
    const lookahead = 15;
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
        // this.camX = destX;
        // this.camY = destY;
        // Nee, meer LERP
        this.camX += (destX - this.camX) * 0.95;
        this.camY += (destY - this.camY) * 0.95;
    }

    // 4. WRITE: Slechts één DOM-schrijfactie per frame
    this.element.style.setProperty('--cam-x', Math.round(this.camX)) /* rounding these to prevent too many DOM updates */
    this.element.style.setProperty('--cam-y', Math.round(this.camY))
    // this.element.scrollTo({
    //     left: this.camX,
    //     top: this.camY,
    //     behavior: 'auto'
    // });
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