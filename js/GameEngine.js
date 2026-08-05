import World from './World.js';
import Player from './Player.js';
import Opponent from './Opponent.js';
import AIOpponent from './AIOpponent.js';
import NetworkManager from './NetworkManager.js';
import EffectManager from './EffectManager.js';
import CameraManager from './CameraManager.js';
import CameraTweaker from './tools/CameraTweaker.js';
import LapTimer from "./LapTimer.js";
import RaceHUD from "./HeadsupDisplay.js";

import { SoundManager } from './Sound.js';
import { getAngle } from './tools/MathUtils.js'
export default class GameEngine {
    constructor(settings) {

      this.debug = false;
      this.maxBots = 2;
      
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
      this.audioManager = null;

      this.sessionTime = 300000;
      this.hud = new RaceHUD(this);


      this.init(this);
    }

    async init (game) {
      // Camera is created first because the CameraCulling IntersectionObserver 
      // is part of it:
      // The World class (next line) (and inside it, Building Manager) can then 
      // add (3D) structures and lights, sprites to the culling system.
      // FIXME: 
      // CameraManager initializes with localPlayer as target, which will be undefined so we're 
      // "re" assigning the camera target to localPlayer again later (but correctly this time lol).
      // 💡 Could be cool to initialize at 0,0 and then pan towards the player when loading's done, ie
      // opacity: 0; blur(32px) -> pan2playr, opacity: 1, blur(0)
      this.camera = new CameraManager(this, document.querySelector('#camera-viewport'))
       
      const possibleSpawnpoints = await this.world.load();

      // 0. Chart the area, note interesting areas/surfaces
      await this.world.findSurfaces();

      // 1. Find spawnpoints
      // TODO: either make a session system that decides between 
      // paddock and grid, or (in the meantime?) make a selector UI

      await this.world.findSpawnPoints('paddock');
      
      if (!this.world.garages.length) {
        console.error('No garages found in SVG. Does g#spawnpoints have g[label:paddock] or g[label:grid] containing paths/circles?');
        return false;
      } 
      
      // player Host always gets garage box 1
      // AI/network players are slotted after, in order of joining

      this.localPlayer = new Player(game, this.network.peer.id, this.settings['player-name'], this.settings['player-number'], this.settings['player-color'], this.settings['player-team'], this.settings['player-livery'], true);

      

      this.camera.setTarget(this.localPlayer);
      console.groupCollapsed('🗺️ #racetrack')
      console.log(this.world.trackElement);
      console.groupEnd();

      // 2. Find walls, trees (obstacles, sprites)
      await this.world.findWalls();
      await this.world.findTrees();

      // Wait for peer to be fully ready before assigning local player
      await this.network.waitForPeerReady();
      console.groupCollapsed('networking')
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
        
        const playerGarage = this.world.garages[this.localPlayer.garageIndex];
        this.world.paths.pitbox = playerGarage?.rectanglePath || null;
      } else {
        // TODO: transfer host when host is gone / fix this else branch to assign 
        // garage when entering an "abandoned" lobby
        console.log(`isHost is FALSE, skipping local player assignment`);
      }

      if(this.network.isHost) {
        console.log('assign bots?')
        // await this.spawnBots(game);
      }

      console.groupEnd()
      
      // Initialize audio manager (Tuna optional). Keep non-blocking: try to create and load minimal assets.
      try {
       const AudioManager = (await import('./AudioManager.js')).default;
       this.audioManager = new AudioManager(this.soundManager, this.world, this);
       await this.audioManager.init();
       // try to load the crowd amb file if present; ignore failures
       this.audioManager.loadCrowd('/assets/sound/crowd.ogg').catch(() => {});
      } catch (e) {
       console.warn('GameEngine: AudioManager not initialized', e);
      }

      // Detach the SVG now that all geometry measurements have been collected.
      // This reduces DOM size and avoids future getBBox surprises on detached nodes.
      if (typeof this.world.detachSvg === 'function') this.world.detachSvg();

      this.start();
      this.cameraTweaker = new CameraTweaker(this)
      this.cameraTweaker.refresh();
      this.world.lapTimer = new LapTimer(this, [...this.world.paths.sectors]);
      
      document.body.classList.remove('busy');

