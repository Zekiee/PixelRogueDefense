
import { GRID_W, PLAYABLE_H } from '../constants';
import { Point } from '../types';

export const generateLevelData = (stage: number): { path: Point[], obstacles: Point[] } => {
  const path: Point[] = [];
  const obstacles: Point[] = [];
  
  // 1. Generate Path
  // Restrict start Y to buffer zones
  const maxStart = Math.max(1, PLAYABLE_H - 2);
  let current = { x: 0, y: Math.floor(Math.random() * maxStart) + 1 };
  path.push({ ...current });

  // Difficulty Scaling:
  // Lower stage = more winding (lower moveRightChance)
  // Higher stage = straighter/faster (higher moveRightChance)
  const baseMoveRightChance = Math.min(0.8, 0.3 + (stage * 0.05));

  while (current.x < GRID_W - 1) {
    const moveRight = Math.random() < baseMoveRightChance || current.x === 0;
    
    if (moveRight) {
      const steps = Math.floor(Math.random() * 2) + 1; // Move 1-2 steps right
      const nextX = Math.min(GRID_W - 1, current.x + steps);
      for (let x = current.x + 1; x <= nextX; x++) {
         path.push({ x, y: current.y });
      }
      current.x = nextX;
    } else {
      // Vertical movement (Lane change)
      const direction = Math.random() > 0.5 ? 1 : -1;
      const nextY = current.y + direction;
      
      const previous = path.length > 1 ? path[path.length - 2] : null;
      const isBacktracking = previous && previous.x === current.x && previous.y === nextY;

      if (nextY >= 1 && nextY < PLAYABLE_H - 1 && !isBacktracking) { 
        path.push({ x: current.x, y: nextY });
        current.y = nextY;
      } else {
         // Forced move right if blocked
         current.x++;
         path.push({ ...current });
      }
    }
  }
  
  if (path[path.length-1].x < GRID_W) {
     path.push({ x: GRID_W, y: path[path.length-1].y });
  }

  // 2. Generate Obstacles
  const obstacleCount = 3 + Math.floor(Math.random() * 3) + Math.floor(stage * 0.5);
  let attempts = 0;
  while (obstacles.length < obstacleCount && attempts < 100) {
      attempts++;
      const ox = Math.floor(Math.random() * GRID_W);
      const oy = Math.floor(Math.random() * PLAYABLE_H);
      
      const onPath = path.some(p => p.x === ox && p.y === oy);
      const existing = obstacles.some(o => o.x === ox && o.y === oy);
      
      if (!onPath && !existing) {
          obstacles.push({ x: ox, y: oy });
      }
  }

  return { path, obstacles };
};
