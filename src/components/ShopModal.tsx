import React from 'react';
import { X, Check, Lock, Zap } from 'lucide-react';
import { PlayerCustomization } from '../types/game';

interface SkinItem {
  id: PlayerCustomization['colorScheme'];
  name: string;
  tag: string;
  price: number;
  primaryColor: string;
  accentColor: string;
  neonColor: string;
}

const SKINS: SkinItem[] = [
  {
    id: 'original_blue',
    name: 'Neo Blue',
    tag: 'Original Spec',
    price: 0,
    primaryColor: '#f3f6fa',
    accentColor: '#0284c7',
    neonColor: '#00d2ff',
  },
  {
    id: 'cyber_cyan',
    name: 'Cyber Cyan',
    tag: 'Overclocked',
    price: 60,
    primaryColor: '#ecfeff',
    accentColor: '#06b6d4',
    neonColor: '#22d3ee',
  },
  {
    id: 'synth_magenta',
    name: 'Synthwave Magenta',
    tag: 'Retrowave 80s',
    price: 120,
    primaryColor: '#fdf2f8',
    accentColor: '#db2777',
    neonColor: '#f472b6',
  },
  {
    id: 'matrix_green',
    name: 'Matrix Emerald',
    tag: 'Quantum Core',
    price: 180,
    primaryColor: '#f0fdf4',
    accentColor: '#16a34a',
    neonColor: '#4ade80',
  },
  {
    id: 'solar_gold',
    name: 'Solar Flare Gold',
    tag: 'Legendary',
    price: 250,
    primaryColor: '#fffbeb',
    accentColor: '#d97706',
    neonColor: '#fbbf24',
  },
];

interface ShopModalProps {
  totalCoins: number;
  unlockedSkins: string[];
  currentCustomization: PlayerCustomization;
  onSelectSkin: (skinId: PlayerCustomization['colorScheme']) => void;
  onBuySkin: (skinId: PlayerCustomization['colorScheme'], cost: number) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  totalCoins,
  unlockedSkins,
  currentCustomization,
  onSelectSkin,
  onBuySkin,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-cyan-950/80 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl sm:text-2xl font-orbitron font-bold text-white neon-glow-cyan">
              NEO BOT WARDROBE
            </h3>
            <p className="text-xs font-cyber text-slate-400">
              Customize your companion&apos;s glowing neon reactor and chassis
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-amber-500/40 rounded-xl px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-orbitron font-bold text-amber-300">
                {totalCoins}
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Skins Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
          {SKINS.map((skin) => {
            const isUnlocked = unlockedSkins.includes(skin.id) || skin.price === 0;
            const isEquipped = currentCustomization.colorScheme === skin.id;
            const canAfford = totalCoins >= skin.price;

            return (
              <div
                key={skin.id}
                className={`relative p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                  isEquipped
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-cyber font-bold tracking-wider text-slate-400">
                      {skin.tag}
                    </span>
                    {/* Swatch preview dots */}
                    <div className="flex items-center gap-1">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-700 shadow-sm"
                        style={{ backgroundColor: skin.neonColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-slate-700 shadow-sm"
                        style={{ backgroundColor: skin.accentColor }}
                      />
                    </div>
                  </div>

                  <h4 className="text-sm font-orbitron font-bold text-white mb-2">
                    {skin.name}
                  </h4>
                </div>

                <div className="mt-2">
                  {isEquipped ? (
                    <div className="w-full py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-orbitron text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      EQUIPPED
                    </div>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => onSelectSkin(skin.id)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-orbitron text-xs font-bold transition-all cursor-pointer"
                    >
                      EQUIP
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuySkin(skin.id, skin.price)}
                      disabled={!canAfford}
                      className={`w-full py-2 rounded-xl font-orbitron text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer'
                          : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      UNLOCK ({skin.price} BITS)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron text-xs font-semibold cursor-pointer"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
