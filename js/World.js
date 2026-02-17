import LapTimer from "./LapTimer.js";
import BuildingFactory from "./BuildingFactory.js";

export default class World {
  constructor(scene) {
    this.isLoaded = false;
    this.scene = scene;
    this.width = 0;
    this.height = 0;
    this.element = document.querySelector('main#canvas');
    this.svgElement = undefined;

    this.spawnPoints = [];
    this.collisionPaths = [];
    this.collidibles = [];

    this.logicCanvas = document.createElement('canvas', { willReadFrequently: true });
    this.logicCanvas.width = 1080; 
    this.logicCanvas.height = 1080;
    this.logicCtx = this.logicCanvas.getContext('2d');

    this.trackPath = null; // The racetrack path
    this.trackElement = null;
    this.trackWidth = 500;
    this.structures = [];
    this.buildingFactory = new BuildingFactory(this);


    this.paths = {
      
    }

    this.lapTimer = null;

    this._initWorld();
  }
  
  _initWorld () {

    /* Basically a tiling system that would get its dimensions from the css variables defined on #canvas
    /*

    const canvas = document.getElementById('canvas');
    const canvasStyles = getComputedStyle(canvas);

    let columns = parseInt(canvasStyles.getPropertyValue('--tile-columns'));
    let columnSize = parseInt(canvasStyles.getPropertyValue('--tile-size'));
    let worldSize = columns * columnSize;

    for ( let i = 0; i<columns; i++ ) {
      for( let j = 0; j<columns; j++) {
        let img = new Image();
        img.id = `tile-col${i}-row${j}`;
        img.class = "";
        canvas.appendChild(img)
      }
    }
    */
  }

  async load () {
    let artworkBasePath = `/levels/${this.scene}`
    let svgFilePath = `${artworkBasePath}/${this.scene}.svg`
    const response = await fetch(svgFilePath);

    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    
    // TODO: appending this for development only, allowing for live painting while dev/debuggonmg
    this.svgElement = svgDoc.querySelector('svg');
    this.element.querySelector('#worldmap').appendChild(this.svgElement);
    
    // Render je eigen vectoren maar. We Bitmappin' nao biatch.
    // FIXME: temp fix
    try {

      this.element.style.backgroundImage = `
        url('${artworkBasePath}/tiles/${this.scene}_track-0-0.png'), 
        url('${artworkBasePath}/tiles/${this.scene}_track-1-0.png'), 
        url('${artworkBasePath}/tiles/${this.scene}_track-0-1.png'),
        url('${artworkBasePath}/tiles/${this.scene}_track-1-1.png') 
        `;
        console.log(this.element)
    } catch (e) {
      console.error(e)
    }
    

    this.width = parseInt(this.svgElement.getAttribute('width'));
    this.height = parseInt(this.svgElement.getAttribute('height'));

    const trackElement = this.svgElement.getElementById('racetrack');
    const timingGroup = this.svgElement.getElementById('timing');

    // Arbitrary check to see if the bare mninimum exists, probably nonsense test by now 
    if (trackElement && timingGroup) {
      
      // We halen ook de stroke-width op uit de SVG (belangrijk voor de breedte van de baan!)
      this.trackWidth = parseFloat(window.getComputedStyle(trackElement).strokeWidth) || 520;
      
    }

    // 0. Chart the area, note interesting areas/surfaces
    await this.findSurfaces();

    // 1. Find spawnpoints
    await this.findSpawnPoints('training');
    
    
    // 2. Find walls (obstacles)
    await this.findWalls();
    
    // 3. Find building ground plates for 3D box factory
    
    console.time('generate-buildings');
    await this.generateBuildings();
    console.timeEnd('generate-buildings');
    
    this.lapTimer = new LapTimer(this, [...this.paths.sectors]);

    this.isLoaded = true;
    this.element.querySelector('#worldmap svg').remove();
    return this.spawnPoints;
  }
  
  async findSurfaces () {
    console.log('🧭 finding surfaces...')
    const timingGroup = this.svgElement.getElementById('timing');

      this.paths.worldBG =     new Path2D(this.svgElement.querySelector('#world-bg').getAttribute('d')) // fill, garage may be directly off the pitlane or (a party tent) in the paddock depending on {some variable tbd}
      this.paths.fuelStation = new Path2D(this.svgElement.querySelector('#fuel-station').getAttribute('d')) // fill, garage may be directly off the pitlane or (a party tent) in the paddock depending on {some variable tbd}
      this.paths.grandstands = new Path2D(this.svgElement.querySelector('#sfx-triggers path#grandstands').getAttribute('d'))  // fill, sfx (crowd noise) detection
      this.paths.gravel =      new Path2D(this.svgElement.querySelector('#gravel').getAttribute('d')) // fill, vehicle dynamics / sfx
      this.paths.gridslot =    new Path2D(this.svgElement.querySelector('#gridslot')?.getAttribute('d') || "") // fill, race start position (spawnpoint)
      this.paths.paddock =     new Path2D(this.svgElement.querySelector('#paddock').getAttribute('d')) // fill, in this area player is allowed to enter 'RPG mode' (ie, exit car)
      this.paths.pitbox =      new Path2D(this.svgElement.querySelector('#pitbox').getAttribute('d')) // fill, vehicle dynamics (tune car settings) a marked service area directly off the pitlane
      this.paths.pitlane =     new Path2D(this.svgElement.querySelector('#pitlane').getAttribute('d'));  // stroke, vehicle dynamics (speed limiter)
      this.paths.racetrack =   new Path2D(this.svgElement.querySelector('#racetrack').getAttribute('d')); // stoke, vehicle dynamics (grip level, weather?)
      this.paths.sectors =     new Map(); // timing sectors
      this.paths.tunnel =      new Path2D(this.svgElement.querySelector('#tunnel')?.getAttribute('d'));  // fill, sfx (ie, reverb) detection

      const sectors = timingGroup.querySelectorAll('path');
      sectors.forEach(path => {
          this.paths.sectors.set(path.id, new Path2D(path.getAttribute('d')));
      });


  }

