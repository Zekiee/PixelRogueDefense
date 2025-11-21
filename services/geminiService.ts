// 预设的波次提示文本，替代AI生成
const FLAVOR_TEXTS_NORMAL = [
    "敌人正在集结...",
    "一大波怪物正在靠近！",
    "注意防御，保护核心！",
    "听到了怪物的嘶吼声...",
    "不要放松警惕！",
    "这一波看起来很强...",
    "准备迎接战斗！",
    "保持阵型，敌人来了！"
];

const FLAVOR_TEXTS_BOSS = [
    "警告：Boss 即将降临！",
    "巨大的威胁正在逼近！",
    "决战时刻！",
    "由于Boss的出现，大地在震颤..."
];

export const getWaveFlavorText = async (wave: number): Promise<string> => {
  // 模拟异步延迟，保持接口一致
  return new Promise((resolve) => {
    let text = "";
    if (wave % 5 === 0) {
        text = FLAVOR_TEXTS_BOSS[Math.floor(Math.random() * FLAVOR_TEXTS_BOSS.length)];
    } else {
        text = FLAVOR_TEXTS_NORMAL[Math.floor(Math.random() * FLAVOR_TEXTS_NORMAL.length)];
    }
    resolve(text);
  });
};