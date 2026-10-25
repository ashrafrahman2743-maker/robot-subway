import React from 'react';
import { GameStats, PowerupState } from '../types/game';
import { Volume2, VolumeX, Pause, Play, Shield, Zap, Sparkles, Rocket, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface HUDProps {
  stats: GameStats;
  highScore: number;
  powerups: PowerupState[];
  isMuted: boolean;
  isPaused: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onSlide: () => void;
  onActivateHoverboard: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  highScore,
  powerups,
  isMuted,
  isPaused,
  onToggleMute,
  onTogglePause,
  onMoveLeft,
  onMoveRight,
  onJump,
  onSlide,
  onActivateHoverboard,
}) => {
  const getPowerupIcon = (type: string) => {
    switch (type) {
      case 'magnet':
        return <Zap className="w-3.5 h-3.5 text-pink-400" />;
      case 'hoverboard':
        return <Shield className="w-3.5 h-3.5 text-cyan-400" />;
      case 'jetpack':
        return <Rocket className="w-3.5 h-3.5 text-amber-400" />;
      case 'super_sneakers':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'multiplier':
        return <span className="text-[10px] font-bold text-amber-300">2X</span>;
      default:
        return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const hasHoverboard = powerups.some((p) => p.type === 'hoverboard');

  // Fast pointer-down handler for instant 0ms touch response
  const handlePointerAction = (e: React.PointerEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  return (
    <div
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
      className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between w-full pointer-events-auto gap-2">
        {/* Left: Score & High Score */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="bg-slate-900/85 backdrop-blur-sm border border-cyan-500/40 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg shadow-cyan-950/50">
            <span className="text-[9px] sm:text-[10px] tracking-widest text-cyan-400 uppercase font-semibold block">SCORE</span>
            <span className="text-xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wider neon-glow-cyan leading-tight">
              {stats.score.toLocaleString()}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-cyber flex items-center gap-1 px-1">
            <span className="text-amber-400 font-semibold">BEST:</span>
            <span className="font-orbitron text-slate-200">{Math.max(stats.score, highScore).toLocaleString()}</span>
          </div>
        </div>

        {/* Center: Active Powerups Countdown Indicators */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[40%]">
          {powerups.map((p) => {
            const percent = (p.timeLeft / p.duration) * 100;
            return (
              <div
                key={p.type}
                className="bg-slate-900/90 border border-slate-700/60 rounded-xl px-2 sm:px-2.5 py-1 flex items-center gap-1.5 shadow-md"
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" className="text-slate-800" fill="none" />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-cyan-400 transition-all duration-100"
                      strokeDasharray="50.2"
                      strokeDashoffset={50.2 - (50.2 * percent) / 100}
                      fill="none"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {getPowerupIcon(p.type)}
                  </div>
                </div>
                <div className="text-[11px] sm:text-xs font-orbitron text-cyan-300 font-bold">
                  {Math.ceil(p.timeLeft)}s
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Coins & Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="bg-slate-900/85 backdrop-blur-sm border border-amber-500/40 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 shadow-lg shadow-amber-950/30">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-slate-950">
              ⚡
            </div>
            <span className="text-base sm:text-xl font-orbitron font-bold text-amber-300 neon-glow-amber">
              {stats.coins}
            </span>
          </div>

          <button
            onPointerDown={(e) => handlePointerAction(e, onTogglePause)}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900/85 border border-slate-700/60 text-slate-300 hover:text-white hover:border-cyan-400 flex items-center justify-center transition-colors shadow-lg active:scale-95"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onPointerDown={(e) => handlePointerAction(e, onToggleMute)}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900/85 border border-slate-700/60 text-slate-300 hover:text-white hover:border-cyan-400 flex items-center justify-center transition-colors shadow-lg active:scale-95"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Floating Speed / Distance Badge */}
      <div className="self-center flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/70 border border-cyan-500/20 text-[10px] sm:text-xs font-cyber tracking-wider text-slate-400">
        <span>SPEED: <strong className="text-cyan-300 font-orbitron">{stats.speed} KM/H</strong></span>
        <span>•</span>
        <span>DIST: <strong className="text-slate-200 font-orbitron">{stats.distance}M</strong></span>
      </div>

      {/* Bottom Row: 0ms Latency Mobile Platforming Controls */}
      <div className="w-full pointer-events-auto flex items-end justify-between max-w-4xl mx-auto pb-1 px-1">
        {/* Left Side: Lateral Steer (Left / Right) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onPointerDown={(e) => handlePointerAction(e, onMoveLeft)}
            style={{ touchAction: 'none' }}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
            aria-label="Move Left"
          >
            <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <button
            onPointerDown={(e) => handlePointerAction(e, onMoveRight)}
            style={{ touchAction: 'none' }}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
            aria-label="Move Right"
          >
            <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* Center: Hoverboard Button */}
        <button
          onPointerDown={(e) => handlePointerAction(e, onActivateHoverboard)}
          disabled={hasHoverboard}
          style={{ touchAction: 'none' }}
          className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border flex items-center gap-1.5 sm:gap-2 font-orbitron text-[11px] sm:text-xs font-bold shadow-xl transition-all active:scale-95 cursor-pointer ${
            hasHoverboard
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-cyan-500/30 cursor-default'
              : 'bg-slate-900/90 hover:bg-slate-800 border-pink-500/60 text-pink-300 hover:text-white shadow-pink-500/20'
          }`}
        >
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          <span>{hasHoverboard ? 'ACTIVE' : 'HOVERBOARD'}</span>
        </button>

        {/* Right Side: Jump / Slide */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onPointerDown={(e) => handlePointerAction(e, onSlide)}
            style={{ touchAction: 'none' }}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-pink-600/40 border border-pink-500/40 text-pink-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
            aria-label="Slide Down"
          >
            <ArrowDown className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <button
            onPointerDown={(e) => handlePointerAction(e, onJump)}
            style={{ touchAction: 'none' }}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-cyan-500/50 border border-cyan-400 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-950/60 active:scale-90 transition-transform cursor-pointer"
            aria-label="Jump Up"
          >
            <ArrowUp className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