  async findSpawnPoints (sessionType) {
    let spawnFilter;
    
    let possibleSpawnLocations = [...this.svgElement.querySelectorAll('g#spawnpoints g')];

    switch (sessionType) {
      case 'race':
        spawnFilter = 'grid'
        break;
      case 'training':
        spawnFilter = 'paddock'
        break;
    }
    
    let spawnContainers = possibleSpawnLocations.filter( group => group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label') == `players-${spawnFilter}`)

    let spawners = spawnContainers[0].querySelectorAll('circle');
    
    if (!spawners.length) {
      // some random location probably close to the paddock
      this.spawnPoints.push({x:10000, y: 10500});
    } else {
      spawners.forEach( point => {
        this.spawnPoints.push ({ 
            x: parseFloat(point.getAttribute('cx')), 
            y: parseFloat(point.getAttribute('cy')),
            id: point.getAttribute('id')
        });
      });
    }
  }

  async findWalls () {
    const wallPaths = this.svgElement.querySelectorAll('#obstacles path');
    
    wallPaths.forEach(path => {
      const length = path.getTotalLength();
      
      // Jouw interval
      // TODO: multiply `step` and `r` by stroke width?
      const step = 64; 
      
      console.log(`collidible-wall ${Math.floor(length)}`);

        for (let i = 0; i < length; i += step) {
          const circle = path.getPointAtLength(i);

          this.collidibles.push({
            x: circle.x,
            y: circle.y,
            r: 16 // Radius van het "hek-onderdeel"
          });
        }
    });
  }

  async generateBuildings() {
    // building-3D-groundplates is the ID in your SVG
    
    this.buildingFactory.generate(this.svgElement, this.element)
    console.log("🏙️ 3D World populated via BuildingFactory");
}

  // Controleer of een punt (x, y) binnen de wereldgrenzen valt
  isOutOfBounds(x, y, size) {
    return (
      x < 0 || 
      y < 0 || 
      x > this.width - size || 
      y > this.height - size
    );
  }

  // Geeft de cirkel terug waarmee je in botsting bent gekomen (precise language matters piepol), of null
  getCollision(px, py, pr) {
    for (let i = 0; i < this.collidibles.length; i++) {
      const c = this.collidibles[i];
      
      // Snelle 'Bounding Box' check voordat we de wortel berekenen
      // Dit filtert 99% van de cirkels direct weg met simpele min/plus
      const distLimit = pr + c.r;
      if (Math.abs(px - c.x) < distLimit && Math.abs(py - c.y) < distLimit) {
          
        // Pas als de auto in de buurt is, doen we de exacte berekening
        const dx = px - c.x;
        const dy = py - c.y;
        if (dx * dx + dy * dy < distLimit * distLimit) {
            return c;
        }
      }
    }
    return null;
  }

  getSurfaceType(x, y) {
    
    // Stel de dikte in voor de stroke-check
    // this.logicCtx.lineWidth = this.trackWidth;
    // isPointInStroke checkt de wiskundige lijn, ongeacht canvas-grootte
    // if (this.logicCtx.isPointInStroke(this.trackPath, x, y)) {
    //     return 'asphalt';
    // }

    // this.logicCtx.lineWidth = 1;
    // if (this.logicCtx.isPointInPath(this.paths.worldBG, x, y)) {
    //   return 'grass';
    // } else {
    //   /* etc */
    //   return 'asphalt';
    // }

 // 1. Definieer de prioriteit (van specifiek naar algemeen)
  // We checken de 'kleine' vlakken eerst.
  const surfaceRules = [
    { path: this.paths.pitbox,      type: 'pitbox',      method: 'fill'   },
    { path: this.paths.pitlane,     type: 'pitlane',     method: 'stroke', width: 280 }, 
    { path: this.paths.racetrack,   type: 'asphalt',     method: 'stroke', width: 520 }, 
    { path: this.paths.gravel,      type: 'gravel',      method: 'fill'   },
    { path: this.paths.fuelStation, type: 'fuel',        method: 'fill'   },
    { path: this.paths.paddock,     type: 'paddock',     method: 'fill'   },
    { path: this.paths.tunnel,      type: 'tunnel',      method: 'fill'   },
    { path: this.paths.worldBG,     type: 'grass',       method: 'fill'   }
  ];

  // 2. Loop door de regels en return de eerste match
  for (const rule of surfaceRules) {
    if (!rule.path) continue; // Skip als het pad niet bestaat (zoals optionele tunnels)

    if (rule.method === 'stroke') {
      this.logicCtx.lineWidth = rule.width || 1;
      if (this.logicCtx.isPointInStroke(rule.path, x, y)) return rule.type;
    } else {
      if (this.logicCtx.isPointInPath(rule.path, x, y)) return rule.type;
    }
  }

  // 3. Fallback als er niets geraakt wordt
  return 'out-of-bounds';

  }

}