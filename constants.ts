import { Point, TowerType, UpgradeCard, TowerStats } from './types';

export const GRID_W = 16;
export const GRID_H = 9;
export const CELL_SIZE = 64; // Virtual pixel size, scaled by canvas
export const FPS = 60;

// A winding path for enemies
export const MAP_PATH: Point[] = [
  { x: 0, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 6 },
  { x: 8, y: 6 },
  { x: 8, y: 2 },
  { x: 12, y: 2 },
  { x: 12, y: 7 },
  { x: 15, y: 7 },
  { x: 15, y: 4 },
  { x: 16, y: 4 } // Exit
];

export const TOWER_STATS: Record<TowerType, TowerStats> = {
  [TowerType.ARCHER]: {
    name: "Archer",
    cost: 50,
    range: 3.5,
    damage: 15,
    cooldown: 40, // Frames
    color: '#34d399', // Emerald
    desc: "Fast firing, single target."
  },
  [TowerType.CANNON]: {
    name: "Cannon",
    cost: 120,
    range: 3,
    damage: 40,
    cooldown: 90,
    color: '#f87171', // Red
    splash: 1.5,
    desc: "High damage, splash area."
  },
  [TowerType.MAGE]: {
    name: "Ice Mage",
    cost: 150,
    range: 4,
    damage: 10,
    cooldown: 30,
    color: '#60a5fa', // Blue
    freeze: 30,
    desc: "Slows enemies."
  },
  [TowerType.SNIPER]: {
    name: "Sniper",
    cost: 250,
    range: 8,
    damage: 150,
    cooldown: 180,
    color: '#c084fc', // Purple
    desc: "Infinite range, massive damage."
  }
};

export const ROGUE_UPGRADES: Omit<UpgradeCard, 'apply'>[] = [
  { id: 'dmg_up', title: 'Sharp Arrows', description: 'All towers gain +20% damage.', rarity: 'COMMON' },
  { id: 'spd_up', title: 'Rapid Fire', description: 'All towers attack 15% faster.', rarity: 'COMMON' },
  { id: 'eco_up', title: 'Gold Rush', description: 'Gain +100 Gold immediately.', rarity: 'COMMON' },
  { id: 'rng_up', title: 'Eagle Eye', description: 'All towers range +1.', rarity: 'RARE' },
  { id: 'int_up', title: 'Compound Interest', description: 'Gain 10% of current gold.', rarity: 'RARE' },
  { id: 'sniper_buff', title: 'Headshot', description: 'Snipers deal double damage.', rarity: 'LEGENDARY' },
  { id: 'base_hp', title: 'Fortification', description: 'Repair 5 base lives.', rarity: 'COMMON' },
];

export const INITIAL_STATE = {
  money: 1200,
  lives: 20,
  wave: 1,
  score: 0
};