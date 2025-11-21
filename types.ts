
export enum GamePhase {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  WAVE_COMPLETE = 'WAVE_COMPLETE', // Choosing upgrade
  STAGE_COMPLETE = 'STAGE_COMPLETE', // New Map Transition
  GAME_OVER = 'GAME_OVER'
}

export enum TowerType {
  ARCHER = 'ARCHER',
  CANNON = 'CANNON',
  MAGE = 'MAGE',
  SNIPER = 'SNIPER'
}

export interface TowerStats {
  name: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  desc: string;
  splash?: number;
  freeze?: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // frames
  vy: number;
  size: number;
}

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number; // Current segment of path
  distance: number; // Distance traveled along current segment
  frozen: number; // Freeze ticks remaining
  hitFlash: number; // Frames to flash white
  type: 'BASIC' | 'FAST' | 'TANK' | 'SWARM' | 'BOSS';
  visualOffset: number; // For animation wobble
}

export interface Tower extends Entity {
  type: TowerType;
  range: number;
  damage: number;
  cooldown: number;
  lastShot: number;
  level: number;
  totalInvested: number; // For sell calculation
}

export interface Projectile extends Entity {
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  splashRadius?: number;
  freezeDuration?: number;
  homing: boolean;
}

export interface Particle extends Entity {
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  money: number;
  lives: number;
  wave: number;
  stage: number; // Current Map Level
  score: number;
  grid: (Tower | null)[][];
  path: Point[]; // Dynamic path for current stage
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  screenShake: number;
}

export interface UpgradeCard {
  id: string;
  title: string;
  description: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  apply: (state: GameState) => void;
}
