export type Lane = -1 | 0 | 1; // -1: Left, 0: Center, 1: Right

export type ObstacleType = 
  | 'low_barrier'    // Jump over
  | 'high_barrier'   // Slide under
  | 'train_static'   // Bullet hover-train, run on top via ramp or dodge
  | 'train_moving'   // Coming towards player
  | 'ramp'           // Launches player onto train roof
  | 'cyber_drone'    // Hovering hazard
  | 'tall_column';   // Full blocker (must switch lane)

export type PowerupType = 
  | 'magnet'         // Attracts coins
  | 'jetpack'        // Sky high flight with tons of coins
  | 'hoverboard'     // Shield against 1 crash + stylish surfing
  | 'super_sneakers' // Double jump height
  | 'multiplier';    // 2x score

export interface PowerupState {
  type: PowerupType;
  duration: number; // in seconds
  timeLeft: number;
}

export interface PlayerCustomization {
  colorScheme: 'original_blue' | 'cyber_cyan' | 'synth_magenta' | 'matrix_green' | 'solar_gold';
  boardSkin: 'neon_stream' | 'quantum_glow' | 'cyber_flame';
}

export interface GameStats {
  score: number;
  highScore: number;
  coins: number;
  totalCoins: number;
  distance: number;
  speed: number;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';
