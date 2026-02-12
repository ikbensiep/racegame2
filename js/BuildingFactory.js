import MaterialManager from './MaterialManager.js';

export default class BuildingFactory {
    /**
     * Scans the SVG group and populates the 3D world layer
     * @param {SVGElement} svgElement - The source SVG
     * @param {HTMLElement} worldLayer - The target DOM container
     */
    static generate(svgElement, worldLayer) {
        const groundplates = svgElement.querySelectorAll('g#building-3D-groundplates rect');
        
        groundplates.forEach(rect => {
            const building = this.createBuilding(rect);
            worldLayer.appendChild(building);
        });
    }

    static createBuilding(rect) {
      
        // 1. Extract raw data from SVG
        const w = parseFloat(rect.getAttribute('width'));
        const h = parseFloat(rect.getAttribute('height'));
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        
        // 2. Extract rotation from transform matrix
        const transformAttr = rect.getAttribute('transform') || '';
        const rotateMatch = transformAttr.match(/rotate\(([^)]+)\)/);
        const rotation = rotateMatch ? parseFloat(rotateMatch[1].split(/[\s,]+/)[0]) : 0;

        // 3. Get visual properties via MaterialManager
        const props = MaterialManager.getProperties(rect);

        // 4. Construct DOM element
        const el = document.createElement('div');
        el.className = `building ${props.materialClass}`;
        
        // Use cssText for high performance single-write to the DOM
        el.style.cssText = `
            --w: ${w}px; 
            --h: ${h}px; 
            --x: ${x}px; 
            --y: ${y}px; 
            --rz: ${rotation}deg;
            --c: ${props.baseColor};
            --d: ${props.depth}px;
        `;

        el.innerHTML = `
            <div class="walls-ns"></div>
            <div class="walls-ew"></div>
            <div class="roof"></div>
        `;

        return el;
    }
}