/**
 * @param {number} hypot
 * @param {number} angle
 */
export function  sidesFromHypotenhuse (hypot, angle) {
  // Convert angle from degrees to radians
  // obsolete as we're no longer using degrees but rads in this game
  // const angleInRadians = (angle * Math.PI) / 180;

  // Calculate width (a) and height (b) using trigonometric functions
  const width = hypot * Math.cos(angle);
  const height = hypot * Math.sin(angle);

  return { width, height };
}

/**
 * @param {object} a
 * @param {object} b
 */
export function getAngle (a, b) {
  let cx = (a.x ? a.x : a.position.x);
  let cy = (a.y ? a.y : a.position.y);
  let dx = (b.x ? b.x : b.position.x) - cx;
  let dy = (b.y ? b.y : b.position.y) - cy;
    
  const angleDegs = Math.atan2(dy, dx) * 180 / Math.PI;
  return angleDegs;
}

/**
 * @param {object} a
 * @param {object} b
 */
export function getDistance(a, b) {
  try {
    let cx = (a.x ? a.x : a.position.x);
    let cy = (a.y ? a.y : a.position.y);
    let dx = (b.x ? b.x : b.position.x) - cx;
    let dy = (b.y ? b.y : b.position.y) - cy;

    let mag = Math.sqrt(dx * dx + dy * dy);
    return mag;
  } catch (e) {
    console.error(e, [a, b]);
  }
}

/**
   * @param {object} a
   * @param {object} b
   */
export function checkCollision (a, b) {

    let xPosA = a.position ? a.position.x : a.x;
    let yPosA = a.position ? a.position.y : a.y;
    let xPosB = b.position ? b.position.x : b.x;
    let yPosB = b.position ? b.position.y : b.y;

    const sumOfRadii = a.radius / 2 + b.radius/2;
    const dx = xPosA - xPosB;
    const dy = yPosA - yPosB;
    const distance = Math.hypot(dx, dy);
    return [(distance < sumOfRadii), distance, sumOfRadii, dx, dy];
  }