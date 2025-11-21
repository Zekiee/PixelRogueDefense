
import { 
  GameState, Enemy, Tower, Projectile, Point, GamePhase, GameModifiers, TowerType, UpgradeCard, FloatingText 
} from '../types';
import { 
  GRID_W, GRID_H, PLAYABLE_H, INITIAL_STATE, TOWER_STATS, UPGRADE_STAT_MULTIPLIER, 
  COMBO_TIMEOUT, COMBO_DAMAGE_SCALING, MAX_ENERGY, ENERGY_PER_KILL, ORBITAL_STRIKE_DAMAGE,
  SELL_RATIO, UPGRADE_COST_MULTIPLIER, ROGUE_UPGRADES, REROLL_COST, WAVES_PER_STAGE
} from '../constants';
import { getDistance } from '../utils/math';
import { generateLevelData } from './LevelGenerator';

export class GameEngine {
  public state: GameState;
  public modifiers: GameModifiers;
  
  private enemiesToSpawn: Enemy[] = [];
  private waveTime: number = 0;

  constructor() {
    const initialLevel = generateLevelData(1);
    this.state = {
      ...INITIAL_STATE,
      grid: Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(null)),
      path: initialLevel.path,
      obstacles: initialLevel.obstacles,
      enemies: [],
      projectiles: [],
      particles: [],
      floatingTexts: [],
      screenShake: 0,
      combo: 0,
      comboTimer: 0,
      energy: 0,
      orbitalStrikeTick: 0
    };
    
