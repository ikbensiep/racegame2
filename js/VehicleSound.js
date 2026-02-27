export default class VehicleSound {
  
  constructor(soundManager, soundName) {
    this.manager = soundManager;
    this.source = null;
    this.gainNode = null;
    this.soundName = soundName;
  }

  // Start de motor één keer
  start() {
    console.log(this.soundName, this.source, ' start()')
    if (this.source) return; // Al bezig

    this.source = this.manager.context.createBufferSource();
    this.gainNode = this.manager.context.createGain();

    this.source.buffer = this.manager.buffers.get(this.soundName);
    this.source.loop = true;

    this.source.connect(this.gainNode);
    this.gainNode.connect(this.manager.masterGain);

    this.source.start(0);
  }

  // Update de pitch (RPM) op basis van je game-loop
  // Bijv: speed is 0.0 tot 1.0
  update(speed) {
    if (!this.source) return;

    // Verschuif de pitch tussen 0.5 (idle) en 2.5 (max RPM)
    const pitch = speed;
    
    this.source.playbackRate.setTargetAtTime(
      pitch, 
      this.manager.context.currentTime, 
      0.5 // slide 'smoothness' factor
    );
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source = null;
    }
  }
}