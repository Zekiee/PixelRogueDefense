
import { GRID_W, GRID_H, PLAYABLE_H } from '../constants';

interface Point {
  x: number;
  y: number;
}

export const getGameCoordinates = (
  clientX: number, 
  clientY: number, 
  rect: DOMRect, 
  isPortrait: boolean
): Point => {
    if (isPortrait) {
        // In portrait mode, the game container is rotated 90 degrees via CSS.
        // We need to map the physical screen coordinates back to the logical game coordinates.
        // 
        // Visual (Rotated):
        // Top-Right of screen is Game (0,0)
        // Bottom-Right of screen is Game (W,0)
        // Top-Left of screen is Game (0,H)
        
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        
        // The game container's width in the DOM is actually its visual height (because of rotation)
        // and vice versa.
        
        // Logic mapping: Screen Y -> Game X, Screen -X -> Game Y
        
        // Normalizing coordinates relative to the rotated center
        // rect.height is the "game width" visually
        // rect.width is the "game height" visually
        
        const gameWidth = rect.height; 
        const gameHeight = rect.width; 
        
        // Normalized coordinates (-0.5 to 0.5)
        const nx = dy / gameWidth; 
        const ny = -dx / gameHeight;
        
        const x = Math.floor((nx + 0.5) * GRID_W);
        const y = Math.floor((ny + 0.5) * GRID_H);
        
        return { x, y };
    } else {
        // Standard landscape mode
        const x = Math.floor((clientX - rect.left) / (rect.width / GRID_W));
        const y = Math.floor((clientY - rect.top) / (rect.height / GRID_H));
        return { x, y };
    }
};
