import MaterialManager from './MaterialManager.js';

export default class BuildingFactory {

    constructor(game) {
        this.game = game;
        this.world = game.world;
    }

    /**
     * Scans the SVG group and populates the 3D world layer
     * @param {SVGElement} svgElement - The source SVG
     * @param {HTMLElement} worldLayer - The target DOM container
     */
    generate(svgElement, worldLayer) {

        
        this.generateFences(svgElement, worldLayer);

        //FIXME: betere selector(s) natuurlijk
        const groundplates = svgElement.querySelectorAll('g#building-3D-groundplates rect, #building-groundplates rect');
        
        groundplates.forEach( rect  => {
            const building = this.generateBuilding(rect);
            this.game.world.structures.push(building);
            this.game.camera.cullingObserver.observe(building);
            worldLayer.appendChild(building);
        });


    }

    /**
     * Finds a rectangle's coordinates + rotation and returns a nugget of HTML 
     * to build 3D structures with into the game wrld
     * @param {SVGRectElement} rect - a rectangle
     * @returns 
     */
    generateBuilding(rect) {
        console.log(`🏗️ building rect.${rect.getAttribute('class')}#${rect.id}`);

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
        const template = document.getElementById("structure");
        const clone = document.importNode(template.content, true);
        const structure = clone.querySelector('.structure');

        // 5. FF bordje op dak/gevel
        structure.querySelector('.roof').innerHTML = `
            <div class="sign">
                <h3>${ props.title ? props.title : 'ROOF &lt;TITLE&gt; SIGN'}</h3>
                ${ props.description ? '<p>' + props.description + '</p>': ''}
            </div>
        </div>
        `;

        props.materialClass.split(' ').forEach( materialName => structure.classList.add(materialName))
        
        // Use cssText for single-fast-as-all-hell-write to the DOM
        // NOTE: (for now) we're capping the elevation level to 5 floors because we don't
        // want the geometry to get all funky up in the Z-direction. Infinity calculations 
        // in the rearview mirror tend to be closer than they appear.

        // 1. Grab rect dimensions, location, orientation
        // 2. Grab rect styles to use for our CSS 3D buildings' restyling
        structure.style.cssText = `
            --w: ${w}px; 
            --h: ${(h + props.strokeWidth).toFixed(2)}px; 
            --x: ${x}px; 
            --y: ${y}px; 
            --rz: ${rotation}deg;

            --column-color: ${props.columnColor};
            --face-color: ${props.faceColor};
            --face-opacity: ${props.faceOpacity};
            --floor-count: ${Math.min(props.strokeWidth, 5)}; 
            --column-size: ${props.gap};
            --column-fill-size: ${props.wall};
            --weathering: ${props.strokeOpacity};
            --roof-type: ${props.roof}
        `;
        return structure;
    }

    /**
     * 
     * @param {SVGElement} svgElement - the track/level SVG
     * @param {HTMLElement} worldLayer - the game world layer (<main id="canvas">)
     */
    generateFences(svgElement, worldLayer) {

    const paths = svgElement.querySelectorAll('g#fencing > path');
    const segmentWidth = 200; 

    paths.forEach( (path, index) => {
        const totalLength = path.getTotalLength();
        const numSegments = Math.floor(totalLength / segmentWidth);
        
        for (let i = 0; i < numSegments; i++) {
            console.log(`🚧 fencing off perimiter, fence ${i}: ${path.className}#${path.id}`);

            const p1 = path.getPointAtLength(i * segmentWidth);
            const p2 = path.getPointAtLength((i + 1) * segmentWidth);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

            const fence = document.createElement('div');
            
            fence.className = 'fence-wall mat-fence';
            
            fence.style.cssText = `
                width: ${segmentWidth}px;
                height: ${path.dataset.depth || 80}px;
                left: ${p1.x}px;
                top: ${p1.y}px;
                --rz: ${angle}deg;
            `;
            worldLayer.appendChild(fence);
            this.game.world.structures.push(fence);
            
        }
    });
    }
}