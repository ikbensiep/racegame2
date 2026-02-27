export class SoundManager {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = new Map(); // Cache voor geluidsbestanden
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
    }

    /**
     * Laad een geluid in het geheugen (Pre-loading)
     */
    async load(name, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
        return audioBuffer;
    }

    /**
     * Speel geluid met optionele volume en pitch (detune)
     */
    play(name, { volume = 1.0, pitch = 1.0, loop = false } = {}) {
        if (!this.buffers.has(name)) {
            console.warn(`Sound "${name}" not loaded.`);
            return null;
        }

        const source = this.context.createBufferSource();
        const gainNode = this.context.createGain();

        source.buffer = this.buffers.get(name);
        source.loop = loop;
        source.playbackRate.value = pitch;
        
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        source.start(0);
        return source; // Return voor eventuele stop() acties
    }

    setMasterVolume(value) {
        this.masterGain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, value), 
            this.context.currentTime + 0.1
        );
    }

    // Web Audio vereist een user-interaction om te starten
    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }
}