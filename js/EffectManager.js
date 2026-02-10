export default class EffectManager {
  constructor(game) {
    this.game = game;
  }

  /**
   * Trigger een visuele 'exception' op een voertuig
   * @param {Element} gameObject  - Game Object DOM node
   * @param {string} state - De exception naam (damaged, boosting, etc)
   * @param {number} duration - Hoe lang het effect duurt
   */
  trigger(gameObject, state, duration = 500) {
    
      if (!gameObject.element) return;

      // using 1s units in css for readability, milliseconds in JS for familiarity
      // this sounds "really smart" actually now that im typing it out.

      gameObject.element.style.setProperty('--animation-duration', duration/1000) 
      gameObject.element.setAttribute('data-state', state);
      
      gameObject.element.addEventListener('animationend', this.handleAnimationEnd);
      
      // Verwijder de state na de duur
      setTimeout(() => {
          gameObject.element.dataset.state = '';
      }, duration);
  }
  
  handleAnimationEnd (e) {
    console.info('EffectManager.handleAnimationEnd', e.target)
    // maybe check against animation-name, not sure how to handle this like a real adult yet
    e.target.dataset.state = '';
    e.target.removeEventListener('animationend', this.handleAnimationEnd)
    
  }
}