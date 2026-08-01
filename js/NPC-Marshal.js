import Emitter from "./tools/Emitter.js";
import { getDistance, checkCollision } from './tools/MathUtils.js';

export default class Marshal {
  
  constructor(game, spriteElem, svgPathElem, targetLayer,  marshalId, radius = 64, maxFrames = 64) {
    this.game = game;
    this.sprite = new Emitter(game, spriteElem, radius, radius, maxFrames, false, targetLayer, false );
    this.sprite.domElement.id = `${svgPathElem.id}-marshal-${marshalId}`;
    this.base = svgPathElem;
    this.position = {x: 0, y: 0};
    this.target = {x: this.base.cx.baseVal.value, y: this.base.cy.baseVal.value};
    this.radius = radius;
    this.speed = .2 + Math.random() * .8;
    this.status = 'idle';
    this.facingAngle = Math.random()* 360;
    this.marshalId = marshalId;
  }

  init () {
    let x = this.base.cx.baseVal.value + (Math.random() * this.radius - (this.radius * .25));
    let y = this.base.cy.baseVal.value + (Math.random() * this.radius - (this.radius * .25));
    this.position = {x, y};
    this.sprite.loop = true;
    this.sprite.start(this.position.x, this.position.y, this.facingAngle);
  }

  rescue () {

    /* 
    * set NPC target to player
    */
   
    let player = this.game.localPlayer;
    let cx = parseInt(this.position.x);
    let cy = parseInt(this.position.y);
    this.target.x = parseInt(player.x - cx);
    this.target.y = parseInt(player.y - cy);
    this.free = false;
  }

  draw () {
      this.sprite.domElement.style.setProperty('--left', Math.floor(this.position.x) + 'px');
      this.sprite.domElement.style.setProperty('--top', Math.floor(this.position.y) + 'px');
      this.sprite.domElement.style.setProperty('--rot', Math.floor(this.facingAngle + 90) + 'deg');
  }

  update (deltaTime) {
    if( !this.game.localPlayer) return;
    
    if (this.game.localPlayer == undefined) {
      return;
    }
    
    if (this.status === 'dead' || getDistance(this, this.game.localPlayer) > 2048) {
      return;
    }

    if(this.status === 'rescue') {
      this.rescue();
    } else {
      this.target.x = this.base.cx.baseVal.value - this.position.x;
      this.target.y = this.base.cy.baseVal.value - this.position.y;
    }
    

    // colliding with Player
    
    let [playerCollision, distance, sumOfRadii, distanceX, distanceY] = checkCollision(this, this.game.localPlayer);

    if (playerCollision) {

      console.log(`player struck marshal ${this.sprite.domElement.id}`)

      this.sprite.img.classList.add('hit');

      const unitX = distanceX / distance;
      const unitY = distanceY / distance;

      this.position.x = this.game.localPlayer.x + (sumOfRadii + this.game.localPlayer.speed) * unitX;
      this.position.y = this.game.localPlayer.y + (sumOfRadii + this.game.localPlayer.speed) * unitY;
      /*
      this.game.localPlayer.hud.postMessage('racecontrol','notice',`Incident involving car ${this.game.localPlayer.carnumber} (${this.game.localPlayer.displayname.slice(0, 3).toUpperCase()}) and marshal ${this.base.id.replace('post-','')}-${(this.marshalId + 1) }`, true);
      this.game.localPlayer.hud.postMessage('team','radio','DON\'T HIT THE MARSHALS!', true);
      */
      if(this.game.localPlayer.speed > 20) {
        this.status = 'dead';
        this.sprite.img.classList.add(this.status);
        /*
        this.game.localPlayer.hud.postMessage('session', 'status','red flag');

        this.game.localPlayer.hud.sessionTime = 0;
        */
       
      }

      setTimeout( () => {
        console.warn("STRAF! TERUG NAAR DE PITS!")
        this.game.localPlayer.speed = 0;
        let {x, y} = this.game.world.garages[this.game.localPlayer.garageIndex].circlePos;
        this.game.localPlayer.x = x;
        this.game.localPlayer.y = y;
        
      }, 1000)

    } else {
      if(this.sprite.img.className.includes('hit')) {
        this.sprite.img.classList.remove('hit');
      }
    }
 
    // colliding with other NPC
    // EDIT: let's skip this, little to gain from it rly

    /*
    this.game.world.marshals.forEach(lilguy => {
      if(lilguy.marshalId == this.marshalId) return;
      
      let [collision, distance, sumOfRadii, distanceX, distanceY] = checkCollision(this, lilguy);
      if (collision) {
        
        // these values will always be 0-1 as the distance = hypotenuse
        // ie a fraction of the total length. May be netgative, so a 
        // value between -1 and and +1
        const unitX = distanceX / distance;
        const unitY = distanceY / distance;
        
        this.position.x = lilguy.position.x + (sumOfRadii + 3) * unitX;
        this.position.y = lilguy.position.y + (sumOfRadii + 3) * unitY;
      }
    });
    */

    // If walking, animate NPC sprite
    if (Math.abs(this.target.x) > this.radius * 1.5 || Math.abs(this.target.y) > this.radius * 1.5 && !playerCollision) {

      // animate NPC
      this.sprite.update(deltaTime);

      // move NPC
      this.position.x += ((this.target.x * .025) + (Math.sin(deltaTime) * 2)) * this.speed;
      this.position.y += ((this.target.y * .025) + (Math.sin(deltaTime) * 2)) * this.speed;
      this.facingAngle = Math.atan2(this.target.y, this.target.x) * 180 / Math.PI;
      this.draw();

    } else {
      this.free = true;
    }
  }
}