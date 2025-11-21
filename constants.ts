import { Point, TowerType, UpgradeCard, TowerStats } from './types';

export const GRID_W = 16;
export const GRID_H = 9;
export const CELL_SIZE = 64; // 虚拟像素大小，会被Canvas缩放
export const FPS = 60;

// 敌人的移动路径
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
  { x: 16, y: 4 } // 出口
];

export const TOWER_STATS: Record<TowerType, TowerStats> = {
  [TowerType.ARCHER]: {
    name: "弓箭手",
    cost: 50,
    range: 3.5,
    damage: 15,
    cooldown: 40, // 帧数
    color: '#34d399', // 翡翠绿
    desc: "射速快，单体伤害。"
  },
  [TowerType.CANNON]: {
    name: "加农炮",
    cost: 120,
    range: 3,
    damage: 40,
    cooldown: 90,
    color: '#f87171', // 红色
    splash: 1.5,
    desc: "高伤害，范围溅射。"
  },
  [TowerType.MAGE]: {
    name: "冰法师",
    cost: 150,
    range: 4,
    damage: 10,
    cooldown: 30,
    color: '#60a5fa', // 蓝色
    freeze: 30,
    desc: "减缓敌人移动速度。"
  },
  [TowerType.SNIPER]: {
    name: "狙击手",
    cost: 250,
    range: 8,
    damage: 150,
    cooldown: 180,
    color: '#c084fc', // 紫色
    desc: "无限射程，巨额伤害。"
  }
};

export const ROGUE_UPGRADES: Omit<UpgradeCard, 'apply'>[] = [
  { id: 'dmg_up', title: '锐利箭矢', description: '所有防御塔伤害 +20%', rarity: 'COMMON' },
  { id: 'spd_up', title: '急速射击', description: '所有防御塔攻速 +15%', rarity: 'COMMON' },
  { id: 'eco_up', title: '淘金热', description: '立即获得 100 金币', rarity: 'COMMON' },
  { id: 'rng_up', title: '鹰眼', description: '所有防御塔射程 +1', rarity: 'RARE' },
  { id: 'int_up', title: '复利', description: '获得当前金币的 10%', rarity: 'RARE' },
  { id: 'sniper_buff', title: '爆头', description: '狙击手造成双倍伤害', rarity: 'LEGENDARY' },
  { id: 'base_hp', title: '基地加固', description: '修复 5 点生命值', rarity: 'COMMON' },
];

export const INITIAL_STATE = {
  money: 1200,
  lives: 20,
  wave: 1,
  score: 0
};