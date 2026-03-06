import { getDistance } from "./MathUtils.js";
export default class Emitter {
  constructor(game, elem, width, height, maxFrame, sticky, targetLayer, loop = false) {
    this.game = game;
    this.free = true;
    this.position= {x: 0, y: 0};
    this.speed = 0;
    this.domElement = elem.cloneNode(true);
    this.domElement.id = '';
    this.width = width || 128;
    this.height = height || 128;
    this.rotation = 0;
    this.domElement.classList.add('emitter-object');
    this.domElement.style.width = this.width + "px";
    this.domElement.style.height = this.height + "px";
    this.frameX = 0;
    this.frameY = 0;
    this.frame = 0;
    this.maxFrame = maxFrame || 64;
    this.loop = loop;
    this.animationTimer = 0;
    this.animationInterval = 1000/60;
    
    this.sticky = sticky;
    this.targetLayer = targetLayer ? targetLayer : this.game.mapLayers.track.element;
    
    this.img = this.domElement.querySelector('img') ? this.domElement.querySelector('img') : this.domElement;
    this.img.addEventListener('load', (e) => {
      // let path = new URL(e.target.src);
      // let file = path.pathname;
      // console.log(`🖼️ loaded ${file}, w: ${parseInt(this.img.getAttribute('width')) || this.img.width || e.target.width}, framesPerRow: ${this.framesPerRow}`)
      let spriteImageWidth = parseInt(this.img.getAttribute('width')) || this.img.width || e.target.width;
      this.framesPerRow = Math.floor(spriteImageWidth / this.width);
    })

    this.domElement.addEventListener('animationend', (event) => {
      if(event.animationName) {
        this.game.debug && console.log(`${this.domElement.className} animation ended, scheduling DOM removal`);
        this.reset();
      }
    })

    // this.framesPerRow = Math.floor(spriteImageWidth / this.width);

    if (this.maxFrame == 1) {
      this.frameX = 0;
      this.frameY = 0;
    }

    this.domElement.style.setProperty('--spriteHeight', parseInt(this.height));
    this.domElement.style.setProperty('--spriteWidth', parseInt(this.width));
  }

  draw () {
    console.log('draw sprite', this.domElement)
    this.game.debug && console.log(this.domElement.className, this.speed);

    let distanceToPlayer = getDistance(this, this.game.localPlayer);
    if(!this.free && distanceToPlayer < this.game.camera.viewPortSize.width) {
      // sprite animation is handled by changing the CSS `object-position` using a css variable
      // (see `.emitter-object` @ style.css)
      if(this.maxFrame) {
        this.domElement.style.setProperty('--step', this.frameX);
        this.domElement.style.setProperty('--row', this.frameY);
      }
      this.domElement.style.setProperty('--left',`${parseInt(this.position.x)}px`);
      this.domElement.style.setProperty('--top',`${parseInt(this.position.y)}px`);
      this.domElement.style.setProperty('--rot',`${this.rotation}`);
    }
  }

  update (deltaTime) {
    if(!this.free) {
      if(this.sticky) {
        let offset = this.game.sidesFromHypotenhuse(this.game.localPlayer.width / 2, this.game.localPlayer.angle)
        this.position.x = parseInt(this.game.localPlayer.x - offset.width);
        this.position.y = parseInt(this.game.localPlayer.y - offset.height);

        let left, top, rot;
        left = parseInt(this.position.x);
        top = parseInt(this.position.y);
        rot = parseInt(this.rotation);

        this.domElement.style.setProperty('--left',`${left}px`);
        this.domElement.style.setProperty('--top',`${top}px`);
        this.domElement.style.setProperty('--rot',`${rot}`);
      }

      if(this.animationTimer > this.animationInterval) {
        if(this.frame < this.maxFrame) {
          this.frame++;
        } else {
          if(!this.loop) {
            this.reset();
          } else {
            this.frame = 0;
            this.frameY = 0;
            this.frameX = 0;
          }
        }
        
        this.frameX = this.frame % this.framesPerRow;
        this.frameY = Math.floor(this.frame / this.framesPerRow);
        
        // Panik, reset to frame 0
        if(isNaN(this.frameX) || !isFinite(this.frameX)) this.frameX = 0;
        if(isNaN(this.frameY) || !isFinite(this.frameY)) this.frameY = 0;
        
        this.animationTimer = 0;
        if( !this.domElement.className.includes('fade')) {
          this.draw()
        }
        
      } else {
        this.animationTimer += deltaTime;
      }  

      if(this.speed > 0) {
        let target = this.game.sidesFromHypotenhuse(this.speed, this.rotation);
        this.position.x += target.width * .99;
        this.position.y += target.height * .99;
        this.speed--;
      } else {
        this.speed = 0;
      }
    }
  }

  reset () {
    const removeEmittedItem = () => {
      this.domElement.remove();
    }
    this.frame = 0;
    this.frameX = 0;
    this.frameY = 0;
    this.free = true;
    

    requestAnimationFrame(removeEmittedItem);
  }

  start (x, y, rot) {
    
    if (!this.free) return;

    const appendEmittedItem = () => {
      this.rotation = rot;
  
      this.free = false;
      this.frame = 0;
      this.frameY = 0;
      this.frameX = 0;
      this.position.x = x;
      this.position.y = y;
      
      this.domElement.style.setProperty('--left',`${parseInt(this.position.x)}px`);
      this.domElement.style.setProperty('--top',`${parseInt(this.position.y)}px`);
      this.domElement.style.setProperty('--rot',`${rot}`);
      
      this.sticky && this.domElement.classList.add('sticky');
      
      if (this.targetLayer && this.domElement) {
        this.targetLayer.appendChild(this.domElement);
      }
      this.game.debug && console.log(this.domElement)
    }
    
    // FIXME (MAYBE?): instead of appending a sprite when needed,
    // we should have appended it already (and hidden) upon initialization
    // and then here just flip a classname / attr (ie, 'alive') when necessary?

    requestAnimationFrame(appendEmittedItem);
  }
}