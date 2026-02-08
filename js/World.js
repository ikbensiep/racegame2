export default class World {
  constructor(scene) {
    this.scene = scene;
    this.width = 0;
    this.height = 0;

    this.element = document.getElementById('canvas')
    this.svgElement = undefined;

    this.spawnPoints = [];
    this.collisionPaths = [];
    this.collidibles = [];
    this.isLoaded = false;

    this.logicCtx = document.createElement('canvas').getContext('2d');
    this.trackPath = null; // The racetrack path
    this.trackElement = null;
    this.finishPath = null; // timing sector v0.1

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
    }

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
    const response = await fetch(this.scene.svgUrl);
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    
    // TODO: appending this for development only, allowing for live painting while dev/debuggonmg
    this.svgElement = svgDoc.querySelector('svg');

    console.log(this.svgElement);

    this.element.querySelector('#worldmap').appendChild(this.svgElement);

    this.width = parseInt(this.svgElement.getAttribute('width'));
    this.height = parseInt(this.svgElement.getAttribute('height'));

    const trackElement = this.svgElement.getElementById('racetrack');
    this.trackElement = trackElement;
    const finishElement = this.svgElement.getElementById('s0');

    if (trackElement && finishElement) {
      // Maak een herbruikbaar Path2D object van de SVG data
      this.trackPath = new Path2D(trackElement.getAttribute('d'));
      this.finishPath = new Path2D(finishElement.getAttribute('d'))
      // We halen ook de stroke-width op uit de SVG (belangrijk voor de breedte van de baan!)
      this.trackWidth = parseFloat(window.getComputedStyle(trackElement).strokeWidth) || 520;
    }

    // 1. Find spawnpoints
    console.time('finding-spawnpoints');
    await this.findSpawnPoints('race');
    console.timeEnd('finding-spawnpoints');
    
    // 2. Find walls (obstacles)
    console.time('finding-walls');
    await this.findWalls();
    console.timeEnd('finding-walls');

    this.isLoaded = true;

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
    if (!this.trackPath) return 'off-road';

    const ctx = this.logicCtx;
    ctx.lineWidth = 0;
    if (this.finishPath && ctx.isPointInPath(this.finishPath, x, y)) {
        return 'finish';
    }

    // Check of de auto zich op de 'stroke' (de lijn) van het pad bevindt
    // De dikte van de lijn in de SVG bepaalt hier de breedte van de baan
    ctx.lineWidth = this.trackWidth;
    
    if (ctx.isPointInStroke(this.trackPath, x, y)) {
      
      return 'asphalt';
    } else {
      
      return 'grass';
    }
  }

}