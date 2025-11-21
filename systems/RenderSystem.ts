
import { GameState, TowerType, Point } from '../types';
import { GRID_W, GRID_H, CELL_SIZE, TOWER_STATS, PLAYABLE_H } from '../constants';

export interface DragState {
    type: TowerType;
    x: number;
    y: number;
    valid: boolean;
}

export class RenderSystem {
  
  draw(
    ctx: CanvasRenderingContext2D, 
    state: GameState, 
    width: number, 
    height: number,
    hoverPos: Point | null,
    dragState: DragState | null,
    selectedPlacedTower: Point | null,
    modifiers: any
  ) {
    const scaleX = width / GRID_W;
    const scaleY = height / GRID_H; 

    ctx.save();
    
    // Screen Shake
    if (state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake;
        const shakeY = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Path
    ctx.fillStyle = '#262626';
    const path = state.path;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);
        
        const rectX = minX * scaleX;
        const rectY = minY * scaleY;
        const rectW = (maxX - minX + 1) * scaleX;
        const rectH = (maxY - minY + 1) * scaleY;
        ctx.fillRect(rectX, rectY, rectW, rectH);
    }
    
    // Obstacles
    ctx.fillStyle = '#4b5563';
    state.obstacles.forEach(o => {
        const ox = o.x * scaleX;
        const oy = o.y * scaleY;
        ctx.fillRect(ox + scaleX*0.1, oy + scaleY*0.1, scaleX*0.8, scaleY*0.8);
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(ox + scaleX*0.2, oy + scaleY*0.2, scaleX*0.4, scaleY*0.4);
        ctx.fillStyle = '#4b5563';
    });

