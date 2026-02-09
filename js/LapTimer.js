export default class LapTimer {
  constructor(world) {
    this.world = world;
    this.sectors = world.paths.sectors;

    this.currentSector = 0; 
    this.lastSectorTime = 0;
    this.laps = [];
    this.bestLap = Infinity;

  }

  checkSectors(x, y) {
    for (let [id, path] of this.sectors) {
      if (this.world.logicCtx.isPointInPath(path, x, y)) {
        return id; // Geeft 's0', 's1' of 's2' terug
      }
    }
    return null;
  }
}