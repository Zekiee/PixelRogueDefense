
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GamePhase, GameState, TowerType, Enemy, Projectile, Particle, Tower, UpgradeCard, Point, FloatingText } from './types';
import { GRID_W, GRID_H, CELL_SIZE, TOWER_STATS, ROGUE_UPGRADES, INITIAL_STATE, WAVES_PER_STAGE, UPGRADE_COST_MULTIPLIER, UPGRADE_STAT_MULTIPLIER, SELL_RATIO, REROLL_COST } from './constants';
import { GameUI } from './components/GameUI';
import { UpgradeMenu } from './components/UpgradeMenu';
import { getWaveFlavorText } from './services/geminiService';

// --- 常量定义 ---
const UI_ROWS = 2; // 底部保留给UI的行数
const PLAYABLE_H = GRID_H - UI_ROWS; // 实际游戏区域高度

// --- 工具函数 ---
const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// 简单的随机路径生成器
const generatePath = (): Point[] => {
  const path: Point[] = [];
  // 限制起始 Y 在 1 到 PLAYABLE_H - 2 之间 (留出顶部和底部缓冲)
  const maxStart = Math.max(1, PLAYABLE_H - 2);
  let current = { x: 0, y: Math.floor(Math.random() * maxStart) + 1 };
  path.push({ ...current });

  while (current.x < GRID_W - 1) {
    // 决定下一步去哪里
    // 70% 概率向右，30% 概率改变 Y 轴
    const moveRight = Math.random() > 0.3 || current.x === 0;
    
    if (moveRight) {
      const steps = Math.floor(Math.random() * 2) + 1; // 向右走 1-2 格
      const nextX = Math.min(GRID_W - 1, current.x + steps);
      // 添加中间点以确保直线绘制正确
      for (let x = current.x + 1; x <= nextX; x++) {
         path.push({ x, y: current.y });
      }
      current.x = nextX;
    } else {
      // 变道
      const direction = Math.random() > 0.5 ? 1 : -1;
      const nextY = current.y + direction;
      // 限制路径不超出顶部和 PLAYABLE_H
      if (nextY >= 1 && nextY < PLAYABLE_H - 1) { 
        path.push({ x: current.x, y: nextY });
        current.y = nextY;
      } else {
         // 如果撞墙，强制向右
         current.x++;
         path.push({ ...current });
      }
    }
  }
  // 确保最后一点在最右边
  if (path[path.length-1].x < GRID_W) {
     path.push({ x: GRID_W, y: path[path.length-1].y });
  }

  return path;
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // 初始化状态
  const gameStateRef = useRef<GameState>({
    ...INITIAL_STATE,
    grid: Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(null)),
    path: generatePath(),
    enemies: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    screenShake: 0
  });
  
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<Tower | null>(null);
  
  const [uiState, setUiState] = useState<GameState>(gameStateRef.current); 
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeCard[]>([]);
  const [flavorText, setFlavorText] = useState<string>("");
  
  // 神器属性修正
  const [modifiers, setModifiers] = useState({
    damageMul: 1,
    rangeAdd: 0,
    speedMul: 1,
    sniperMul: 1,
    splashRadiusMul: 1,
    executeThreshold: 0, // 处决血线 (0-1)
    critChance: 0, // 暴击率
    critDmg: 1.5, // 暴击伤害倍率
    goldOnHitChance: 0, // 贪婪
    explodeOnDeath: 0 // 尸爆伤害
  });

  const waveTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);

  // --- 绘图辅助函数 (仿SVG风格) ---
  
  const drawSVGEnemy = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: string, offset: number, frozen: boolean, hitFlash: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // 冰冻效果颜色叠加
    if (frozen) ctx.globalAlpha = 0.8;
    
    // 简单的呼吸动画
    const scale = 1 + Math.sin(offset * 0.2) * 0.1;
    ctx.scale(scale, scale);

    // Hit Flash Effect (Phase 1)
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
      // 史莱姆 (绿色圆Blob)
      ctx.beginPath();
      ctx.arc(0, 0, size/2, Math.PI, 0); // 上半圆
      ctx.bezierCurveTo(size/2, size/2, -size/2, size/2, -size/2, 0); // 底部波浪
      ctx.fill();
      // 眼睛 (如果不在闪白状态)
      if (hitFlash <= 0) {
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(-size/5, -size/10, size/6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/5, -size/10, size/6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(-size/5, -size/10, size/12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/5, -size/10, size/12, 0, Math.PI*2); ctx.fill();
      }

    } else if (type === 'FAST') {
      // 蝙蝠 (紫色三角)
      ctx.beginPath();
      ctx.moveTo(0, size/3);
      ctx.lineTo(-size/1.5, -size/3); // 左翼
      ctx.lineTo(0, -size/6); // 身体中心
      ctx.lineTo(size/1.5, -size/3); // 右翼
      ctx.fill();
      if (hitFlash <= 0) {
        ctx.fillStyle = 'yellow';
        ctx.beginPath(); ctx.arc(0, -size/6, size/10, 0, Math.PI*2); ctx.fill();
      }

    } else if (type === 'TANK') {
      // 铁傀儡 (灰色方块)
      ctx.fillRect(-size/2, -size/2, size, size);
      if (hitFlash <= 0) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(-size/3, -size/3, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/3, -size/3, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-size/3, size/3, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(size/3, size/3, 2, 0, Math.PI*2); ctx.fill();
      }

    } else if (type === 'SWARM') {
      // 虫群 (三个小点)
      const positions = [{x: -size/3, y: 0}, {x: size/3, y: -size/4}, {x: 0, y: size/3}];
      positions.forEach(pos => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size/4, 0, Math.PI*2);
        ctx.fill();
      });

    } else if (type === 'BOSS') {
      // 骷髅王 (大红色)
      ctx.beginPath();
      ctx.arc(0, -size/6, size/1.8, 0, Math.PI*2);
      ctx.fill();
      ctx.fillRect(-size/3, size/6, size/1.5, size/3);
      if (hitFlash <= 0) {
        ctx.fillStyle = 'black';
        ctx.beginPath(); 
        ctx.moveTo(-size/4, -size/4); ctx.lineTo(-size/6, 0); ctx.lineTo(-size/3, 0); ctx.fill();
        ctx.beginPath(); 
        ctx.moveTo(size/4, -size/4); ctx.lineTo(size/3, 0); ctx.lineTo(size/6, 0); ctx.fill();
      }
    }
    
    ctx.restore();
  };

  const drawSVGTower = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: TowerType, level: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    
    // 基座 (等级越高越复杂)
    ctx.fillStyle = '#334155';
    if (level === 1) {
        ctx.fillRect(-size/2, -size/2, size, size);
    } else {
        ctx.beginPath();
        ctx.roundRect(-size/2, -size/2, size, size, 5);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = level;
        ctx.stroke();
    }

    ctx.fillStyle = color;

    if (type === TowerType.ARCHER) {
      // 弓箭塔
      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size/3, -Math.PI/2, Math.PI/2); // 弓
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(size/3, 0); // 箭
      ctx.stroke();

    } else if (type === TowerType.CANNON) {
      // 加农炮
      ctx.fillStyle = '#1f2937'; // 炮管黑
      ctx.beginPath();
      ctx.arc(0, 0, size/3, 0, Math.PI*2); // 底座
      ctx.fill();
      ctx.fillStyle = color; // 炮身
      ctx.fillRect(-size/6, -size/2, size/3, size/1.5);

    } else if (type === TowerType.MAGE) {
      // 魔法塔 (水晶)
      ctx.beginPath();
      ctx.moveTo(0, -size/2);
      ctx.lineTo(size/3, 0);
      ctx.lineTo(0, size/2);
      ctx.lineTo(-size/3, 0);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, size/2.5, 0, Math.PI*2); ctx.stroke();

    } else if (type === TowerType.SNIPER) {
      // 狙击塔 (十字准星)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, size/2.5, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2); ctx.stroke();
    }
    
    if (level > 1) {
        ctx.fillStyle = '#fcd34d';
        for(let i=0; i<level; i++) {
            ctx.beginPath();
            ctx.arc(-size/2 + 5 + i*6, -size/2 + 5, 2, 0, Math.PI*2);
            ctx.fill();
        }
    }

    ctx.restore();
  };

  // --- 游戏循环逻辑 ---

  const enemiesToSpawnRef = useRef<Enemy[]>([]);
  
  const prepareWave = (wave: number) => {
    const count = 5 + Math.floor(wave * 1.5);
    const queue: Enemy[] = [];
    const isBossWave = wave % 5 === 0;

    for (let i = 0; i < count; i++) {
      let type: Enemy['type'] = 'BASIC';
      let hp = 20 * (1 + wave * 0.3);
      let speed = 0.04;
      const rand = Math.random();

      if (isBossWave && i === count - 1) {
        type = 'BOSS';
        hp *= 15;
        speed = 0.015;
      } else if (rand > 0.9) {
        type = 'TANK';
        hp *= 3;
        speed = 0.02;
      } else if (rand > 0.7) {
        type = 'FAST';
        hp *= 0.6;
        speed = 0.07;
      } else if (rand > 0.5 && wave > 3) {
        type = 'SWARM';
        hp *= 0.3;
        speed = 0.06;
      }

      queue.push({
        id: Math.random().toString(36),
        x: gameStateRef.current.path[0].x,
        y: gameStateRef.current.path[0].y,
        pathIndex: 0,
        distance: 0,
        speed,
        maxHp: hp,
        hp,
        frozen: 0,
        hitFlash: 0, // Phase 1
        type,
        visualOffset: Math.random() * 100
      });
    }
    enemiesToSpawnRef.current = queue;
  };

  const updatePhysics = () => {
    const state = gameStateRef.current;
    
    // Screen Shake Decay (Phase 1)
    if (state.screenShake > 0) {
        state.screenShake *= 0.9;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    // Floating Texts Physics (Phase 1)
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= ft.vy;
        ft.life--;
        if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }
    
    // 0. 生成敌人
    if (enemiesToSpawnRef.current.length > 0 && waveTimeRef.current % 40 === 0) {
        const next = enemiesToSpawnRef.current.shift();
        if (next) state.enemies.push(next);
    }

    // 检查波次结束
    if (enemiesToSpawnRef.current.length === 0 && state.enemies.length === 0 && state.lives > 0) {
       endWave();
       return;
    }

    // 1. 敌人移动
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy.frozen > 0) enemy.frozen--;
      if (enemy.hitFlash > 0) enemy.hitFlash--; // Decay flash
      
      const currentSpeed = enemy.frozen > 0 ? enemy.speed * 0.5 : enemy.speed;
      enemy.distance += currentSpeed;
      enemy.visualOffset += 0.2;
      
      const path = state.path;
      const p1 = path[enemy.pathIndex];
      const p2 = path[enemy.pathIndex + 1];
      
      if (!p1 || !p2) {
        state.lives -= 1;
        state.screenShake = 10; // Shake on dmg
        state.enemies.splice(i, 1);
        addParticles(enemy.x, enemy.y, '#ff0000', 10);
        if (state.lives <= 0) setPhase(GamePhase.GAME_OVER);
        continue;
      }
      
      const segLen = getDistance(p1, p2);
      const realLen = Math.max(0.1, segLen);

      if (enemy.distance >= realLen) {
        enemy.pathIndex++;
        enemy.distance = 0;
        enemy.x = p2.x;
        enemy.y = p2.y;
        if (enemy.pathIndex >= path.length - 1) {
           state.lives -= 1;
           state.screenShake = 10; // Shake on dmg
           state.enemies.splice(i, 1);
           addParticles(enemy.x, enemy.y, '#ff0000', 10);
           if (state.lives <= 0) setPhase(GamePhase.GAME_OVER);
        }
      } else {
        const t = enemy.distance / realLen;
        enemy.x = p1.x + (p2.x - p1.x) * t;
        enemy.y = p1.y + (p2.y - p1.y) * t;
      }
    }

    // 2. 塔攻击
    state.grid.flat().forEach(tower => {
      if (!tower) return;
      if (tower.lastShot > 0) tower.lastShot--;
      
      if (tower.lastShot <= 0) {
        const stats = TOWER_STATS[tower.type];
        let statDmg = stats.damage * Math.pow(UPGRADE_STAT_MULTIPLIER, tower.level - 1);
        let statRange = stats.range; 
        let statCooldown = stats.cooldown;

        const target = state.enemies.find(e => getDistance(tower, e) <= (statRange + modifiers.rangeAdd));
        if (target) {
          let dmg = statDmg * modifiers.damageMul;
          if (tower.type === TowerType.SNIPER) dmg *= modifiers.sniperMul;

          // Critical Hit Logic (Phase 2)
          let isCrit = false;
          if (Math.random() < modifiers.critChance) {
             dmg *= modifiers.critDmg;
             isCrit = true;
          }

          const proj: Projectile = {
            id: Math.random().toString(),
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            speed: 0.25,
            damage: dmg,
            color: isCrit ? '#ffff00' : stats.color, // Yellow projectile for crit
            homing: true,
            splashRadius: stats.splash ? stats.splash * modifiers.splashRadiusMul : undefined,
            freezeDuration: stats.freeze
          };
          state.projectiles.push(proj);
          tower.lastShot = Math.max(5, statCooldown / modifiers.speedMul);
        }
      }
    });

    // 3. 投射物移动
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      const target = state.enemies.find(e => e.id === p.targetId);
      
      let tx = p.x, ty = p.y;
      if (p.homing && target) {
        tx = target.x;
        ty = target.y;
      } else if (p.homing && !target) {
        state.projectiles.splice(i, 1);
        addParticles(p.x, p.y, p.color, 2);
        continue;
      }
      
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < p.speed) {
        state.projectiles.splice(i, 1);
        hitEnemy(p, target, state);
      } else {
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
      }
    }

    // 4. 粒子
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  };

  const addFloatingText = (x: number, y: number, text: string, color: string, size: number = 1) => {
      gameStateRef.current.floatingTexts.push({
          id: Math.random().toString(),
          x, y, text, color, size,
          life: 40,
          vy: 0.02
      });
  };

  const hitEnemy = (proj: Projectile, target: Enemy | undefined, state: GameState) => {
    const hitEffect = (e: Enemy) => {
      // Visual: Flash White
      e.hitFlash = 5;

      // Artifact: Greed (Phase 2)
      if (modifiers.goldOnHitChance > 0 && Math.random() < modifiers.goldOnHitChance) {
          state.money += 2;
          addFloatingText(e.x, e.y - 0.5, "+$2", '#fbbf24', 0.8);
      }

      let damageDealt = proj.damage;
      
      // Artifact: Executioner (Phase 2)
      if (modifiers.executeThreshold > 0 && (e.hp / e.maxHp) < modifiers.executeThreshold && e.type !== 'BOSS') {
          damageDealt = e.hp + 10; // Ensure kill
          addFloatingText(e.x, e.y, "斩杀!", '#ef4444', 1.5);
          state.screenShake = 5;
      }

      e.hp -= damageDealt;
      
      // Visual: Damage Number
      const isCrit = proj.color === '#ffff00'; // Simple check based on projectile color set earlier
      addFloatingText(
          e.x + (Math.random() - 0.5) * 0.2, 
          e.y - 0.5, 
          Math.floor(damageDealt).toString(), 
          isCrit ? '#facc15' : '#ffffff', 
          isCrit ? 1.2 : 0.8
      );

      if (proj.freezeDuration) e.frozen = proj.freezeDuration;
      
      if (e.hp <= 0) {
        const idx = state.enemies.findIndex(en => en.id === e.id);
        if (idx !== -1) {
          state.enemies.splice(idx, 1);
          state.money += (e.type === 'BOSS' ? 50 : e.type === 'TANK' ? 10 : e.type === 'SWARM' ? 2 : 5);
          state.score += 10;
          addParticles(e.x, e.y, '#fbbf24', 5);

          // Artifact: Corpse Explosion (Phase 2)
          if (modifiers.explodeOnDeath > 0) {
              addParticles(e.x, e.y, '#ef4444', 10);
              state.screenShake = 3;
              state.enemies.forEach(other => {
                  if (getDistance(e, other) < 1.5) {
                      other.hp -= modifiers.explodeOnDeath;
                      addFloatingText(other.x, other.y, modifiers.explodeOnDeath.toString(), '#ef4444');
                  }
              });
          }
        }
      }
    };

    if (proj.splashRadius) {
      const impactX = target ? target.x : proj.x;
      const impactY = target ? target.y : proj.y;
      addParticles(impactX, impactY, proj.color, 8);
      state.screenShake = 2; // Small shake on explosion

      state.enemies.forEach(e => {
        if (getDistance({x: impactX, y: impactY}, e) <= (proj.splashRadius || 0)) {
          hitEffect(e);
        }
      });
    } else if (target) {
      hitEffect(target);
      addParticles(target.x, target.y, proj.color, 3);
    }
  };

  const addParticles = (x: number, y: number, color: string, count: number) => {
    for (let k = 0; k < count; k++) {
      gameStateRef.current.particles.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 15 + Math.random() * 15,
        color,
        size: Math.random() * 0.2 + 0.1
      });
    }
  };

  // --- 游戏流程控制 ---

  const endWave = () => {
    setPhase(GamePhase.WAVE_COMPLETE);
    generateUpgrades();
  };

  const generateUpgrades = () => {
    const shuffled = [...ROGUE_UPGRADES].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3).map(base => ({
      ...base,
      apply: (state: GameState) => {
        if (base.id === 'dmg_up') setModifiers(m => ({ ...m, damageMul: m.damageMul + 0.2 }));
        if (base.id === 'spd_up') setModifiers(m => ({ ...m, speedMul: m.speedMul + 0.15 }));
        if (base.id === 'eco_up') state.money += 150;
        if (base.id === 'rng_up') setModifiers(m => ({ ...m, rangeAdd: m.rangeAdd + 1 }));
        if (base.id === 'int_up') state.money += Math.floor(state.money * 0.1);
        if (base.id === 'sniper_buff') setModifiers(m => ({ ...m, sniperMul: m.sniperMul * 2 }));
        if (base.id === 'splash_buff') setModifiers(m => ({ ...m, splashRadiusMul: m.splashRadiusMul * 1.5 }));
        if (base.id === 'base_hp') state.lives += 5;
        
        // Phase 2 Artifacts
        if (base.id === 'execute') setModifiers(m => ({ ...m, executeThreshold: 0.15 }));
        if (base.id === 'greed') setModifiers(m => ({ ...m, goldOnHitChance: m.goldOnHitChance + 0.05 }));
        if (base.id === 'crit') setModifiers(m => ({ ...m, critChance: m.critChance + 0.15 }));
        if (base.id === 'explode') setModifiers(m => ({ ...m, explodeOnDeath: m.explodeOnDeath + 20 }));
      }
    }));
    setUpgradeOptions(picked);
  };

  // Reroll Logic (Phase 2)
  const rerollUpgrades = () => {
      if (gameStateRef.current.money >= REROLL_COST) {
          gameStateRef.current.money -= REROLL_COST;
          setUiState({...gameStateRef.current}); // Force update UI
          generateUpgrades();
      }
  };

  const selectUpgrade = (card: UpgradeCard) => {
    card.apply(gameStateRef.current);
    
    if (gameStateRef.current.wave % WAVES_PER_STAGE === 0) {
      setPhase(GamePhase.STAGE_COMPLETE);
      getWaveFlavorText(gameStateRef.current.wave).then(t => setFlavorText("区域已肃清！准备前往下一个危险地带..."));
    } else {
      setPhase(GamePhase.MENU); 
    }
  };

  const startNextWave = async () => {
    gameStateRef.current.wave += 1;
    const txt = await getWaveFlavorText(gameStateRef.current.wave);
    setFlavorText(txt);
    waveTimeRef.current = 0;
    prepareWave(gameStateRef.current.wave);
    setPhase(GamePhase.PLAYING);
  };

  const startNextStage = () => {
    const state = gameStateRef.current;
    state.grid = Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(null));
    state.path = generatePath();
    state.stage += 1;
    state.projectiles = [];
    state.particles = [];
    state.enemies = [];
    state.floatingTexts = [];
    
    setPhase(GamePhase.MENU);
    setFlavorText(`进入第 ${state.stage} 区域。新的地形，新的挑战！`);
  };

  const handleUpgradeTower = () => {
    if (!selectedPlacedTower) return;
    const state = gameStateRef.current;
    const tower = state.grid[selectedPlacedTower.y][selectedPlacedTower.x];
    if (!tower) return;

    const stats = TOWER_STATS[tower.type];
    const cost = Math.floor(stats.cost * Math.pow(UPGRADE_COST_MULTIPLIER, tower.level));

    if (state.money >= cost) {
      state.money -= cost;
      tower.level += 1;
      tower.totalInvested += cost;
      setSelectedPlacedTower({...tower}); 
      addParticles(tower.x, tower.y, '#fbbf24', 15);
    }
  };

  const handleSellTower = () => {
    if (!selectedPlacedTower) return;
    const state = gameStateRef.current;
    const tower = state.grid[selectedPlacedTower.y][selectedPlacedTower.x];
    if (!tower) return;

    const sellValue = Math.floor(tower.totalInvested * SELL_RATIO);
    state.money += sellValue;
    state.grid[selectedPlacedTower.y][selectedPlacedTower.x] = null;
    
    addParticles(selectedPlacedTower.x, selectedPlacedTower.y, '#ef4444', 10);
    setSelectedPlacedTower(null);
  };


  // --- 渲染 ---

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameStateRef.current;
    const scaleX = width / GRID_W;
    const scaleY = height / GRID_H; 

    ctx.save();
    // Apply Screen Shake (Phase 1)
    if (state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake;
        const shakeY = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // 1. 背景与地形
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // 绘制路径地板
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

    // 2. 塔 (只在可行区域绘制)
    state.grid.forEach((row, y) => {
      row.forEach((tower, x) => {
        if (tower) {
          const stats = TOWER_STATS[tower.type];
          const px = (x + 0.5) * scaleX;
          const py = (y + 0.5) * scaleY;
          
          if (selectedPlacedTower && selectedPlacedTower.x === x && selectedPlacedTower.y === y) {
             ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
             ctx.beginPath(); ctx.arc(px, py, scaleX * 0.6, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.lineWidth = 1;
             ctx.beginPath(); ctx.arc(px, py, (stats.range + modifiers.rangeAdd) * scaleX, 0, Math.PI*2); ctx.stroke();
          }

          drawSVGTower(ctx, px, py, scaleX * 0.8, tower.type, tower.level, stats.color);
        }
      });
    });

    // 3. 敌人
    state.enemies.forEach(e => {
      const px = (e.x + 0.5) * scaleX;
      const py = (e.y + 0.5) * scaleY;
      const size = scaleX * (e.type === 'BOSS' ? 1.2 : e.type === 'SWARM' ? 0.4 : 0.6);
      
      drawSVGEnemy(ctx, px, py, size, e.type, e.visualOffset, e.frozen > 0, e.hitFlash);

      const hpPct = e.hp / e.maxHp;
      const barW = scaleX * 0.8;
      ctx.fillStyle = 'red';
      ctx.fillRect(px - barW/2, py - size * 0.8, barW, 4);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(px - barW/2, py - size * 0.8, barW * hpPct, 4);
    });

    // 4. 投射物
    state.projectiles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, scaleX * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. 粒子
    state.particles.forEach(p => {
      const px = (p.x + 0.5) * scaleX;
      const py = (p.y + 0.5) * scaleY;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.beginPath(); ctx.arc(px, py, p.size * scaleX, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 6. Floating Text (Phase 1)
    state.floatingTexts.forEach(ft => {
        const px = (ft.x + 0.5) * scaleX;
        const py = (ft.y + 0.5) * scaleY;
        
        ctx.save();
        ctx.font = `bold ${Math.floor(12 * ft.size)}px 'Press Start 2P', monospace`;
        ctx.fillStyle = 'black';
        ctx.fillText(ft.text, px + 2, py + 2); // shadow
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, px, py);
        ctx.restore();
    });
    
    // 7. 建造预览
    if (hoverPos.current && selectedTowerType) {
      const { x, y } = hoverPos.current;
      if (x >= 0 && x < GRID_W && y >= 0 && y < PLAYABLE_H) {
        const cx = (x + 0.5) * scaleX;
        const cy = (y + 0.5) * scaleY;
        const stats = TOWER_STATS[selectedTowerType];
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, (stats.range + modifiers.rangeAdd) * scaleX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        const valid = isValidPlacement(x, y, gameStateRef.current);
        ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
      }
    }

    ctx.restore(); // End Screen Shake transform

    // 8. 绘制底部UI区域遮罩 (最后绘制，确保覆盖)
    const uiY = PLAYABLE_H * scaleY;
    ctx.fillStyle = '#0f172a'; // 深蓝黑
    ctx.fillRect(0, uiY, width, height - uiY);
    // 警示条纹
    ctx.fillStyle = '#1e293b';
    for(let i=0; i<width; i+=20) {
        ctx.beginPath();
        ctx.moveTo(i, uiY);
        ctx.lineTo(i+10, uiY);
        ctx.lineTo(i-10, height);
        ctx.lineTo(i-20, height);
        ctx.fill();
    }
    // 分割线
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, uiY); ctx.lineTo(width, uiY); ctx.stroke();
  };

  const isValidPlacement = (x: number, y: number, state: GameState) => {
    // 禁止在 UI 区域建造
    if (y >= PLAYABLE_H) return false;

    if (state.grid[y][x]) return false;
    for (let i=0; i < state.path.length - 1; i++) {
      const p1 = state.path[i];
      const p2 = state.path[i+1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return false;
      }
    }
    return true;
  };

  const hoverPos = useRef<{x: number, y: number} | null>(null);

  const loop = useCallback((time: number) => {
    if (phase === GamePhase.PLAYING) {
      waveTimeRef.current++;
      updatePhysics();
    }
    
    setUiState({...gameStateRef.current}); 

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.width, canvas.height);
    }
    
    requestRef.current = requestAnimationFrame(loop);
  }, [phase, modifiers, selectedTowerType, selectedPlacedTower]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  // --- 交互 ---

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
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
    
    // 如果点击了UI区域，直接忽略
    if (y >= PLAYABLE_H) {
        setSelectedPlacedTower(null);
        setSelectedTowerType(null);
        return;
    }

    const clickedTower = gameStateRef.current.grid[y][x];

    if (clickedTower) {
      setSelectedPlacedTower(clickedTower);
      setSelectedTowerType(null);
    } else if (selectedTowerType) {
      if (isValidPlacement(x, y, gameStateRef.current)) {
        const stats = TOWER_STATS[selectedTowerType];
        if (gameStateRef.current.money >= stats.cost) {
          gameStateRef.current.money -= stats.cost;
          const newTower: Tower = {
            id: Math.random().toString(),
            x, y,
            type: selectedTowerType,
            range: stats.range + modifiers.rangeAdd,
            damage: stats.damage,
            cooldown: stats.cooldown,
            lastShot: 0,
            level: 1,
            totalInvested: stats.cost
          };
          gameStateRef.current.grid[y][x] = newTower;
          setSelectedTowerType(null);
          addParticles(x, y, '#fff', 10);
        }
      }
    } else {
      setSelectedPlacedTower(null);
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

  useEffect(() => {
     getWaveFlavorText(1).then(setFlavorText);
  }, []);

  return (
    <div className="w-full h-screen bg-gray-950 flex items-center justify-center overflow-hidden relative select-none">
      <div className="relative w-full max-w-[1200px] aspect-video bg-black shadow-2xl border-2 md:border-4 border-gray-800 rounded-lg overflow-hidden">
        
        <canvas
          ref={canvasRef}
          width={GRID_W * CELL_SIZE}
          height={GRID_H * CELL_SIZE}
          className="w-full h-full block cursor-pointer"
          onClick={handleCanvasClick} 
          onMouseMove={handleMouseMove}
          onTouchStart={handleCanvasClick} 
        />

        <GameUI 
          gameState={uiState} 
          phase={phase}
          selectedTowerType={selectedTowerType}
          selectedPlacedTower={selectedPlacedTower}
          onSelectTowerType={(t) => { setSelectedTowerType(t); setSelectedPlacedTower(null); }}
          onUpgradeTower={handleUpgradeTower}
          onSellTower={handleSellTower}
          onNextWave={startNextWave}
          onNextStage={startNextStage}
          flavorText={flavorText}
        />

        {phase === GamePhase.WAVE_COMPLETE && (
          <UpgradeMenu 
            options={upgradeOptions} 
            money={uiState.money}
            onSelect={selectUpgrade} 
            onReroll={rerollUpgrades}
          />
        )}

        {phase === GamePhase.GAME_OVER && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30 text-white animate-fadeIn">
            <h1 className="text-4xl md:text-6xl text-red-500 mb-4 font-bold">任务失败</h1>
            <div className="text-center mb-8 text-gray-300">
              <p className="text-xl">存活波次: {uiState.wave - 1}</p>
              <p className="text-lg">最终得分: {uiState.score}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-white text-black font-bold hover:scale-105 transition-transform rounded"
            >
              重新开始
            </button>
          </div>
        )}
      </div>

      <div className="md:hidden fixed top-0 left-0 w-full h-full bg-black z-50 flex flex-col items-center justify-center text-white p-4 pointer-events-none opacity-0 portrait:opacity-100 portrait:pointer-events-auto transition-opacity duration-500">
        <div className="text-6xl mb-4 animate-spin-slow">⟳</div>
        <div className="text-center text-lg font-bold">请旋转手机</div>
        <div className="text-center text-gray-400 text-sm mt-2">横屏模式体验最佳</div>
      </div>
    </div>
  );
};

export default App;
