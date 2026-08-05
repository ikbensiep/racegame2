// js/CameraManager.js
export default class CameraManager {
  constructor(game, scrollContainer, worldSize = 32768) {
    this.game = game;
    this.element = scrollContainer;
    this.target = {x: 100, y:100};
    this.isTransitioning = false;
    this.worldSize = worldSize;
    
    this.cullingObserverObtions = {
      root: this.element,
      rootMargin: "512px",
      threshold: 0.0,
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

    this.camX = 0;
    this.camY = 0;

    this.speedZoomEnabled = this._isSpeedZoomEnabled(game?.settings);
    this.speedZoomMin = .9;
    this.speedZoomMax = 2;

    this.updateViewport();
    window.addEventListener('resize', () => this.updateViewport());
  }

  _isSpeedZoomEnabled(settings = {}) {
    const value = settings?.['camera-speed-zoom'];
    return value === true || value === 'on' || value === 'true' || value === 1;
  }

  _updateSpeedZoom(speed = 0) {
    if (!this.speedZoomEnabled) {
      // this.element.style.setProperty('--camera-speed-zoom', '1');
      this.element.style.setProperty('--camera-zoom', '1');
      return;
    }

    const maxSpeed = this.target?.dynamics?.maxSpeed || this.target?.maxSpeed || 50;
    const clampedSpeed = Math.max(0, Math.min(Math.abs(speed || 0), maxSpeed));
    const ratio = maxSpeed > 0 ? clampedSpeed / maxSpeed : 0;
    const zoom = this.speedZoomMax - ((this.speedZoomMax - this.speedZoomMin) * ratio);

    // this.element.style.setProperty('--camera-speed-zoom', zoom.toFixed(3));
    this.element.style.setProperty('--camera-zoom', zoom.toFixed(3));
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
    this.isTransitioning = true;
    console.groupCollapsed(`🎬 Camera Lock`)
    console.log(this.target);
    console.groupEnd();
  }

  update(dt) {
    
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
        // 2. LERP in JS 
        this.camX += (destX - this.camX) * 0.5;
        this.camY += (destY - this.camY) * 0.5;

        // Check of we er zijn
        if (Math.hypot(destX - this.camX, destY - this.camY) < 2) {
            this.isTransitioning = false;
        }
    } else {
        // 3. Instant lock
        this.camX = destX;
        this.camY = destY;

        // 3b. Nee, meer LERP
        // this.camX += (destX - this.camX) * 0.925;
        // this.camY += (destY - this.camY) * 0.925;
    }

    // 4. WRITE: Slechts één DOM-schrijfactie per frame
    this.element.style.setProperty('--cam-x', Math.round(this.camX)) /* rounding these to prevent too many DOM updates */
    this.element.style.setProperty('--cam-y', Math.round(this.camY))

    const speed = this.target?.speed || 0;
    this._updateSpeedZoom(speed);
    // this.element.scrollTo({
    //     left: this.camX,
    //     top: this.camY,
    //     behavior: 'auto'
    // });
  }
  
