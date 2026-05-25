/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Lane, Player, Obstacle, ObstacleType, Collectible, Particle, BackgroundElement, PlayState, GameSettings } from '../types';
import { audioSynth } from '../utils/audio';

// Constants for game configurations
const LANE_COUNT = 3;
const BASE_GRAVITY = 0.38; // much slower, floatier jump
const JUMP_FORCE = -8.5;  // lower and easier to master
const INITIAL_SPEED = 2.4; // super slow and friendly start
const MAX_SPEED = 4.2;    // very safe speed cap for toddlers
const ACCELERATION = 0.00015; // grows very slowly indeed
const LASER_WARNING_DURATION = 75; // longer warning time (around 1.3 seconds)
const LASER_ACTIVE_DURATION = 55; // shorter threat time

interface GameCanvasProps {
  playState: PlayState;
  settings: GameSettings;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  highScore: number;
  setHighScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onCoinsCollected: (coins: number) => void;
  activeShield: boolean;
  setActiveShield: (active: boolean) => void;
  shieldTimeLeft: number;
  setShieldTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  onRestartRequest: boolean;
  setOnRestartRequest: (req: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playState,
  settings,
  score,
  setScore,
  highScore,
  setHighScore,
  onGameOver,
  onCoinsCollected,
  activeShield,
  setActiveShield,
  shieldTimeLeft,
  setShieldTimeLeft,
  onRestartRequest,
  setOnRestartRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isVictorious, setIsVictorious] = useState(false);

  // References to keep state across animation frames without triggering constant React re-renders
  const stateRef = useRef({
    speed: INITIAL_SPEED,
    frameCount: 0,
    itemsCollected: 0,
    score: 0,
    renderedScore: 0,
    powerupState: 'playing' as 'intro_eating' | 'playing',
    level: 1,
    distanceValue: 0,
    levelUpMessageTimer: 0,
    levelUpBannerText: '',
    victory: false,
    player: {
      lane: 1 as 0 | 1 | 2,
      x: 0,
      y: 0,
      z: 0,
      vz: 0,
      width: 55,
      height: 55,
      isJumping: false,
      shieldActive: false,
      shieldTimer: 0,
      maxShieldTimer: 180, // 3 seconds at 60fps
      targetX: 0,
      animFrame: 0,
    } as Player,
    obstacles: [] as Obstacle[],
    collectibles: [] as Collectible[],
    particles: [] as Particle[],
    backgroundElements: [] as BackgroundElement[],
    laneLinesOffset: 0,
    dustParticleTimer: 0,
    lastLaserFrame: 0,
    difficultySettings: {
      initialSpeed: INITIAL_SPEED,
      maxSpeed: MAX_SPEED,
      acceleration: ACCELERATION,
      laserWarningDuration: LASER_WARNING_DURATION,
      spawnPeriodBase: 95,
    },
  });

  const [dimensions, setDimensions] = useState({ width: 400, height: 700 });

  // Use values from settings in our loop
  audioSynth.enabled = settings.soundEnabled;

  // Manage responsive Canvas scaling
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        let { width, height } = entry.contentRect;
        
        // Enforce portrait mobile arcade aspect ratio (9:16)
        const targetWidth = Math.min(width, 500);
        const targetHeight = height;
        
