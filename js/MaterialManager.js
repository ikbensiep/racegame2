export default class MaterialManager {
    static getProperties(rect) {
        const className = rect.getAttribute('class') || 'default';
        const fill = rect.getAttribute('fill') || '#555555';
        
        // Logic: if no data-depth is present, use the last 2 digits of HEX as depth
        let depth = rect.dataset.depth;
        if (!depth && fill.startsWith('#0000')) {
            depth = parseInt(fill.replace('#0000', ''), 16);
        }

        return {
            materialClass: `mat-${className}`,
            baseColor: fill,
            depth: depth || 64 // Default fallback
        };
    }
}