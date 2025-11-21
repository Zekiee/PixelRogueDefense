
import React from 'react';
import { UpgradeCard } from '../types';
import { REROLL_COST } from '../constants';

interface Props {
  options: UpgradeCard[];
  money: number;
  onSelect: (card: UpgradeCard) => void;
  onReroll: () => void;
}

export const UpgradeMenu: React.FC<Props> = ({ options, money, onSelect, onReroll }) => {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'COMMON': return 'border-gray-400 text-gray-100';
      case 'RARE': return 'border-blue-400 text-blue-100 shadow-[0_0_15px_rgba(96,165,250,0.5)]';
      case 'LEGENDARY': return 'border-yellow-400 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.7)]';
      default: return 'border-white';
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 animate-fadeIn p-2 md:p-4">
      <div className="flex items-center justify-between w-full max-w-4xl mb-4 px-4">
         <div className="text-left">
            <h2 className="text-xl md:text-3xl text-white" style={{ textShadow: '2px 2px 0 #000' }}>
              关卡清除
            </h2>
            <p className="text-gray-400 text-xs">选择一件神器</p>
         </div>
         <div className="text-yellow-400 font-bold text-lg flex items-center gap-2">
            <span>持有金币: ${Math.floor(money)}</span>
         </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-4xl h-full max-h-[60vh] md:max-h-none mb-4">
        {options.map((card) => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className={`
              relative group p-2 md:p-6 border-2 md:border-4 bg-gray-900 
              flex flex-col items-center justify-center text-center gap-1 md:gap-4
              transition-transform hover:scale-105 active:scale-95
              ${getRarityColor(card.rarity)}
            `}
          >
            <div className="text-[8px] md:text-xs uppercase tracking-widest opacity-70">{card.rarity}</div>
            <div className="text-xs md:text-xl font-bold whitespace-pre-wrap">{card.title}</div>
            <div className="text-[8px] md:text-xs leading-3 md:leading-5">{card.description}</div>
            
            {/* 像素角落装饰 */}
            <div className="absolute top-0 left-0 w-1 h-1 md:w-2 md:h-2 bg-current"></div>
            <div className="absolute top-0 right-0 w-1 h-1 md:w-2 md:h-2 bg-current"></div>
            <div className="absolute bottom-0 left-0 w-1 h-1 md:w-2 md:h-2 bg-current"></div>
            <div className="absolute bottom-0 right-0 w-1 h-1 md:w-2 md:h-2 bg-current"></div>
          </button>
        ))}
      </div>

      <button
        onClick={onReroll}
        disabled={money < REROLL_COST}
        className={`
            px-8 py-3 rounded border-2 font-bold transition-all flex items-center gap-2
            ${money >= REROLL_COST 
              ? 'bg-indigo-600 border-indigo-400 hover:bg-indigo-500 text-white' 
              : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'}
        `}
      >
        <span>🎲 刷新重置</span>
        <span className={money >= REROLL_COST ? "text-yellow-300" : "text-gray-500"}>-${REROLL_COST}</span>
      </button>
    </div>
  );
};
