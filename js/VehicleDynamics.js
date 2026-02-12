// Vehicles

export const DefaultDynamics = {
  maxSpeed: 500,
  acceleration: .5,
  friction: 0.985,         
  steeringSensitivity: 0.05,
  driftFactor: 0.25,       
  handbrakeDrift: .01,     
  grassFriction: 0.90
};

// 1. De Basislijn: De 'Golf/Volvo' Gezinsauto
// Stabiel, traag sturen, veel rolweerstand
export const SaloonDynamics = {
  maxSpeed: 10,             // Bescheiden topsnelheid
  acceleration: 0.12,      // Rustig optrekken
  friction: 0.97,          // Gemiddelde rolweerstand
  steeringSensitivity: 0.035, // Zwaarder sturen (geen racestuur)
  driftFactor: 0.1,        // Zeer hoge grip, glijdt bijna niet uit zichzelf
  handbrakeDrift: 0.4,     // Alleen glijden met handrem
  grassFriction: 0.85
};

// 2. De GT3 / Porsche (Jouw huidige 'stijve' maar drift-achtige setup)
export const DriftDynamics = {
  maxSpeed: 5000,
  acceleration: 0.8,
  friction: 0.985,         // Rolt lang door
  steeringSensitivity: 0.05,
  driftFactor: 0.25,       // De 'sweet spot' waar de achterkant gaat 'jagen'
  handbrakeDrift: 0.8,     // Klaar voor 180-graden bochten
  grassFriction: 0.90
};

// 3. De Kart: De 'Zandbak-Koning'
// Extreem wendbaar, lage topsnelheid, stopt direct
export const KartDynamics = {
  maxSpeed: 6,
  acceleration: 0.6,       // Trekt razendsnel op
  friction: 0.92,          // Veel interne weerstand (stopt snel bij gas los)
  steeringSensitivity: 0.12, // Extreem nerveus sturen
  driftFactor: 0.05,       // Plakt aan de weg
  handbrakeDrift: 0.6,
  grassFriction: 0.70      // Komt bijna niet vooruit op gras
};

// 4. De Tractor: Onstuitbaar maar traag
// Lage snelheid, enorme koppel, negeert gras-vertraging bijna
export const TractorDynamics = {
  maxSpeed: 3,
  acceleration: 0.05,
  friction: 0.85,          // Enorme rolweerstand
  steeringSensitivity: 0.02, // Draaicirkel van een vrachtschip
  driftFactor: 0.02,       // Glijdt NOOIT
  handbrakeDrift: 0.1,
  grassFriction: 0.82      // Rijdt op gras bijna net zo 'snel' als op asfalt
};

// 5. De F1 Auto: De Raket
// Absurde snelheid, moet warm worden voor grip
export const F1Dynamics = {
  maxSpeed: 7500,
  acceleration: 1.2,       // Katapult-start
  friction: 0.995,         // Aerodynamisch, rolt eeuwig door
  steeringSensitivity: 0.08,
  driftFactor: 0.15,       // Glijdt alleen bij extreme snelheden/bochten
  handbrakeDrift: 0.9,     // Eén tikje en je tolt rond
  grassFriction: 0.50      // Onbestuurbaar op gras (spint direct)
};