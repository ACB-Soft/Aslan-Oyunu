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

  // References to keep state across animation frames without triggering constant React re-renders
  const stateRef = useRef({
    speed: INITIAL_SPEED,
    frameCount: 0,
    itemsCollected: 0,
    score: 0,
    renderedScore: 0,
    powerupState: 'playing' as 'intro_eating' | 'playing',
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

    // A single continuous cohesive warm sunset gradient spanning the full canvas height (no split look)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#781d00');     // Rich deep sunset red top
    bgGrad.addColorStop(0.35, '#c2410c');  // Warm orange-red sky
    bgGrad.addColorStop(0.55, '#ea580c');  // Golden orange horizon
    bgGrad.addColorStop(0.75, '#be185d');  // Soft dusky transition pinkish-orange
    bgGrad.addColorStop(1, '#7c2d12');     // Ground deep warm terracotta terracotta
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Render a large glowing sunset sun with fast vector concentric glow rings
    ctx.save();
    
    // Ambient Outer Corona 2
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.38, 110, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.07)';
    ctx.fill();

    // Ambient Outer Corona 1
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.38, 88, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
    ctx.fill();

    // Central Radiant Sun body
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.38, 68, 0, Math.PI * 2);
    const sunGrad = ctx.createRadialGradient(width * 0.5, height * 0.38, 2, width * 0.5, height * 0.38, 68);
    sunGrad.addColorStop(0, '#fffbeb');   // bright warm core
    sunGrad.addColorStop(0.3, '#fef08a');  // glowing warm yellow
    sunGrad.addColorStop(0.7, '#f97316');  // sunset orange edge
    sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0.1)'); // ambient glow dissipation
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.restore();

    // Render distant dunes and cactus silhouettes
    state.backgroundElements.forEach((el) => {
      ctx.save();

      if (el.type === 'dune') {
        el.y += state.speed * 0.012;
        
        ctx.fillStyle = 'rgba(124, 45, 18, 0.4)'; // warm sand dune highlight
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.25)'; // delicate sandy neon line
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
        // Render stylized pyramids in desert gold tints
        const baseWidth = 120 * el.scale;
        const pyrHeight = 85 * el.scale;
        
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x - baseWidth / 2, el.y + pyrHeight);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(124, 45, 18, 0.45)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.lineTo(el.x + baseWidth / 2, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(251, 146, 60, 0.2)';
        ctx.fill();
      }

      if (el.type === 'cactus_static') {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.65)'; // warm deep brown silhouette
        const cSize = 25 * el.scale;
        
        // draw main trunks
        ctx.beginPath();
        ctx.roundRect(el.x - 3, el.y - cSize, 6, cSize, 3);
        ctx.fill();
        
        // left curved arm
        ctx.beginPath();
        ctx.moveTo(el.x - 3, el.y - cSize * 0.65);
        ctx.quadraticCurveTo(el.x - 12, el.y - cSize * 0.65, el.x - 12, el.y - cSize * 0.9);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.65)';
        ctx.stroke();
        
        // right curved arm
        ctx.beginPath();
        ctx.moveTo(el.x + 3, el.y - cSize * 0.45);
        ctx.quadraticCurveTo(el.x + 12, el.y - cSize * 0.45, el.x + 12, el.y - cSize * 0.75);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw main ground desert sand floor glow overlay (seamlessly blends)
    const grGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
    grGrad.addColorStop(0, 'rgba(249, 115, 22, 0.15)');  // pleasant warm orange dust glow
    grGrad.addColorStop(0.6, 'rgba(124, 45, 18, 0.1)');  // sunset terracotta shades
    grGrad.addColorStop(1, 'rgba(43, 14, 6, 0.35)');      // cozy ground base
    ctx.fillStyle = grGrad;
    ctx.fillRect(0, height * 0.55, width, height - height * 0.55);
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
    ctx.strokeStyle = '#f59e0b'; // glowing amber yellow borders
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
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.42)'; // elegant rust/brown wood
      
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
      ctx.strokeStyle = '#451a03'; // deep metallic copper/brown shadow
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();

      // Steel Rail active metallic core
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ea580c'; // glowing bright bronze-orange steel look
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();

      // Top shiny highlight on rails
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#ffedd5'; // bright gold highlight
      ctx.beginPath();
      ctx.moveTo(rLStart, yStart);
      ctx.lineTo(rLEnd, yEnd);
      ctx.moveTo(rRStart, yStart);
      ctx.lineTo(rREnd, yEnd);
      ctx.stroke();
      
      // Glowing neon light beam in center of each lane (Subway track guides)
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.15)'; 
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

      // Shield outer glowing ring (highly optimized, draw a double circle instead of shadowBlur)
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

    // 2. LION ANATOMY (VEKTOREL CANVASES)

    // Tail (Kuyruk)
    ctx.save();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, 5);
    // Curl tail upwards or wild oscillation when running or jumping
    const tailOsc = Math.sin(playerObj.animFrame * 0.15) * 12;
    ctx.quadraticCurveTo(-30, -5 + tailOsc, -24, -20 + tailOsc);
    ctx.stroke();
    // Tail tip (pom-pom)
    ctx.fillStyle = '#813200';
    ctx.beginPath();
    ctx.arc(-24, -22 + tailOsc, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Running legs
    ctx.fillStyle = '#f39c12';
    const legSwing = Math.sin(playerObj.animFrame * 0.25) * 10;
    
    // Front and back left legs
    ctx.fillRect(-14, 10 + Math.max(0, legSwing), 6, 12);
    ctx.fillRect(8, 10 + Math.max(0, -legSwing), 6, 12);
    // Front and back right legs (opposite swing phase)
    ctx.fillRect(-6, 10 + Math.max(0, -legSwing), 6, 12);
    ctx.fillRect(14, 10 + Math.max(0, legSwing), 6, 12);

    // Lion Body (Gövde)
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(0, 0 + bob, 25, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy Lion Chest Tuft
    ctx.fillStyle = '#d35400';
    ctx.beginPath();
    ctx.moveTo(-15, -10 + bob);
    ctx.lineTo(2, 5 + bob);
    ctx.lineTo(15, -10 + bob);
    ctx.closePath();
    ctx.fill();

    // 3. THE MANE (Gösterişli Aslan Yelesi)
    // Draw 10 interlocking outer circles for fluffy cartoon mane
    ctx.fillStyle = '#813200'; // Dark rich brown mane
    const manePoints = 11;
    const maneRadius = 24 + Math.abs(bob) * 0.4;
    const headCenterX = 0;
    const headCenterY = -24 + bob;
    
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < manePoints; i++) {
      const angle = (i * Math.PI * 2) / manePoints;
      const maneX = headCenterX + Math.cos(angle) * maneRadius;
      const maneY = headCenterY + Math.sin(angle) * maneRadius;
      
      // Arc radius creates a nice scallop pattern
      ctx.arc(maneX, maneY, 13, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // 4. THE FACE & HEAD (Kafa ve Kulaklar)
    ctx.fillStyle = '#f1c40f'; // Bright golden yellow head skin
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, 17, 0, Math.PI * 2);
    ctx.fill();

    // Ears (Kulaklar - Yellow triangles with pink interiors)
    // Left ear
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(headCenterX - 14, headCenterY - 12);
    ctx.lineTo(headCenterX - 18, headCenterY - 26);
    ctx.lineTo(headCenterX - 4, headCenterY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9999'; // Inner pink
    ctx.beginPath();
    ctx.moveTo(headCenterX - 12, headCenterY - 14);
    ctx.lineTo(headCenterX - 15, headCenterY - 23);
    ctx.lineTo(headCenterX - 6, headCenterY - 16);
    ctx.closePath();
    ctx.fill();

    // Right ear
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(headCenterX + 14, headCenterY - 12);
    ctx.lineTo(headCenterX + 18, headCenterY - 26);
    ctx.lineTo(headCenterX + 4, headCenterY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9999'; // Inner pink
    ctx.beginPath();
    ctx.moveTo(headCenterX + 12, headCenterY - 14);
    ctx.lineTo(headCenterX + 15, headCenterY - 23);
    ctx.lineTo(headCenterX + 6, headCenterY - 16);
    ctx.closePath();
    ctx.fill();

    // Sparkling Eyes (Gözler)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headCenterX - 6, headCenterY - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(headCenterX + 6, headCenterY - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    // Dilate slightly as we speed up
    const eyePupilRadius = 1.8 + Math.min(1.0, state.speed * 0.05);
    ctx.arc(headCenterX - 5.5, headCenterY - 4, eyePupilRadius, 0, Math.PI * 2);
    ctx.arc(headCenterX + 6.5, headCenterY - 4, eyePupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Snout / Muzzle
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(headCenterX - 3, headCenterY + 4, 5, 0, Math.PI * 2);
    ctx.arc(headCenterX + 3, headCenterY + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(headCenterX - 3, headCenterY + 1);
    ctx.lineTo(headCenterX + 3, headCenterY + 1);
    ctx.lineTo(headCenterX, headCenterY + 45 * 0.1);
    ctx.closePath();
    ctx.fill();

    // Mouth / Smile line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(headCenterX - 2.5, headCenterY + 5, 2.5, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headCenterX + 2.5, headCenterY + 5, 2.5, 0, Math.PI);
    ctx.stroke();

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

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.scale(scale, scale);

    // 1. DANGER ZONE WARNING LIGHTS
    // Render Warning exclamation indicator logic for lasers
    if (enemy.type === 'vLaser' && enemy.laserWarningTimer > 0) {
      const isFlashing = Math.floor(enemy.laserWarningTimer / 6) % 2 === 0;
      if (isFlashing) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        // Draw safety strip highlight for vertical lane, scaled beautifully in 3D perspective
        ctx.fillRect(-22, -enemy.y / scale, 44, height / scale);

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

    // Smoothly accelerate over time until reaching the max limit cap
    if (state.speed < dSettings.maxSpeed) {
      state.speed += dSettings.acceleration;
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
    if (state.dustParticleTimer >= 3) {
      state.dustParticleTimer = 0;
      // Add a dusty particle flying past the screen
      const dustLane = Math.floor(Math.random() * LANE_COUNT) as 0 | 1 | 2;
      state.particles.push({
        id: Math.random().toString(36).substring(2, 9),
        x: getLaneX(dustLane) + (Math.random() - 0.5) * 60,
        y: height * 0.55, // spawn at horizon
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
        const laserChance = Math.random();
        
        // Prevent consecutive vertical lasers
        const lastObs = state.obstacles.length > 0 ? state.obstacles[state.obstacles.length - 1] : null;
        const wasLastObsLaser = lastObs ? lastObs.type === 'vLaser' : false;
        const frameDiff = state.frameCount - state.lastLaserFrame;
        const tooSoon = frameDiff < (spawnPeriod * 3.5); // increased buffer between lasers
        
        if (laserChance < 0.10 && !wasLastObsLaser && !tooSoon) {
          cactusType = 'vLaser'; // vertical laser on lane
          state.lastLaserFrame = state.frameCount;
        }

        state.obstacles.push({
          id: `obs_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: height * 0.5 - 20, // trigger at horizon
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
          y: height * 0.5 - 20,
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
      const relativeDepth = (obs.y - height * 0.5) / (height * 0.5); // 0 at horizon, 1 at screen bottom
      const obsSpeed = state.speed * (0.35 + relativeDepth * 0.85);
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
      const relativeDepth = (item.y - height * 0.5) / (height * 0.5);
      item.y += state.speed * (0.35 + relativeDepth * 0.85);
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

  const drawHUD = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;
    
    // Draw only during PLAYING state
    if (playState !== 'PLAYING') return;

    ctx.save();
    
    // 1. TOP HUD CONTAINER BAR (Semi-translucent dark glassmorphism combo)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
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

    // 3. CORE SPEED RATE BAR (Center section)
    const currentSpeed = state.speed;
    const initialSpeed = state.difficultySettings?.initialSpeed || INITIAL_SPEED;
    const maxSpeed = state.difficultySettings?.maxSpeed || MAX_SPEED;
    const speedProgress = Math.min(1.0, (currentSpeed - initialSpeed) / (maxSpeed - initialSpeed || 1));
    
    const barX = hudX + 70;
    const barWidth = width * 0.28;
    const barY = hudY + hudHeight / 2 - 4;
    
    // Draw speed track
    ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.beginPath();
    ctx.roundRect(barX, barY + 4, barWidth, 6, 3);
    ctx.fill();
    
    // Draw active speed progress
    const activeBarWidth = barWidth * speedProgress;
    const speedGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    speedGrad.addColorStop(0, '#f59e0b'); // amber-500
    speedGrad.addColorStop(1, '#ef4444'); // rose-500
    ctx.fillStyle = speedGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY + 4, activeBarWidth, 6, 3);
    ctx.fill();
    
    // Speed rate text label
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px "JetBrains Mono", var(--font-mono), monospace';
    ctx.fillText(`${currentSpeed.toFixed(1)}x HIZ`, barX, barY - 1);

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


    </div>
  );
};
