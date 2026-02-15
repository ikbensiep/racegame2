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

    // TODO
    // these should all probably contain arrays with 0 or more paths
    this.paths = {
      garage: null,      // fill, garage may be directly off the pitlane or (a party tent) in the paddock depending on {some variable tbd}
      grandstands: null, // fill, sfx (crowd noise) detection
      gridslot: null,    // fill, race start position (spawnpoint)
      gravel: null,      // fill, vehicle dynamics / sfx
      paddock: null,     // fill, in this area player is allowed to enter 'RPG mode' (ie, exit car)
      pitbox: null,      // fill, vehicle dynamics (tune car settings) a marked service area directly off the pitlane
      pitlane: null,     // stroke, vehicle dynamics (speed limiter)
      racetrack: null,   // stroke, vehicle dynamics detection
      tunnel: null,      // fill, sfx (reverb) detection
      sectors: new Map()
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
    let artworkBasePath = `/levels/${this.scene}/${this.scene}`
    let svgFilePath = `${artworkBasePath}.svg`
    const response = await fetch(svgFilePath);

    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    
    // TODO: appending this for development only, allowing for live painting while dev/debuggonmg
    this.svgElement = svgDoc.querySelector('svg');
    this.element.querySelector('#worldmap').appendChild(this.svgElement);
    
    // Render je eigen vectoren maar. We Bitmappin' nao biatch.
    // FIXME: temp fix
    this.element.style.setProperty('--level-artwork-url', `url('${artworkBasePath}_track.png')`)


    this.width = parseInt(this.svgElement.getAttribute('width'));
    this.height = parseInt(this.svgElement.getAttribute('height'));

    const trackElement = this.svgElement.getElementById('racetrack');
    const timingGroup = this.svgElement.getElementById('timing');
    this.trackElement = trackElement;
    this.paths.racetrack = trackElement.cloneNode();
    console.info(timingGroup)

    if (trackElement && timingGroup) {
      // Maak een herbruikbaar Path2D object van de SVG data
      this.trackPath = new Path2D(trackElement.getAttribute('d'));

      const sectors = timingGroup.querySelectorAll('path');
      sectors.forEach(path => {
          this.paths.sectors.set(path.id, new Path2D(path.getAttribute('d')));
      });

      // We halen ook de stroke-width op uit de SVG (belangrijk voor de breedte van de baan!)
      this.trackWidth = parseFloat(window.getComputedStyle(trackElement).strokeWidth) || 520;
      console.log(this.paths)
    }

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
            r: 32 // Radius van het "hek-onderdeel"
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
    if (!this.trackPath) return 'grass';

    // Stel de dikte in voor de stroke-check
    this.logicCtx.lineWidth = this.trackWidth;

    // isPointInStroke checkt de wiskundige lijn, ongeacht canvas-grootte
    if (this.logicCtx.isPointInStroke(this.trackPath, x, y)) {
        return 'asphalt';
    }

    
    return 'grass';
  }

}