import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GamePhase, GameState, TowerType, Enemy, Projectile, Particle, Tower, UpgradeCard, Point } from './types';
import { GRID_W, GRID_H, CELL_SIZE, MAP_PATH, TOWER_STATS, ROGUE_UPGRADES, INITIAL_STATE, FPS } from './constants';
import { GameUI } from './components/GameUI';
import { UpgradeMenu } from './components/UpgradeMenu';
import { getWaveFlavorText } from './services/geminiService';

// --- UTILS ---
const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const App: React.FC = () => {
  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game Logic Refs (Mutable state for performance)
  const gameStateRef = useRef<GameState>({
    ...INITIAL_STATE,
    grid: Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(null)),
    enemies: [],
    projectiles: [],
    particles: []
  });
  
  // UI State
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
  const [uiState, setUiState] = useState<GameState>(gameStateRef.current); // Synced occasionally for UI
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeCard[]>([]);
  const [flavorText, setFlavorText] = useState<string>("");
  const [modifiers, setModifiers] = useState({
    damageMul: 1,
    rangeAdd: 0,
    speedMul: 1,
    sniperMul: 1,
  });

  // --- GAME LOOP HELPERS ---

  const spawnEnemy = (wave: number, waveTime: number) => {
    // Simple spawning logic based on wave number
    const spawnRate = Math.max(20, 100 - wave * 2); // Frames between spawns
    const enemiesToSpawn = 5 + Math.floor(wave * 1.5);
    const spawnedCount = Math.floor(waveTime / spawnRate);
    
    if (waveTime % spawnRate === 0 && spawnedCount < enemiesToSpawn) {
      const isBoss = wave % 5 === 0 && spawnedCount === enemiesToSpawn - 1;
      const isFast = !isBoss && Math.random() > 0.8;
      const isTank = !isBoss && Math.random() > 0.8;
      
      const hpMul = 1 + (wave * 0.4);
      
      const enemy: Enemy = {
        id: Math.random().toString(36),
        x: MAP_PATH[0].x,
        y: MAP_PATH[0].y,
        pathIndex: 0,
        distance: 0,
        speed: isBoss ? 0.02 : isFast ? 0.06 : isTank ? 0.02 : 0.04,
        maxHp: (isBoss ? 500 : isTank ? 80 : 30) * hpMul,
        hp: (isBoss ? 500 : isTank ? 80 : 30) * hpMul,
        frozen: 0,
        type: isBoss ? 'BOSS' : isFast ? 'FAST' : isTank ? 'TANK' : 'BASIC'
      };
      gameStateRef.current.enemies.push(enemy);
    }
    
    // Check wave end
    if (spawnedCount >= enemiesToSpawn && gameStateRef.current.enemies.length === 0) {
      endWave();
    }
  };

  const updatePhysics = () => {
    const state = gameStateRef.current;
    
    // 1. Enemies Move
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy.frozen > 0) enemy.frozen--;
      
      const currentSpeed = enemy.frozen > 0 ? enemy.speed * 0.5 : enemy.speed;
      enemy.distance += currentSpeed;
      
      // Path interpolation
      const p1 = MAP_PATH[enemy.pathIndex];
      const p2 = MAP_PATH[enemy.pathIndex + 1];
      if (!p1 || !p2) {
        // Reached end
        state.lives -= 1;
        state.enemies.splice(i, 1);
        addParticles(enemy.x, enemy.y, '#ff0000', 10);
        if (state.lives <= 0) setPhase(GamePhase.GAME_OVER);
        continue;
      }
      
      const segLen = getDistance(p1, p2);
      if (enemy.distance >= segLen) {
        enemy.pathIndex++;
        enemy.distance = 0;
        enemy.x = p2.x;
        enemy.y = p2.y;
        if (enemy.pathIndex >= MAP_PATH.length - 1) {
           // Reached true end
           state.lives -= 1;
           state.enemies.splice(i, 1);
           addParticles(enemy.x, enemy.y, '#ff0000', 10);
           if (state.lives <= 0) setPhase(GamePhase.GAME_OVER);
        }
      } else {
        const t = enemy.distance / segLen;
        enemy.x = p1.x + (p2.x - p1.x) * t;
        enemy.y = p1.y + (p2.y - p1.y) * t;
      }
    }

    // 2. Towers Shoot
    state.grid.flat().forEach(tower => {
      if (!tower) return;
      if (tower.lastShot > 0) tower.lastShot--;
      
      if (tower.lastShot <= 0) {
        // Find target
        const target = state.enemies.find(e => getDistance(tower, e) <= tower.range);
        if (target) {
          const stats = TOWER_STATS[tower.type];
          let dmg = stats.damage * modifiers.damageMul;
          if (tower.type === TowerType.SNIPER) dmg *= modifiers.sniperMul;

          const proj: Projectile = {
            id: Math.random().toString(),
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            speed: 0.25,
            damage: dmg,
            color: stats.color,
            homing: true,
            splashRadius: stats.splash,
            freezeDuration: stats.freeze
          };
          state.projectiles.push(proj);
          tower.lastShot = Math.max(5, stats.cooldown / modifiers.speedMul);
        }
      }
    });

    // 3. Projectiles Move
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      const target = state.enemies.find(e => e.id === p.targetId);
      
      let tx = p.x, ty = p.y;
      if (p.homing && target) {
        tx = target.x;
        ty = target.y;
      } else if (p.homing && !target) {
        // Target died, remove projectile
        state.projectiles.splice(i, 1);
        continue;
      }
      
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < p.speed) {
        // Hit
        state.projectiles.splice(i, 1);
        hitEnemy(p, target, state);
      } else {
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
      }
    }

    // 4. Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  };

  const hitEnemy = (proj: Projectile, target: Enemy | undefined, state: GameState) => {
    const hitEffect = (e: Enemy) => {
      e.hp -= proj.damage;
      if (proj.freezeDuration) e.frozen = proj.freezeDuration;
      
      if (e.hp <= 0) {
        const idx = state.enemies.findIndex(en => en.id === e.id);
        if (idx !== -1) {
          state.enemies.splice(idx, 1);
          state.money += (e.type === 'BOSS' ? 50 : 5);
          state.score += (e.type === 'BOSS' ? 100 : 10);
          addParticles(e.x, e.y, '#fbbf24', 6); // Gold particles
        }
      }
    };

    if (proj.splashRadius) {
      // AOE
      const impactX = target ? target.x : proj.x;
      const impactY = target ? target.y : proj.y;
      addParticles(impactX, impactY, proj.color, 8); // Explosion

      state.enemies.forEach(e => {
        if (getDistance({x: impactX, y: impactY}, e) <= (proj.splashRadius || 0)) {
          hitEffect(e);
        }
      });
    } else if (target) {
      // Single Target
      hitEffect(target);
      addParticles(target.x, target.y, proj.color, 3);
    }
  };

  const addParticles = (x: number, y: number, color: string, count: number) => {
    for (let k = 0; k < count; k++) {
      gameStateRef.current.particles.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        life: 20 + Math.random() * 20,
        color,
        size: Math.random() * 0.3 + 0.1
      });
    }
  };

  // --- ROGUELIKE LOGIC ---
  
  const endWave = () => {
    setPhase(GamePhase.WAVE_COMPLETE);
    generateUpgrades();
  };

  const generateUpgrades = () => {
    // Pick 3 random upgrades
    const shuffled = [...ROGUE_UPGRADES].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3).map(base => ({
      ...base,
      apply: (state: GameState) => {
        if (base.id === 'dmg_up') setModifiers(m => ({ ...m, damageMul: m.damageMul + 0.2 }));
        if (base.id === 'spd_up') setModifiers(m => ({ ...m, speedMul: m.speedMul + 0.15 }));
        if (base.id === 'eco_up') state.money += 100;
        if (base.id === 'rng_up') setModifiers(m => ({ ...m, rangeAdd: m.rangeAdd + 1 }));
        if (base.id === 'int_up') state.money += Math.floor(state.money * 0.1);
        if (base.id === 'sniper_buff') setModifiers(m => ({ ...m, sniperMul: m.sniperMul * 2 }));
        if (base.id === 'base_hp') state.lives += 5;
      }
    }));
    setUpgradeOptions(picked);
  };

  const selectUpgrade = (card: UpgradeCard) => {
    card.apply(gameStateRef.current);
    startNextWave();
  };

  const startNextWave = async () => {
    gameStateRef.current.wave += 1;
    
    // Gemini integration for flavor
    const txt = await getWaveFlavorText(gameStateRef.current.wave);
    setFlavorText(txt);
    
    waveTimeRef.current = 0;
    setPhase(GamePhase.PLAYING);
  };

  // --- RENDERER ---

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameStateRef.current;
    const scaleX = width / GRID_W;
    const scaleY = height / GRID_H; // Should keep aspect ratio, but stretch for now to fill grid

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Grid Lines (Subtle)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * scaleX, 0); ctx.lineTo(x * scaleX, height); ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * scaleY); ctx.lineTo(width, y * scaleY); ctx.stroke();
    }

    // Draw Path
    ctx.strokeStyle = '#333';
    ctx.lineWidth = scaleX * 0.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (MAP_PATH.length > 0) {
      ctx.moveTo((MAP_PATH[0].x + 0.5) * scaleX, (MAP_PATH[0].y + 0.5) * scaleY);
      for (let i = 1; i < MAP_PATH.length; i++) {
        ctx.lineTo((MAP_PATH[i].x + 0.5) * scaleX, (MAP_PATH[i].y + 0.5) * scaleY);
      }
    }
    ctx.stroke();

    // Draw Towers
    state.grid.forEach((row, y) => {
      row.forEach((tower, x) => {
        if (tower) {
          const stats = TOWER_STATS[tower.type];
          const px = (x + 0.5) * scaleX;
          const py = (y + 0.5) * scaleY;
          const size = scaleX * 0.8;
          
          // Base
          ctx.fillStyle = '#444';
          ctx.fillRect(px - size/2, py - size/2, size, size);
          
          // Color Top
          ctx.fillStyle = stats.color;
          ctx.fillRect(px - size/4, py - size/4, size/2, size/2);

          // Range indicator (if selected) or hover logic could go here
        }
      });
    });

    // Draw Enemies
    state.enemies.forEach(e => {
      const px = (e.x + 0.5) * scaleX;
      const py = (e.y + 0.5) * scaleY;
      const size = scaleX * 0.5;
      
      ctx.fillStyle = e.frozen > 0 ? '#93c5fd' : (e.type === 'BOSS' ? '#ef4444' : '#fbbf24');
      if (e.type === 'BOSS') {
         // Draw boss larger
         ctx.fillRect(px - size * 0.8, py - size * 0.8, size * 1.6, size * 1.6);
      } else {
         ctx.beginPath();
         ctx.arc(px, py, size / 2, 0, Math.PI * 2);
         ctx.fill();
      }

      // Health Bar
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = 'red';
      ctx.fillRect(px - size/2, py - size * 0.8, size, 4);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(px - size/2, py - size * 0.8, size * hpPct, 4);
    });

    // Draw Projectiles
    state.projectiles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, scaleX * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Particles
    state.particles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.fillRect(px, py, p.size * scaleX, p.size * scaleY);
      ctx.globalAlpha = 1.0;
    });
    
    // Draw Ghost Tower (Placement)
    if (hoverPos.current && selectedTower) {
      const { x, y } = hoverPos.current;
      // Check validity
      if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
        const cx = (x + 0.5) * scaleX;
        const cy = (y + 0.5) * scaleY;
        const stats = TOWER_STATS[selectedTower];
        
        // Range Circle
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, (stats.range + modifiers.rangeAdd) * scaleX, 0, Math.PI * 2);
        ctx.stroke();
        
        // Placement Square
        const valid = isValidPlacement(x, y, gameStateRef.current);
        ctx.fillStyle = valid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
      }
    }
  };

  const isValidPlacement = (x: number, y: number, state: GameState) => {
    if (state.grid[y][x]) return false;
    // Simple Path Check: don't place on path points
    // Better check: Check distance to line segments of path
    // For grid simplicity, we just check if (x,y) is ON the path nodes or directly between them if straight?
    // Let's just use the pre-defined path list for exact checks if grid based
    // Since we interpolate, let's block cells that the path passes through.
    
    // Crude check: Is (x,y) in MAP_PATH?
    if (MAP_PATH.some(p => p.x === x && p.y === y)) return true; // Wait, path points are cells.
    
    // Actually, we need to block cells that the line segments intersect.
    // Since path is strictly manhattan or diagonal?
    // Our map path defined in constants is comprised of straight lines.
    
    // Let's iterate path segments
    for (let i=0; i < MAP_PATH.length - 1; i++) {
      const p1 = MAP_PATH[i];
      const p2 = MAP_PATH[i+1];
      // Check if x,y lies on segment p1-p2
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        // It's on the segment bounding box. Since lines are straight axis-aligned in our path:
        if (p1.x === p2.x && x === p1.x) return false; // Vertical
        if (p1.y === p2.y && y === p1.y) return false; // Horizontal
      }
    }
    return true;
  };

  const hoverPos = useRef<{x: number, y: number} | null>(null);
  const waveTimeRef = useRef(0);

  // --- MAIN LOOP ---
  const loop = useCallback((time: number) => {
    if (phase === GamePhase.PLAYING) {
      waveTimeRef.current++;
      spawnEnemy(gameStateRef.current.wave, waveTimeRef.current);
      updatePhysics();
    }
    
    // Sync UI state occasionally (every 10 frames) or always? 
    // Always is fine for simple UI, React is fast enough if we don't deep clone everything.
    // We only really need money, lives, wave in UI.
    setUiState({...gameStateRef.current}); 

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.width, canvas.height);
    }
    
    requestRef.current = requestAnimationFrame(loop);
  }, [phase, modifiers, selectedTower]); // Deps are tricky with RAF, usually use refs. But phase changes trigger re-setup.

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  // --- INTERACTION ---

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (phase !== GamePhase.PLAYING && phase !== GamePhase.MENU) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const x = Math.floor((clientX - rect.left) / (rect.width / GRID_W));
    const y = Math.floor((clientY - rect.top) / (rect.height / GRID_H));
    
    if (selectedTower) {
      // Place Tower
      if (isValidPlacement(x, y, gameStateRef.current)) {
        const stats = TOWER_STATS[selectedTower];
        if (gameStateRef.current.money >= stats.cost) {
          gameStateRef.current.money -= stats.cost;
          gameStateRef.current.grid[y][x] = {
            id: Math.random().toString(),
            x, y,
            type: selectedTower,
            range: stats.range + modifiers.rangeAdd,
            damage: stats.damage,
            cooldown: stats.cooldown,
            lastShot: 0,
            level: 1
          };
          setSelectedTower(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / GRID_W));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / GRID_H));
    hoverPos.current = { x, y };
  };

  // --- INITIALIZE ---
  useEffect(() => {
     getWaveFlavorText(1).then(setFlavorText);
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900 flex items-center justify-center overflow-hidden relative">
      <div className="relative w-full max-w-[1200px] aspect-video bg-black shadow-2xl border-4 border-gray-700 rounded-lg overflow-hidden">
        
        <canvas
          ref={canvasRef}
          width={GRID_W * CELL_SIZE}
          height={GRID_H * CELL_SIZE}
          className="w-full h-full block cursor-crosshair pixel-art"
          onClick={handleCanvasClick} // Fallback for mouse
          onMouseMove={handleMouseMove}
          onTouchStart={handleCanvasClick} // Simple touch tap
        />

        <GameUI 
          gameState={uiState} 
          phase={phase}
          selectedTower={selectedTower}
          onSelectTower={setSelectedTower}
          onNextWave={startNextWave}
          flavorText={flavorText}
        />

        {phase === GamePhase.WAVE_COMPLETE && (
          <UpgradeMenu options={upgradeOptions} onSelect={selectUpgrade} />
        )}

        {phase === GamePhase.GAME_OVER && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30 text-white animate-fadeIn">
            <h1 className="text-4xl md:text-6xl text-red-500 mb-4">GAME OVER</h1>
            <p className="text-xl mb-8">Waves Survived: {uiState.wave - 1}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-white text-black font-bold hover:scale-105 transition-transform"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Landscape warning for phones */}
      <div className="md:hidden fixed top-0 left-0 w-full h-full bg-black z-50 flex items-center justify-center text-white text-center p-4 pointer-events-none opacity-0 portrait:opacity-100 portrait:pointer-events-auto transition-opacity duration-500">
        <div className="animate-pulse">
          <div className="text-4xl mb-4">↻</div>
          Please Rotate Device<br/>for Best Experience
        </div>
      </div>
    </div>
  );
};

export default App;