      let dialog = document.querySelector('dialog#lobby-menu');
      dialog.close();
    }

    async spawnBots (game) {
      let colorOptions = document.querySelector('#color-palette').options;
      // Maak een paar bots aan
      for(let i = 0; i < this.maxBots; i++) {
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

    setSpawnOrientation (player, garage) {
      
      if (!player || !garage) {
        return;
      }
      // Prefer a precomputed rectangle center (computed while SVG attached),
      // then fall back to the circle center. Only use getBBox as a last resort.
      let targetPoint = garage.rectangleCenter || garage.circlePos || null;
      const targetShape = garage.rectangleElement || garage.garageGroup?.querySelector('rect, path');

      if (!targetPoint && targetShape?.getBBox) {
        try {
          const bbox = targetShape.getBBox();
          console.log('[pitbox rect]', bbox, targetShape);
          if (bbox && (bbox.width > 0 || bbox.height > 0)) {
            targetPoint = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
          } else {
            console.warn('[pitbox rect] empty bbox, no usable targetPoint', bbox);
          }
        } catch (e) {
          console.warn('getBBox failed for targetShape, continuing with available data', e);
        }
      }

      if (targetPoint && player.x !== null && player.y !== null) {
        player.angle = Math.atan2(targetPoint.y - player.y, targetPoint.x - player.x);
        
        try {
          // player.angle = getAngle(player, targetPoint)

        } catch (e) {
          console.error(e)
        }
        player.movementAngle = player.angle;
      } 
    }

    assignGarageToPlayer (player) {
      const garageIndex = this.getNextAvailableGarageIndex();
      console.log(`Assigning garage to ${player.id}. Available index: ${garageIndex}, Total garages: ${this.world.garages.length}`);
      
      if (garageIndex !== -1) {
        const garage = this.world.garages[garageIndex];
        if (!garage) {
          console.warn(`Garage index ${garageIndex} is not available in the current world data.`);
          return false;
        }

        player.garageIndex = garageIndex;
        garage.occupant = player.id;
        
        player.x = garage.circlePos.x;
        player.y = garage.circlePos.y;
        this.setSpawnOrientation(player, garage);

        if (player.isLocal && garage.rectanglePath) {
          this.world.paths.pitbox = garage.rectanglePath;
        }
        console.log(`🏠 ${player.id} assigned to garage ${garageIndex} at ${player.x}, ${player.y}`);
        
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
          console.debug('[network] hello packet received:', data);

          // Hier heb je volledige controle over de nieuwe speler
          if (!this.opponents.has(data.id)) {

            const newOpp = new Opponent(this, data.id, data.name, data.driverNumber, data.color, data.team, data.livery);
            console.debug(`[network] created Opponent ${data.id} with color=${data.color} livery=${data.livery}`);
            console.info('[newOpp]',newOpp)
            
            newOpp.name = data.name; // Sla de naam op
            this.opponents.set(data.id, newOpp);
            
            // Always assign a fresh garage slot for new players (don't accept theirs)
            this.assignGarageToPlayer(newOpp);
            
            this.hud?.addCompetitor(newOpp);
            

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
            
            if (this.cameraTweaker && typeof this.cameraTweaker.refresh === 'function') {
              this.cameraTweaker.refresh();
            } else {
              console.warn('cameraTweaker not ready yet; skipping refresh on join');
            }
            console.log(`${data.name} joined the race!`);
            
            let msg = `${data.name} (car ${data.driverNumber}) joined.`;
            console.log(this.hud, msg)
            this.hud?.postMessage('racecontrol', 'notice', msg, true);
          }
          break;

        case 'update':
          if (opp) {
            opp.x = data.x;
            opp.y = data.y;
            opp.angle = data.angle;
            opp.speed = data.speed;
            opp.health = data.health;
            opp.isBraking = data.isBraking;
            opp.highbeam = data.highbeam;
            // Sync garage assignment if included. Use !== undefined so garage 0 is still processed.
            if (data.garageIndex !== undefined && opp.garageIndex !== data.garageIndex) {
              const previousGarageIndex = opp.garageIndex;
              opp.garageIndex = data.garageIndex;

              if (this.world.garages && previousGarageIndex !== undefined && previousGarageIndex >= 0 && previousGarageIndex < this.world.garages.length) {
                const previousGarage = this.world.garages[previousGarageIndex];
                if (previousGarage && previousGarage.occupant === data.id) {
                  previousGarage.occupant = null;
                }
              }

              if (this.world.garages && data.garageIndex >= 0 && data.garageIndex < this.world.garages.length) {
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
          const garageIndex = Number(data.garageIndex);
          if (!this.world.garages || !Number.isInteger(garageIndex) || garageIndex < 0 || garageIndex >= this.world.garages.length) {
            console.warn(`Invalid garage index: ${data.garageIndex}, only ${this.world.garages?.length || 0} garages available`);
            break;
          }
          
          // Look up the player object (either local or opponent)
          const localPeerId = this.network?.peer?.id;
          const claimingPlayer = this.localPlayer?.id === data.playerId || localPeerId === data.playerId
            ? this.localPlayer
            : this.opponents.get(data.playerId);
          
          // Clear old garage assignment if player had one
          if (claimingPlayer && claimingPlayer.garageIndex !== undefined) {
            const oldGarageIndex = claimingPlayer.garageIndex;
            if (oldGarageIndex !== garageIndex) {
              const oldGarage = this.world.garages[oldGarageIndex];
              if (oldGarage && oldGarage.occupant === data.playerId) {
                oldGarage.occupant = null;
              }
            }
          }
          
          const garage = this.world.garages[garageIndex];
          if (!garage) {
            console.warn(`Garage slot ${garageIndex} is missing from the current world data.`);
            break;
          }

          // Assign new garage
          garage.occupant = data.playerId;
          if (claimingPlayer) {
            claimingPlayer.garageIndex = garageIndex;
            // Set spawn position based on garage
            if (claimingPlayer.isLocal && garage?.rectanglePath) {
              this.world.paths.pitbox = garage.rectanglePath;
            }
            if (garage && garage.circlePos) {
              claimingPlayer.x = garage.circlePos.x;
              claimingPlayer.y = garage.circlePos.y;
              this.setSpawnOrientation(claimingPlayer, garage);
              if (typeof claimingPlayer.initEngineSound === 'function') {
                claimingPlayer.initEngineSound().catch(err => console.error('Error initializing engine sound', err));
              }
            }
          }
          console.log(`🏠 ${data.playerId} claimed garage ${garageIndex}`);
          break;

        case 'daytime':
          if (data.value !== undefined) {
            console.log('[network] daytime sync received:', data.value);
            if (this.cameraTweaker?.setTimeOfDay) {
              this.cameraTweaker.setTimeOfDay(data.value);
            }
          }
          break;

        case 'bang' :
          if (data.type === 'bang' && opp) {
            opp.health = data.health;
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
                  garageIndex: opp.garageIndex,
                  health: opp.health
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
          garageIndex: this.localPlayer.garageIndex,
          health: this.localPlayer.health,
          braking: this.localPlayer.isBraking,
          highbeam: this.localPlayer.highbeam
      });

      this.camera.update(dt);
    }

    draw() {
      this.localPlayer.draw();
      this.opponents.forEach(opp => opp.draw());
    }

    start() {

        console.groupCollapsed(`starting game loop`)
        console.log(this);
        console.groupEnd()
        console.log(this.inviteLink ? this.inviteLink : '🫩 no PeerJS connection ig 🙄')
        
        // Guard against multiple start() calls
        if (this.loopRunning) {
            console.warn('Game loop already running, ignoring duplicate start() call');
            return;
        }
        this.loopRunning = true;
        
        let frameCount = 0;
        
        const loop = () => {
          frameCount++;
          const currentTime = performance.now(); 
          let frameTime = (currentTime - this.lastTime) / 16.66;

          this.lastTime = currentTime;
          
          // Log frame updates for debugging
          if (this.debug && frameCount % 60 === 0) {
              const playerUpdates = window.__playerUpdateCount || 0;
              const getInputsCalls = window.__getInputsCount || 0;
              console.log(`Frame ${frameCount}: update called ${playerUpdates} times, getInputs called ${getInputsCalls} times`);
              window.__playerUpdateCount = 0;
              window.__getInputsCount = 0;
          }
          
          this.update(frameTime);
          this.draw();

          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}