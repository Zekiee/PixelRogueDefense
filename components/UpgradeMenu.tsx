import React from 'react';
import { UpgradeCard } from '../types';

interface Props {
  options: UpgradeCard[];
  onSelect: (card: UpgradeCard) => void;
}

export const UpgradeMenu: React.FC<Props> = ({ options, onSelect }) => {
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
      <h2 className="text-xl md:text-3xl text-white mb-2 md:mb-8 text-center" style={{ textShadow: '2px 2px 0 #000' }}>
        关卡清除
      </h2>
      <p className="text-gray-400 mb-2 md:mb-8 text-xs">选择一件神器</p>
      
      {/* 
         使用 flex-row 或 grid-cols-3 强制横向排列，适应手机横屏。
         减小 gap 和 padding 确保放得下。
      */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-4xl h-full max-h-[60vh] md:max-h-none">
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
    </div>
  );
};