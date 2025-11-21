
import { TowerType, UpgradeCard, TowerStats } from './types';

export const GRID_W = 16;
export const GRID_H = 9;
export const CELL_SIZE = 64;
export const FPS = 60;

// Layout Constants
export const UI_ROWS = 2; // 底部保留给UI的行数
export const PLAYABLE_H = GRID_H - UI_ROWS; // 实际游戏区域高度

export const SELL_RATIO = 0.7; // Sell returns 70% of value
export const REROLL_COST = 50; // Cost to refresh upgrades
export const UPGRADE_COST_MULTIPLIER = 1.5; // Cost increases by 50% each level
export const UPGRADE_STAT_MULTIPLIER = 1.25; // Stats increase by 25% each level
export const WAVES_PER_STAGE = 5; // New map every 5 waves

// Combo System
export const COMBO_TIMEOUT = 180; // 3 seconds to keep combo alive
export const COMBO_DAMAGE_SCALING = 0.02; // +2% damage per combo count
export const MAX_ENERGY = 100;
export const ENERGY_PER_KILL = 5;
export const ORBITAL_STRIKE_DAMAGE = 500;

export const TOWER_STATS: Record<TowerType, TowerStats> = {
  [TowerType.ARCHER]: {
    name: "游侠塔",
    cost: 50,
    range: 3.5,
    damage: 15,
    cooldown: 40,
    color: '#34d399',
    desc: "均衡的单体输出。"
  },
  [TowerType.CANNON]: {
    name: "迫击炮",
    cost: 120,
    range: 3,
    damage: 40,
    cooldown: 90,
    color: '#f87171',
    splash: 1.5,
    desc: "造成范围爆炸伤害。"
  },
  [TowerType.MAGE]: {
    name: "冰霜塔",
    cost: 150,
    range: 4,
    damage: 10,
    cooldown: 30,
    color: '#60a5fa',
    freeze: 30,
    desc: "减缓敌人移动速度。"
  },
  [TowerType.SNIPER]: {
    name: "狙击塔",
    cost: 250,
    range: 8,
    damage: 150,
    cooldown: 180,
    color: '#c084fc',
    desc: "超远射程，致命一击。"
  }
};

export const ROGUE_UPGRADES: Omit<UpgradeCard, 'apply'>[] = [
  { id: 'dmg_up', title: '精钢箭头', description: '所有防御塔伤害 +20%', rarity: 'COMMON' },
  { id: 'spd_up', title: '机械润滑', description: '所有防御塔攻速 +15%', rarity: 'COMMON' },
  { id: 'eco_up', title: '皇家拨款', description: '立即获得 150 金币', rarity: 'COMMON' },
  { id: 'rng_up', title: '高塔瞭望', description: '所有防御塔射程 +1', rarity: 'RARE' },
  { id: 'int_up', title: '地精投资', description: '每波结束获得 10% 当前金币利息', rarity: 'RARE' },
  { id: 'sniper_buff', title: '弱点看破', description: '狙击手造成双倍伤害', rarity: 'LEGENDARY' },
  { id: 'splash_buff', title: '高爆炸药', description: '迫击炮爆炸范围扩大 50%', rarity: 'RARE' },
  { id: 'base_hp', title: '城墙修补', description: '恢复 5 点生命值', rarity: 'COMMON' },
  // Phase 2 New Artifacts
  { id: 'execute', title: '处决之刃', description: '立即斩杀生命值低于 15% 的敌人', rarity: 'LEGENDARY' },
  { id: 'greed', title: '贪婪之手', description: '攻击时有 5% 概率获得 2 金币', rarity: 'RARE' },
  { id: 'crit', title: '致命节奏', description: '所有攻击获得 15% 暴击率 (150% 伤害)', rarity: 'RARE' },
  { id: 'explode', title: '尸体爆炸', description: '敌人死亡时对周围造成 20 点范围伤害', rarity: 'LEGENDARY' },
];

export const INITIAL_STATE = {
  money: 650,
  lives: 20,
  wave: 1,
  stage: 1,
  score: 0
};
