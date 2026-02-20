import World from './World.js';
import Player from './Player.js';
import Opponent from './Opponent.js';
import AIOpponent from './AIOpponent.js';
import NetworkManager from './NetworkManager.js';
import EffectManager from './EffectManager.js';
import CameraManager from './CameraManager.js';
import CameraTweaker from './tools/CameraTweaker.js';
import LapTimer from "./LapTimer.js";

export default class GameEngine {
    constructor(settings) {

      this.settings = settings;
      this.lastTime = 0;
      this.scene = settings.track || 'assen';
      this.world = new World(this, this.scene);

      this.localPlayer = undefined;
      this.opponents = new Map();
      this.effects = new EffectManager(this);
      this.network = new NetworkManager(this, (data) => this.handleNetworkData(data));
      this.camera = {};

      this.cameraTweaker = new CameraTweaker(this);

      this.init(this);
    }

    async init (game) {
      this.camera = new CameraManager(this, document.querySelector('#camera-viewport'))
      
      const possibleSpawnpoints = await this.world.load();

      // 0. Chart the area, note interesting areas/surfaces
      await this.world.findSurfaces();

      // 1. Find spawnpoints
      await this.world.findSpawnPoints('training');
      
      // 2. Find walls, trees (obstacles, sprites)
      await this.world.findWalls();
      await this.world.findTrees();

      let spawnPoint = possibleSpawnpoints[Math.floor(Math.random() * possibleSpawnpoints.length)];

      this.localPlayer = new Player('me', this.settings.name, this.settings.driverNumber, this.settings.color, true, game);
      this.localPlayer.spawnPoint = { ...spawnPoint };
      this.localPlayer.x = spawnPoint.x;
      this.localPlayer.y = spawnPoint.y;

      this.world.lapTimer = new LapTimer(this.world, [...this.world.paths.sectors]);

      this.start();
      
      this.camera.target = this.localPlayer;
    
      // if(this.network.isHost) {
      //  await this.spawnBots(game);
      // }

      this.cameraTweaker.refresh();
    }

    async spawnBots (game) {
      // Maak een paar bots aan
      for(let i = 0; i < 1; i++) {
          const bot = new AIOpponent(`bot-${i}`, 'green', game);
          bot.progress = i * 0.1; // Verspreid ze over de baan
          game.opponents.set(bot.id, bot);
      }
    }

    handleNetworkData(data) {

    const opp = this.opponents.get(data.id) || null;

    switch(data.type) {

      case 'hello':
        console.info('🥳 HELLO from ', data); // DIT IS GOED SPUL

        // Hier heb je volledige controle over de nieuwe speler
        if (!this.opponents.has(data.id)) {
          const newOpp = new Opponent(data.id, data.name, data.driverNumber, data.color, this);
          newOpp.name = data.name; // Sla de naam op
          this.opponents.set(data.id, newOpp);
          console.log(`${data.name} joined the race!`);
        }
        break;

      case 'update':
        if (opp) {
          opp.x = data.x;
          opp.y = data.y;
          opp.angle = data.angle;
        } else {
          // Optioneel: als we nog geen 'hello' hadden, stuur een verzoek terug
          this.network.send({ type: 'who_are_you' });
        }
        break;

      case 'bang' :
        if (data.type === 'bang' && opp) {
          console.log(`🚑 Collision with ${data.id}`);
          
          // Trigger visual effects
          this.effects.trigger(opp, 'colliding', 300);
          // Opbokke boeke
          this.effects.trigger(this.localPlayer, 'colliding', 100);
          this.game.effects?.trigger(this.game.camera.zoomElement, 'colliding', 300);
        }
      }
    }

    update(dt) {
      
      if (!this.world.isLoaded) return;

      const gp = navigator.getGamepads()[0];
      this.localPlayer.update(gp, dt);
      
      if (this.network.isHost) {
      this.opponents.forEach(opp => {
        
        if (opp instanceof AIOpponent) {
          opp.update();

            this.network.send({
                type: 'update',
                id: opp.id,
                x: opp.x,
                y: opp.y,
                angle: opp.angle
            });
            }
          });
      }

      // Netwerk sync
      this.network.send({
          type: 'update',
          id: this.network.peer.id,
          x: this.localPlayer.x,
          y: this.localPlayer.y,
          angle: this.localPlayer.angle
      });

      this.camera.update(dt);
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