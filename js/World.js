import BuildingFactory from "./BuildingFactory.js";
import Marshal from "./NPC-Marshal.js";
import Sundial from "./Sundial.js";
import Emitter from "./tools/Emitter.js";
export default class World {
  constructor(game) {
    this.isLoaded = false;
    this.game = game;
    this.scene = game.scene;
    this.width = 0;
    this.height = 0;
    this.element = document.querySelector('main#canvas');
    this.lightLayer = this.element.querySelector('#light-layer')
    this.svgElement = undefined;

    this.spawnPoints = [];
    this.garages = []; // Garage assignments: {id, garageGroup, circlePos: {x, y}, rectangleElement, occupant: null}
    this.collisionPaths = [];
    this.collidibles = [];

    this.logicCanvas = document.createElement('canvas', { willReadFrequently: true });
    this.logicCanvas.width = 1080; 
    this.logicCanvas.height = 1080;
    this.logicCtx = this.logicCanvas.getContext('2d');

    this.trackPath = null; // The racetrack path
    this.trackElement = null;
    this.structures = [];
    this.buildingFactory = new BuildingFactory(this.game);

    this.marshals = [];

    this.paths = {}

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
    let artworkBasePath = `/levels/${this.scene}`;
    let svgFilePath = `${artworkBasePath}/${this.scene}.svg`
    const response = await fetch(svgFilePath);

    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    
    // TODO: appending this for development only, allowing for live painting while dev/debuggonmg
    this.svgElement = svgDoc.querySelector('svg');
    this.element.querySelector('#worldmap').appendChild(this.svgElement);

    this.width = parseInt(this.svgElement.getAttribute('width'));
    this.height = parseInt(this.svgElement.getAttribute('height'));
    
    this.element.style.setProperty('--world-size', `${this.width}px`);
    this.trackElement = this.svgElement.getElementById('racetrack').cloneNode();
    
    const timingGroup = this.svgElement.getElementById('timing');

    // 3. Find building ground plates for 3D box factory
    
    console.time('generate-buildings');
    await this.generateBuildings();
    console.timeEnd('generate-buildings');
    console.time('add-marshals')
    await this.addMarshals();
    console.timeEnd('add-marshals')
    this.isLoaded = true;
    
    // Keep the SVG attached a bit longer so other measurement routines
    // (findSurfaces, findSpawnPoints, findWalls, findTrees) can read geometry
    // data like bounding boxes. The SVG will be detached later by the
    // GameEngine once all measurements are complete.
    // this.element.querySelector('#worldmap svg').remove();
    
    try {
      let rows = 2;
      let cols = 2;
      let mapElement = this.element.querySelector('#worldmap');
      for (let i = 0; i<rows; i++) {
        for (let j = 0; j<cols; j++) {
          let tileImg =  new Image()
          tileImg.src = `${artworkBasePath}/tiles/${this.scene}_track_${j}-${i}.png`;
          tileImg.alt = `${this.scene}_track-${j}-${i}.png`;
          tileImg.setAttribute('decoding','async');
          mapElement.appendChild(tileImg);
          this.game.camera.cullingObserver.observe(tileImg);
        }
      }

      this.element.querySelector('#light-layer').style.backgroundImage = 
        `url(${artworkBasePath}/${this.scene}_lights.png), url(${artworkBasePath}/${this.scene}_lights.webp)`
    } catch (e) {
      console.error(e)
    }
    return this.spawnPoints;
  }
  
  async findSurfaces () {
    console.log('🧭 finding surfaces...')
    const timingGroup = this.svgElement.getElementById('timing');

      this.paths.worldBG =     new Path2D(this.svgElement.querySelector('#world-bg').getAttribute('d')) // fill, car dynamics
      this.paths.fuelStation = new Path2D(this.svgElement.querySelector('#fuel-station')?.getAttribute('d')) // fill, garage may be directly off the pitlane or (a party tent) in the paddock depending on {some variable tbd}
      this.paths.grandstands = new Path2D(this.svgElement.querySelector('#sfx-triggers path#grandstands')?.getAttribute('d') || "")  // fill, sfx (crowd noise) detection
      this.paths.gravel =      new Path2D(this.svgElement.querySelector('#gravel')?.getAttribute('d')) // fill, vehicle dynamics / sfx
      this.paths.gridslot =    new Path2D(this.svgElement.querySelector('#gridslot')?.getAttribute('d') || "") // fill, race start position (spawnpoint)
      this.paths.paddock =     new Path2D(this.svgElement.querySelector('#paddock').getAttribute('d')) // fill, in this area player is allowed to enter 'RPG mode' (ie, exit car)
      this.paths.pitbox =      undefined; // fill, (tune car settings) a personal service area directly off the pitlane
      this.paths.pitlane =     new Path2D(this.svgElement.querySelector('#pitlane').getAttribute('d'));  // stroke, vehicle dynamics (speed limiter)
      this.paths.racetrack =   new Path2D(this.svgElement.querySelector('#racetrack').getAttribute('d')); // stroke, (AI) vehicle pathinding
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
      case 'paddock':
        spawnFilter = 'paddock'
        break;
    }
    
