export default class Sundial {
  constructor(game) {
    this.game = game;
    console.log('init Sundial');
  }

  update () {
    let time = this.game.lastTime;
    this.updateGlobalLighting(time)
  }

  updateGlobalLighting(gameTime) {
    // 1. Calculate Sun Angles
    // Rotate 360 degrees over the cycle
    const azimuth = (gameTime * 360) % 360; 
    // High at noon (0.5), low at sunrise/sunset
    const elevation = Math.sin(gameTime * Math.PI) * 90; 
  
    // 2. Update SVG Filters (Normal Map & Specular)
    const sunElements = document.querySelectorAll('feDistantLight');
    sunElements.forEach(light => {
      light.setAttribute('azimuth', azimuth);
      light.setAttribute('elevation', Math.max(5, elevation)); // Keep a min elevation for visibility
    });
  
    // 3. Update Drop Shadows (simulate parallel direction)
    // Distance increases as elevation decreases
    const shadowDist = (90 - elevation) * 0.5; 
    const shadowX = Math.cos(azimuth * Math.PI / 180) * shadowDist;
    const shadowY = Math.sin(azimuth * Math.PI / 180) * shadowDist;
    
    document.documentElement.style.setProperty('--shadow-offset-x', `${shadowX}px`);
    document.documentElement.style.setProperty('--shadow-offset-y', `${shadowY}px`);
  
    // 4. Global Darkness/Multiply Opacity
    // Darkest at night (elevation < 0)
    const darkness = elevation > 0 ? 0 : Math.abs(elevation) / 90;
    document.getElementById('multiply-layer').style.opacity = darkness;
  }
}