    // Path Outline
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = scaleX * 0.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (path.length > 0) {
      ctx.moveTo((path[0].x + 0.5) * scaleX, (path[0].y + 0.5) * scaleY);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo((path[i].x + 0.5) * scaleX, (path[i].y + 0.5) * scaleY);
      }
    }
    ctx.stroke();

    // Towers
    state.grid.forEach((row, y) => {
      row.forEach((tower, x) => {
        if (tower) {
          const stats = TOWER_STATS[tower.type];
          const px = (x + 0.5) * scaleX;
          const py = (y + 0.5) * scaleY;
          
          // Selection Highlight
          if (selectedPlacedTower && selectedPlacedTower.x === x && selectedPlacedTower.y === y) {
             ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
             ctx.beginPath(); ctx.arc(px, py, scaleX * 0.6, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.lineWidth = 1;
             ctx.beginPath(); ctx.arc(px, py, (stats.range + modifiers.rangeAdd) * scaleX, 0, Math.PI*2); ctx.stroke();
          }

          this.drawSVGTower(ctx, px, py, scaleX * 0.8, tower.type, tower.level, stats.color);
        }
      });
    });

    // Enemies
    state.enemies.forEach(e => {
      const px = (e.x + 0.5) * scaleX;
      const py = (e.y + 0.5) * scaleY;
      const size = scaleX * (e.type === 'BOSS' ? 1.2 : e.type === 'SWARM' ? 0.4 : 0.6);
      
      this.drawSVGEnemy(ctx, px, py, size, e.type, e.visualOffset, e.frozen > 0, e.hitFlash);

      // Health Bar
      const hpPct = e.hp / e.maxHp;
      const barW = scaleX * 0.8;
      ctx.fillStyle = 'red';
      ctx.fillRect(px - barW/2, py - size * 0.8, barW, 4);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(px - barW/2, py - size * 0.8, barW * hpPct, 4);
    });

    // Projectiles
    state.projectiles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, scaleX * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // Particles
    state.particles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.beginPath(); ctx.arc(px, py, p.size * scaleX, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // Orbital Strike
    if (state.orbitalStrikeTick > 0) {
        const alpha = state.orbitalStrikeTick / 30;
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        for(let i=0; i<10; i++) {
            const bx = Math.random() * width;
            const bw = Math.random() * 50 + 20;
            ctx.fillRect(bx, 0, bw, height);
        }
        ctx.restore();
    }

    // Floating Text
    state.floatingTexts.forEach(ft => {
        const px = (ft.x + 0.5) * scaleX;
        const py = (ft.y + 0.5) * scaleY;
        ctx.save();
        ctx.font = `bold ${Math.floor(12 * ft.size)}px 'Press Start 2P', monospace`;
        ctx.fillStyle = 'black';
        ctx.fillText(ft.text, px + 2, py + 2);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, px, py);
        ctx.restore();
    });
    
    // Drag & Drop Preview (Ghost Tower)
    if (dragState) {
      const { x, y, type, valid } = dragState;
      const cx = (x + 0.5) * scaleX;
      const cy = (y + 0.5) * scaleY;
      const stats = TOWER_STATS[type];
      
      // Draw Validity Indicator on Grid
      ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);

      // Draw Range Circle (Centered on Grid)
      ctx.beginPath();
      ctx.strokeStyle = valid ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 100, 100, 0.5)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, (stats.range + modifiers.rangeAdd) * scaleX, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Ghost Tower (Offset upwards so finger doesn't hide it)
      // VISUAL_OFFSET_Y = 1.5 cells up
      const ghostY = cy - (scaleY * 1.5);
      
      ctx.save();
      ctx.globalAlpha = 0.8;
      // Draw a connection line from finger to ghost
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, ghostY); ctx.stroke();
      
      this.drawSVGTower(ctx, cx, ghostY, scaleX * 0.9, type, 1, stats.color);
      ctx.restore();
    }

    ctx.restore(); 

    // UI Mask
    const uiY = PLAYABLE_H * scaleY;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, uiY, width, height - uiY);
    ctx.fillStyle = '#1e293b';
    for(let i=0; i<width; i+=20) {
        ctx.beginPath();
        ctx.moveTo(i, uiY);
        ctx.lineTo(i+10, uiY);
        ctx.lineTo(i-10, height);
        ctx.lineTo(i-20, height);
        ctx.fill();
    }
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, uiY); ctx.lineTo(width, uiY); ctx.stroke();
  }

  private drawSVGEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: string, offset: number, frozen: boolean, hitFlash: number) {
    ctx.save();
    ctx.translate(x, y);
    if (frozen) ctx.globalAlpha = 0.8;
    const scale = 1 + Math.sin(offset * 0.2) * 0.1;
    ctx.scale(scale, scale);

    if (hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      if (type === 'BASIC') ctx.fillStyle = frozen ? '#a5f3fc' : '#84cc16';
      else if (type === 'FAST') ctx.fillStyle = frozen ? '#c4b5fd' : '#a855f7';
      else if (type === 'TANK') ctx.fillStyle = frozen ? '#cbd5e1' : '#475569';
      else if (type === 'SWARM') ctx.fillStyle = frozen ? '#fdba74' : '#ea580c';
      else if (type === 'BOSS') ctx.fillStyle = frozen ? '#fca5a5' : '#b91c1c';
    }

    if (type === 'BASIC') {
      ctx.beginPath();
      ctx.arc(0, 0, size/2, Math.PI, 0);
      ctx.bezierCurveTo(size/2, size/2, -size/2, size/2, -size/2, 0);
      ctx.fill();
      if (hitFlash <= 0) {
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(-size/5, -size/10, size/6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/5, -size/10, size/6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(-size/5, -size/10, size/12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/5, -size/10, size/12, 0, Math.PI*2); ctx.fill();
      }
    } else if (type === 'FAST') {
      ctx.beginPath(); ctx.moveTo(0, size/3); ctx.lineTo(-size/1.5, -size/3); ctx.lineTo(0, -size/6); ctx.lineTo(size/1.5, -size/3); ctx.fill();
      if (hitFlash <= 0) { ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(0, -size/6, size/10, 0, Math.PI*2); ctx.fill(); }
    } else if (type === 'TANK') {
      ctx.fillRect(-size/2, -size/2, size, size);
      if (hitFlash <= 0) {
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(-size/3, -size/3, 2, 0, Math.PI*2); ctx.fill(); ctx.arc(size/3, -size/3, 2, 0, Math.PI*2); ctx.fill();
      }
    } else if (type === 'SWARM') {
      const positions = [{x: -size/3, y: 0}, {x: size/3, y: -size/4}, {x: 0, y: size/3}];
      positions.forEach(pos => { ctx.beginPath(); ctx.arc(pos.x, pos.y, size/4, 0, Math.PI*2); ctx.fill(); });
    } else if (type === 'BOSS') {
      ctx.beginPath(); ctx.arc(0, -size/6, size/1.8, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(-size/3, size/6, size/1.5, size/3);
      if (hitFlash <= 0) {
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.moveTo(-size/4, -size/4); ctx.lineTo(-size/6, 0); ctx.lineTo(-size/3, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(size/4, -size/4); ctx.lineTo(size/3, 0); ctx.lineTo(size/6, 0); ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawSVGTower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: TowerType, level: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#334155';
    if (level === 1) { ctx.fillRect(-size/2, -size/2, size, size); } 
    else { ctx.beginPath(); ctx.roundRect(-size/2, -size/2, size, size, 5); ctx.fill(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = level; ctx.stroke(); }
    
    ctx.fillStyle = color;
    if (type === TowerType.ARCHER) {
      ctx.strokeStyle = '#d1fae5'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, size/3, -Math.PI/2, Math.PI/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size/3, 0); ctx.stroke();
    } else if (type === TowerType.CANNON) {
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, 0, size/3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(-size/6, -size/2, size/3, size/1.5);
    } else if (type === TowerType.MAGE) {
      ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.lineTo(size/3, 0); ctx.lineTo(0, size/2); ctx.lineTo(-size/3, 0); ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, size/2.5, 0, Math.PI*2); ctx.stroke();
    } else if (type === TowerType.SNIPER) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, size/2.5, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2); ctx.stroke();
    }
    
    if (level > 1) {
        ctx.fillStyle = '#fcd34d';
        for(let i=0; i<level; i++) { ctx.beginPath(); ctx.arc(-size/2 + 5 + i*6, -size/2 + 5, 2, 0, Math.PI*2); ctx.fill(); }
    }
    ctx.restore();
  }
}
