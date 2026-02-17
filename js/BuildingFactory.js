import MaterialManager from './MaterialManager.js';

export default class BuildingFactory {

    constructor(world) {
        this.world = world;
    }

    /**
     * Scans the SVG group and populates the 3D world layer
     * @param {SVGElement} svgElement - The source SVG
     * @param {HTMLElement} worldLayer - The target DOM container
     */
    generate(svgElement, worldLayer) {

        
        this.generateFences(svgElement, worldLayer);

        //FIXME: betere selector(s) natuurlijk
        const groundplates = svgElement.querySelectorAll('g#building-3D-groundplates  > rect');
        
        groundplates.forEach( rect  => {

            console.log(`🏗️ building rect.${rect.getAttribute('class')}#${rect.id}`);

            const building = this.generateBuilding(rect);
            worldLayer.appendChild(building);
            this.world.structures.push(building);
        });


        // TODO: move to function
        let buildingObserverOptions = {
            root: document.querySelector('#camera-viewport'),
            rootMargin: "256px",
            threshold: 0.05,
        };

        let structures = this.world.structures;
        
        let buildingObserver = new IntersectionObserver( (entries, self) => {
            entries.forEach (entry => {
            if (entry.isIntersecting) {
                console.log('intersecting!', entry)
                entry.target.classList.remove('off-screen')
                
            } else {
                entry.target.classList.add('off-screen')
            }
            });
        }, buildingObserverOptions);

        
        structures.forEach( building => { buildingObserver.observe(building)});
        
        console.warn(buildingObserver, structures)
    }

    /**
     * Finds a rectangle's coordinates + rotation and returns a nugget of HTML 
     * to build 3D structures with into the game wrld
     * @param {SVGRectElement} rect - a rectangle
     * @returns 
     */
    generateBuilding(rect) {
      
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
            --h: ${h + props.depth}px; 
            --x: ${x}px; 
            --y: ${y}px; 
            --rz: ${rotation}deg;
            
            --column-color: ${props.columnColor};
            --face-color: ${props.faceColor};
            --face-opacity: ${props.faceOpacity};
            --floor-count: ${props.depth};
            --column-size: ${props.gap};
            --column-fill-size: ${props.wall};
            --weathering: ${props.grunge};
            --roof-type: ${props.roof}
        `;
        /* TODO: use building <template> from index.html */
        el.innerHTML = `
        <div class="wall-n" title"NOORD wand"></div>
        <div class="wall-e" title="OOST blok"></div>
        <div class="wall-s" title="ZUYD zijde"></div>
        <div class="wall-w" title="WESTley wand"></div>
        <div class="roof">
            <div class="sign">
                <h3>${ props.title ? props.title : 'ROOF'}</h3>
                <p>${ props.description ? props.description : 'rooftop patio'}</p>
            </div>
        </div>
        `;

        return el;
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
            this.world.structures.push(fence);
            
        }
    });
    }
}