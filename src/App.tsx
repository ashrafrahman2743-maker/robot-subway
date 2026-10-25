import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { StartScreen } from './components/StartScreen';
import { GameOverModal } from './components/GameOverModal';
import { ShopModal } from './components/ShopModal';
import { GameStats, PlayerCustomization, PowerupState } from './types/game';
import { soundManager } from './audio/soundManager';

const STORAGE_KEY_HIGH_SCORE = 'neobot_surfer_highscore';
const STORAGE_KEY_TOTAL_COINS = 'neobot_surfer_total_coins';
const STORAGE_KEY_UNLOCKED_SKINS = 'neobot_surfer_unlocked_skins';
const STORAGE_KEY_CUSTOMIZATION = 'neobot_surfer_customization';

export default function App() {
  const canvasRef = useRef<GameCanvasHandle>(null);

  // Game UI State
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Game Stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    coins: 0,
    totalCoins: 0,
    distance: 0,
    speed: 26,
  });

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [totalCoins, setTotalCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TOTAL_COINS);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_UNLOCKED_SKINS);
      return saved ? JSON.parse(saved) : ['original_blue'];
    } catch {
      return ['original_blue'];
    }
  });

  const [customization, setCustomization] = useState<PlayerCustomization>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOMIZATION);
      return saved ? JSON.parse(saved) : { colorScheme: 'original_blue', boardSkin: 'neon_stream' };
    } catch {
      return { colorScheme: 'original_blue', boardSkin: 'neon_stream' };
    }
  });

  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [powerups, setPowerups] = useState<PowerupState[]>([]);

  // Update total coins storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TOTAL_COINS, totalCoins.toString());
    } catch {
      // ignore
    }
  }, [totalCoins]);

  // Update high score storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HIGH_SCORE, highScore.toString());
    } catch {
      // ignore
    }
  }, [highScore]);

  // Update unlocked skins storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_UNLOCKED_SKINS, JSON.stringify(unlockedSkins));
    } catch {
      // ignore
    }
  }, [unlockedSkins]);

  // Update customization storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMIZATION, JSON.stringify(customization));
    } catch {
      // ignore
    }
  }, [customization]);

  // Callbacks from GameEngine
  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  const handlePowerupsUpdate = useCallback((activePowerups: PowerupState[]) => {
    setPowerups(activePowerups);
  }, []);

  const handleGameOver = useCallback(
    (finalStats: GameStats) => {
      setGameStatus('gameover');
      setIsPaused(false);

      // Check high score
      let newBest = false;
      if (finalStats.score > highScore) {
        setHighScore(finalStats.score);
        newBest = true;
      }
      setIsNewHighScore(newBest);

      // Add run coins to total
      setTotalCoins((prev) => prev + finalStats.coins);
    },
    [highScore]
  );

  // Controls Handlers
  const handleStartGame = () => {
    setGameStatus('playing');
    setIsPaused(false);
    setIsNewHighScore(false);
    canvasRef.current?.startGame();
  };

  const handleRestartGame = () => {
    setGameStatus('playing');
    setIsPaused(false);
    setIsNewHighScore(false);
    canvasRef.current?.startGame();
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
    canvasRef.current?.pauseGame();
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  const handleSelectSkin = (skinId: PlayerCustomization['colorScheme']) => {
    const nextCustomization: PlayerCustomization = {
      ...customization,
      colorScheme: skinId,
    };
    setCustomization(nextCustomization);
    canvasRef.current?.setCustomization(nextCustomization);
  };

  const handleBuySkin = (skinId: PlayerCustomization['colorScheme'], cost: number) => {
    if (totalCoins >= cost && !unlockedSkins.includes(skinId)) {
      setTotalCoins((prev) => prev - cost);
      setUnlockedSkins((prev) => [...prev, skinId]);
      handleSelectSkin(skinId);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-cyber select-none">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas
        ref={canvasRef}
        customization={customization}
        onStatsUpdate={handleStatsUpdate}
        onPowerupsUpdate={handlePowerupsUpdate}
        onGameOver={handleGameOver}
      />

      {/* In-Game HUD overlay (Visible during active gameplay) */}
      {gameStatus === 'playing' && (
        <HUD
          stats={stats}
          highScore={highScore}
          powerups={powerups}
          isMuted={isMuted}
          isPaused={isPaused}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onMoveLeft={() => canvasRef.current?.moveLeft()}
          onMoveRight={() => canvasRef.current?.moveRight()}
          onJump={() => canvasRef.current?.jump()}
          onSlide={() => canvasRef.current?.slide()}
          onActivateHoverboard={() => canvasRef.current?.activateHoverboard()}
        />
      )}

      {/* Start Screen (Idle State) */}
      {gameStatus === 'idle' && (
        <StartScreen
          highScore={highScore}
          totalCoins={totalCoins}
          customization={customization}
          isMuted={isMuted}
          onStartGame={handleStartGame}
          onOpenShop={() => setIsShopOpen(true)}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Game Over Screen */}
      {gameStatus === 'gameover' && (
        <GameOverModal
          stats={stats}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRestart={handleRestartGame}
          onOpenShop={() => setIsShopOpen(true)}
        />
      )}

      {/* Robot Customization Shop Modal */}
      {isShopOpen && (
        <ShopModal
          totalCoins={totalCoins}
          unlockedSkins={unlockedSkins}
          currentCustomization={customization}
          onSelectSkin={handleSelectSkin}
          onBuySkin={handleBuySkin}
          onClose={() => setIsShopOpen(false)}
        />
      )}
    </div>
  );
}
