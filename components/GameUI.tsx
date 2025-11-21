import React from 'react';
import { GamePhase, GameState, TowerType } from '../types';
import { TOWER_STATS } from '../constants';

interface Props {
  gameState: GameState;
  phase: GamePhase;
  selectedTower: TowerType | null;
  onSelectTower: (type: TowerType) => void;
  onNextWave: () => void;
  flavorText: string;
}

export const GameUI: React.FC<Props> = ({ 
  gameState, 
  phase, 
  selectedTower, 
  onSelectTower, 
  onNextWave,
  flavorText
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4">
      {/* 顶部信息栏 */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="flex gap-4 text-white text-xs md:text-sm bg-black/50 p-2 rounded border border-white/20 backdrop-blur-sm">
          <div className="text-red-400">♥ {gameState.lives}</div>
          <div className="text-yellow-400">$ {Math.floor(gameState.money)}</div>
          <div className="text-blue-400">波次 {gameState.wave}</div>
          <div className="text-gray-400">分数 {gameState.score}</div>
        </div>
        
        {phase === GamePhase.PLAYING && (
          <div className="bg-black/60 text-white px-3 py-1 text-[10px] md:text-xs border border-white/10 rounded max-w-[200px] text-right">
            {flavorText}
          </div>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className="pointer-events-auto flex flex-col gap-2 items-center w-full">
        {/* 开始按钮 */}
        {phase === GamePhase.MENU && (
             <button 
             onClick={onNextWave}
             className="mb-4 bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:translate-y-1 px-8 py-3 font-bold text-sm md:text-base animate-bounce"
           >
             开始第一波
           </button>
        )}
        
        {(phase === GamePhase.MENU || phase === GamePhase.PLAYING) && (
          <div className="flex gap-2 overflow-x-auto max-w-full p-2 bg-black/80 rounded border border-white/20">
            {(Object.keys(TOWER_STATS) as TowerType[]).map((type) => {
              const stats = TOWER_STATS[type];
              const canAfford = gameState.money >= stats.cost;
              const isSelected = selectedTower === type;
              
              return (
                <button
                  key={type}
                  onClick={() => onSelectTower(type)}
                  disabled={!canAfford}
                  className={`
                    relative flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 p-1
                    border-2 transition-all shrink-0
                    ${isSelected ? 'border-white bg-white/20 -translate-y-2' : 'border-gray-600 bg-gray-900'}
                    ${!canAfford ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-gray-400'}
                  `}
                >
                  {/* 塔图标颜色块 */}
                  <div 
                    className="w-6 h-6 md:w-8 md:h-8 mb-1 shadow-inner"
                    style={{ backgroundColor: stats.color }}
                  ></div>
                  <div className="text-[8px] md:text-[10px] text-white text-center leading-tight">
                    {stats.name}<br/>
                    <span className="text-yellow-300">${stats.cost}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};