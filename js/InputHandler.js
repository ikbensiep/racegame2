export default class InputHandler {
    constructor() {
        this.keys = {};
        this.previousKeys = {};
        this.gamepadConnected = false;
        this.lastGamepadState = null;
        
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('gamepadconnected', e => {
            console.log('gamepad connected', e.gamepad);
            this.gamepadConnected = true;
        });
        window.addEventListener('gamepaddisconnected', e => {
            console.log('gamepad disconnected', e.gamepad);
            this.gamepadConnected = false;
            this.lastGamepadState = null;
        });
        
        // Reset keyboard state when window loses/regains focus to prevent sticky inputs
        // This handles the case where a key press wasn't registered as released
        window.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Window is hiding - clear all key states to avoid stuck keys
                this.keys = {};
            }
        });
        
        window.addEventListener('blur', () => {
            // Window lost focus - clear all key states
            this.keys = {};
        });
        
        window.addEventListener('focus', () => {
            // Window regained focus - ensure gamepad input is fresh on next poll
            this.lastGamepadState = null;
        });
    }

    getInputs() {
        // Debug: track calls per frame
        if (!window.__getInputsCount) window.__getInputsCount = 0;
        window.__getInputsCount++;
        
        // CRITICAL: Always get a FRESH gamepad reference from navigator every frame
        // The Gamepad API returns new snapshots each time - storing references causes stale reads
        // This is especially important after focus changes, devtools closing, or visibility changes
        const gp = navigator.getGamepads()[0];
        
        // Dead zone to prevent axis drift from causing sticky input
        const STICK_DEADZONE = 0.15;
        const TRIGGER_DEADZONE = 0.1;

        const keyPressed = (code) => !!this.keys[code];
        const justPressed = (code) => !!this.keys[code] && !this.previousKeys[code];
        const gamepadButtonPressed = (index) => !!gp?.buttons?.[index]?.pressed;
        const gamepadButtonJustPressed = (index) => {
            const currentPressed = gamepadButtonPressed(index);
            const previousPressed = !!this.lastGamepadState?.buttons?.[index]?.pressed;
            return currentPressed && !previousPressed;
        };

        if (!gp || !gp.buttons) {
            // Return neutral inputs when gamepad is unavailable
            const inputs = {
                gas: (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0),
                brake: (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0),
                handbrake: this.keys['Space'],
                steer: (this.keys['KeyA'] || this.keys['ArrowLeft'] ? -1 : 0) + (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0),

                honk: keyPressed('CapsLock'),
                honkPressed: justPressed('CapsLock'),
                highbeam: keyPressed('Backquote'),
                highbeamPressed: justPressed('Backquote'),
            };

            this.previousKeys = { ...this.keys };
            this.lastGamepadState = null;
            return inputs;
        }

        if (game.debug && gp) {
            console.log('gamepad', gp.id,
                        'axes', gp.axes.map(a=>a.toFixed(3)),
                        'buttons', gp.buttons.map(b=>b.value.toFixed(2)));
        }

        // Apply dead zones to analog inputs
        const stickInput = Math.abs(gp?.axes?.[0] || 0) > STICK_DEADZONE ? gp.axes[0] : 0;
        const gasValue = (gp?.buttons?.[7]?.value || 0) > TRIGGER_DEADZONE ? gp.buttons[7].value : 0;
        const brakeValue = (gp?.buttons?.[6]?.value || 0) > TRIGGER_DEADZONE ? gp.buttons[6].value : 0;
        const honkHeld = gamepadButtonPressed(10) || gamepadButtonPressed(11) || keyPressed('CapsLock');
        const honkPressed = justPressed('CapsLock') || gamepadButtonJustPressed(10) || gamepadButtonJustPressed(11);
        const highbeamHeld = gamepadButtonPressed(15) || keyPressed('Backquote');
        const highbeamPressed = justPressed('Backquote') || gamepadButtonJustPressed(15);

        const inputs = {
            // Gas: RT (index 7) or W/Up with dead zone
            gas: Math.max(gasValue, (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0)),
            
            // Brake: LT (index 6) or S/Down with dead zone
            brake: Math.max(brakeValue, (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0)),
            
            // Handbrake: R1 (index 5) of Space
            handbrake: gp?.buttons?.[5]?.pressed || this.keys['Space'],
            
            // Steering: Left stick (index 0) or A/D/arrow keys with dead zone
            steer: stickInput + (this.keys['KeyA'] || this.keys['ArrowLeft'] ? -1 : 0) + (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0),

            // Honking: left/right stick buttons (B10/B11) or keyboard fallback
            honk: honkHeld,

            // Highbeams toggle: D-pad right (B15) or keyboard fallback
            highbeam: highbeamHeld,
            highbeamPressed,
            honkPressed
        };

        this.previousKeys = { ...this.keys };
        this.lastGamepadState = {
            buttons: gp.buttons.map(button => ({
                pressed: !!button?.pressed,
                value: button?.value || 0
            }))
        };
        return inputs;
    }
}