        setDimensions({
          width: targetWidth,
          height: targetHeight,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Set initial player layout when canvas dimensions are initialized or updated
  useEffect(() => {
    const state = stateRef.current;
    const laneWidth = dimensions.width / LANE_COUNT;
    state.player.targetX = (state.player.lane * laneWidth) + (laneWidth / 2);
    state.player.x = state.player.targetX;
    state.player.y = dimensions.height - 80; // base y height closer to screen bottom
  }, [dimensions]);

  // Handle external restart requests from parent components
  useEffect(() => {
    if (onRestartRequest) {
      resetGameData();
      setOnRestartRequest(false);
    }
  }, [onRestartRequest]);

  // Synchronize parent sound options
  useEffect(() => {
    audioSynth.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  const resetGameData = () => {
    const state = stateRef.current;
    const laneWidth = dimensions.width / LANE_COUNT;
    const initialLane = 1;
    const targetX = (initialLane * laneWidth) + (laneWidth / 2);

    const diff = settings.difficulty;
    let initialSpeed = INITIAL_SPEED;
    let maxSpeed = MAX_SPEED;
    let acceleration = ACCELERATION;
    let laserWarningDuration = LASER_WARNING_DURATION;
    let spawnPeriodBase = 95;
    let initialShieldTimer = 180;

    if (diff === 'easy') {
      initialSpeed = 1.6;
      maxSpeed = 2.8;
      acceleration = 0.00007;
      laserWarningDuration = 95;
      spawnPeriodBase = 125;
      initialShieldTimer = 360; // Extra long protective start shield for Easy Mode
    } else if (diff === 'normal') {
      initialSpeed = 2.4;
      maxSpeed = 4.2;
      acceleration = 0.00015;
      laserWarningDuration = 75;
      spawnPeriodBase = 95;
      initialShieldTimer = 180; // Standard starter shield
    } else if (diff === 'hard') {
      initialSpeed = 3.3;
      maxSpeed = 6.2;
      acceleration = 0.0003;
      laserWarningDuration = 45;
      spawnPeriodBase = 70;
      initialShieldTimer = 0; // No free starting shield in Hard Mode
    }

    state.difficultySettings = {
      initialSpeed,
      maxSpeed,
      acceleration,
      laserWarningDuration,
      spawnPeriodBase,
    };

    state.speed = initialSpeed;
    state.frameCount = 0;
    state.itemsCollected = 0;
    state.score = 0;
    state.renderedScore = 0;
    state.powerupState = 'playing';
    state.level = 1;
    state.distanceValue = 0;
    state.levelUpMessageTimer = 0;
    state.levelUpBannerText = '';
    state.victory = false;
    setIsVictorious(false);
    state.player = {
      lane: initialLane,
      x: targetX,
      y: dimensions.height - 80, // base y height closer to screen bottom
      z: 0,
      vz: 0,
      width: 55,
      height: 55,
      isJumping: false,
      shieldActive: initialShieldTimer > 0,
      shieldTimer: initialShieldTimer,
      maxShieldTimer: 180,
      targetX: targetX,
      animFrame: 0,
    };
    state.obstacles = [];
    state.collectibles = [];
    state.particles = [];
    state.laneLinesOffset = 0;
    state.lastLaserFrame = 0;
    
    // Seed scenic background elements (rolling dunes and static cacti silhouettes)
    state.backgroundElements = [
      { id: '1', x: dimensions.width * 0.15, y: dimensions.height * 0.35, scale: 0.9, speed: 0.1, type: 'dune' },
      { id: '2', x: dimensions.width * 0.75, y: dimensions.height * 0.38, scale: 1.1, speed: 0.12, type: 'dune' },
      { id: '3', x: dimensions.width * 0.3, y: dimensions.height * 0.28, scale: 0.6, speed: 0.08, type: 'cactus_static' },
      { id: '4', x: dimensions.width * 0.85, y: dimensions.height * 0.32, scale: 0.7, speed: 0.09, type: 'cactus_static' },
      { id: '5', x: dimensions.width * 0.5, y: dimensions.height * 0.22, scale: 0.5, speed: 0.05, type: 'cactus_static' },
    ];

    setScore(0);
    setActiveShield(false);
    setShieldTimeLeft(0);
  };

  // Helper to resolve player lane coordinate
  const getLaneX = (lane: number) => {
    const laneWidth = dimensions.width / LANE_COUNT;
    return (lane * laneWidth) + (laneWidth / 2);
  };

  // Particle explosion effect when picking items or crashing
  const spawnExplosion = (x: number, y: number, color: string, count = 12) => {
    const state = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      const id = Math.random().toString(36).substring(2, 9);
      const maxLife = 20 + Math.random() * 25;
      state.particles.push({
        id,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (state.speed * 0.3), // blow particles upwards
        size: 3 + Math.random() * 5,
        color,
        alpha: 1.0,
        life: maxLife,
        maxLife,
      });
    }
  };

  // --- RENDERING CANVAS DETAILS (VECTORS) ---

  const drawParallaxBackground = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;
    const level = state.level;
    const horizonY = height * 0.42;

    ctx.save();
    // 1. DYNAMIC ATMOSPHERIC GRADIENTS DEPENDING ON LEVEL
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    
    if (level === 1) {
      // Sakin Çöl (Golden Day Desert)
      bgGrad.addColorStop(0, '#0284c7');     // Sky blue
      bgGrad.addColorStop(0.35, '#bae6fd');  // Soft light cyan sky
      bgGrad.addColorStop(0.55, '#fef08a');  // Sunny golden horizon
      bgGrad.addColorStop(0.75, '#fed7aa');  // Amber sunset transition
      bgGrad.addColorStop(1, '#ea580c');     // Terracotta sandy ground
    } else if (level === 2) {
      // Kızıl Tehlike (Crimson Threat Sunset)
      bgGrad.addColorStop(0, '#781d00');     // Rich deep sunset red top
      bgGrad.addColorStop(0.35, '#c2410c');  // Warm orange-red sky
      bgGrad.addColorStop(0.55, '#ea580c');  // Golden orange horizon
      bgGrad.addColorStop(0.75, '#be185d');  // Soft dusky transition pinkish-orange
      bgGrad.addColorStop(1, '#7c2d12');     // Ground deep warm terracotta
    } else if (level === 3) {
      // Siber Günbatımı (Synthwave Violet Magenta)
      bgGrad.addColorStop(0, '#1e1b4b');     // Midnight indigo top
      bgGrad.addColorStop(0.35, '#581c87');  // Neon deep violet
      bgGrad.addColorStop(0.55, '#c084fc');  // Glow neon pink
      bgGrad.addColorStop(0.75, '#f472b6');  // High-contrast hot magenta transition
      bgGrad.addColorStop(1, '#3b0764');     // Cyber purple terrain
    } else if (level === 4) {
      // Dijital Fırtına (Lightning Electric Blue Night)
      const isLightningFlash = state.frameCount % 230 > 220; // spontaneous clean visual flash
      if (isLightningFlash) {
        bgGrad.addColorStop(0, '#e0f2fe');   // Bright electric flash blue
        bgGrad.addColorStop(0.5, '#7dd3fc');
        bgGrad.addColorStop(1, '#0c4a6e');
      } else {
        bgGrad.addColorStop(0, '#030712');   // Deep obsidian space
        bgGrad.addColorStop(0.35, '#1e293b'); // Dark indigo storm sky
        bgGrad.addColorStop(0.55, '#0f172a'); // Slick deep border
        bgGrad.addColorStop(0.75, '#0284c7'); // Electric cyan horizon highlight
        bgGrad.addColorStop(1, '#0f172a');   // Pitch bottom cyber ground
      }
    } else {
      // Level 5: Kozmik Vaha (Universal Cosmos Galaxy Final)
      bgGrad.addColorStop(0, '#0f051d');     // Space nebula purple top
      bgGrad.addColorStop(0.35, '#1e1b4b');  // Deep cosmic stellar indigo
      bgGrad.addColorStop(0.55, '#db2777');  // Sparkling pink twilight
      bgGrad.addColorStop(0.75, '#fb923c');  // Golden supernova glow
      bgGrad.addColorStop(1, '#311042');     // Cosmic magenta dunes ground
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. SUN/HEAVENLY BODIES
    if (level === 1) {
      // Golden glowing sun for Level 1
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.38, 55, 0, Math.PI * 2);
      const sunGrad = ctx.createRadialGradient(width * 0.5, height * 0.38, 2, width * 0.5, height * 0.38, 55);
      sunGrad.addColorStop(0, '#ffffff'); // pure sun
      sunGrad.addColorStop(0.5, '#fef08a'); // radiant sweet yellow
      sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0.05)');
      ctx.fillStyle = sunGrad;
      ctx.fill();
    } else if (level === 2) {
      // Dangerous blood-red sun for Level 2
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.38, 68, 0, Math.PI * 2);
      const sunGrad = ctx.createRadialGradient(width * 0.5, height * 0.38, 2, width * 0.5, height * 0.38, 68);
      sunGrad.addColorStop(0, '#fee2e2'); // bright center
      sunGrad.addColorStop(0.4, '#f87171'); // burning crimson red
      sunGrad.addColorStop(1, 'rgba(220, 38, 38, 0.05)');
      ctx.fillStyle = sunGrad;
      ctx.fill();
    } else if (level === 3) {
      // Giant Synthwave Grid Sun with custom horizontal lines for Level 3
      const cx = width * 0.5;
      const cy = height * 0.38;
      const rad = 75;

      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      const sunGrad = ctx.createLinearGradient(cx, cy - rad, cx, cy + rad);
      sunGrad.addColorStop(0, '#f43f5e'); // hot rose
      sunGrad.addColorStop(0.5, '#d946ef'); // electric magenta
      sunGrad.addColorStop(1, '#a855f7'); // neon purple
      ctx.fillStyle = sunGrad;
      ctx.fill();

      // Horizontal retro scan-line cuts
      ctx.fillStyle = 'rgba(30, 27, 75, 0.95)'; // matches background indigo
      for (let yOffset = -rad + 15; yOffset < rad; yOffset += 14) {
        const lineH = Math.max(1.8, 4.5 * ((yOffset + rad) / (rad * 2))); // stripes widen at the bottom
        ctx.fillRect(cx - rad - 5, cy + yOffset, (rad + 5) * 2, lineH);
      }
    } else if (level === 4) {
      // Dark Lunar Eclipse with glowing cyan corona for Level 4
      const cx = width * 0.5;
      const cy = height * 0.38;
      const rad = 50;
      
      // Corona glow
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)'; // bright cyan halo
      ctx.fill();

      // Eclipse body (dark core)
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Glowing blue thin arc
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 2, rad, 0.1 * Math.PI, 1.8 * Math.PI);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Static stardust particles on Level 4
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let s = 1; s <= 15; s++) {
        const sX = (cx * s * 1.34) % width;
        const sY = (cy * s * 0.82) % (height * 0.5);
        ctx.fillRect(sX, sY, 1.5, 1.5);
      }
    } else {
      // Binary Stars & Floating Star particles on Level 5
      const cx = width * 0.5;
      const cy = height * 0.38;
      
      // Draw 20 glowing stars blinking randomly
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for (let s = 0; s < 25; s++) {
        const blink = Math.sin((state.frameCount * 0.05) + s * 1.2) * 0.4 + 0.6;
        ctx.save();
        ctx.globalAlpha = blink;
        const sX = (cx + s * 187) % width;
        const sY = (cy + s * 93) % (height * 0.5);
        ctx.beginPath();
        ctx.arc(sX, sY, 1.5 + (s % 2), 0, Math.PI * 2);
        ctx.fillStyle = s % 2 === 0 ? '#facc15' : '#f472b6';
        ctx.fill();
        ctx.restore();
      }

      // Draw shiny galaxy center
      ctx.beginPath();
      ctx.ellipse(cx, cy, 110, 24, Math.PI / 12, 0, Math.PI * 2);
      const galGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 110);
      galGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      galGrad.addColorStop(0.3, 'rgba(244, 114, 182, 0.15)');
      galGrad.addColorStop(1, 'rgba(30, 27, 75, 0.0)');
      ctx.fillStyle = galGrad;
      ctx.fill();
    }
    ctx.restore();

    // Render distant dunes and cactus silhouettes (scroll in 3D parallax)
    state.backgroundElements.forEach((el) => {
      ctx.save();

      // Dune color based on level
      let duneFill = 'rgba(124, 45, 18, 0.4)';
      let duneStroke = 'rgba(251, 146, 60, 0.25)';
      if (level === 3) {
        duneFill = 'rgba(59, 7, 100, 0.45)';
        duneStroke = 'rgba(192, 132, 252, 0.25)';
      } else if (level === 4) {
        duneFill = 'rgba(15, 23, 42, 0.6)';
        duneStroke = 'rgba(6, 182, 212, 0.2)';
      } else if (level === 5) {
        duneFill = 'rgba(49, 16, 66, 0.5)';
        duneStroke = 'rgba(244, 114, 182, 0.2)';
      }

      if (el.type === 'dune') {
        el.y += state.speed * 0.012;
        ctx.fillStyle = duneFill;
        ctx.strokeStyle = duneStroke;
        ctx.lineWidth = 2.0;
        
        ctx.beginPath();
        ctx.moveTo(-50, el.y);
        ctx.quadraticCurveTo(width * 0.3, el.y - 25 * el.scale, width * 0.65, el.y + 10);
        ctx.quadraticCurveTo(width * 0.85, el.y + 25, width + 50, el.y - 10);
        ctx.lineTo(width + 50, height);
        ctx.lineTo(-50, height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (el.type === 'pyramid') {
        const baseWidth = 120 * el.scale;
        const pyrHeight = 85 * el.scale;
        
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x - baseWidth / 2, el.y + pyrHeight);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = level === 3 ? 'rgba(59, 7, 100, 0.5)' : 'rgba(124, 45, 18, 0.45)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.lineTo(el.x + baseWidth / 2, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = level === 3 ? 'rgba(192, 132, 252, 0.2)' : 'rgba(251, 146, 60, 0.2)';
        ctx.fill();
      }

      if (el.type === 'cactus_static') {
        ctx.fillStyle = level === 3 ? 'rgba(88, 28, 135, 0.75)' : (level === 4 ? 'rgba(15, 23, 42, 0.8)' : 'rgba(120, 53, 15, 0.65)');
        const cSize = 25 * el.scale;
        
        ctx.beginPath();
        ctx.roundRect(el.x - 3, el.y - cSize, 6, cSize, 3);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(el.x - 3, el.y - cSize * 0.65);
        ctx.quadraticCurveTo(el.x - 12, el.y - cSize * 0.65, el.x - 12, el.y - cSize * 0.9);
        ctx.lineWidth = 4;
        ctx.strokeStyle = level === 3 ? 'rgba(88, 28, 135, 0.75)' : (level === 4 ? 'rgba(15, 23, 42, 0.8)' : 'rgba(120, 53, 15, 0.65)');
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(el.x + 3, el.y - cSize * 0.45);
        ctx.quadraticCurveTo(el.x + 12, el.y - cSize * 0.45, el.x + 12, el.y - cSize * 0.75);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw main ground desert sand floor glow overlay (seamlessly blends)
    const grGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
    if (level === 1) {
      grGrad.addColorStop(0, 'rgba(253, 224, 71, 0.18)');
      grGrad.addColorStop(0.6, 'rgba(244, 180, 26, 0.15)');
      grGrad.addColorStop(1, 'rgba(124, 45, 18, 0.3)');
    } else if (level === 2) {
      grGrad.addColorStop(0, 'rgba(239, 68, 68, 0.16)');
      grGrad.addColorStop(0.6, 'rgba(127, 29, 29, 0.15)');
      grGrad.addColorStop(1, 'rgba(67, 12, 12, 0.35)');
    } else if (level === 3) {
      grGrad.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
      grGrad.addColorStop(0.6, 'rgba(59, 7, 100, 0.18)');
      grGrad.addColorStop(1, 'rgba(24, 3, 44, 0.45)');
    } else if (level === 4) {
      grGrad.addColorStop(0, 'rgba(6, 182, 212, 0.11)');
      grGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.2)');
      grGrad.addColorStop(1, 'rgba(3, 7, 18, 0.5)');
    } else {
      grGrad.addColorStop(0, 'rgba(244, 114, 182, 0.2)');
      grGrad.addColorStop(0.6, 'rgba(49, 16, 66, 0.15)');
      grGrad.addColorStop(1, 'rgba(15, 5, 29, 0.4)');
    }

    ctx.fillStyle = grGrad;
    ctx.fillRect(0, height * 0.55, width, height - height * 0.55);
  };

  const getLevelBorderColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#f59e0b'; // amber
      case 2: return '#ef4444'; // crimson red
      case 3: return '#c084fc'; // neon purple
      case 4: return '#06b6d4'; // bright cyan
      case 5: return '#f472b6'; // cosmic pink
      default: return '#f59e0b';
    }
  };

  const getLevelRailColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#ea580c'; // bronze-orange
      case 2: return '#dc2626'; // dark blood-red
      case 3: return '#9333ea'; // violet magenta
      case 4: return '#0891b2'; // ocean cyan
      case 5: return '#db2777'; // sparkling pink
      default: return '#ea580c';
    }
  };

  const drawLanes = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;
    
    const horizonY = height * 0.42;
    const vanishingX = width / 2;

    // 1. Draw 3D Asphalt Highway roadbed bed polygon
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vanishingX - 25, horizonY);
    ctx.lineTo(vanishingX + 25, horizonY);
    ctx.lineTo(width + 60, height);
    ctx.lineTo(-60, height);
    ctx.closePath();
    
    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    roadGrad.addColorStop(0, '#110c08');     // extremely dark warm grey
    roadGrad.addColorStop(0.3, '#1c1917');   // warm asphalt grey stone-800
    roadGrad.addColorStop(1, '#0c0a09');     // deep bottom black
    ctx.fillStyle = roadGrad;
    ctx.fill();
    
    // Smooth fine perspective borders/metal safety barriers
    ctx.strokeStyle = getLevelBorderColor(state.level); // dynamic level safety borders
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // left border
    ctx.moveTo(vanishingX - 25, horizonY);
    ctx.lineTo(-60, height);
    // right border
    ctx.moveTo(vanishingX + 25, horizonY);
    ctx.lineTo(width + 60, height);
    ctx.stroke();
    ctx.restore();

    // Scroll lines for track lines (slightly speed up scroll rate for intense warp sensation)
    state.laneLinesOffset = (state.laneLinesOffset + state.speed * 1.5) % 80;

    // 2. Draw wooden/cyber tracking sleepers in perspective!
    const numSleepers = 11;
    ctx.save();
    for (let i = 0; i < numSleepers; i++) {
      const z = (i / numSleepers + state.laneLinesOffset / 80) % 1.0;
      const depth = Math.pow(z, 2.3); // exponential perspective spacing
      const sleeperY = horizonY + depth * ((height - 80) - horizonY);
      
      // Sleeper expands in thickness as it moves closer to screen bottom
      ctx.lineWidth = Math.max(1.5, 9 * depth);
      ctx.strokeStyle = state.level === 3 ? 'rgba(88, 28, 135, 0.42)' : (state.level === 4 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(120, 53, 15, 0.42)');
      
      for (let l = 0; l < LANE_COUNT; l++) {
        const laneCenterX = getLaneX(l);
        // Spacing becomes wider closer to the viewer
        const sL = vanishingX + (laneCenterX - 25 - vanishingX) * depth;
        const sR = vanishingX + (laneCenterX + 25 - vanishingX) * depth;
        
        ctx.beginPath();
        ctx.moveTo(sL, sleeperY);
        ctx.lineTo(sR, sleeperY);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Draw parallel glowing metal railway tracks for each of the 3 lanes!
    ctx.save();
    for (let l = 0; l < LANE_COUNT; l++) {
      const laneCenterX = getLaneX(l);
      
      const startDepth = 0.04;
      const endDepth = 1.35;
      
      const yStart = horizonY + startDepth * ((height - 80) - horizonY);
      const yEnd = horizonY + endDepth * ((height - 80) - horizonY);
          
      const rLStart = vanishingX + (laneCenterX - 20 - vanishingX) * startDepth;
      const rLEnd = vanishingX + (laneCenterX - 20 - vanishingX) * endDepth;
      
      const rRStart = vanishingX + (laneCenterX + 20 - vanishingX) * startDepth;
      const rREnd = vanishingX + (laneCenterX + 20 - vanishingX) * endDepth;
      
      // Steel Rail base (dark outline)
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1e1b4b'; // deep space-indigo shadow
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();

      // Steel Rail active metallic core
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = getLevelRailColor(state.level); // dynamic level metallic rail core
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();

      // Top shiny highlight on rails
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#ffffff'; // bright brilliant white/gold highlight
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();
      
      // Glowing neon light beam in center of each lane (Subway track guides)
      ctx.lineWidth = 1.25;
      const neonColor = state.level === 4 || state.level === 5 ? '34, 211, 238' : '249, 115, 22';
      ctx.strokeStyle = `rgba(${neonColor}, 0.22)`; 
      ctx.beginPath();
      ctx.moveTo(vanishingX + (laneCenterX - vanishingX) * startDepth, yStart);
      ctx.lineTo(vanishingX + (laneCenterX - vanishingX) * endDepth, yEnd);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawLionCharacter = (ctx: CanvasRenderingContext2D, playerObj: Player) => {
    const state = stateRef.current;
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;
    
    // Project the logical player coordinates to 3D space
    const relativeDepth = (playerObj.y - horizonY) / ((height - 80) - horizonY);
    const depth = Math.max(0.01, relativeDepth);
    
    const renderX = vanishingX + (playerObj.x - vanishingX) * depth;
    // Vertical jump height is scaled by perspective depth
    const renderY = playerObj.y - (playerObj.z * depth);
    const scale = depth;
    
    ctx.save();
    // Shift coordinate system to make calculations simpler under 3D perspective scaling
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);

    // Apply scaling squish based on landing / run bobbing
    const bob = Math.sin(playerObj.animFrame * 0.22) * 1.5;
    const isShielded = playerObj.shieldActive;

    // 1. SHIELD ORB EFFECT
    if (isShielded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -22, playerObj.width * 0.85, 0, Math.PI * 2);
      
      const shieldGrad = ctx.createRadialGradient(0, -22, playerObj.width * 0.5, 0, -22, playerObj.width * 0.85);
      shieldGrad.addColorStop(0, 'rgba(6, 182, 212, 0.0)');
      shieldGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.25)');
      shieldGrad.addColorStop(1, `rgba(6, 182, 212, ${0.65 + Math.sin(Date.now() / 85) * 0.2})`);
      ctx.fillStyle = shieldGrad;
      ctx.fill();

      // Shield outer glowing ring
      ctx.beginPath();
      ctx.arc(0, -22, playerObj.width * 0.9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([15, 30]);
      ctx.lineDashOffset = (Date.now() / 8) % 45;
      ctx.stroke();
      ctx.restore();
    }

    // Shadow on the ground (stretches or shrinks as player jumps)
    ctx.save();
    ctx.beginPath();
    const shadowScale = Math.max(0.2, 1 - (playerObj.z / 250));
    ctx.ellipse(0, playerObj.height * 0.15 + (playerObj.z), playerObj.width * 0.5 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.restore();

    // 2. LION ANATOMY (BACK-VIEW ARCHITECTURE)

    // Running back legs
    ctx.fillStyle = '#e67e22'; // Darker base gold/orange for legs in back shadow
    const legSwing = Math.sin(playerObj.animFrame * 0.3) * 12;
    
    // Draw legs jogging from under the body rump
    ctx.fillRect(-12, 8 + Math.max(0, legSwing), 6, 14);
    ctx.fillRect(6, 8 + Math.max(0, -legSwing), 6, 14);
    ctx.fillRect(-6, 8 + Math.max(0, -legSwing), 6, 14);
    ctx.fillRect(12, 8 + Math.max(0, legSwing), 6, 14);

    // Draw little dark golden soft paws
    ctx.fillStyle = '#813200';
    ctx.fillRect(-12, 20 + Math.max(0, legSwing), 6, 3);
    ctx.fillRect(6, 20 + Math.max(0, -legSwing), 6, 3);
    ctx.fillRect(-6, 20 + Math.max(0, -legSwing), 6, 3);
    ctx.fillRect(12, 20 + Math.max(0, legSwing), 6, 3);

    // Tail attached to the rump in back-view!
    ctx.save();
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // attached at rump center
    ctx.moveTo(0, 3 + bob);
    // swing playfully as he runs
    const tailSwing = Math.sin(playerObj.animFrame * 0.18) * 16;
    ctx.quadraticCurveTo(tailSwing - 12, 16 + bob, tailSwing + 4, 25 + bob);
    ctx.stroke();

    // Tail fluffy dark tip pom-pom
    ctx.fillStyle = '#813200';
    ctx.beginPath();
    ctx.arc(tailSwing + 4, 28 + bob, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lion Body (Rump and Back - drawn as a warm golden circle/pear)
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(0, 0 + bob, 24, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft dark golden highlight of shoulder blades / spine
    ctx.fillStyle = '#d35400';
    ctx.beginPath();
    // spine strip in back center
    ctx.fillRect(-1.5, -16 + bob, 3, 14);

    // 3. THE MANE (Gösterişli Aslan Yelesi - behind the head, covering shoulders)
    ctx.fillStyle = '#813200'; // Dark rich brown mane
    const manePoints = 12;
    const maneRadius = 25 + Math.abs(bob) * 0.4;
    const headCenterX = 0;
    const headCenterY = -23 + bob;
    
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < manePoints; i++) {
      const angle = (i * Math.PI * 2) / manePoints;
      const maneX = headCenterX + Math.cos(angle) * maneRadius;
      const maneY = headCenterY + Math.sin(angle) * maneRadius;
      
      ctx.arc(maneX, maneY, 14, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // 4. THE LION FACE (Turning back to face the camera look)
    // Primary golden skin
    ctx.fillStyle = '#f1c40f'; // Bright golden yellow head skin
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, 17, 0, Math.PI * 2);
    ctx.fill();

    // Ears seen from behind or front (back-tilted cute appearance)
    // Left ear
    ctx.fillStyle = '#813200'; // outer shadow
    ctx.beginPath();
    ctx.moveTo(headCenterX - 13, headCenterY - 11);
    ctx.lineTo(headCenterX - 18, headCenterY - 26);
    ctx.lineTo(headCenterX - 4, headCenterY - 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f1c40f'; // yellow ear skin
    ctx.beginPath();
    ctx.moveTo(headCenterX - 11, headCenterY - 13);
    ctx.lineTo(headCenterX - 15, headCenterY - 23);
    ctx.lineTo(headCenterX - 5, headCenterY - 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff9999'; // ear pink center
    ctx.beginPath();
    ctx.arc(headCenterX - 10, headCenterY - 16, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Right ear
    ctx.fillStyle = '#813200'; // outer shadow
    ctx.beginPath();
    ctx.moveTo(headCenterX + 13, headCenterY - 11);
    ctx.lineTo(headCenterX + 18, headCenterY - 26);
    ctx.lineTo(headCenterX + 4, headCenterY - 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f1c40f'; // yellow ear skin
    ctx.beginPath();
    ctx.moveTo(headCenterX + 11, headCenterY - 13);
    ctx.lineTo(headCenterX + 15, headCenterY - 23);
    ctx.lineTo(headCenterX + 5, headCenterY - 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff9999'; // ear pink center
    ctx.beginPath();
    ctx.arc(headCenterX + 10, headCenterY - 16, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // SPARKLY CARTOON EYES looking backward with focus!
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headCenterX - 6, headCenterY - 3, 4, 0, Math.PI * 2);
    ctx.arc(headCenterX + 6, headCenterY - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(headCenterX - 6.2, headCenterY - 2.8, 2, 0, Math.PI * 2);
    ctx.arc(headCenterX + 5.8, headCenterY - 2.8, 2, 0, Math.PI * 2);
    ctx.fill();

    // Tiny white sparkle highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headCenterX - 7, headCenterY - 3.8, 1, 0, Math.PI * 2);
    ctx.arc(headCenterX + 5, headCenterY - 3.8, 1, 0, Math.PI * 2);
    ctx.fill();

    // Snout / Muzzle cheeks
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(headCenterX - 3, headCenterY + 4, 4.5, 0, Math.PI * 2);
    ctx.arc(headCenterX + 3, headCenterY + 4, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Cute dark brown triangular nose
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.moveTo(headCenterX - 3, headCenterY + 1.5);
    ctx.lineTo(headCenterX + 3, headCenterY + 1.5);
    ctx.lineTo(headCenterX, headCenterY + 4.5);
    ctx.closePath();
    ctx.fill();

    // Black cartoon smile
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(headCenterX - 2, headCenterY + 4.5, 2.2, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headCenterX + 2, headCenterY + 4.5, 2.2, 0, Math.PI);
    ctx.stroke();

    // Cute pink cheeks blush!
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.beginPath();
    ctx.arc(headCenterX - 11, headCenterY + 2, 2.5, 0, Math.PI * 2);
    ctx.arc(headCenterX + 11, headCenterY + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawProjected3DStrip = (
    ctx: CanvasRenderingContext2D,
    lane: number,
    yStart: number,
    yEnd: number,
    widthAtPlayerLevel: number,
    fillColor: string | CanvasGradient
  ) => {
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;
    const bottomY = height - 80;

    const getProj = (yVal: number) => {
      const d = Math.max(0.01, (yVal - horizonY) / (bottomY - horizonY));
      const xMid = vanishingX + (getLaneX(lane) - vanishingX) * d;
      const halfW = (widthAtPlayerLevel / 2) * d;
      return { xLeft: xMid - halfW, xRight: xMid + halfW };
    };

    const top = getProj(yStart);
    const bottom = getProj(yEnd);

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(top.xLeft, yStart);
    ctx.lineTo(top.xRight, yStart);
    ctx.lineTo(bottom.xRight, yEnd);
    ctx.lineTo(bottom.xLeft, yEnd);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawCactusObstacle = (ctx: CanvasRenderingContext2D, enemy: Obstacle) => {
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;

    const relativeDepth = (enemy.y - horizonY) / ((height - 80) - horizonY);
    const depth = Math.max(0.01, relativeDepth);
    const renderX = vanishingX + (enemy.x - vanishingX) * depth;
    const renderY = enemy.y;
    const scale = depth;

    // 1. DANGER ZONE WARNING LIGHTS (Rendered in absolute perspective BEFORE translate)
    if (enemy.type === 'vLaser' && enemy.laserWarningTimer > 0) {
      const isFlashing = Math.floor(enemy.laserWarningTimer / 6) % 2 === 0;
      if (isFlashing) {
        // Draw safety strip highlight for vertical lane, scaled beautifully in 3D perspective along the road axis
        drawProjected3DStrip(ctx, enemy.lane, horizonY, height, 44, 'rgba(239, 68, 68, 0.45)');
      }
    }

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);

    // Render Warning exclamation indicator logic for lasers (in scaled 3D context above the cactus)
    if (enemy.type === 'vLaser' && enemy.laserWarningTimer > 0) {
      const isFlashing = Math.floor(enemy.laserWarningTimer / 6) % 2 === 0;
      if (isFlashing) {
        // Draw HUD exclamation mark warning bubble above player (adjust height relative to scale)
        ctx.save();
        ctx.translate(0, -95);
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, -1);
        ctx.restore();
      }
    }

    if (enemy.type === 'hLaser' && enemy.laserWarningTimer > 0) {
      const isFlashing = Math.floor(enemy.laserWarningTimer / 6) % 2 === 0;
      if (isFlashing) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        // Full horizon banner highlighter across the whole 3D width
        ctx.fillRect(-renderX / scale, -16, width / scale, 32);

        // Draw indicator on left and right borders of the screen
        ctx.save();
        ctx.beginPath();
        ctx.arc(-renderX / scale + 35 / scale, 0, 15, 0, Math.PI * 2);
        ctx.arc(-renderX / scale + (width - 35) / scale, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', -renderX / scale + 35 / scale, 0);
        ctx.fillText('⚡', -renderX / scale + (width - 35) / scale, 0);
        ctx.restore();
      }
    }

    // 2. THE CACTUS BODY (Symmetrical & detailed vector art)
    const baseWidth = 22;
    const bodyHeight = 52;

    // Draw shadow on desert floor
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 2, baseWidth * 0.9, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();
    ctx.restore();

    // Main Green trunk
    ctx.fillStyle = '#22543d'; // Rich forest cactus green
    ctx.beginPath();
    ctx.ellipse(0, -bodyHeight / 2, baseWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-baseWidth / 2, -bodyHeight / 2, baseWidth, bodyHeight / 2);

    // Left curved branch arm
    ctx.strokeStyle = '#22543d';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-baseWidth * 0.35, -bodyHeight * 0.45);
    ctx.quadraticCurveTo(-26, -bodyHeight * 0.45, -26, -bodyHeight * 0.8);
    ctx.stroke();

    // Right curved branch arm
    ctx.beginPath();
    ctx.moveTo(baseWidth * 0.35, -bodyHeight * 0.28);
    ctx.quadraticCurveTo(28, -bodyHeight * 0.28, 28, -bodyHeight * 0.65);
    ctx.stroke();

    // 3. SCI-FI LASER RADAR EYE (Red visors indicating laser capabilities)
    if (enemy.type === 'vLaser' || enemy.type === 'hLaser') {
      ctx.fillStyle = '#ef4444';
      
      // Cyber tactical visor
      ctx.beginPath();
      ctx.roundRect(-8, -bodyHeight * 0.88, 16, 6, 2);
      ctx.fill();
      
      // Visor glowing iris
      ctx.fillStyle = '#ffffff';
      const eyeOsc = Math.sin(Date.now() / 60) * 4;
      ctx.beginPath();
      ctx.arc(eyeOsc, -bodyHeight * 0.88 + 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. DIKENLER (Prickly spikes along outlines)
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.3;
    const spikeSize = 4.5;
    
    const drawSpike = (sx: number, sy: number, rx: number, ry: number) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + rx, sy + ry);
      ctx.stroke();
    };

    // Draw various spikes
    drawSpike(0, -bodyHeight - 1, 0, -spikeSize); // Top spikes
    drawSpike(-baseWidth / 2, -bodyHeight * 0.3, -spikeSize, -1);
    drawSpike(baseWidth / 2, -bodyHeight * 0.45, spikeSize, -1);
    drawSpike(-26, -bodyHeight * 0.8, -spikeSize * 0.7, -spikeSize * 0.7); // Branch tips
    drawSpike(28, -bodyHeight * 0.65, spikeSize * 0.7, -spikeSize * 0.7);

    ctx.restore();
  };

  const drawHamburger = (ctx: CanvasRenderingContext2D, c: Collectible) => {
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;

    const relativeDepth = (c.y - horizonY) / ((height - 80) - horizonY);
    const depth = Math.max(0.01, relativeDepth);
    const renderX = vanishingX + (c.x - vanishingX) * depth;
    const renderY = c.y;
    const scale = depth;

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);
    
    // Slight rocking animation instead of full wild spin for realistic food
    const rockAngle = Math.sin(Date.now() / 200) * 0.15;
    ctx.rotate(rockAngle);
    
    // Scale slightly based on hover/pulse
    const pulseScale = 1 + Math.sin(Date.now() / 150) * 0.05;
    ctx.scale(pulseScale, pulseScale);

    // Draw shadow on ground
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 15, 12, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    ctx.restore();

    // 1. Bottom Bun (Golden Brown)
    ctx.fillStyle = '#b45309'; // amber-700 / brown
    ctx.beginPath();
    ctx.ellipse(0, 7, 13, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Burger Patty (Deep Brown)
    ctx.fillStyle = '#451a03'; // brown-950 extremely dark brown
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Melted Cheese Slice (Bright Yellow)
    ctx.fillStyle = '#fbbf24'; // amber-400
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.lineTo(13, 2);
    ctx.lineTo(9, 5); // dripping corner
    ctx.lineTo(3, 2);
    ctx.lineTo(-4, 5); // dripping corner
    ctx.lineTo(-9, 2);
    ctx.closePath();
    ctx.fill();

    // 4. Fresh Lettuce (Green, wavy)
    ctx.fillStyle = '#22c55e'; // green-500
    ctx.beginPath();
    ctx.ellipse(0, -1, 14, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wave details on lettuce
    ctx.fillStyle = '#15803d'; // green-700
    ctx.beginPath();
    ctx.arc(-8, -1, 2.5, 0, Math.PI * 2);
    ctx.arc(0, -1, 2.5, 0, Math.PI * 2);
    ctx.arc(8, -1, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Top Bun (Golden brown dome)
    ctx.fillStyle = '#f59e0b'; // amber-500
    ctx.beginPath();
    ctx.arc(0, -2, 13, Math.PI, 0); // half circle dome
    ctx.closePath();
    ctx.fill();
    
    // Highlight on top bun
    ctx.fillStyle = '#fbbf24'; // bright highlights
    ctx.beginPath();
    ctx.ellipse(-4, -7, 3, 1.5, -Math.PI/6, 0, Math.PI * 2);
    ctx.fill();

    // 6. Sesame Seeds (Tiny white specks on Top Bun)
    ctx.fillStyle = '#ffffff';
    ctx.font = '6px sans-serif';
    ctx.fillText('•', -5, -5);
    ctx.fillText('•', 0, -8);
    ctx.fillText('•', 5, -6);

    ctx.restore();
  };

  const drawOasisShieldItem = (ctx: CanvasRenderingContext2D, c: Collectible) => {
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;

    const relativeDepth = (c.y - horizonY) / ((height - 80) - horizonY);
    const depth = Math.max(0.01, relativeDepth);
    const renderX = vanishingX + (c.x - vanishingX) * depth;
    const renderY = c.y;
    const scale = depth;

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);

    // Bouncing animation
    const bounceOffset = Math.sin(Date.now() / 150) * 4.5;
    ctx.translate(0, bounceOffset);

    // Outer concentric magic ring (extremely fast vector alternative to shadowBlur)
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Rotating glowing magical orb
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    const bubbleGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 17);
    bubbleGrad.addColorStop(0, '#ffffff');
    bubbleGrad.addColorStop(1, 'rgba(59, 130, 246, 0.75)');
    ctx.fillStyle = bubbleGrad;
    ctx.fill();
    ctx.restore();

    // Shiny outer ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-3, -3, 13, 0, Math.PI, true);
    ctx.stroke();

    // 3. THE WATER DROPLET (Vaha Suyu)
    ctx.beginPath();
    ctx.moveTo(0, -9);
    // Draw fluid droplet base curves
    ctx.bezierCurveTo(9, 2, 8, 11, 0, 11);
    ctx.bezierCurveTo(-8, 11, -9, 2, 0, -9);
    ctx.closePath();

    const waterGrad = ctx.createLinearGradient(0, -9, 0, 11);
    waterGrad.addColorStop(0, '#93c5fd'); // soft ice blue
    waterGrad.addColorStop(1, '#1d4ed8'); // deep ocean water
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Little specular highlight flare
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, 3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawLaserBeams = (ctx: CanvasRenderingContext2D, enemy: Obstacle) => {
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;

    // 1. DİKEY LAZER (Vertical beam fired downwards)
    if (enemy.type === 'vLaser' && enemy.laserTriggered && enemy.laserTimer > 0) {
      ctx.save();

      // Translucent fading beam
      const beamAlpha = Math.min(1.0, enemy.laserTimer / 10);
      const baseBeamWidth = 24 + Math.sin(enemy.laserTimer * 0.8) * 4;

      // Project top point (at cactus source Y)
      const depthTop = Math.max(0.01, (enemy.y - horizonY) / ((height - 80) - horizonY));
      const xTop = vanishingX + (getLaneX(enemy.lane) - vanishingX) * depthTop;
      const wTop = baseBeamWidth * depthTop;

      // Project bottom point (at screen bottom Y)
      const depthBottom = Math.max(0.01, (height - horizonY) / ((height - 80) - horizonY));
      const xBottom = vanishingX + (getLaneX(enemy.lane) - vanishingX) * depthBottom;
      const wBottom = baseBeamWidth * depthBottom;

      // Create a gradient across the trapezoid width at the bottom for beautiful glow
      const lGrad = ctx.createLinearGradient(xBottom - wBottom / 2, 0, xBottom + wBottom / 2, 0);
      lGrad.addColorStop(0, `rgba(239, 68, 68, 0.0)`);
      lGrad.addColorStop(0.3, `rgba(239, 68, 68, ${0.75 * beamAlpha})`);
      lGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.98 * beamAlpha})`);
      lGrad.addColorStop(0.7, `rgba(239, 68, 68, ${0.75 * beamAlpha})`);
      lGrad.addColorStop(1, `rgba(239, 68, 68, 0.0)`);

      // Draw the laser safety outer glow zone (wider)
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 * beamAlpha})`;
      ctx.beginPath();
      ctx.moveTo(xTop - wTop * 1.5, enemy.y);
      ctx.lineTo(xTop + wTop * 1.5, enemy.y);
      ctx.lineTo(xBottom + wBottom * 1.5, height);
      ctx.lineTo(xBottom - wBottom * 1.5, height);
      ctx.closePath();
      ctx.fill();

      // Firing actual core laser trapezoid
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.moveTo(xTop - wTop / 2, enemy.y);
      ctx.lineTo(xTop + wTop / 2, enemy.y);
      ctx.lineTo(xBottom + wBottom / 2, height);
      ctx.lineTo(xBottom - wBottom / 2, height);
      ctx.closePath();
      ctx.fill();

      // Electro static crackles on the beam converging with perspective
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.8 * depthTop);
      ctx.beginPath();
      let currentY = enemy.y;
      ctx.moveTo(xTop, currentY);
      while (currentY < height) {
        currentY += 15 + Math.random() * 20;
        const currentDepth = Math.max(0.01, (currentY - horizonY) / ((height - 80) - horizonY));
        const currentX = vanishingX + (getLaneX(enemy.lane) - vanishingX) * currentDepth;
        const currentW = baseBeamWidth * currentDepth;
        const dispX = currentX + (Math.random() - 0.5) * (currentW - 4);
        ctx.lineTo(dispX, Math.min(currentY, height));
      }
      ctx.globalAlpha = 0.5 * beamAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1.0; // Reset to solid state

      ctx.restore();
    }

    // 2. YATAY LAZER (Horizontal full widescreen beam)
    if (enemy.type === 'hLaser' && enemy.laserTriggered && enemy.laserTimer > 0) {
      ctx.save();

      const beamAlpha = Math.min(1.0, enemy.laserTimer / 10);
      const relativeDepth = (enemy.y - horizonY) / ((height - 80) - horizonY);
      const depth = Math.max(0.01, relativeDepth);
      const beamHeight = (18 + Math.sin(enemy.laserTimer * 0.8) * 3) * depth;

      const hGrad = ctx.createLinearGradient(0, enemy.y - beamHeight / 2, 0, enemy.y + beamHeight / 2);
      hGrad.addColorStop(0, `rgba(239, 68, 68, ${0.15 * beamAlpha})`);
      hGrad.addColorStop(0.25, `rgba(239, 68, 68, ${0.85 * beamAlpha})`);
      hGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.98 * beamAlpha})`);
      hGrad.addColorStop(0.75, `rgba(239, 68, 68, ${0.85 * beamAlpha})`);
      hGrad.addColorStop(1, `rgba(239, 68, 68, ${0.15 * beamAlpha})`);

      ctx.save();
      // Fluorescent outer envelope glow (super-fast hardware vector layer)
      ctx.fillStyle = `rgba(239, 68, 68, ${0.18 * beamAlpha})`;
      ctx.fillRect(0, enemy.y - (beamHeight + 12 * depth) / 2, width, beamHeight + 12 * depth);

      ctx.fillStyle = hGrad;
      ctx.fillRect(0, enemy.y - beamHeight / 2, width, beamHeight);
      ctx.restore();

      // Horizontally travelling lightning bolt inside beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 2 * depth);
      ctx.beginPath();
      let currentX = 0;
      ctx.moveTo(currentX, enemy.y);
      while (currentX < width) {
        currentX += 18 + Math.random() * 25;
        const dispY = enemy.y + (Math.random() - 0.5) * (beamHeight - 4);
        ctx.lineTo(Math.min(currentX, width), dispY);
      }
      ctx.globalAlpha = 0.6 * beamAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1.0; // Reset to solid state

      ctx.restore();
    }
  };

  const drawScorePopupsAndParticles = (ctx: CanvasRenderingContext2D) => {
    const state = stateRef.current;
    const { width, height } = dimensions;
    const horizonY = height * 0.42;
    const vanishingX = width / 2;
    
    // Draw dust & collections particles
    state.particles.forEach((p, index) => {
      // Apply movement physics
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Fade out dynamically relative to remaining life
      p.alpha = Math.max(0, p.life / p.maxLife);

      // Project the particle coordinates to 3D space
      const relativeDepth = (p.y - horizonY) / ((height - 80) - horizonY);
      const depth = Math.max(0.01, relativeDepth);
      const renderX = vanishingX + (p.x - vanishingX) * depth;
      const renderY = p.y;
      const renderSize = p.size * depth;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(renderX, renderY, Math.max(0.2, renderSize), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.life <= 0) {
        state.particles.splice(index, 1);
      }
    });
  };

  // --- GAMEPLAY MANTIĞI VE DÖNGÜ (ENGINE RUNNER) ---

  useEffect(() => {
    let animationId: number;

    const gameLoop = () => {
      if (playState === 'PLAYING') {
        updateGameMath();

        // Throttled React state score updates (every 20 frames = ~3 times a second)
        // This eliminates massive Virtual DOM reconciliation cycles and makes the game incredibly lag-free!
        const nextIntScore = Math.floor(stateRef.current.score);
        if (stateRef.current.frameCount % 20 === 0) {
          if (nextIntScore !== stateRef.current.renderedScore) {
            stateRef.current.renderedScore = nextIntScore;
            setScore(nextIntScore);
            if (nextIntScore > highScore) {
              setHighScore(nextIntScore);
            }
          }
        }

        // Throttled React state shield updates (every 10 frames = ~6 times a second)
        if (stateRef.current.frameCount % 10 === 0) {
          if (stateRef.current.player.shieldActive !== activeShield) {
            setActiveShield(stateRef.current.player.shieldActive);
          }
          const expectedShieldTime = stateRef.current.player.shieldActive ? stateRef.current.player.shieldTimer : 0;
          if (expectedShieldTime !== shieldTimeLeft) {
            setShieldTimeLeft(expectedShieldTime);
          }
        }
      }
      renderGameFrame();
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [playState, dimensions, highScore, activeShield, shieldTimeLeft]);

  const updateGameMath = () => {
    const state = stateRef.current;
    const { width, height } = dimensions;

    state.frameCount++;
    
    const dSettings = state.difficultySettings || {
      initialSpeed: INITIAL_SPEED,
      maxSpeed: MAX_SPEED,
      acceleration: ACCELERATION,
      laserWarningDuration: LASER_WARNING_DURATION,
      spawnPeriodBase: 95,
    };

    // 1. DISTANCE ACCUMULATION & LEVEL CHECKPOINT EVALUATIONS
    state.distanceValue += state.speed * 0.012;

    // Evaluate active zone boundaries
    let nextLevel = 1;
    if (state.distanceValue >= 2500) {
      if (!state.victory) {
        state.victory = true;
        setIsVictorious(true); // Pop-up victory React modal
        audioSynth.playCollectShield(); // Play beautiful victory melody
        state.obstacles = [];
        state.collectibles = [];
      }
      return; // Stop math execution
    } else if (state.distanceValue >= 1900) {
      nextLevel = 5;
    } else if (state.distanceValue >= 1400) {
      nextLevel = 4;
    } else if (state.distanceValue >= 900) {
      nextLevel = 3;
    } else if (state.distanceValue >= 400) {
      nextLevel = 2;
    }

    // Trigger level advancement events (displays grand visual banners on the screen)
    if (nextLevel !== state.level) {
      state.level = nextLevel;
      state.levelUpMessageTimer = 110; // visual banner stays active for ~1.8 seconds

      let levelTitleStr = '';
      if (nextLevel === 2) levelTitleStr = 'BÖLÜM 2: KIZIL TEHLİKE!';
      else if (nextLevel === 3) levelTitleStr = 'BÖLÜM 3: SİBER GÜNBATIMI!';
      else if (nextLevel === 4) levelTitleStr = 'BÖLÜM 4: DİJİTAL FIRTINA!';
      else if (nextLevel === 5) levelTitleStr = 'BÖLÜM 5: KOZMİK VAHA FİNALİ!';

      state.levelUpBannerText = levelTitleStr;
      audioSynth.playCollectShield(); // play pleasant notification tone
    }

    if (state.levelUpMessageTimer > 0) {
      state.levelUpMessageTimer--;
    }

    // Determine target speed limit based on active level
    let targetSpeedLimit = dSettings.initialSpeed; // Normal speed for Level 1 & 2
    if (state.level === 3) {
      targetSpeedLimit = dSettings.initialSpeed + 1.8; // increased speed
    } else if (state.level === 4) {
      targetSpeedLimit = dSettings.initialSpeed + 3.5; // frantic speed
    } else if (state.level === 5) {
      targetSpeedLimit = dSettings.initialSpeed + 5.5; // extreme cosmic speed warp!
    }

    // Smoothly transition speed rate towards the active level's target speed limit
    if (state.speed < targetSpeedLimit) {
      state.speed += 0.04;
    } else if (state.speed > targetSpeedLimit) {
      state.speed -= 0.04;
    }

    // Gradually increment survival score
    state.score += 0.08 * (state.speed / dSettings.initialSpeed);

    // Animate character frames
    state.player.animFrame++;

    // 1. SMOOTH PLAYER LERB
    // Linearly interpolate player's active x towards target lane position (highly smooth for kids)
    state.player.x += (state.player.targetX - state.player.x) * 0.14;

    // 2. GRAVITY & Z-HEIGHT MECHANICS for JUMP
    if (state.player.isJumping) {
      state.player.vz += BASE_GRAVITY;
      state.player.z -= state.player.vz;

      // Check landing collision threshold
      if (state.player.z <= 0) {
        state.player.z = 0;
        state.player.vz = 0;
        state.player.isJumping = false;
      }
    }

    // 3. SHIELD DOWNCOUNTER
    if (state.player.shieldActive) {
      state.player.shieldTimer--;
      
      // Flash a warnings trigger when shield has only 0.7s remaining
      if (state.player.shieldTimer === 45 || state.player.shieldTimer === 23) {
        audioSynth.playShieldWarning();
      }

      if (state.player.shieldTimer <= 0) {
        state.player.shieldActive = false;
      }
    }

    // 4. RANDOM DUST PARTICLES (Gives a visual sensation of high running speed)
    state.dustParticleTimer++;
    const horizonY = height * 0.42;
    if (state.dustParticleTimer >= 3) {
      state.dustParticleTimer = 0;
      // Add a dusty particle flying past the screen
      const dustLane = Math.floor(Math.random() * LANE_COUNT) as 0 | 1 | 2;
      state.particles.push({
        id: Math.random().toString(36).substring(2, 9),
        x: getLaneX(dustLane) + (Math.random() - 0.5) * 60,
        y: horizonY, // spawn perfectly at horizon
        vx: (Math.random() - 0.5) * 1.5,
        vy: state.speed * 1.05, // travel back faster than game speed
        size: 1 + Math.random() * 2.5,
        color: '#ffcc55', // sand-yellow dust
        alpha: 0.15,
        life: 58,
        maxLife: 58,
      });
    }

    // 5. SPONTANEOUSLY SPAWNED ENGINES (Cacti & Crystals)
    // Dynamic spawn timers based on speed rate
    const spawnPeriod = Math.max(50, Math.floor(dSettings.spawnPeriodBase / (state.speed / dSettings.initialSpeed)));
    if (state.frameCount % spawnPeriod === 0) {
      const targetLane = Math.floor(Math.random() * LANE_COUNT) as Lane;
      const decider = Math.random();

      if (decider < 0.62) {
        // Build cacti obstacle
        let cactusType: ObstacleType = 'normal';
        
        // Spawn lasers only if level >= 2
        if (state.level >= 2) {
          const laserChance = Math.random();
          const lastObs = state.obstacles.length > 0 ? state.obstacles[state.obstacles.length - 1] : null;
          const wasLastObsLaser = lastObs ? (lastObs.type === 'vLaser' || lastObs.type === 'hLaser') : false;
          const frameDiff = state.frameCount - state.lastLaserFrame;
          const tooSoon = frameDiff < (spawnPeriod * 3.0); // buffer between lasers
          
          if (!wasLastObsLaser && !tooSoon) {
            // Determine laser type thresholds based on level difficulty
            let vLaserThreshold = 0.10; // Level 2: 10% vertical laser chance
            let hLaserThreshold = 0.0;  // Level 2: 0% horizontal laser chance (no high lasers in Lv 2!)
            
            if (state.level === 3) {
              vLaserThreshold = 0.14;
              hLaserThreshold = 0.06;
            } else if (state.level === 4) {
              vLaserThreshold = 0.18;
              hLaserThreshold = 0.10;
            } else if (state.level === 5) {
              vLaserThreshold = 0.22;
              hLaserThreshold = 0.13;
            }

            if (laserChance < vLaserThreshold) {
              cactusType = 'vLaser';
              state.lastLaserFrame = state.frameCount;
            } else if (laserChance < vLaserThreshold + hLaserThreshold) {
              cactusType = 'hLaser';
              state.lastLaserFrame = state.frameCount;
            }
          }
        }

        state.obstacles.push({
          id: `obs_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: horizonY, // spawn perfectly at horizon
          type: cactusType,
          width: 32,
          height: 52,
          laserTriggered: false,
          laserWarningTimer: dSettings.laserWarningDuration,
          laserTimer: LASER_ACTIVE_DURATION,
          isPassed: false,
        });
      } else {
        // Build items
        const isOasisWater = Math.random() < 0.18; // 18% chance for shield water, 82% for delicious hamburger
        state.collectibles.push({
          id: `item_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: horizonY, // spawn perfectly at horizon
          type: isOasisWater ? 'oasis' : 'hamburger',
          width: 30,
          height: 30,
          angle: 0,
          isCollected: false,
        });
      }
    }

    // 6. UPDATE CACTI AND DETECT CRASHES
    state.obstacles.forEach((obs, index) => {
      // 3D perspective scroll speed factor (larger size as it gets near)
      const relativeDepth = (obs.y - horizonY) / ((height - 80) - horizonY); // math correct!
      const obsSpeed = state.speed * (0.35 + Math.max(0, relativeDepth) * 0.85);
      obs.y += obsSpeed;

      // Handle continuous warning / active laser routines
      if (obs.type === 'vLaser' || obs.type === 'hLaser') {
        if (obs.laserWarningTimer > 0) {
          obs.laserWarningTimer--;
          if (obs.laserWarningTimer === 0) {
            obs.laserTriggered = true;
            // play laser sound
            audioSynth.playLaserActive();
          }
        } else if (obs.laserTriggered && obs.laserTimer > 0) {
          obs.laserTimer--;
          
          // Re-buzz audio periodically for laser stream
          if (obs.laserTimer % 12 === 0 && obs.laserTimer > 0) {
            audioSynth.playLaserActive();
          }
          
          if (obs.laserTimer <= 0) {
            obs.laserTriggered = false;
          }
        }
      }

      // Check collision coordinates
      const distToPlayerY = Math.abs(obs.y - state.player.y);
      const isOverlappingY = distToPlayerY < 32;

      // [CRITICAL] Horizontal Laser overlaps all lanes!
      if (obs.type === 'hLaser' && obs.laserTriggered && obs.laserTimer > 0) {
        // player must jump over this high horizontal beam
        // beam is hot between its coordinate y, and player only escapes if their height z is high enough (e.g., z >= 35)
        const withinBeamY = Math.abs(obs.y - state.player.y) < 42;
        if (withinBeamY && state.player.z < 38) {
          if (state.player.shieldActive) {
            // absorb hit
            obs.laserTriggered = false;
            obs.laserTimer = 0;
            // pop shield
            state.player.shieldActive = false;
            spawnExplosion(state.player.x, state.player.y - 20, '#06b6d4', 20);
            audioSynth.playShieldWarning();
          } else {
            handleCollisionDeath();
          }
        }
      }

      // [CRITICAL] Vertical Laser fires straight down the specific lane
      if (obs.type === 'vLaser' && obs.laserTriggered && obs.laserTimer > 0) {
        // laser beam is covering the lane, and player dies if they enter it, UNLESS they jump way over it!
        const isInSameLane = state.player.lane === obs.lane;
        // checking if horizontal lerped x coordinate is also inside the beam path
        const isPhysicallyCollidingX = Math.abs(state.player.x - obs.x) < 22;
        if (isInSameLane || isPhysicallyCollidingX) {
          if (state.player.z < 35) { // laser is powerful but a massive jump still clears it
            if (state.player.shieldActive) {
              obs.laserTriggered = false;
              obs.laserTimer = 0;
              state.player.shieldActive = false;
              spawnExplosion(state.player.x, state.player.y - 20, '#06b6d4', 20);
              audioSynth.playShieldWarning();
            } else {
              handleCollisionDeath();
            }
          }
        }
      }

      // [CRITICAL] Normal physical Cactus crash (or crash on empty non-active laser cacti bodies)
      if (isOverlappingY && state.player.lane === obs.lane) {
        // A collision occurs only when player's jump height is too low to clear the physical model
        if (state.player.z < 32) {
          if (state.player.shieldActive) {
            // Destroy physical cactus and pop shield!
            state.obstacles.splice(index, 1);
            state.player.shieldActive = false;
            spawnExplosion(obs.x, obs.y - 25, '#22543d', 18);
            spawnExplosion(state.player.x, state.player.y - 20, '#06b6d4', 20);
            audioSynth.playShieldWarning();
          } else {
            handleCollisionDeath();
          }
        }
      }

      // Earn minor score points for successfully passing obstacles
      if (!obs.isPassed && obs.y > state.player.y + 12) {
        obs.isPassed = true;
        state.score += 15;
      }

      // Clear off-screen entities
      if (obs.y > height + 100) {
        state.obstacles.splice(index, 1);
      }
    });

    // 7. COLLECT CYRSTALS AND DRINK SHIELD WATER
    state.collectibles.forEach((item, index) => {
      // 3D perspective velocity
      const relativeDepth = (item.y - horizonY) / ((height - 80) - horizonY);
      item.y += state.speed * (0.35 + Math.max(0, relativeDepth) * 0.85);
      item.angle += 0.05; // Spin rotation

      const distY = Math.abs(item.y - state.player.y);
      const isNearY = distY < 35;
      const isInSameLane = state.player.lane === item.lane;

      if (isNearY && isInSameLane) {
        // Grab item
        item.isCollected = true;
        
        if (item.type === 'hamburger') {
          // Play pick audio and update score state
          audioSynth.playCollectCrystal();
          state.score += 50;
          onCoinsCollected(1); // Notify tracker count
          spawnExplosion(item.x, item.y, '#fbbf24', 12);
        } else if (item.type === 'oasis') {
          // Play obtain kalkan audio
          audioSynth.playCollectShield();
          state.player.shieldActive = true;
          // Set shield timing (180 frames = 3 seconds at 60fps)
          state.player.shieldTimer = state.player.maxShieldTimer;
          spawnExplosion(item.x, item.y, '#3b82f6', 20);
        }
        
        // delete from pool
        state.collectibles.splice(index, 1);
      }

      // Garbage collect out of screen bottom
      if (item.y > height + 80) {
        state.collectibles.splice(index, 1);
      }
    });
  };

  const handleCollisionDeath = () => {
    // Blast with hit synth and invoke parent crash triggers
    audioSynth.playHit();
    audioSynth.playGameOver();
    
    const finalScore = Math.floor(stateRef.current.score);
    // Directly set score and highscore to parent so it's precisely updated on the Game Over screen
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
    }
    
    onGameOver(finalScore);

    // Blast lovely cloud particles around the dead character
    const playerObj = stateRef.current.player;
    spawnExplosion(playerObj.x, playerObj.y - 20, '#f1c40f', 24);
    spawnExplosion(playerObj.x, playerObj.y - 20, '#813200', 16);
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return '#3b82f6'; // Sakin Sky Blue
      case 2: return '#dc2626'; // Hot Crimson Red
      case 3: return '#a855f7'; // Synthwave Neon Purple
      case 4: return '#06b6d4'; // Electric Lightning Cyan
      case 5: return '#f472b6'; // Cosmic Supernova Pink
      default: return '#fb923c';
    }
  };

  const drawHUD = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;
    
    // Draw only during PLAYING state
    if (playState !== 'PLAYING') return;

    ctx.save();
    
    // 1. TOP HUD CONTAINER BAR (Semi-translucent dark glassmorphism combo)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = getLevelBorderColor(state.level); // glows in active level color!
    ctx.lineWidth = 2;
    
    const hudY = 12;
    const hudHeight = 38;
    const hudWidth = width - 24;
    const hudX = 12;
    
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 10);
    ctx.fill();
    ctx.stroke();
    
    // 2. HAMBURGER COUNT (Left section of HUD)
    ctx.font = 'bold 13px "JetBrains Mono", var(--font-mono), monospace';
    ctx.fillStyle = '#fbbf24'; // amber-400
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🍔 ${state.itemsCollected}`, hudX + 14, hudY + hudHeight / 2);

    // 3. LEVEL & DISTANCE BAR (Center section)
    let levelStart = 0;
    let levelTarget = 400;
    if (state.level === 2) { levelStart = 400; levelTarget = 900; }
    else if (state.level === 3) { levelStart = 900; levelTarget = 1400; }
    else if (state.level === 4) { levelStart = 1400; levelTarget = 1900; }
    else if (state.level === 5) { levelStart = 1900; levelTarget = 2500; }

    const levelProg = Math.min(1.0, Math.max(0, (state.distanceValue - levelStart) / (levelTarget - levelStart)));
    
    const barX = hudX + 70;
    const barWidth = width * 0.28;
    const barY = hudY + hudHeight / 2 - 4;
    
    // Draw level progress track
    ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.beginPath();
    ctx.roundRect(barX, barY + 4, barWidth, 6, 3);
    ctx.fill();
    
    // Draw active level progress using level-specific color
    const activeBarWidth = barWidth * levelProg;
    ctx.fillStyle = getLevelColor(state.level);
    ctx.beginPath();
    ctx.roundRect(barX, barY + 4, activeBarWidth, 6, 3);
    ctx.fill();
    
    // Level & Distance label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", var(--font-mono), monospace';
    ctx.fillText(`BÖLÜM ${state.level} • ${Math.floor(state.distanceValue)}m`, barX, barY - 1);

    // 4. INSTANT LIVE SCORE (Right section, glowing orange-gold)
    ctx.textAlign = 'right';
    ctx.font = '800 15px "JetBrains Mono", var(--font-mono), monospace';
    
    const displayScore = Math.floor(state.score);
    if (displayScore > highScore && highScore > 0) {
      ctx.fillStyle = '#facc15'; // golden high score glow
      ctx.fillText(`🏆 REKOR: ${displayScore}`, hudX + hudWidth - 14, hudY + hudHeight / 2);
    } else {
      ctx.fillStyle = '#f97316'; // orange-500
      ctx.fillText(`SKOR: ${displayScore}`, hudX + hudWidth - 14, hudY + hudHeight / 2);
    }

    ctx.restore();
  };

  const renderGameFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw scenes
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    drawParallaxBackground(ctx);
    drawLanes(ctx);

    const state = stateRef.current;

    // Render coins, hamburgers, and vaha suyu (only spawn/render if we are actually playing or have some)
    state.collectibles.forEach((item) => {
      if (item.type === 'hamburger') {
        drawHamburger(ctx, item);
      } else {
        drawOasisShieldItem(ctx, item);
      }
    });

    // Render cacti and lasers
    state.obstacles.forEach((obs) => {
      drawCactusObstacle(ctx, obs);
      drawLaserBeams(ctx, obs);
    });

    // Render active player
    drawLionCharacter(ctx, state.player);

    // Render particles
    drawScorePopupsAndParticles(ctx);

    // Render beautiful HUD overlay
    drawHUD(ctx);

    // 5. RENDER GIANT LEVEL UP BANNER (Floating overlay in Turkish, glowing and animated!)
    if (state.levelUpMessageTimer > 0) {
      ctx.save();
      const alpha = Math.min(1.0, state.levelUpMessageTimer / 15);
      
      // Black translucent ribbon background across the center
      ctx.fillStyle = `rgba(15, 23, 42, ${0.80 * alpha})`;
      ctx.fillRect(0, dimensions.height * 0.42 - 30, dimensions.width, 60);
      
      // Top and bottom glowing accent lines
      ctx.fillStyle = getLevelColor(state.level);
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, dimensions.height * 0.42 - 32, dimensions.width, 2);
      ctx.fillRect(0, dimensions.height * 0.42 + 30, dimensions.width, 2);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Primary text shadow
      ctx.font = '800 17px "Space Grotesk", var(--font-sans), sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(state.levelUpBannerText, dimensions.width / 2 + 1.2, dimensions.height * 0.42 - 4 + 1.2);

      // Primary glowing text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.levelUpBannerText, dimensions.width / 2, dimensions.height * 0.42 - 4);

      // Helper sub-message
      ctx.font = 'bold 9px "JetBrains Mono", var(--font-sans), sans-serif';
      ctx.fillStyle = getLevelColor(state.level);
      ctx.fillText("HIZ VE ENGELLER GÜNCELLENDİ!", dimensions.width / 2, dimensions.height * 0.42 + 15);
      
      ctx.restore();
    }
  };

  // --- MOBİL DOKUNMATİK KAYDIRMA (TOUCH SWIPE INTERCEPTORS) ---

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchStartY.current = e.changedTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    const threshold = 35; // swipe sensitivity threshold in pixels

    // Detect direction based on dominant coordinate axis difference
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > threshold) {
        laneShiftRight();
      } else if (diffX < -threshold) {
        laneShiftLeft();
      }
    } else {
      if (diffY < -threshold) {
        triggerJump();
      }
    }
  };

  // --- LANE SHIFT ROUTERS ---

  const laneShiftLeft = () => {
    const state = stateRef.current;
    if (state.player.lane > 0) {
      state.player.lane = (state.player.lane - 1) as 0 | 1 | 2;
      state.player.targetX = getLaneX(state.player.lane);
      // Give a slight tilt or play quick audio tick if wanted
    }
  };

  const laneShiftRight = () => {
    const state = stateRef.current;
    if (state.player.lane < LANE_COUNT - 1) {
      state.player.lane = (state.player.lane + 1) as 0 | 1 | 2;
      state.player.targetX = getLaneX(state.player.lane);
    }
  };

  const triggerJump = () => {
    const state = stateRef.current;
    if (!state.player.isJumping) {
      state.player.isJumping = true;
      state.player.vz = JUMP_FORCE;
      audioSynth.playJump();
    }
  };

  // Intercept Keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (playState !== 'PLAYING') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        laneShiftLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        laneShiftRight();
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        triggerJump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playState, dimensions]);

  return (
    <div
      ref={containerRef}
      id="gameCanvasWrapper"
      className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden shadow-2xl rounded-2xl border-4 border-slate-800"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        id="gameCanvas"
        width={dimensions.width}
        height={dimensions.height}
        className="block bg-slate-900 cursor-crosshair focus:outline-none"
        onClick={() => {
          // Focus wrapper/game container to capture keypad events
          canvasRef.current?.focus();
        }}
      />

      {/* --- REKOR / ZAFER KAZANMA ÖZEL OVERLAY --- */}
      {isVictorious && (
        <div id="victoryOverlay" className="absolute inset-x-4 max-w-sm mx-auto bg-slate-900/95 backdrop-blur-md p-5 border-4 border-amber-400 rounded-2xl z-40 text-center shadow-2xl animate-fade-in animate-duration-300">
          <div className="relative text-5xl mb-2 animate-bounce">🦁🏆✨</div>
          <h2 className="text-2xl font-extrabold text-amber-500 tracking-tight mb-1 uppercase drop-shadow">ŞAMPİYON ASLAN!</h2>
          <div className="w-12 h-1 bg-amber-400 mx-auto rounded mb-3" />
          
          <p className="text-slate-200 text-xs px-2.5 mb-4 leading-relaxed bg-slate-950/75 py-2.5 rounded-lg border border-slate-800">
            Tebrikler! Müthiş reflekslerin sayesinde aslanımızı siber çölün engellerinden tam <strong className="text-amber-300">2500m</strong> kaçırarak nihai yeşil <strong className="text-emerald-400">Vahaya</strong> ulaştırdın! Kazandın! 🎉
          </p>

          <div className="bg-slate-950/90 rounded-xl px-4 py-3 mb-4 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
              <span>Toplam Hamburger:</span>
              <span className="text-amber-400 font-bold">🍔 {stateRef.current.itemsCollected} Adet</span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
              <span>Kazanılan Skor:</span>
              <span className="text-emerald-400 font-extrabold">{Math.floor(stateRef.current.score)} Puan</span>
            </div>
          </div>

          <button
            id="btnVictoryReset"
            type="button"
            onClick={() => {
              resetGameData();
              setOnRestartRequest(true);
            }}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md active:scale-95 transition-all cursor-pointer border-b-4 border-amber-700 hover:border-amber-600"
          >
            Yeniden Başlat
          </button>
        </div>
      )}

    </div>
  );
};
