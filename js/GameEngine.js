import World from './World.js';
import Player from './Player.js';
import Opponent from './Opponent.js';
import AIOpponent from './AIOpponent.js';
import NetworkManager from './NetworkManager.js';
import EffectManager from './EffectManager.js';
import CameraManager from './CameraManager.js';
import CameraTweaker from './tools/CameraTweaker.js';
import LapTimer from "./LapTimer.js";
import { SoundManager } from './Sound.js';

export default class GameEngine {
    constructor(settings) {

      this.settings = settings;
      this.settings.audioPanScreenSpace = true;
      this.lastTime = 0;
      this.scene = settings.track || 'assen';
      this.world = new World(this, this.scene);

      this.localPlayer = undefined;
      this.opponents = new Map();
      this.effects = new EffectManager(this);
      this.network = new NetworkManager(this, (data) => this.handleNetworkData(data));
      this.soundManager = new SoundManager();
      this.camera = {};
      this.cameraTweaker = {};


      this.init(this);
    }

    async init (game) {
      this.camera = new CameraManager(this, document.querySelector('#camera-viewport'))
      
      const possibleSpawnpoints = await this.world.load();

      // 0. Chart the area, note interesting areas/surfaces
      await this.world.findSurfaces();

      // 1. Find spawnpoints
      await this.world.findSpawnPoints('paddock');
      
      console.log(`📍 Found ${this.world.garages.length} garages from SVG`);
      
      // player Host always gets garage box 1
      // AI/network players are slotted after, in order of joining
      
      this.localPlayer = new Player(this.network.peer.id, this.settings['player-name'], this.settings['player-number'], this.settings['player-color'], true, game);
      
      /* TODO: delete this old code
      let spawnPoint = possibleSpawnpoints[0];
      this.localPlayer.spawnPoint = { ...spawnPoint };
      this.localPlayer.x = spawnPoint.x;
      this.localPlayer.y = spawnPoint.y; 
      */

      // Local player always claims first available garage
      // For host: claims garage 0, then bots claim 1,2,3
      // For client: waits for host to assign (via garage-claim message)
      // NOTE: Assign AFTER spawnBots() to ensure isHost is properly set
      // (moved to end of init)

      this.world.lapTimer = new LapTimer(this.world, [...this.world.paths.sectors]);

      
      this.camera.target = this.localPlayer;

      

      console.log(this.world.trackElement)
      // 2. Find walls, trees (obstacles, sprites)
      await this.world.findWalls();
      await this.world.findTrees();

      // if(this.network.isHost) {
      // await this.spawnBots(game);
      // }
      

      // Wait for peer to be fully ready before assigning local player
      await this.network.waitForPeerReady();
      
      // Ensure local player has the actual network peer id (was null if created before peer open)
      if (!this.localPlayer.id) {
        this.localPlayer.id = this.network.peer.id;
        console.log(`Resolved localPlayer.id -> ${this.localPlayer.id}`);
      }

      // Assign local player garage (after peer is fully initialized)
      console.log(`About to assign local player. isHost: ${this.network.isHost}`);
      if (this.network.isHost) {
        console.log(`isHost is TRUE, assigning local player...`);
        this.assignGarageToPlayer(this.localPlayer);
      } else {
        console.log(`isHost is FALSE, skipping local player assignment`);
      }

      this.start();
      this.cameraTweaker = new CameraTweaker(this)
      this.cameraTweaker.refresh();
    }

    async spawnBots (game) {
      let colorOptions = document.querySelector('#color-palette').options;
      // Maak een paar bots aan
      for(let i = 0; i < 3; i++) {
        const bot = new AIOpponent(`bot-${i}`, colorOptions[Math.floor(Math.random() * colorOptions.length )].value, game);
        console.log(`spawning 🤖 ${bot.id}`)
          bot.progress = i * 0.15; // Verspreid ze over de baan
          this.opponents.set(bot.id, bot);
          this.assignGarageToPlayer(bot);
      }
    }

    getNextAvailableGarageIndex () {
      for (let i = 0; i < this.world.garages.length; i++) {
        if (this.world.garages[i].occupant === null) {
          return i;
        }
      }
      return -1; // No available garage
    }

    assignGarageToPlayer (player) {
      const garageIndex = this.getNextAvailableGarageIndex();
      console.log(`Assigning garage to ${player.id}. Available index: ${garageIndex}, Total garages: ${this.world.garages.length}`);
      
      if (garageIndex !== -1) {
        player.garageIndex = garageIndex;
        this.world.garages[garageIndex].occupant = player.id;
        console.log(`🏠 ${player.id} assigned to garage ${garageIndex}`);

        player.x = this.world.garages[garageIndex].circlePos.x;
        player.y = this.world.garages[garageIndex].circlePos.y;
        console.log(`Position set to ${player.x}, ${player.y}`);
        // Initialize engine sound now that the player has a valid position
        if (typeof player.initEngineSound === 'function') {
          player.initEngineSound().catch(err => console.error('Error initializing engine sound', err));
        }

        return true;
      }
      console.warn(`⚠️ No available garages for ${player.id}`);
      return false;
    }

