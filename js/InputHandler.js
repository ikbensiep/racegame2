export default class InputHandler {
    constructor() {
        this.keys = {};
        this.gamePad = navigator.getGamepads()[0];
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
    }

    getInputs() {
        const gp = navigator.getGamepads()[0]; // Pak de eerste controller
        
        return {
            // Gas: RT (index 7) of W/Up
            gas: Math.max(gp?.buttons[7]?.value || 0, (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0)),
            
            // Brake: LT (index 6) of S/Down
            brake: Math.max(gp?.buttons[6]?.value || 0, (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0)),
            
            // Handbrake: R1 (index 5) of Space
            handbrake: gp?.buttons[5]?.pressed || this.keys['Space'],
            
            // Steering: Stick (index 0) of A/D/Left/Right
            steer: (gp?.axes[0] || 0) + (this.keys['KeyA'] || this.keys['ArrowLeft'] ? -1 : 0) + (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0)
        };
    }
}