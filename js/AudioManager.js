// AudioManager: integrates SoundManager with Tuna (if available) and provides ambient/crowd playback
// - Uses existing SoundManager for loading buffers
// - If window.Tuna is present, creates Tuna filters attached to the AudioContext

export default class AudioManager {
  constructor(soundManager, world, game) {
    this.soundManager = soundManager;
    this.world = world;
    this.game = game;

    this.context = this.soundManager?.context || (new (window.AudioContext || window.webkitAudioContext)());
    this.masterGain = this.soundManager?.masterGain || this.context.createGain();

    this.tuna = null;

    this.crowdBuffer = null;
    this.crowdSource = null;
    this.crowdGain = this.context.createGain();
    this.crowdGain.connect(this.masterGain);

    // Optional Tuna nodes
    this.tunaNodes = null;

    // state
    this.isCrowdPlaying = false;
    this.crowdVolume = 0;
    this.crowdAreaPath = null; // Path2D to test point-in-path
  }

  async init() {
    this.tuna = window.Tuna ? new window.Tuna(this.context) : null;
 
    // If the world already has a grandstands path, use it for triggers
    if (this.world?.paths?.grandstands) {
      this.crowdAreaPath = this.world.paths.grandstands;
    }
 
    // If Tuna is available, create a simple reverb chain for crowd ambience
    if (this.tuna) {
      try {
        const reverb = new this.tuna.Convolver({
          highCut: 22050,
          lowCut: 20,
          dryLevel: 0.8,
          wetLevel: 0.7,
          level: 1,
          impulse: null // no custom impulse loaded here
        });

        this.tunaNodes = { reverb };

        // Connect chain to crowdGain -> master
        // source -> reverb -> crowdGain
        reverb.connect(this.crowdGain);
      } catch (e) {
        console.warn('AudioManager: failed to create Tuna nodes', e);
        this.tunaNodes = null;
      }
    }
  }

  async loadCrowd(url = '/assets/sound/crowd.ogg') {
    if (!this.soundManager) return;
    try {
      const buf = await this.soundManager.load('crowd-ambience', url);
      this.crowdBuffer = buf;
      return buf;
    } catch (e) {
      console.warn('AudioManager: failed to load crowd sound', e);
      return null;
    }
  }

  playCrowd(loop = true, startVolume = 0) {
    if (!this.crowdBuffer || this.isCrowdPlaying) return;
 
    const src = this.context.createBufferSource();
    src.buffer = this.crowdBuffer;
    src.loop = loop;
 
    // If we have a Tuna chain, connect through it; otherwise connect directly to crowdGain
    if (this.tuna && this.tunaNodes && this.tunaNodes.reverb) {
      try {
        const reverbNode = this.tunaNodes.reverb;
        src.connect(reverbNode.input ? reverbNode.input : reverbNode);
      } catch (e) {
        console.warn('AudioManager: failed to route crowd source through Tuna, falling back to direct connect', e);
        src.connect(this.crowdGain);
      }
    } else {
      src.connect(this.crowdGain);
    }
 
    try {
      this.setCrowdVolume(startVolume);
      src.start(0);
      this.crowdSource = src;
      this.isCrowdPlaying = true;
    } catch (e) {
      console.warn('AudioManager: start crowd failed', e);
    }
  }

  stopCrowd() {
    if (!this.crowdSource) return;
    try {
      this.crowdSource.stop();
    } catch (e) {}
    this.crowdSource.disconnect();
    this.crowdSource = null;
    this.isCrowdPlaying = false;
    this.crowdVolume = 0;
  }
 
  setCrowdVolume(v) {
    const volume = Math.max(0, Math.min(1, v));
    this.crowdVolume = volume;
    this.crowdGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
  }

  // Call this when player's position updates so we can trigger ambient
  updatePlayerPosition(x, y) {
    if (!this.crowdAreaPath || !this.world || !this.world.logicCtx) {
      
      return;
    }
    

    try {
      const inside = this.world.logicCtx.isPointInPath(this.crowdAreaPath, x, y);
      if (inside) {
        if (!this.isCrowdPlaying) {
          this.playCrowd(true, 0);
        }
 
        if (this.crowdVolume < 1) {
          this.setCrowdVolume(this.crowdVolume + 0.02);
        }
      } else if (this.isCrowdPlaying) {
        const nextVolume = Math.max(0, this.crowdVolume - 0.02);
        this.setCrowdVolume(nextVolume);
 
        if (nextVolume <= 0 && this.crowdSource) {
          this.stopCrowd();
        }
      }
    } catch (e) {
      console.warn('AudioManager.updatePlayerPosition failed', e);
    }
  }
}
