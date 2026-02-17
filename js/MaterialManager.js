
export default class MaterialManager {


    static getProperties(rect) {
        const className = rect.getAttribute('class') || 'default';
        const title = rect.querySelector('title')?.textContent || '';
        const description = rect.querySelector('desc')?.textContent || '';

        const styleString = rect.getAttribute('style') || "";
    
        // 2. Maak een dummy element om de browser het zware werk te laten doen
        const tempEl = document.createElement('div');
        tempEl.style.cssText = styleString;
        const style = tempEl.style;

        const strokeWidth = parseFloat(tempEl.style.getPropertyValue('stroke-width')) || 1;
        const dashArray = tempEl.style.getPropertyValue("stroke-dasharray");
        const parts = dashArray && dashArray !== 'none' ? dashArray.split(",") : [100, 0];
        

        return {
            id: rect.id || "",
            title: title,
            description: description,
            materialClass: `mat-${className}`,
            faceColor: rect.getAttribute('fill') || rect.style.fill || '#555555',
            faceOpacity: rect.getAttribute('fill-opacity') || rect.style.fillOpacity || 1,
            columnColor: rect.getAttribute('fill') || rect.style.stroke || '#fff',
            depth: Math.max(1, strokeWidth),
            wall: parseInt(parts[0]) || 10,
            gap: parseInt(parts[1]) || 0,
            grunge: 1.0 - (parseFloat(tempEl.style.getPropertyValue('stroke-opacity')) || 1.0),
            roof: tempEl.style.getPropertyValue('stroke-linecap') === 'square' ? 'overhang' : 'flat'
        };
    }
}