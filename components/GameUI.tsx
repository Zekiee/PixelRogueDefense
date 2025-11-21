
import React from 'react';
import { GamePhase, GameState, TowerType, Tower } from '../types';
import { TOWER_STATS, SELL_RATIO, UPGRADE_COST_MULTIPLIER, MAX_ENERGY, COMBO_TIMEOUT, COMBO_DAMAGE_SCALING } from '../constants';

interface Props {
  gameState: GameState;
  phase: GamePhase;
  selectedTowerType: TowerType | null;
  selectedPlacedTower: Tower | null;
  onSelectTowerType: (type: TowerType | null) => void;
  onUpgradeTower: () => void;
  onSellTower: () => void;
  onNextWave: () => void;
  onNextStage: () => void;
  onOrbitalStrike: () => void;
  onToggleFullscreen: () => void; // New prop
  flavorText: string;
}

export const GameUI: React.FC<Props> = ({ 
  gameState, 
  phase, 
  selectedTowerType, 
  selectedPlacedTower,
  onSelectTowerType, 
  onUpgradeTower,
  onSellTower,
  onNextWave,
  onNextStage,
  onOrbitalStrike,
  onToggleFullscreen,
  flavorText
}) => {
  
  const getUpgradeInfo = () => {
    if (!selectedPlacedTower) return null;
    const stats = TOWER_STATS[selectedPlacedTower.type];
    const upgradeCost = Math.floor(stats.cost * Math.pow(UPGRADE_COST_MULTIPLIER, selectedPlacedTower.level));
    const sellValue = Math.floor(selectedPlacedTower.totalInvested * SELL_RATIO);
    return { upgradeCost, sellValue, name: stats.name };
  };

  const upgradeInfo = getUpgradeInfo();

  // Calculate combo bar percentage
  const comboPercent = (gameState.comboTimer / COMBO_TIMEOUT) * 100;
  const energyPercent = (gameState.energy / MAX_ENERGY) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 select-none">
      {/* 顶部信息栏 */}
      <div className="flex flex-col w-full pointer-events-auto gap-2">
        <div className="flex justify-between items-start">
             <div className="flex gap-3 text-white text-xs md:text-sm bg-black/60 p-2 rounded-lg border border-white/20 backdrop-blur-sm shadow-lg">
                <div className="flex items-center gap-1"><span className="text-red-500 text-lg">♥</span> {gameState.lives}</div>
                <div className="flex items-center gap-1"><span className="text-yellow-400 text-lg">$</span> {Math.floor(gameState.money)}</div>
                <div className="flex items-center gap-1 text-blue-300">
                    <span>关卡 {gameState.stage}</span>
                    <span className="text-gray-500">|</span>
                    <span>波次 {gameState.wave}</span>
                </div>
            </div>

            <div className="flex gap-2">
              {/* 全屏按钮 */}
              <button 
                onClick={onToggleFullscreen}
                className="w-8 h-8 md:w-10 md:h-10 bg-gray-800/80 border border-gray-500 text-white rounded hover:bg-gray-700 flex items-center justify-center text-sm md:text-lg"
                title="全屏显示"
              >
                ⛶
              </button>

              {/* 大招按钮 */}
              <button 
                  onClick={onOrbitalStrike}
                  disabled={gameState.energy < MAX_ENERGY || phase !== GamePhase.PLAYING}
                  className={`
                      relative overflow-hidden rounded-full w-12 h-12 md:w-16 md:h-16 border-2 shadow-[0_0_15px_rgba(255,0,0,0.5)]
                      transition-all duration-300 flex items-center justify-center flex-col
                      ${gameState.energy >= MAX_ENERGY 
                          ? 'bg-red-600 border-red-400 text-white hover:scale-110 cursor-pointer animate-pulse' 
                          : 'bg-gray-800 border-gray-600 text-gray-500 opacity-80'}
                  `}
              >
                  <span className="text-xs md:text-xl relative z-10">🚀</span>
                  <div 
                      className="absolute bottom-0 left-0 w-full bg-yellow-400/30 z-0 transition-all duration-200"
                      style={{ height: `${energyPercent}%` }}
                  />
                  <span className="text-[8px] md:text-[10px] font-bold relative z-10">
                      {gameState.energy >= MAX_ENERGY ? 'READY' : `${Math.floor(energyPercent)}%`}
                  </span>
              </button>
            </div>
        </div>

        {/* Combo 连击条 */}
        {gameState.combo > 0 && (
            <div className="self-start mt-2 flex flex-col animate-slideInLeft">
                <div className="flex items-end gap-2">
                    <span className="text-3xl md:text-4xl font-bold text-yellow-400 italic" style={{textShadow: '3px 3px 0 #b91c1c'}}>
                        {gameState.combo}
                    </span>
                    <span className="text-white text-sm font-bold mb-1">COMBO!</span>
                    <span className="text-green-400 text-xs mb-1">
                        (+{Math.floor(gameState.combo * COMBO_DAMAGE_SCALING * 100)}% 伤害)
                    </span>
                </div>
                <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden border border-white/20">
                    <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-red-600 transition-all duration-75 ease-linear"
                        style={{ width: `${comboPercent}%` }}
                    />
                </div>
            </div>
        )}
        
        {(phase === GamePhase.MENU || phase === GamePhase.PLAYING) && (
          <div className="self-center bg-black/60 text-white px-3 py-2 text-xs md:text-sm border border-white/10 rounded-lg max-w-[300px] text-center italic mt-2">
            "{flavorText}"
          </div>
        )}
      </div>

      {/* 底部控制区域 */}
      <div className="pointer-events-auto flex flex-col items-center w-full gap-2">
        
        {phase === GamePhase.MENU && (
             <button 
             onClick={onNextWave}
             className="mb-2 bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:translate-y-1 px-6 py-2 md:px-12 md:py-3 font-bold text-sm md:text-lg rounded shadow-lg animate-pulse"
           >
             ⚔️ 开始战斗
           </button>
        )}

        {phase === GamePhase.STAGE_COMPLETE && (
             <button 
             onClick={onNextStage}
             className="mb-2 bg-purple-600 hover:bg-purple-500 text-white border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 px-6 py-2 md:px-12 md:py-3 font-bold text-sm md:text-lg rounded shadow-lg animate-bounce"
           >
             🗺️ 前往下一区域
           </button>
        )}

        <div className="w-full max-w-3xl bg-gray-900/90 border-t-2 border-gray-600 p-2 md:p-3 rounded-t-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
          
          {selectedPlacedTower && upgradeInfo ? (
            // --- 升级/出售界面 ---
            <div className="flex w-full justify-between items-center animate-slideUp">
              <div className="text-white flex flex-col">
                <span className="font-bold text-yellow-400">{upgradeInfo.name} (Lv.{selectedPlacedTower.level})</span>
                <span className="text-xs text-gray-400">已投入: ${Math.floor(selectedPlacedTower.totalInvested)}</span>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={onSellTower}
                  className="flex flex-col items-center bg-red-900/80 hover:bg-red-800 p-2 rounded border border-red-500 text-white text-xs md:text-sm min-w-[80px]"
                >
                  <span>出售</span>
                  <span className="text-yellow-300">+${upgradeInfo.sellValue}</span>
                </button>

                <button 
                  onClick={onUpgradeTower}
                  disabled={gameState.money < upgradeInfo.upgradeCost}
                  className={`flex flex-col items-center p-2 rounded border text-white text-xs md:text-sm min-w-[100px]
                    ${gameState.money >= upgradeInfo.upgradeCost 
                      ? 'bg-blue-600 hover:bg-blue-500 border-blue-400' 
                      : 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'}`}
                >
                  <span>升级</span>
                  <span className="text-yellow-300">-${upgradeInfo.upgradeCost}</span>
                </button>
                
                <button 
                  onClick={() => onSelectTowerType(null)} 
                  className="px-4 py-2 bg-gray-700 text-white rounded border border-gray-500 text-xs"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            // --- 建造栏 ---
            <div className="flex gap-2 overflow-x-auto w-full justify-center">
              {(Object.keys(TOWER_STATS) as TowerType[]).map((type) => {
                const stats = TOWER_STATS[type];
                const canAfford = gameState.money >= stats.cost;
                const isSelected = selectedTowerType === type;
                
                return (
                  <button
                    key={type}
                    onClick={() => onSelectTowerType(isSelected ? null : type)}
                    disabled={!canAfford}
                    className={`
                      relative group flex flex-col items-center justify-center w-14 h-14 md:w-20 md:h-20 p-1
                      border-2 rounded transition-all shrink-0
                      ${isSelected ? 'border-white bg-white/20 -translate-y-1 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-gray-600 bg-gray-800'}
                      ${!canAfford ? 'opacity-40 grayscale' : 'hover:border-gray-400 hover:bg-gray-700'}
                    `}
                  >
                    <div 
                      className="w-4 h-4 md:w-8 md:h-8 mb-1 rounded-sm shadow-sm"
                      style={{ backgroundColor: stats.color }}
                    ></div>
                    <div className="text-[9px] md:text-[10px] text-white text-center font-bold leading-none">
                      {stats.name}
                    </div>
                    <div className="text-[9px] md:text-xs text-yellow-400 font-mono">
                      ${stats.cost}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
