import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameStats, PlayerCustomization, PowerupState } from '../types/game';

export interface GameCanvasHandle {
  moveLeft: () => void;
  moveRight: () => void;
  jump: () => void;
  slide: () => void;
  activateHoverboard: () => void;
  startGame: () => void;
  pauseGame: () => void;
  resetGame: () => void;
  setCustomization: (customization: PlayerCustomization) => void;
}

interface GameCanvasProps {
  customization: PlayerCustomization;
  onStatsUpdate: (stats: GameStats) => void;
  onPowerupsUpdate: (powerups: PowerupState[]) => void;
  onGameOver: (finalStats: GameStats) => void;
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ customization, onStatsUpdate, onPowerupsUpdate, onGameOver }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    // High-precision Touch & Gesture Tracking
    const touchOriginRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const hasSwipedRef = useRef<boolean>(false);
    const lastTapTimeRef = useRef<number>(0);
    const lastSpacePressRef = useRef<number>(0);

    const triggerHaptic = (ms: number = 10) => {
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(ms);
        }
      } catch {
        // Safe fallback if permission or feature not present
      }
    };

    useImperativeHandle(ref, () => ({
      moveLeft: () => {
        triggerHaptic(8);
        engineRef.current?.moveLeft();
      },
      moveRight: () => {
        triggerHaptic(8);
        engineRef.current?.moveRight();
      },
      jump: () => {
        triggerHaptic(12);
        engineRef.current?.jump();
      },
      slide: () => {
        triggerHaptic(10);
        engineRef.current?.slide();
      },
      activateHoverboard: () => {
        triggerHaptic(20);
        engineRef.current?.activateHoverboard();
      },
      startGame: () => engineRef.current?.startGame(),
      pauseGame: () => engineRef.current?.pauseGame(),
      resetGame: () => engineRef.current?.reset(),
      setCustomization: (c: PlayerCustomization) => engineRef.current?.setCustomization(c),
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      const engine = new GameEngine(mountRef.current, customization, {
        onStatsUpdate,
        onPowerupsUpdate,
        onGameOver,
      });

      engineRef.current = engine;

      // Keyboard Controls (Preserved for desktop with zero lag)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!engineRef.current || engineRef.current.status !== 'playing') return;

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          engineRef.current.moveLeft();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          engineRef.current.moveRight();
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          engineRef.current.jump();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          engineRef.current.slide();
        } else if (e.code === 'Space') {
          e.preventDefault();
          const now = Date.now();
          if (now - lastSpacePressRef.current < 360) {
            engineRef.current.activateHoverboard();
          } else {
            engineRef.current.jump();
          }
          lastSpacePressRef.current = now;
        }
      };

      // Ultra-responsive Touch Swipe Handlers (Triggers instantly during gesture)
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          touchOriginRef.current = {
            x: t.clientX,
            y: t.clientY,
            time: performance.now(),
          };
          hasSwipedRef.current = false;

          // Double tap detection for hoverboard activation
          const now = performance.now();
          if (now - lastTapTimeRef.current < 300) {
            triggerHaptic(20);
            engineRef.current?.activateHoverboard();
          }
          lastTapTimeRef.current = now;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!touchOriginRef.current || hasSwipedRef.current || e.touches.length === 0) return;

        const t = e.touches[0];
        const dx = t.clientX - touchOriginRef.current.x;
        const dy = t.clientY - touchOriginRef.current.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Immediate trigger threshold: 22 pixels for lightning-fast reaction
        const threshold = 22;

        if (absX > threshold || absY > threshold) {
          hasSwipedRef.current = true;

          if (absX > absY) {
            // Horizontal lane change
            if (dx > 0) {
              triggerHaptic(8);
              engineRef.current?.moveRight();
            } else {
              triggerHaptic(8);
              engineRef.current?.moveLeft();
            }
          } else {
            // Vertical Jump / Slide
            if (dy < 0) {
              triggerHaptic(12);
              engineRef.current?.jump();
            } else {
              triggerHaptic(10);
              engineRef.current?.slide();
            }
          }

          // Reset origin to current point so player can chain quick follow-up swipes
          touchOriginRef.current = {
            x: t.clientX,
            y: t.clientY,
            time: performance.now(),
          };
        }
      };

      const handleTouchEnd = () => {
        touchOriginRef.current = null;
        hasSwipedRef.current = false;
      };

      const handleTouchCancel = () => {
        touchOriginRef.current = null;
        hasSwipedRef.current = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      const container = mountRef.current;
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
      container.addEventListener('touchcancel', handleTouchCancel, { passive: true });

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (container) {
          container.removeEventListener('touchstart', handleTouchStart);
          container.removeEventListener('touchmove', handleTouchMove);
          container.removeEventListener('touchend', handleTouchEnd);
          container.removeEventListener('touchcancel', handleTouchCancel);
        }
        engine.dispose();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.setCustomization(customization);
    }, [customization]);

    return (
      <div
        ref={mountRef}
        style={{ touchAction: 'none' }}
        className="w-full h-full absolute inset-0 overflow-hidden select-none"
      />
    );
  }
);

GameCanvas.displayName = 'GameCanvas';