    getPlayerGarage (player) {
      if (player.garageIndex !== undefined && player.garageIndex < this.world.garages.length) {
        return this.world.garages[player.garageIndex];
      }
      return null;
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
            
            // Always assign a fresh garage slot for new players (don't accept theirs)
            this.assignGarageToPlayer(newOpp);
            
            // If we're the host, confirm all garage assignments to the new player
            if (this.network.isHost) {
              // Send local player's garage assignment (use peer ID, not 'me')
              this.network.sendTo(data.id, {
                type: 'garage-claim',
                playerId: this.network.peer.id,
                garageIndex: this.localPlayer.garageIndex
              });
              
              // Send all opponent garage assignments
              this.opponents.forEach(opp => {
                if (opp.garageIndex !== undefined && opp.id !== data.id) {
                  this.network.sendTo(data.id, {
                    type: 'garage-claim',
                    playerId: opp.id,
                    garageIndex: opp.garageIndex
                  });
                }
              });
              
              // Finally, confirm the new player's assigned garage
              this.network.sendTo(data.id, {
                type: 'garage-claim',
                playerId: newOpp.id,
                garageIndex: newOpp.garageIndex
              });
            }
            
            this.cameraTweaker.refresh();
            console.log(`${data.name} joined the race!`);
          }
          break;

        case 'update':
          if (opp) {
            opp.x = data.x;
            opp.y = data.y;
            opp.angle = data.angle;
            opp.speed = data.speed;
            
            // Sync garage assignment if included
            if (data.garageIndex !== undefined && opp.garageIndex !== data.garageIndex) {
              opp.garageIndex = data.garageIndex;
              if (this.world.garages && data.garageIndex < this.world.garages.length) {
                this.world.garages[data.garageIndex].occupant = data.id;
              }
            }
          } else {
            // Optioneel: als we nog geen 'hello' hadden, stuur een verzoek terug
            this.network.send({ type: 'who_are_you' });
          }
          break;

        case 'garage-claim':
          // Mark a garage as claimed by a specific player
          if (!this.world.garages || data.garageIndex >= this.world.garages.length) {
            console.warn(`Invalid garage index: ${data.garageIndex}, only ${this.world.garages?.length || 0} garages available`);
            break;
          }
          
          // Look up the player object (either local or opponent)
          const claimingPlayer = this.localPlayer?.id === data.playerId ? this.localPlayer : this.opponents.get(data.playerId);
          
          // Clear old garage assignment if player had one
          if (claimingPlayer && claimingPlayer.garageIndex !== undefined) {
            const oldGarage = this.world.garages[claimingPlayer.garageIndex];
            if (oldGarage && oldGarage.occupant === data.playerId) {
              oldGarage.occupant = null;
            }
          }
          
          // Assign new garage
          this.world.garages[data.garageIndex].occupant = data.playerId;
          if (claimingPlayer) {
            claimingPlayer.garageIndex = data.garageIndex;
            // Set spawn position based on garage
            const garage = this.world.garages[data.garageIndex];
            if (garage && garage.circlePos) {
              claimingPlayer.x = garage.circlePos.x;
              claimingPlayer.y = garage.circlePos.y;
              if (typeof claimingPlayer.initEngineSound === 'function') {
                claimingPlayer.initEngineSound().catch(err => console.error('Error initializing engine sound', err));
              }
            }
          }
          console.log(`🏠 ${data.playerId} claimed garage ${data.garageIndex}`);
          break;

        case 'bang' :
          if (data.type === 'bang' && opp) {
            console.log(`🚑 Collision with ${data.id}`);
            
            // Trigger visual effects
            this.effects.trigger(opp, 'colliding', 300);
            // Opbokke boeke
            this.effects.trigger(this.localPlayer, 'colliding', 100);
            this.effects.trigger(this.camera, 'colliding', 300);
        }
      }
    }

    update(dt) {
      
      if (!this.world.isLoaded) return;

      this.localPlayer.update(dt);
      
      if (this.network.isHost) {
      this.opponents.forEach(opp => {
        
        if (opp instanceof AIOpponent) {
          opp.update();

            this.network.send({
                type: 'update',
                id: opp.id,
                x: opp.x,
                y: opp.y,
                angle: opp.angle,
                speed: opp.speed,
                garageIndex: opp.garageIndex
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
          angle: this.localPlayer.angle,
          speed: this.localPlayer.speed,
          garageIndex: this.localPlayer.garageIndex
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