    this.modifiers = {
      damageMul: 1,
      rangeAdd: 0,
      speedMul: 1,
      sniperMul: 1,
      splashRadiusMul: 1,
      executeThreshold: 0,
      critChance: 0,
      critDmg: 1.5,
      goldOnHitChance: 0,
      explodeOnDeath: 0
    };
  }

  update() {
    this.waveTime++;
    this.updatePhysics();
    this.spawnEnemies();
  }

  private updatePhysics() {
    const state = this.state;

    // Decays
    if (state.screenShake > 0) {
        state.screenShake *= 0.9;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }
    if (state.orbitalStrikeTick > 0) state.orbitalStrikeTick--;
    if (state.combo > 0) {
        state.comboTimer--;
        if (state.comboTimer <= 0) {
            state.combo = 0;
            this.addFloatingText(GRID_W/2, GRID_H/2, "COMBO LOST", "#9ca3af", 1.5);
        }
    }
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= ft.vy;
        ft.life--;
        if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }

    // Enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy.frozen > 0) enemy.frozen--;
      if (enemy.hitFlash > 0) enemy.hitFlash--; 
      
      const currentSpeed = enemy.frozen > 0 ? enemy.speed * 0.5 : enemy.speed;
      enemy.distance += currentSpeed;
      enemy.visualOffset += 0.2;
      
      const path = state.path;
      const p1 = path[enemy.pathIndex];
      const p2 = path[enemy.pathIndex + 1];
      
      if (!p1 || !p2) {
        this.damageBase(i);
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
           this.damageBase(i);
        }
      } else {
        const t = enemy.distance / realLen;
        enemy.x = p1.x + (p2.x - p1.x) * t;
        enemy.y = p1.y + (p2.y - p1.y) * t;
      }
    }

    // Towers
    state.grid.flat().forEach(tower => {
      if (!tower) return;
      if (tower.lastShot > 0) tower.lastShot--;
      
      if (tower.lastShot <= 0) {
        const stats = TOWER_STATS[tower.type];
        let statDmg = stats.damage * Math.pow(UPGRADE_STAT_MULTIPLIER, tower.level - 1);
        const target = state.enemies.find(e => getDistance(tower, e) <= (stats.range + this.modifiers.rangeAdd));
        
        if (target) {
          let comboMult = 1 + (state.combo * COMBO_DAMAGE_SCALING);
          let dmg = statDmg * this.modifiers.damageMul * comboMult;
          if (tower.type === TowerType.SNIPER) dmg *= this.modifiers.sniperMul;

          let isCrit = false;
          if (Math.random() < this.modifiers.critChance) {
             dmg *= this.modifiers.critDmg;
             isCrit = true;
          }

          state.projectiles.push({
            id: Math.random().toString(),
            x: tower.x, y: tower.y,
            targetId: target.id,
            speed: 0.25,
            damage: dmg,
            color: isCrit ? '#ffff00' : stats.color,
            homing: true,
            splashRadius: stats.splash ? stats.splash * this.modifiers.splashRadiusMul : undefined,
            freezeDuration: stats.freeze
          });
          tower.lastShot = Math.max(5, stats.cooldown / this.modifiers.speedMul);
        }
      }
    });

    // Projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      const target = state.enemies.find(e => e.id === p.targetId);
      
      let tx = p.x, ty = p.y;
      if (p.homing && target) { tx = target.x; ty = target.y; }
      else if (p.homing && !target) {
        state.projectiles.splice(i, 1);
        this.addParticles(p.x, p.y, p.color, 2);
        continue;
      }
      
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < p.speed) {
        state.projectiles.splice(i, 1);
        this.hitEnemy(p, target);
      } else {
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.life--;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  private spawnEnemies() {
    if (this.enemiesToSpawn.length > 0 && this.waveTime % 40 === 0) {
        const next = this.enemiesToSpawn.shift();
        if (next) this.state.enemies.push(next);
    }
  }

  public isWaveComplete(): boolean {
      return this.enemiesToSpawn.length === 0 && this.state.enemies.length === 0;
  }

  public prepareWave(wave: number) {
    const count = 5 + Math.floor(wave * 1.5);
    const queue: Enemy[] = [];
    const isBossWave = wave % 5 === 0;

    for (let i = 0; i < count; i++) {
      let type: Enemy['type'] = 'BASIC';
      let hp = 20 * (1 + wave * 0.3);
      let speed = 0.04;
      const rand = Math.random();

      if (isBossWave && i === count - 1) {
        type = 'BOSS'; hp *= 15; speed = 0.015;
      } else if (rand > 0.9) {
        type = 'TANK'; hp *= 3; speed = 0.02;
      } else if (rand > 0.7) {
        type = 'FAST'; hp *= 0.6; speed = 0.07;
      } else if (rand > 0.5 && wave > 3) {
        type = 'SWARM'; hp *= 0.3; speed = 0.06;
      }

      queue.push({
        id: Math.random().toString(36),
        x: this.state.path[0].x,
        y: this.state.path[0].y,
        pathIndex: 0, distance: 0, speed, maxHp: hp, hp,
        frozen: 0, hitFlash: 0, type, visualOffset: Math.random() * 100
      });
    }
    this.enemiesToSpawn = queue;
    this.waveTime = 0;
  }

  private damageBase(enemyIndex: number) {
      this.state.lives -= 1;
      this.state.screenShake = 10;
      const e = this.state.enemies[enemyIndex];
      this.addParticles(e.x, e.y, '#ff0000', 10);
      this.state.enemies.splice(enemyIndex, 1);
      this.state.combo = 0;
      this.state.comboTimer = 0;
  }

  private hitEnemy(proj: Projectile, target: Enemy | undefined) {
    const hitEffect = (e: Enemy) => {
      e.hitFlash = 5;
      if (this.modifiers.goldOnHitChance > 0 && Math.random() < this.modifiers.goldOnHitChance) {
          this.state.money += 2;
          this.addFloatingText(e.x, e.y - 0.5, "+$2", '#fbbf24', 0.8);
      }

      let damageDealt = proj.damage;
      if (this.modifiers.executeThreshold > 0 && (e.hp / e.maxHp) < this.modifiers.executeThreshold && e.type !== 'BOSS') {
          damageDealt = e.hp + 10; 
          this.addFloatingText(e.x, e.y, "斩杀!", '#ef4444', 1.5);
          this.state.screenShake = 5;
      }

      e.hp -= damageDealt;
      const isCrit = proj.color === '#ffff00';
      this.addFloatingText(e.x + (Math.random() - 0.5) * 0.2, e.y - 0.5, Math.floor(damageDealt).toString(), isCrit ? '#facc15' : '#ffffff', isCrit ? 1.2 : 0.8);

      if (proj.freezeDuration) e.frozen = proj.freezeDuration;
      if (e.hp <= 0) this.handleEnemyDeath(e);
    };

    if (proj.splashRadius) {
      const impactX = target ? target.x : proj.x;
      const impactY = target ? target.y : proj.y;
      this.addParticles(impactX, impactY, proj.color, 8);
      this.state.screenShake = 2; 
      this.state.enemies.forEach(e => {
        if (getDistance({x: impactX, y: impactY}, e) <= (proj.splashRadius || 0)) hitEffect(e);
      });
    } else if (target) {
      hitEffect(target);
      this.addParticles(target.x, target.y, proj.color, 3);
    }
  }

  private handleEnemyDeath(e: Enemy) {
     const idx = this.state.enemies.findIndex(en => en.id === e.id);
     if (idx === -1) return;
     this.state.enemies.splice(idx, 1);

     this.state.money += (e.type === 'BOSS' ? 50 : e.type === 'TANK' ? 10 : e.type === 'SWARM' ? 2 : 5);
     this.state.score += 10;
     this.addParticles(e.x, e.y, '#fbbf24', 5);
     
     this.state.combo += 1;
     this.state.comboTimer = COMBO_TIMEOUT;
     this.state.energy = Math.min(MAX_ENERGY, this.state.energy + ENERGY_PER_KILL);

     if (this.state.combo % 10 === 0) {
         this.addFloatingText(e.x, e.y - 1, `${this.state.combo} COMBO!`, '#f472b6', 1.2);
     }
     
     if (this.modifiers.explodeOnDeath > 0) {
        this.addParticles(e.x, e.y, '#ef4444', 10);
        this.state.screenShake = 3;
        this.state.enemies.forEach(other => {
            if (getDistance(e, other) < 1.5) {
                other.hp -= this.modifiers.explodeOnDeath;
                this.addFloatingText(other.x, other.y, this.modifiers.explodeOnDeath.toString(), '#ef4444');
            }
        });
     }
  }

  public activateOrbitalStrike() {
      if (this.state.energy < MAX_ENERGY) return;
      this.state.energy = 0;
      this.state.screenShake = 20;
      this.state.orbitalStrikeTick = 30;
      
      this.state.enemies.forEach(e => {
          e.hp -= ORBITAL_STRIKE_DAMAGE;
          e.hitFlash = 20;
          this.addFloatingText(e.x, e.y, ORBITAL_STRIKE_DAMAGE.toString(), '#ef4444', 2.0);
          this.addParticles(e.x, e.y, '#ef4444', 15);
          if (e.hp <= 0) this.handleEnemyDeath(e);
      });
  }

  public nextStage(): number {
    let recoveredMoney = 0;
    this.state.projectiles = [];
    this.state.enemies = [];
    this.state.floatingTexts = [];
    this.state.particles = [];
    this.state.combo = 0;
    this.state.comboTimer = 0;

    this.state.grid.forEach((row, y) => {
        row.forEach((tower, x) => {
            if (tower) {
                const sellValue = Math.floor(tower.totalInvested * SELL_RATIO);
                this.state.money += sellValue;
                recoveredMoney += sellValue;
                this.addFloatingText(x, y, `+$${sellValue}`, '#fbbf24', 1.2);
                this.addParticles(x, y, '#ef4444', 8);
            }
        });
    });

    this.state.grid = Array(GRID_H).fill(null).map(() => Array(GRID_W).fill(null));
    const nextLevel = generateLevelData(this.state.stage + 1);
    this.state.path = nextLevel.path;
    this.state.obstacles = nextLevel.obstacles;
    this.state.stage += 1;
    
    return recoveredMoney;
  }

  public placeTower(x: number, y: number, type: TowerType): boolean {
      if (!this.isValidPlacement(x, y)) return false;
      const stats = TOWER_STATS[type];
      if (this.state.money < stats.cost) return false;

      this.state.money -= stats.cost;
      this.state.grid[y][x] = {
          id: Math.random().toString(),
          x, y, type,
          range: stats.range + this.modifiers.rangeAdd,
          damage: stats.damage,
          cooldown: stats.cooldown,
          lastShot: 0, level: 1, totalInvested: stats.cost
      };
      this.addParticles(x, y, '#fff', 10);
      return true;
  }

  public upgradeTower(x: number, y: number): boolean {
      const tower = this.state.grid[y][x];
      if (!tower) return false;
      const stats = TOWER_STATS[tower.type];
      const cost = Math.floor(stats.cost * Math.pow(UPGRADE_COST_MULTIPLIER, tower.level));
      
      if (this.state.money >= cost) {
          this.state.money -= cost;
          tower.level += 1;
          tower.totalInvested += cost;
          this.addParticles(tower.x, tower.y, '#fbbf24', 15);
          return true;
      }
      return false;
  }

  public sellTower(x: number, y: number) {
      const tower = this.state.grid[y][x];
      if (!tower) return;
      const sellValue = Math.floor(tower.totalInvested * SELL_RATIO);
      this.state.money += sellValue;
      this.state.grid[y][x] = null;
      this.addParticles(x, y, '#ef4444', 10);
  }

  public isValidPlacement(x: number, y: number): boolean {
    if (y >= PLAYABLE_H) return false;
    if (this.state.obstacles.some(o => o.x === x && o.y === y)) return false;
    if (this.state.grid[y][x]) return false;
    for (let i=0; i < this.state.path.length - 1; i++) {
      const p1 = this.state.path[i];
      const p2 = this.state.path[i+1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return false;
    }
    return true;
  }

  public getUpgradeOptions(): UpgradeCard[] {
    const shuffled = [...ROGUE_UPGRADES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(base => ({
        ...base,
        apply: (s: GameState, m: GameModifiers) => {
             if (base.id === 'dmg_up') m.damageMul += 0.2;
             if (base.id === 'spd_up') m.speedMul += 0.15;
             if (base.id === 'eco_up') s.money += 150;
             if (base.id === 'rng_up') m.rangeAdd += 1;
             if (base.id === 'int_up') s.money += Math.floor(s.money * 0.1);
             if (base.id === 'sniper_buff') m.sniperMul *= 2;
             if (base.id === 'splash_buff') m.splashRadiusMul *= 1.5;
             if (base.id === 'base_hp') s.lives += 5;
             if (base.id === 'execute') m.executeThreshold = 0.15;
             if (base.id === 'greed') m.goldOnHitChance += 0.05;
             if (base.id === 'crit') m.critChance += 0.15;
             if (base.id === 'explode') m.explodeOnDeath += 20;
        }
    }));
  }

  public rerollUpgrades(): UpgradeCard[] | null {
      if (this.state.money >= REROLL_COST) {
          this.state.money -= REROLL_COST;
          return this.getUpgradeOptions();
      }
      return null;
  }

  private addParticles(x: number, y: number, color: string, count: number) {
    for (let k = 0; k < count; k++) {
      this.state.particles.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 15 + Math.random() * 15,
        color,
        size: Math.random() * 0.2 + 0.1
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size: number = 1) {
    this.state.floatingTexts.push({
        id: Math.random().toString(),
        x, y, text, color, size, life: 60, vy: 0.03
    });
  }
}
