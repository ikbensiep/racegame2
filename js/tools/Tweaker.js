export class TweakManager {
    constructor(target, title = "Settings", sidebarId = "debug") {
        this.target = target;
        this.sidebar = document.getElementById(sidebarId);
        
        if (!this.sidebar) return;

        this.container = document.createElement('details');
        this.container.name = "tweaker";
        this.container.className = "tweak-group";
        this.container.innerHTML = `
            <summary class="tweak-group__summary">${title}</summary>
            <div class="tweak-group__content flow"></div>
        `;

        this.sidebar.appendChild(this.container);
        this.fieldsContainer = this.container.querySelector('.tweak-group__content');
        
        this._buildFields();
    }

    _buildFields() {
        this.fieldsContainer.innerHTML = ''; // Clear voor refresh
        Object.keys(this.target).forEach(key => {
            const val = this.target[key];
            if (typeof val !== 'number') return;

            const min = val < 1 ? 0 : 0;
            const max = val < 1 ? 1 : val * 2;
            const step = val < 1 ? 0.001 : 0.1;

            const field = document.createElement('div');
            field.className = 'tweak-field';
            field.innerHTML = `
                <label class="tweak-field__label">
                    <span class="tweak-field__text">${key}</span>
                    <!-- data-key is cruciaal voor de refresh -->
                    <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
                    <code class="tweak-field__value">${val}</code>
                </label>
            `;

            const input = field.querySelector('input');
            const display = field.querySelector('.tweak-field__value');

            input.addEventListener('input', (e) => {
                const newVal = parseFloat(e.target.value);
                this.target[key] = newVal;
                display.textContent = newVal;
            });

            this.fieldsContainer.appendChild(field);
        });
    }

    _addPresetDropdown(presets) {
        const field = document.createElement('div');
        field.className = 'tweak-field tweak-field--preset';
        
        let options = Object.keys(presets).map(name => 
            `<option value="${name}">${name}</option>`
        ).join('');

        field.innerHTML = `
            <label class="tweak-field__label">
                <span class="tweak-field__text">Selecteer Preset:</span>
                <select class="tweak-field__select">${options}</select>
            </label>
        `;

        const select = field.querySelector('select');
        select.addEventListener('change', (e) => {
            const selectedPreset = presets[e.target.value];
            // Overschrijf waarden in het huidige doel-object (bijv. player.dynamics)
            Object.assign(this.target, selectedPreset);
            // Update de sliders visueel
            this.refresh();
        });

        // Plaats de dropdown bovenaan de content
        this.fieldsContainer.prepend(field);
    }

    /**
     * Synchroniseert de UI met de huidige staat van het object
     */
    refresh() {
        const inputs = this.fieldsContainer.querySelectorAll('input[data-key]');
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            const val = this.target[key];
            if (val !== undefined) {
                input.value = val;
                const display = input.parentElement.querySelector('.tweak-field__value');
                if (display) display.textContent = val;
            }
        });
    }
}