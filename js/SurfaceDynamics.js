// Surfaces
export const Surfaces = {
    asphalt: { drag: 1.0, grip: .95, power: .95 },
    paddock: { drag: 0.5, grip: .75, power: .2 },
    pitlane: { drag: 0.75, grip: .75, power: .5 },
    grass:   { drag: 0.125, grip: 0.1, power: 0.6 }, 
    gravel:  { drag: 0.8, grip: 0.2, power: 0.3 },
    sand:    { drag: 0.70, grip: 0.2, power: 0.4 }
    /* TODO: differentiate gravel vs gravel trap        */
    /* so we can add rally stages / boernreed as well   */
};
