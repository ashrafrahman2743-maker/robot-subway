import React from 'react';
import { Play, Sparkles, Volume2, VolumeX, Shield, Zap, Keyboard, Smartphone } from 'lucide-react';
import { PlayerCustomization } from '../types/game';

interface StartScreenProps {
  highScore: number;
  totalCoins: number;
  customization: PlayerCustomization;
  isMuted: boolean;
  onStartGame: () => void;
  onOpenShop: () => void;
  onToggleMute: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  totalCoins,
  customization,
  isMuted,
  onStartGame,
  onOpenShop,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900/90 border border-cyan-500/40 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-cyan-950/80 text-center my-auto max-h-[92vh] overflow-y-auto">
        {/* Glow backdrop decorative accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Sound Toggle & Total Coins */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 bg-slate-950/60 border border-amber-500/30 rounded-xl px-3 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-xs font-cyber text-amber-300 font-bold">
              {totalCoins} CYBER BITS
            </span>
          </div>

          <button
            onClick={onToggleMute}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>

        {/* Robot Hero Avatar Card referencing the user's attachment */}
        <div className="relative mx-auto mb-4 w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-tr from-cyan-500 via-sky-400 to-pink-500 shadow-xl shadow-cyan-500/20">
          <div className="w-full h-full rounded-[22px] overflow-hidden bg-slate-950 flex items-center justify-center relative">
            <img
              src="/assets/aistudio/robot_20494bb9.jpeg"
              alt="Neo Bot - Cyber companion"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent py-1">
              <span className="text-[10px] font-orbitron font-bold text-cyan-300 tracking-wider">NEO BOT</span>
            </div>
          </div>
        </div>

        {/* Game Title */}
        <h1 className="text-3xl sm:text-4xl font-orbitron font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-pink-400 mb-1 neon-glow-cyan">
          NEON BOT SURFER
        </h1>
        <p className="text-xs sm:text-sm font-cyber text-slate-400 max-w-md mx-auto mb-5">
          High-speed 3D Cyber Platformer. Dash through neon highways, surf on bullet trains, dodge laser gates, and collect cyber bits!
        </p>

        {/* High Score Badge */}
        {highScore > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-xs font-cyber text-cyan-300 mb-6">
            <span className="text-amber-400 font-bold">ALL-TIME BEST:</span>
            <span className="font-orbitron font-bold text-white text-sm">{highScore.toLocaleString()}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <button
            onClick={onStartGame}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-extrabold text-base tracking-wider shadow-lg shadow-cyan-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>SURF NOW</span>
          </button>

          <button
            onClick={onOpenShop}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-pink-500/50 text-pink-300 font-orbitron font-bold text-sm tracking-wide shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>CUSTOMIZE BOT</span>
          </button>
        </div>

        {/* Controls Instructions Card */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-left">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2 pb-1 border-b border-slate-800">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Keyboard className="w-3.5 h-3.5" /> KEYBOARD
            </span>
            <span className="flex items-center gap-1.5 text-pink-400">
              <Smartphone className="w-3.5 h-3.5" /> TOUCH / SWIPE
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-cyber">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">SWITCH LANE</span>
              <strong className="text-white font-orbitron">A / D / ◄ ►</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">JUMP / CLIMB</span>
              <strong className="text-cyan-300 font-orbitron">W / ▲ / SPACE</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">SLIDE / DUCK</span>
              <strong className="text-pink-300 font-orbitron">S / ▼</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">HOVERBOARD</span>
              <strong className="text-amber-300 font-orbitron">2x SPACE / TAP</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
