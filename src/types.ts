/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Lane = 0 | 1 | 2; // 0: Left, 1: Middle, 2: Right

export type ObstacleType = 'normal' | 'vLaser' | 'hLaser';

export type ItemType = 'crystal' | 'oasis'; // crystal = Sand Crystal (+50 score), oasis = Oasis Water (3s shield)

export interface Player {
  lane: Lane;
  x: number; // current visual horizontal position (for smooth lerping)
  y: number; // constant base vertical position (near the bottom)
  z: number; // vertical height for jumping (3D depth simulation)
  vz: number; // vertical velocity (gravity physics)
  width: number;
  height: number;
  isJumping: boolean;
  shieldActive: boolean;
  shieldTimer: number; // countdown in milliseconds or frames
  maxShieldTimer: number; // default max duration (e.g. 180 frames = 3 seconds at 60fps)
  targetX: number; // target horizontal position based on current lane
  animFrame: number; // frame counter to animate running/bouncing
}

export interface Obstacle {
  id: string;
  lane: Lane;
  x: number; // base x
  y: number; // vertical position in the canvas
  type: ObstacleType;
  width: number;
  height: number;
  laserTriggered: boolean; // whether the visual laser beam has fired or is in warning state
  laserWarningTimer: number; // count down frames before firing the laser
  laserTimer: number; // duration of active laser beam
  isPassed: boolean; // if player successfully passed this obstacle
}

export interface Collectible {
  id: string;
  lane: Lane;
  x: number;
  y: number;
  type: ItemType;
  width: number;
  height: number;
  angle: number; // rotate animation angle
  isCollected: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface BackgroundElement {
  id: string;
  x: number;
  y: number;
  scale: number;
  speed: number;
  type: 'dune' | 'pyramid' | 'cloud' | 'cactus_static';
}

export type PlayState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface GameSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
}
