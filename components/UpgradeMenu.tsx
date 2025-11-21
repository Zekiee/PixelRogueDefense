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
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 animate-fadeIn p-4">
      <h2 className="text-3xl text-white mb-8 text-center" style={{ textShadow: '2px 2px 0 #000' }}>
        LEVEL CLEARED
      </h2>
      <p className="text-gray-400 mb-8 text-xs">Choose an artifact</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        {options.map((card) => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className={`
              relative group p-6 border-4 bg-gray-900 
              flex flex-col items-center text-center gap-4
              transition-transform hover:scale-105 active:scale-95
              ${getRarityColor(card.rarity)}
            `}
          >
            <div className="text-xs uppercase tracking-widest opacity-70">{card.rarity}</div>
            <div className="text-xl font-bold">{card.title}</div>
            <div className="text-xs leading-5">{card.description}</div>
            
            {/* Pixel Corner Decorations */}
            <div className="absolute top-0 left-0 w-2 h-2 bg-current"></div>
            <div className="absolute top-0 right-0 w-2 h-2 bg-current"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 bg-current"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-current"></div>
          </button>
        ))}
      </div>
    </div>
  );
};
