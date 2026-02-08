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

// Speler object
const player = {
  x: 9500,
  y: 10000,
  angle: 0,        // Richting in radialen
  speed: 0,        // Huidige snelheid
  maxSpeed: 10000,
  accel: 2,      // Hoe snel we optrekken
  friction: 0.98,   // Rolweerstand (0.95 = 5% verlies per frame)
  steerSpeed: 15, // Hoe scherp de auto draait
  drift: 0.15, // Hoeveel de auto "glijdt" (0.1 = veel grip, 0.9 = ijs)
  isHandbraking: false,
  element: document.getElementById('player-local')
};

const peer = new Peer();
let activeConnection = null; // Houdt de huidige verbinding vast
const opponents = new Map();

// 1. Check de URL op een 'join' ID
const urlParams = new URLSearchParams(window.location.search);
const joinId = urlParams.get('join');

peer.on('open', (myId) => {
  if (joinId) {
    // CLIENT: Verbind met de ID uit de URL
    console.log("Verbinden met host...");
    activeConnection = peer.connect(joinId);
    setupConnection(activeConnection);
  } else {
    // HOST: Maak een uitnodigingslink
    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${myId}`;
    console.log("Deel deze link:", joinUrl);
    // Tip: gebruik [navigator.clipboard.writeText](https://developer.mozilla.org) voor een kopieer-knop
  }
});

// HOST luistert naar de inkomende Client
peer.on('connection', (incomingConn) => {
  activeConnection = incomingConn;
  setupConnection(activeConnection);
});

// De vervanger voor setupChat: verwerkt alle inkomende data
function setupConnection(conn) {
  conn.on('open', () => {
    console.log("Peer-to-Peer verbinding actief!");

    conn.on('data', (data) => {
      // Als we de tegenstander nog niet kennen, maak hem aan
      if (!opponents.has(data.id)) {
        const element = createOpponentElement(data.id);
        opponents.set(data.id, { ...data, element });
      } else {
        // Update positie en hoek voor de draw() functie
        const opp = opponents.get(data.id);
        opp.x = data.x;
        opp.y = data.y;
        opp.angle = data.angle;
      }
    });
  });
}


// Helper om een auto element te maken in de DOM (indien nodig)
function createOpponentElement(id) {
  const el = document.createElement('div');
  el.id = `opponent-${id}`;
  el.className = 'car opponent'; // Geef ze een andere kleur via CSS
  canvas.appendChild(el);
  return el;
}


function update() {
  const gp = navigator.getGamepads()[0];
  if (!gp) return;

  // 1. Inputs: Triggers (Gas/Rem) en R1 (Handrem)
  const gas = gp.buttons[7].value;   // R2
  const brake = gp.buttons[6].value; // L2
  player.isHandbraking = gp.buttons[5].pressed; // R1

  // 2. Acceleratie & Handrem logica
  if (player.isHandbraking) {
    player.speed *= 0.92; // Snel vaart minderen bij handrem
  } else {
    if (gas > 0) player.speed += gas * player.accel;
    if (brake > 0) player.speed -= brake * (player.accel * 0.8);
  }

  // 3. Sturen met 'Drift' factor
  // Als de handrem vastzit, sturen we veel scherper maar verliezen we grip
  let currentSteerSpeed = player.steerSpeed;
  if (player.isHandbraking) currentSteerSpeed *= 2.5;

  if (Math.abs(gp.axes[0]) > 0.1) {
    const direction = Math.sign(player.speed) || 1;
    player.angle += gp.axes[0] * currentSteerSpeed * (Math.abs(player.speed) / player.maxSpeed) * direction;
  }

  // 4. Physics: Velocity berekenen
  player.speed *= player.friction;
  
  // Begrenzen
  player.speed = Math.max(-player.maxSpeed / 2, Math.min(player.speed, player.maxSpeed));

  // 5. Drift simulatie (Interpolatie tussen huidige richting en bewegingsrichting)
  // We berekenen waar de neus heen wijst, maar de auto reageert vertraagd
  const targetX = Math.cos(player.angle) * player.speed;
  const targetY = Math.sin(player.angle) * player.speed;

  // Hoe lager dit getal, hoe meer de auto 'uitbreekt' in de bocht
  let grip = player.isHandbraking ? 0.05 : 0.2; 
  
  // Pas de positie aan met een vleugje traagheid
  player.vx = (player.vx || 0) * (1 - grip) + targetX * grip;
  player.vy = (player.vy || 0) * (1 - grip) + targetY * grip;

  player.x += player.vx;
  player.y += player.vy;

  // --- SCHERMGRENZEN (Clamping) ---
    // Horizontale grenzen: 0 (links) tot worldSize minus spelerbreedte (rechts)
    if (player.x < 0) player.x = 0;
    if (player.x > worldSize - player.size) player.x = worldSize - player.size;

    // Verticale grenzen: 0 (boven) tot worldSize minus spelerhoogte (onder)
    if (player.y < 0) player.y = 0;
    if (player.y > worldSize - player.size) player.y = worldSize - player.size;
}

function draw() {
  
  canvas.style.setProperty('--x', player.x.toFixed(3));
  canvas.style.setProperty('--y', player.y.toFixed(3));
  canvas.style.setProperty('--angle', player.angle);
  // canvas.scrollTo(Math.round(player.x), Math.round(player.y))
  player.element.scrollIntoView({block:"center", inline:"center", behavior: "instant", container: "nearest"});

  // 2. Teken alle tegenstanders
  opponents.forEach((opp) => {
    opp.currentX = (opp.currentX || opp.x) + (opp.x - (opp.currentX || opp.x)) * 0.2;
    opp.currentY = (opp.currentY || opp.y) + (opp.y - (opp.currentY || opp.y)) * 0.2;

    opp.element.style.setProperty('--x', opp.currentX);
    opp.element.style.setProperty('--y', opp.currentY);
    opp.element.style.setProperty('--angle', opp.angle);
  });
}

function gameLoop() {
  
  update();

  if (activeConnection && activeConnection.open) {
    activeConnection.send({
      id: peer.id,
      x: player.x,
      y: player.y,
      angle: player.angle
    });
  }
  
  draw();
  requestAnimationFrame(gameLoop); // Herhaal voor de volgende frame
}

// Start de loop
document.addEventListener('DOMContentLoaded', () => {

  let tileObserverOptions = {
    root: canvas,
    rootMargin: "64px",
    threshold: 0,
  };

  let tileImages = canvas.querySelectorAll('img');
  console.log(tileImages)
  let tileObserver = new IntersectionObserver( (entries, self) => {
    entries.forEach (entry => {
      if (entry.isIntersecting) {
        console.log('intersect')
        entry.target.classList.add('onscreen')
        // self.unobserve(entry.target)
      } else {
        entry.target.classList.remove('onscreen')
      }
    });
  }, tileObserverOptions);

  console.warn(tileObserver)

  tileImages.forEach( image => { tileObserver.observe(image)});

  gameLoop();
});