  updateSunPosition(timeOfDay) {
   
    const sunLight = document.getElementById('fakeSunLight');
    const specularLighting = document.getElementById('feSpecularLightingSun');
    
    // 1. STANDAARD BEWEGING EN ELEVATION BEREKENING
    let dayFactor = 0;
    let azimuth = 90;
    let elevation = 0;
    let isDay = false;

    if (timeOfDay >= 0.125 && timeOfDay <= 0.875) {
        isDay = true;
        dayFactor = (timeOfDay - 0.125) / (0.875 - 0.125);
        azimuth = dayFactor * 180;
        elevation = Math.sin(dayFactor * Math.PI) * 44;
        
        sunLight.setAttribute('azimuth', azimuth.toFixed(2));
        sunLight.setAttribute('elevation', elevation.toFixed(2));
        this.updateDropShadow(dayFactor, elevation);
    } else {
        sunLight.setAttribute('elevation', '0');
        this.updateDropShadow(0, 0, false); // Schaduw uit/minimaal in de nacht
    }

    // 2. BEREKEN DE LICHTKLEUR (Voor het feSpecularLighting filter)
    let lightColor = '#000000'; // Nacht = geen specular highlight
    
    if (isDay) {
        // We veranderen de Hue (kleurtoon) van warm goud/oranje naar wit-geel
        // Rond zonsopkomst/ondergang (dayFactor 0 of 1) = Hue 35 (Warm oranje)
        // Rond het middaguur (dayFactor 0.5) = Hue 55 (Warm wit/lichtgeel)
        const intensity = Math.sin(dayFactor * Math.PI); // 0 -> 1 -> 0
        const hue = 35 + (intensity * 20); 
        
        // Lichtsterkte (Lightness) stijgt overdag
        const lightness = 60 + (intensity * 25); // Van 60% naar 85%
        
        lightColor = `hsl(${hue}, 95%, ${lightness}%)`;
    }
    specularLighting.setAttribute('lighting-color', lightColor);

    // 3. BEREKEN DE MULTIPLY OVERLAY KLEUR (De hele wereld)
    // Omdat dit een 'multiply' layer is, zorgt WIT (hsl(0,0%,100%)) voor GEEN verduistering.
    // Donkere/blauwe kleuren maken de wereld donkerder en geven een blauwe tint.
    let overlayColor = 'hsl(240, 60%, 15%)'; // Standaard diepe nacht (Blauw/Paars)

    if (isDay) {
        const intensity = Math.sin(dayFactor * Math.PI);
        
        // Kleurtoon van de overlay:
        // Ochtend/Avond (intensity nabij 0): Hue ~25 (Warme, goudkleurige gloed over de wereld)
        // Middag (intensity = 1): Hue ~50 (Heel licht warm getint wit)
        const overlayHue = 25 + (intensity * 25);
        
        // Hoe hoger de zon, hoe lichter de multiply-layer (dus hoe minder donker de wereld is)
        // Middag = 95% (bijna volledig transparant/licht), Ochtend/Avond = 65% (schemering)
        const overlayLightness = 55 + (intensity * 40);
        
        // Verzadiging (Saturation) is hoog in de ochtend voor diep oranje, lager overdag
        const overlaySaturation = 80 - (intensity * 40); // Van 80% naar 40%
        
        overlayColor = `hsl(${overlayHue}, ${overlaySaturation}%, ${overlayLightness}%)`;
    } else {
        // Nacht-cyclus verloop (optioneel: sfeervol verloop tussen 21:00 en 03:00)
        // Hier houden we het even op een vaste nachtkleur, maar je kunt Lightness pushen op basis van de nacht-tijd
        overlayColor = 'hsl(235, 50%, 12%)'; 
    }

    // Pas de kleur toe op je multiply layer (bijvoorbeeld via een CSS variabele)
    this.element.style.setProperty('--world-multiply-color', overlayColor);

  }

   updateDropShadow(dayFactor, elevation, isDay = true) {
    if (!isDay) {
        this.element.style.setProperty('--dynamic-shadow', '0px 0px 0px rgba(0,0,0,0)');
        return;
    }
    const minShadowLength = 5;
    const maxShadowLength = 72;
    const elevationFactor = 1 - (elevation / 56); 
    const currentLength = minShadowLength + (elevationFactor * (maxShadowLength - minShadowLength));
    
    const sunAzimuthRad = (dayFactor * 180) * (Math.PI / 180);
    const offsetX = -Math.cos(sunAzimuthRad) * currentLength;
    const offsetY = -Math.sin(sunAzimuthRad) * currentLength;
    const blur = 4 + (elevationFactor * 12);
    
    const opacityFactor = Math.sin(dayFactor * Math.PI);
    const opacity = 0.05 + (opacityFactor * 0.4); // Iets minder aanwezig bij extreme hoeken
    
    const shadowString = `${offsetX.toFixed(1)}px ${offsetY.toFixed(1)}px ${blur.toFixed(1)}px rgba(0, 0, 0, ${opacity.toFixed(2)})`;
    
    this.element.style.setProperty('--dynamic-shadow', shadowString);
  }

  // TODO: delete?
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