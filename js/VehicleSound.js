import { getDistance, getAngle } from './tools/MathUtils.js';

export default class VehicleSound {
  
  constructor(soundManager, soundName) {
    this.manager = soundManager;
    this.source = null;
    this.panner = null;
    this.gainNode = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.tunnelReverbAmount = 0;
    this.soundName = soundName;
    
    // For doppler effect: track previous position to estimate velocity
    this.prevSourceX = 0;
    this.prevSourceY = 0;
  }

  // Start de motor één keer
  start() {
    if (this.source) return;

    const ctx = this.manager.context;
    const buffer = this.manager.buffers.get(this.soundName);

    if (!buffer) {
      console.warn(`VehicleSound: buffer not loaded for ${this.soundName}`);
      return;
    }

    this.source = ctx.createBufferSource();
    this.panner = ctx.createStereoPanner();
    this.gainNode = ctx.createGain();

    this.source.buffer = buffer;
    this.source.loop = true;

    // chain: source -> panner -> dryGain -> master
    this.source.connect(this.panner);
    this.panner.connect(this.gainNode);
    this.gainNode.connect(this.manager.masterGain);

    // optional tunnel reverb path
    if (window.Tuna) {
      try {
        const tunaInstance = new window.Tuna(ctx);
        this.reverbNode = new tunaInstance.Convolver({
          highCut: 22000,
          lowCut: 20,
          dryLevel: 0,
          wetLevel: 1,
          level: 1,
          // Use a project-local impulse response copied from the old repo
          impulse: '/assets/sound/IMP parking_garage_close.wav'
        });
        this.reverbGain = ctx.createGain();
        this.reverbGain.gain.value = 0;

        this.panner.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.manager.masterGain);
      } catch (e) {
        console.warn('VehicleSound: failed to create tunnel reverb', e);
        this.reverbNode = null;
        this.reverbGain = null;
      }
    }

    // start with silent volume until we know distance
    this.gainNode.gain.value = 0;
    this.panner.pan.value = 0;

    this.source.start(0);
  }

  // Update de pitch (RPM), volume, panning, doppler effect
  // speed parameter is expected to have been normalised by caller
  // options: { source: vehicleObject, listener: vehicleObject, maxDistance, screenSpace }
  update(speed, options = {}) {
    if (!this.source || !this.panner || !this.gainNode) return;

    // base pitch adjustment (RPM)
    let finalPitch = speed;
    
    // spatialisation logic only when both source and listener supplied
    if (options.source && options.listener) {
      try {
        const dist = getDistance(options.listener, options.source);
        
        // === DOPPLER EFFECT ===
        // Calculate radial velocity (component of source velocity towards listener)
        const dx = options.source.x - options.listener.x;
        const dy = options.source.y - options.listener.y;
        const distSafe = Math.max(dist, 1);
        
        // Normalized direction from listener to source
        const dirX = dx / distSafe;
        const dirY = dy / distSafe;
        
        // Estimate source velocity from position delta or use available vx/vy
        const sourceVx = (options.source.vx !== undefined) 
          ? options.source.vx 
          : (options.source.x - this.prevSourceX);
        const sourceVy = (options.source.vy !== undefined) 
          ? options.source.vy 
          : (options.source.y - this.prevSourceY);
        
        // Radial velocity: positive = approaching, negative = receding
        const radialVelocity = -(sourceVx * dirX + sourceVy * dirY);
        
        // Doppler formula: observed_freq = base_freq * (sound_speed - observer_vel) / (sound_speed - source_radial_vel)
        // Simplified for games: dopplerFactor = 1 + (radialVelocity / soundSpeed)
        const soundSpeed = 8000; // arbitrary large value for game space
        const dopplerFactor = 1 + (radialVelocity / soundSpeed);
        
        // Apply doppler to pitch
        finalPitch = speed * Math.max(0.5, Math.min(2.0, dopplerFactor)); // clamp to reasonable range
        
        // Update position tracking for next frame
        this.prevSourceX = options.source.x;
        this.prevSourceY = options.source.y;
        
        // === PANNING ===
        // determine pan based on either world rotation or screen coordinates
        let pan = 0;
        if (options.screenSpace) {
          // simple left/right based on on-screen x-offset
          const screenDx = (options.source.x || 0) - (options.listener.x || 0);
          pan = Math.max(-1, Math.min(1, screenDx / distSafe));
        } else {
          const angleDeg = getAngle(options.listener, options.source);
          const listenerAngleDeg = (options.listener.angle || 0) * 180 / Math.PI;
          const relativeRad = (angleDeg - listenerAngleDeg) * Math.PI / 180;
          pan = Math.sin(relativeRad); // -1 left, +1 right
        }

        if (this.panner) {
          this.panner.pan.setTargetAtTime(
            pan,
            this.manager.context.currentTime,
            0.1
          );
        }

        // === VOLUME ===
        const maxD = options.maxDistance || 8192;
        let vol = 1 - Math.min(dist / maxD, 1);
        vol = vol * vol; // smoother falloff

        if (this.gainNode) {
          this.gainNode.gain.setTargetAtTime(
            Math.max(0, vol),
            this.manager.context.currentTime,
            0.1
          );
        }
      } catch (e) {
        console.error('VehicleSound.update spatial error', e);
      }
    }
    
    // Apply final pitch (with doppler applied if spatial)
    this.source.playbackRate.setTargetAtTime(
      Math.max(0.1, finalPitch),
      this.manager.context.currentTime,
      0.5 // slide 'smoothness' factor
    );
  }

  setTunnelReverbLevel(value) {
    const amount = Math.max(0, Math.min(1, value));
    this.tunnelReverbAmount = amount;

    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(amount, this.manager.context.currentTime, 0.1);
    }

    if (this.reverbNode) {
      try {
        if (this.reverbNode.wetLevel) {
          this.reverbNode.wetLevel.setTargetAtTime(amount, this.manager.context.currentTime, 0.1);
        }
        if (this.reverbNode.level) {
          this.reverbNode.level.setTargetAtTime(1 + amount * 0.4, this.manager.context.currentTime, 0.1);
        }
      } catch (e) {
        console.warn('VehicleSound: failed to update tunnel reverb parameters', e);
      }
    }
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    } 

    this.source = null;
    this.panner = null;
    this.gainNode = null;
    this.reverbNode = null;
    this.reverbGain = null;
  }
}