    console.warn({sessionType, spawnFilter});

    let spawnContainers = possibleSpawnLocations.filter( group => { 
      return group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label') == `players-${spawnFilter}`
    });

    // Build garages from group elements containing circle/ellipse
    let garageGroups = spawnContainers[0]?.querySelectorAll('g');
    
    if (!garageGroups || !garageGroups.length) {
      // some random location probably close to the paddock
      this.spawnPoints.push({x:10000, y: 10500});
    } else {
      garageGroups.forEach( garageGroup => {
        const circle = garageGroup.querySelector('circle, ellipse');
        const rectangle = garageGroup.querySelector('rect, path');
        
        if (circle) {
          const circlePos = {
            x: parseFloat(circle.getAttribute('cx')),
            y: parseFloat(circle.getAttribute('cy'))
          };
          
          // Store in spawnPoints for backward compatibility
          this.spawnPoints.push({ 
            x: circlePos.x, 
            y: circlePos.y,
            id: circle.getAttribute('id')
          });
          
        // Compute rectangle center now while the SVG is still attached to the DOM.
        // This avoids relying on getBBox later when the SVG may be detached.
        let rectangleCenter = null;
        if (rectangle) {
          const tagName = rectangle.tagName?.toLowerCase();
          if (tagName === 'rect') {
            const rx = parseFloat(rectangle.getAttribute('x') || 0);
            const ry = parseFloat(rectangle.getAttribute('y') || 0);
            const rwidth = parseFloat(rectangle.getAttribute('width') || 0);
            const rheight = parseFloat(rectangle.getAttribute('height') || 0);
            rectangleCenter = { x: rx + rwidth / 2, y: ry + rheight / 2 };
          } else if (tagName === 'path' && typeof rectangle.getBBox === 'function') {
            try {
              const bbox = rectangle.getBBox();
              if (bbox && (bbox.width > 0 || bbox.height > 0)) {
                rectangleCenter = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
              }
            } catch (e) {
              // getBBox can throw if SVG not fully available; ignore and fallback to circlePos
              console.warn('Unable to compute bbox for garage path', rectangle, e);
            }
          }
        }
          
        // Store in garages for garage assignment
        this.garages.push({
          id: circle.getAttribute('id'),
          garageGroup: garageGroup,
          circlePos: circlePos,
          rectangleElement: rectangle,
          rectangleCenter: rectangleCenter,
          rectanglePath: this.createGaragePath(rectangle),
          occupant: null
        });
      }
    });
    }
  }

  createGaragePath (rectangle) {
    if (!rectangle) return null;

    const tagName = rectangle.tagName?.toLowerCase();

    if (tagName === 'path') {
      return new Path2D(rectangle.getAttribute('d'));
    }

    if (tagName === 'rect') {
      const x = parseFloat(rectangle.getAttribute('x') || 0);
      const y = parseFloat(rectangle.getAttribute('y') || 0);
      const width = parseFloat(rectangle.getAttribute('width') || 0);
      const height = parseFloat(rectangle.getAttribute('height') || 0);
      const rx = parseFloat(rectangle.getAttribute('rx') || 0);
      const ry = parseFloat(rectangle.getAttribute('ry') || 0);
      const path = new Path2D();

      if (rx || ry) {
        path.roundRect(x, y, width, height, [rx || ry, ry || rx]);
      } else {
        path.rect(x, y, width, height);
      }

      return path;
    }

    return null;
  }

  getPitboxPath (player) {
    if (player?.garageIndex !== undefined && this.garages?.[player.garageIndex]?.rectanglePath) {
      return this.garages[player.garageIndex].rectanglePath;
    }

    return this.paths.pitbox || null;
  }

  /**
   * Detach the in-DOM SVG to reduce DOM clutter once all measurements
   * that depend on it have been collected. Safe to call multiple times.
   */
  detachSvg () {
    const svg = this.element.querySelector('#worldmap svg');
    if (svg) svg.remove();
  }

  // TODO: maybe update `findWalls ()` below to be a smarter algorythm like this bad boy
  async findTrees () {
    const treeLines = this.svgElement.querySelectorAll('#trees path');
    console.groupCollapsed('🌳 treelines')
    treeLines.forEach(path => {
      const length = path.getTotalLength();
      console.log(`treeline ${path.id}`)

      const {strokeWidth, strokeDasharray, stroke, strokeLinecap} = path.style;
      // const stepSize = strokeDasharray[0] + strokeDasharray[1];
      const stepSize = 512;
      for (let i = 0; i < length; i += stepSize) {
        
        const circle = path.getPointAtLength(i);

        this.collidibles.push({
          x: circle.x,
          y: circle.y,
          r: 16, // TODO: is this an appropriate prop to assume and use as tree trunk size?
          type: 'tree'
        });


        const template = document.getElementById("shrubbery");
        const clone = document.importNode(template.content, true);
        const sprite = clone.querySelector('b');
        sprite.id = `tree-${path.id}-${stepSize}`;
        sprite.className = `tree ${strokeLinecap} ${path.className.baseVal}`
        sprite.style.setProperty('--tree-type', strokeLinecap);
        sprite.style.setProperty('--tree-color', stroke);
        sprite.style.setProperty('rotate', Math.floor(Math.random() * 90) + 'deg');
        sprite.style.left = `${circle.x}px`;
        sprite.style.top = `${circle.y}px`;
        this.element.appendChild(sprite);
        this.game.camera.cullingObserver.observe(sprite);
        // console.log(path, sprite)
      }
    })
    console.groupEnd()
  }

  async findWalls () {
    const wallPaths = this.svgElement.querySelectorAll('#obstacles path:not(:is(#trees>path))');
    console.groupCollapsed('🧱 collidible-walls');
    wallPaths.forEach(path => {
      const length = path.getTotalLength();
      
      
      // TODO: multiply `step` and `r` by stroke-dasharray and stroke-width?
      
      const stepSize = 32; 
      
      let wallId = 0;
      for (let i = 0; i < length; i += stepSize) {
        const circle = path.getPointAtLength(i);
        this.collidibles.push({
          x: circle.x,
          y: circle.y,
          r: 48, // Radius van het "hek-onderdeel"
          id: `path-${path.id}-wall-${wallId}`
        });
        wallId++;
      }
      console.log(`collidible-wall (length: ${Math.floor(length)}, segments: ${wallId})`);
    });
    console.groupEnd()
  }

  async generateBuildings() {
    // #building-3D-groundplates or #building-groundplates is the ID in the SVG
    
    this.buildingFactory.generate(this.svgElement, this.element)
}

  async addMarshals () {
    let svg = this.svgElement
    let marshalTargetLayer = this.element;
    let marshalPostTargetLayer = this.element;
    
    let lamp = document.createElement('span');
    lamp.className = 'lamp-post';

    this.marshalPosts = svg.querySelectorAll('#marshal-posts > *') || [];
    console.groupCollapsed('👲 marshals')
    this.marshalPosts.forEach( (post, postIndex) => {
      console.log(`marshal post ${postIndex}`)
      post.id = 'post-' + (postIndex + 1);
      let cx = post.getAttribute('cx');
      let cy = post.getAttribute('cy');
      
      // add a light
      let postlamp = lamp.cloneNode();
      postlamp.style.left = cx + 'px';
      postlamp.style.top = cy + 'px';
      this.lightLayer.appendChild(postlamp);

      this.game.camera.cullingObserver.observe(postlamp);

      // TODO: add a bouwkeet 
      // TODO: geen bouwkeet, we build 3D objects in the world file if need be
      /*
      try {

        let keet = new Emitter(this.game.camera, window.hokjeSprite, 128, 64, 1, true, marshalPostTargetLayer, false);
        // this.marshalKeten.push(keet);
        keet.start(cx, cy, 0);
        console.info(keet)
      } catch (e) {
        console.error('geen keet', e)
      }
      */

      // add a team of lil guys
      for(let i=0; i<3; i++) {
        let marshal = new Marshal(this.game, window.marshalSprite, post, marshalTargetLayer, i, 64, 7);
        this.marshals.push(marshal);
        marshal.init();
        this.game.camera.cullingObserver.observe(marshal.sprite.domElement);
      }
    });
    console.groupEnd('marshals')
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

  // Geeft de cirkel/het ding terug waarmee je in botsing bent gekomen 
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

  getSurfaceType(x, y, player = null) {
    
  // 1. Definieer de prioriteit (van specifiek naar algemeen)
  // We checken de 'kleine' vlakken eerst.
  const pitboxPath = this.getPitboxPath(player);
  const surfaceRules = [
    { path: pitboxPath,            type: 'pitbox',      method: 'fill'   },
    { path: this.paths.fuelStation, type: 'fuel',        method: 'fill'   },
    { path: this.paths.paddock,     type: 'paddock',     method: 'fill'   },
    { path: this.paths.pitlane,     type: 'pitlane',     method: 'stroke', width: 280 }, 
    { path: this.paths.tunnel,      type: 'tunnel',      method: 'fill'   },
    { path: this.paths.racetrack,   type: 'asphalt',     method: 'stroke', width: 520 }, 
    { path: this.paths.gravel,      type: 'gravel',      method: 'fill'   },
    { path: this.paths.worldBG,     type: 'grass',       method: 'fill'   }
  ];

  // 2. Loop door de regels en return de eerste match
  // TODO: check logische volgorde van rules hierboven. Tunnel (sfx trigger) lijkt me hoger dan asfalt bijv?
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