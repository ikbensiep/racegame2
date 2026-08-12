export class TweakManager {
    constructor(target, title = "Settings", tweakerUIElement = "debug") {
        this.target = target;
        this.title = title;
        this.element = document.querySelector('dialog#garage-menu')
        this.fieldsContainer = this.element.querySelector(`${tweakerUIElement}`);
        this.init();
    }

    init () {
      Object.keys(this.target).forEach(key => {
        const val = this.target[key];
        const inputLabel = document.createElement('label');

        if (typeof val === 'boolean') {
            inputLabel.innerHTML = `
                <span>${key}</span>
                <input type="checkbox" data-key="${key}" ${val ? 'checked' : ''}>`;
            inputLabel.querySelector('input').onchange = e => this.target[key] = e.target.checked;
        } 
        else if (typeof val === 'number') {
            const min = val < 1 ? 0 : 0, max = val < 1 ? 1 : val * 2, step = val < 1 ? 0.001 : 0.1;
            inputLabel.innerHTML = `
                    <span>${key}</span>
                    <output>${val}</output>
                    <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">`;
            inputLabel.querySelector('input').oninput = e => {
                this.target[key] = parseFloat(e.target.value);
                inputLabel.querySelector('output').textContent = e.target.value;
            };
        } else return;

        this.fieldsContainer.appendChild(inputLabel);
    });
}

    _addPresetDropdown(presets) {
        const inputLabel = document.createElement('label');
        
        let options = Object.keys(presets).map(name => 
            `<option value="${name}">${name}</option>`
        ).join('');

        inputLabel.innerHTML = `
                <span>Select preset:</span>
                <select name="${this.title}">${options}</select>
                <i>&nbsp;</i>
        `;

        const select = inputLabel.querySelector('select');
        select.addEventListener('change', (e) => {
            const selectedPreset = presets[e.target.value];
            // Overschrijf waarden in het huidige doel-object (bijv. player.dynamics)
            Object.assign(this.target, selectedPreset);
            // Update de sliders visueel
            this.refresh();
        });

        // Plaats de dropdown bovenaan de content
        this.fieldsContainer.prepend(inputLabel);
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
                const display = input.parentElement.querySelector('output');
                if (display) display.textContent = val;
            }
        });
    }
}