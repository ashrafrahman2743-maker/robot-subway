import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameStats } from '../types/game';
import { RotateCcw, Sparkles, Award, Zap } from 'lucide-react';

interface GameOverModalProps {
  stats: GameStats;
  highScore: number;
  isNewHighScore: boolean;
  onRestart: () => void;
  onOpenShop: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  highScore,
  isNewHighScore,
  onRestart,
  onOpenShop,
}) => {
  useEffect(() => {
    if (isNewHighScore) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00d2ff', '#ec4899', '#f59e0b', '#ffffff'],
        });
      } catch {
        // Fallback gracefully
      }
    }
  }, [isNewHighScore]);

  // Keyboard shortcut: Space or Enter to restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-pink-500/40 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-pink-950/60 text-center my-auto max-h-[92vh] overflow-y-auto">
        {/* Glow backdrop */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Title */}
        <div className="inline-block px-3 py-1 rounded-full bg-pink-950/60 border border-pink-500/40 text-pink-400 font-cyber text-xs tracking-widest font-bold mb-3 uppercase">
          SIGNAL TERMINATED
        </div>
        <h2 className="text-3xl sm:text-4xl font-orbitron font-black text-white tracking-wider mb-4 neon-glow-magenta">
          GAME OVER
        </h2>

        {/* New High Score Banner */}
        {isNewHighScore && (
          <div className="mb-4 py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/50 flex items-center justify-center gap-2 text-amber-300 font-orbitron text-xs sm:text-sm font-bold animate-none shadow-lg">
            <Award className="w-4 h-4 text-amber-400" />
            <span>NEW ALL-TIME RECORD!</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-cyber">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">FINAL SCORE</span>
            <span className="text-2xl font-orbitron font-extrabold text-cyan-300 neon-glow-cyan">
              {stats.score.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">HIGH SCORE</span>
            <span className="text-2xl font-orbitron font-extrabold text-white">
              {highScore.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">CYBER BITS</span>
            <span className="text-xl font-orbitron font-bold text-amber-300 flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              +{stats.coins}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">DISTANCE</span>
            <span className="text-xl font-orbitron font-bold text-slate-200">
              {stats.distance}M
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-slate-950 font-orbitron font-extrabold text-sm tracking-wider shadow-lg shadow-pink-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-950" />
            <span>RUN AGAIN (SPACE)</span>
          </button>

          <button
            onClick={onOpenShop}
            className="w-full py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-cyan-500/40 text-cyan-300 font-orbitron font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>NEO BOT SHOP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
