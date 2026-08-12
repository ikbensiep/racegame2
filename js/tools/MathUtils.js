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

export function getAngle (a, b) {
  const cx = a?.x ?? a?.position?.x ?? 0;
  const cy = a?.y ?? a?.position?.y ?? 0;
  const dx = (b?.x ?? b?.position?.x ?? 0) - cx;
  const dy = (b?.y ?? b?.position?.y ?? 0) - cy;
    
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

export function getDistance(a, b) {
  const cx = a?.x ?? a?.position?.x ?? 0;
  const cy = a?.y ?? a?.position?.y ?? 0;
  const dx = (b?.x ?? b?.position?.x ?? 0) - cx;
  const dy = (b?.y ?? b?.position?.y ?? 0) - cy;

  return Math.sqrt(dx * dx + dy * dy);
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