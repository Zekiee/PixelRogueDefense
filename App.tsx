
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GamePhase, TowerType, Tower, UpgradeCard } from './types';
import { GRID_W, GRID_H, CELL_SIZE, TOWER_STATS, WAVES_PER_STAGE, PLAYABLE_H } from './constants';
import { GameUI } from './components/GameUI';
import { UpgradeMenu } from './components/UpgradeMenu';
import { getWaveFlavorText } from './services/geminiService';
import { GameEngine } from './systems/GameLogic';
import { RenderSystem } from './systems/RenderSystem';
import { getGameCoordinates } from './utils/input';

// Hook to get window size
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const { width: windowW, height: windowH } = useWindowSize();
  const isPortrait = windowH > windowW;
  
  // --- Game Systems ---
  const engineRef = useRef<GameEngine>(new GameEngine());
  const rendererRef = useRef<RenderSystem>(new RenderSystem());
  
  // --- UI State ---
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<Tower | null>(null);
  
  // We clone the state for React UI to trigger re-renders
  const [uiState, setUiState] = useState(engineRef.current.state); 
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeCard[]>([]);
  const [flavorText, setFlavorText] = useState<string>("");
  const hoverPos = useRef<{x: number, y: number} | null>(null);

  // --- Game Loop ---
  const loop = useCallback((time: number) => {
    const engine = engineRef.current;
    
    if (phase === GamePhase.PLAYING) {
      engine.update();
      if (engine.state.lives <= 0) {
          setPhase(GamePhase.GAME_OVER);
      } else if (engine.isWaveComplete()) {
          setPhase(GamePhase.WAVE_COMPLETE);
          setUpgradeOptions(engine.getUpgradeOptions());
      }
    }
    
    // Sync state to UI (throttle this if performance is an issue, currently 60fps sync)
    setUiState({...engine.state});

    // Draw
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
          rendererRef.current.draw(
              ctx, 
              engine.state, 
              canvas.width, 
              canvas.height, 
              hoverPos.current,
              selectedTowerType,
              selectedPlacedTower ? {x: selectedPlacedTower.x, y: selectedPlacedTower.y} : null,
              engine.modifiers
          );
      }
    }
    
    requestRef.current = requestAnimationFrame(loop);
  }, [phase, selectedTowerType, selectedPlacedTower]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  useEffect(() => {
     getWaveFlavorText(1).then(setFlavorText);
  }, []);

  // --- Interactions ---
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const { x, y } = getGameCoordinates(clientX, clientY, rect, isPortrait);
    
    if (y >= PLAYABLE_H) {
        setSelectedPlacedTower(null);
        setSelectedTowerType(null);
        return;
    }
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;

    const clickedTower = engineRef.current.state.grid[y][x];

    if (clickedTower) {
      setSelectedPlacedTower(clickedTower);
      setSelectedTowerType(null);
    } else if (selectedTowerType) {
        const success = engineRef.current.placeTower(x, y, selectedTowerType);
        if (success) {
            setSelectedTowerType(null);
        }
    } else {
      setSelectedPlacedTower(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getGameCoordinates(e.clientX, e.clientY, rect, isPortrait);
    hoverPos.current = { x, y };
  };

  const handleActions = {
      onNextWave: async () => {
          engineRef.current.state.wave += 1;
          const txt = await getWaveFlavorText(engineRef.current.state.wave);
          setFlavorText(txt);
          engineRef.current.prepareWave(engineRef.current.state.wave);
          setPhase(GamePhase.PLAYING);
      },
      onNextStage: () => {
          const recovered = engineRef.current.nextStage();
          setPhase(GamePhase.MENU);
          setFlavorText(`进入第 ${engineRef.current.state.stage} 区域。已自动回收防御塔，获得资金 $${recovered}！`);
      },
      onUpgradeTower: () => {
          if (selectedPlacedTower) {
              const success = engineRef.current.upgradeTower(selectedPlacedTower.x, selectedPlacedTower.y);
              if (success) {
                  // Force update selected ref since level changed
                  setSelectedPlacedTower({...engineRef.current.state.grid[selectedPlacedTower.y][selectedPlacedTower.x]!});
              }
          }
      },
      onSellTower: () => {
          if (selectedPlacedTower) {
              engineRef.current.sellTower(selectedPlacedTower.x, selectedPlacedTower.y);
              setSelectedPlacedTower(null);
          }
      },
      onSelectUpgrade: (card: UpgradeCard) => {
          card.apply(engineRef.current.state, engineRef.current.modifiers);
          if (engineRef.current.state.wave % WAVES_PER_STAGE === 0) {
              setPhase(GamePhase.STAGE_COMPLETE);
              getWaveFlavorText(engineRef.current.state.wave).then(t => setFlavorText("区域已肃清！准备前往下一个危险地带..."));
          } else {
              setPhase(GamePhase.MENU);
          }
      },
      onReroll: () => {
          const newOptions = engineRef.current.rerollUpgrades();
          if (newOptions) setUpgradeOptions(newOptions);
      },
      onOrbitalStrike: () => {
          engineRef.current.activateOrbitalStrike();
      },
      onToggleFullscreen: () => {
          if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(e => console.error(e));
          } else {
              if (document.exitFullscreen) document.exitFullscreen();
          }
      }
  };

  const containerStyle: React.CSSProperties = isPortrait ? {
      width: '100vh',
      height: '100vw',
      transform: 'translate(-50%, -50%) rotate(90deg)',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transformOrigin: 'center center',
  } : {
      width: '100%',
      maxWidth: '1200px',
      aspectRatio: '16/9',
      position: 'relative',
  };

  return (
    <div className="w-full h-screen bg-gray-950 flex items-center justify-center overflow-hidden relative select-none">
      <div 
        className="bg-black shadow-2xl border-2 md:border-4 border-gray-800 rounded-lg overflow-hidden transition-all duration-500"
        style={containerStyle}
      >
        <canvas
          ref={canvasRef}
          width={GRID_W * CELL_SIZE}
          height={GRID_H * CELL_SIZE}
          className="w-full h-full block cursor-pointer"
          onClick={handleCanvasClick} 
          onMouseMove={handleMouseMove}
          onTouchStart={handleCanvasClick} 
        />

        <GameUI 
          gameState={uiState} 
          phase={phase}
          selectedTowerType={selectedTowerType}
          selectedPlacedTower={selectedPlacedTower}
          onSelectTowerType={(t) => { setSelectedTowerType(t); setSelectedPlacedTower(null); }}
          onUpgradeTower={handleActions.onUpgradeTower}
          onSellTower={handleActions.onSellTower}
          onNextWave={handleActions.onNextWave}
          onNextStage={handleActions.onNextStage}
          onOrbitalStrike={handleActions.onOrbitalStrike}
          onToggleFullscreen={handleActions.onToggleFullscreen}
          flavorText={flavorText}
        />

        {phase === GamePhase.WAVE_COMPLETE && (
          <UpgradeMenu 
            options={upgradeOptions} 
            money={uiState.money}
            onSelect={handleActions.onSelectUpgrade} 
            onReroll={handleActions.onReroll}
          />
        )}

        {phase === GamePhase.GAME_OVER && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30 text-white animate-fadeIn">
            <h1 className="text-4xl md:text-6xl text-red-500 mb-4 font-bold">任务失败</h1>
            <div className="text-center mb-8 text-gray-300">
              <p className="text-xl">存活波次: {uiState.wave - 1}</p>
              <p className="text-lg">最终得分: {uiState.score}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-white text-black font-bold hover:scale-105 transition-transform rounded"
            >
              重新开始
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
