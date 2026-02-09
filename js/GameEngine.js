import World from './World.js';
import Player from './Player.js';
import Opponent from './Opponent.js';
import NetworkManager from './NetworkManager.js';

export default class GameEngine {
    constructor() {
        this.lastTime = 0;

        this.world = new World({svgUrl: 'levels/assen/assen.svg'});

        this.localPlayer = undefined;
        this.opponents = new Map();
        this.network = new NetworkManager(this, (data) => this.handleNetworkData(data));
        
        this.init();
    }

    async init () {
      
      const possibleSpawnpoints = await this.world.load();
      let spawnPoint = possibleSpawnpoints[Math.floor(Math.random() * possibleSpawnpoints.length)];

      this.localPlayer = new Player('me', 'red', true, this);
      this.localPlayer.spawnPoint = { ...spawnPoint };
      this.localPlayer.x = spawnPoint.x;
      this.localPlayer.y = spawnPoint.y;

      this.start();
    }

    handleNetworkData(data) {
        /* previous 
        if (!this.opponents.has(data.id)) {
            this.opponents.set(data.id, new Opponent(data.id, 'blue', false, this));
        }
        const opp = this.opponents.get(data.id);
        if(data.type == 'bang') { 
          console.log(`🚑🚑🚑 hurt by ${data.id}`)  
        } else {
          opp.x = data.x;
          opp.y = data.y;
          opp.angle = data.angle;
        }
        */

    switch(data.type) {
      case 'hello':
        // Hier heb je volledige controle over de nieuwe speler
        if (!this.opponents.has(data.id)) {
          const newOpp = new Opponent(data.id, data.color, false, this);
          newOpp.name = data.name; // Sla de naam op
          this.opponents.set(data.id, newOpp);
          console.log(`${data.name} joined the race!`);
        }
        break;

      case 'update':
        const opp = this.opponents.get(data.id);
        if (opp) {
          opp.x = data.x;
          opp.y = data.y;
          opp.angle = data.angle;
        } else {
          // Optioneel: als we nog geen 'hello' hadden, stuur een verzoek terug
          this.network.send({ type: 'who_are_you' });
        }
        break;
      }
    }

    update(dt) {
      if (!this.world.isLoaded) return;
      const gp = navigator.getGamepads()[0];
      this.localPlayer.update(gp, dt);

      // Netwerk sync
      this.network.send({
          type: 'update',
          id: this.network.peer.id,
          x: this.localPlayer.x,
          y: this.localPlayer.y,
          angle: this.localPlayer.angle
      });
    }

    draw() {
        this.localPlayer.draw();
        this.opponents.forEach(opp => opp.draw());
    }

    start() {
        console.log(`starting game loop`, this)
        const loop = () => {
          const currentTime = performance.now(); 
          let frameTime = (currentTime - this.lastTime) / 16.66;

          if (frameTime > 4) frameTime = 4;

          this.lastTime = currentTime;
          this.update(frameTime);
          this.draw();

          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}