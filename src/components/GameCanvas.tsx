/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Lane, Player, Obstacle, Collectible, Particle, BackgroundElement, PlayState, GameSettings } from '../types';
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
    powerupState: 'intro_eating' as 'intro_eating' | 'playing',
    meatballIntroTimer: 180, // initial eat meatballs phase
    meatballsEaten: 0,
    meatballs: [] as Array<{
      id: string;
      lane: Lane;
      x: number;
      y: number;
      width: number;
      height: number;
      speed: number;
      angle: number;
      isCollected: boolean;
    }>,
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
    state.player.y = dimensions.height - 130; // base y height near screen bottom
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

    state.speed = INITIAL_SPEED;
    state.frameCount = 0;
    state.itemsCollected = 0;
    state.score = 0;
    state.renderedScore = 0;
    state.powerupState = 'intro_eating';
    state.meatballIntroTimer = 180;
    state.meatballsEaten = 0;
    state.meatballs = [];
    state.player = {
      lane: initialLane,
      x: targetX,
      y: dimensions.height - 130,
      z: 0,
      vz: 0,
      width: 55,
      height: 55,
      isJumping: false,
      shieldActive: false,
      shieldTimer: 0,
      maxShieldTimer: 180,
      targetX: targetX,
      animFrame: 0,
    };
    state.obstacles = [];
    state.collectibles = [];
    state.particles = [];
    state.laneLinesOffset = 0;
    
    // Seed scenic background elements
    state.backgroundElements = [
      { id: '1', x: dimensions.width * 0.15, y: dimensions.height * 0.2, scale: 0.9, speed: 0.1, type: 'pyramid' },
      { id: '2', x: dimensions.width * 0.75, y: dimensions.height * 0.25, scale: 0.7, speed: 0.12, type: 'pyramid' },
      { id: '3', x: dimensions.width * 0.45, y: dimensions.height * 0.15, scale: 0.5, speed: 0.08, type: 'pyramid' },
      { id: '4', x: dimensions.width * 0.2, y: dimensions.height * 0.4, scale: 1.0, speed: 0.6, type: 'dune' },
      { id: '5', x: dimensions.width * 0.8, y: dimensions.height * 0.45, scale: 1.1, speed: 0.62, type: 'dune' },
      { id: '6', x: dimensions.width * 0.1, y: dimensions.height * 0.1, scale: 1.0, speed: 0.04, type: 'cloud' },
      { id: '7', x: dimensions.width * 0.6, y: dimensions.height * 0.06, scale: 1.2, speed: 0.03, type: 'cloud' },
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

    // Golden twilight gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0c1020'); // Deep night space roof
    skyGrad.addColorStop(0.3, '#1e1c3e'); // Twilight dark violet
    skyGrad.addColorStop(0.55, '#d35400'); // Sunset orange horizon
    skyGrad.addColorStop(0.75, '#f39c12'); // Rich glowing yellow
    skyGrad.addColorStop(0.9, '#f1c40f'); // Golden yellow sands base
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Render distant sun
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.45, 60, 0, Math.PI, true);
    const sunGrad = ctx.createLinearGradient(0, height * 0.35, 0, height * 0.45);
    sunGrad.addColorStop(0, '#f39c12');
    sunGrad.addColorStop(1, '#e74c3c');
    ctx.fillStyle = sunGrad;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#e74c3c';
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    // Sun lines for retro synthwave look
    ctx.strokeStyle = '#1e1c3e';
    ctx.lineWidth = 3;
    for (let yOffset = height * 0.45 - 30; yOffset < height * 0.45; yOffset += 9) {
      ctx.beginPath();
      ctx.moveTo(width * 0.5 - 70, yOffset);
      ctx.lineTo(width * 0.5 + 70, yOffset);
      ctx.stroke();
    }

    // Render clouds, pyramids, and dunes
    state.backgroundElements.forEach((el) => {
      ctx.save();
      
      if (el.type === 'cloud') {
        el.x += el.speed;
        if (el.x - 60 > width) el.x = -80; // Wrap around
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(el.x, el.y, 25 * el.scale, 0, Math.PI * 2);
        ctx.arc(el.x + 20 * el.scale, el.y - 10, 20 * el.scale, 0, Math.PI * 2);
        ctx.arc(el.x - 20 * el.scale, el.y - 5, 18 * el.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      if (el.type === 'pyramid') {
        const baseWidth = 110 * el.scale;
        const pyrHeight = 90 * el.scale;
        
        // Draw left shadow side
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x - baseWidth / 2, el.y + pyrHeight);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(30, 28, 62, 0.65)'; // Deep purple shadow shadow
        ctx.fill();

        // Draw light face side
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x, el.y + pyrHeight);
        ctx.lineTo(el.x + baseWidth / 2, el.y + pyrHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(211, 84, 0, 0.35)'; // Lit orange side
        ctx.fill();
      }

      if (el.type === 'dune') {
        // Continuous horizontal scroll
        el.y += state.speed * 0.015; // move slightly down as we speed up, or simulate forward displacement
        
        ctx.fillStyle = '#ffb33b';
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(-50, height * 0.55 + 20);
        ctx.quadraticCurveTo(width * 0.25, height * 0.53, width * 0.55, height * 0.56);
        ctx.quadraticCurveTo(width * 0.8, height * 0.58, width + 50, height * 0.54);
        ctx.lineTo(width + 50, height);
        ctx.lineTo(-50, height);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw main ground desert floor gradient (3D perspective feel)
    const grGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
    grGrad.addColorStop(0, '#e67e22'); // Horizon orange-gold
    grGrad.addColorStop(0.4, '#d35400'); // Mid orange
    grGrad.addColorStop(1, '#813200'); // Foreground deep red sand
    ctx.fillStyle = grGrad;
    ctx.fillRect(0, height * 0.55, width, height - height * 0.55);
  };

  const drawLanes = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;

    // Draw 3 lanes with perspective vanishing points
    ctx.strokeStyle = '#ffcc00';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#d35400';

    // Scroll lines
    state.laneLinesOffset = (state.laneLinesOffset + state.speed) % 80;

    for (let i = 1; i < LANE_COUNT; i++) {
      const xStart = i * (width / LANE_COUNT);
      
      ctx.save();
      ctx.setLineDash([20, 25]);
      ctx.lineDashOffset = -state.laneLinesOffset;
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(xStart, height * 0.55); // horizon starts around middle of screen
      ctx.lineTo(xStart, height);
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw horizon line separating desert sky
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.55);
    ctx.lineTo(width, height * 0.55);
    ctx.stroke();
    
    ctx.shadowBlur = 0; // Reset shadows
  };

  const drawLionCharacter = (ctx: CanvasRenderingContext2D, playerObj: Player) => {
    const state = stateRef.current;
    
    // Bounce height z affects visualization
    const drawY = playerObj.y - playerObj.z;
    
    ctx.save();
    // Shift coordinate system to make calculations simpler
    ctx.translate(playerObj.x, drawY);

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

      // Shield ring rotation
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#06b6d4';
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
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    // 1. DANGER ZONE WARNING LIGHTS
    // Render Warning exclamation indicator logic for lasers
    if (enemy.type === 'vLaser' && enemy.laserWarningTimer > 0) {
      const isFlashing = Math.floor(enemy.laserWarningTimer / 6) % 2 === 0;
      if (isFlashing) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        // Draw safety strip highlight for vertical lane
        ctx.fillRect(-22, -enemy.y, 44, dimensions.height);

        // Draw HUD exclamation mark warning bubble above player
        ctx.save();
        ctx.translate(0, -95);
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ef4444';
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
        // Full horizon banner highlighter
        ctx.fillRect(-enemy.x, -16, dimensions.width, 32);

        // Draw indicator on left and right borders of the screen
        ctx.save();
        ctx.beginPath();
        ctx.arc(-enemy.x + 35, 0, 15, 0, Math.PI * 2);
        ctx.arc(-enemy.x + dimensions.width - 35, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ef4444';
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', -enemy.x + 35, 0);
        ctx.fillText('⚡', -enemy.x + dimensions.width - 35, 0);
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
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ef4444';
      
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
      
      ctx.shadowBlur = 0; // Reset
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

  const drawSandCrystal = (ctx: CanvasRenderingContext2D, c: Collectible) => {
    ctx.save();
    ctx.translate(c.x, c.y);
    // Dynamic spin and float displacement
    ctx.rotate(c.angle);
    
    // Draw shadow on ground
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 30, 10, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#06b6d4';

    // Octahedron/Gem vector polygon
    ctx.beginPath();
    ctx.moveTo(0, -18); // top
    ctx.lineTo(13, 0); // right
    ctx.lineTo(0, 18); // bottom
    ctx.lineTo(-13, 0); // left
    ctx.closePath();

    const crystGrad = ctx.createLinearGradient(-13, -18, 13, 18);
    crystGrad.addColorStop(0, '#22d3ee'); // bright cyan
    crystGrad.addColorStop(0.5, '#06b6d4'); // dark cyan
    crystGrad.addColorStop(1, '#0891b2');
    ctx.fillStyle = crystGrad;
    ctx.fill();

    // Inside crystal light facets
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 18);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();

    ctx.restore();
  };

  const drawOasisShieldItem = (ctx: CanvasRenderingContext2D, c: Collectible) => {
    ctx.save();
    ctx.translate(c.x, c.y);

    // Bouncing animation
    const bounceOffset = Math.sin(Date.now() / 150) * 4.5;
    ctx.translate(0, bounceOffset);

    // Rotating glowing magical orb
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#3b82f6';
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

    // 1. DİKEY LAZER (Vertical beam fired downwards)
    if (enemy.type === 'vLaser' && enemy.laserTriggered && enemy.laserTimer > 0) {
      ctx.save();

      // Translucent fading beam
      const beamAlpha = Math.min(1.0, enemy.laserTimer / 10);
      const beamWidth = 24 + Math.sin(enemy.laserTimer * 0.8) * 4;

      const beamGrad = ctx.createLinearGradient(enemy.x - beamWidth / 2, 0, enemy.x + beamWidth / 2, 0);
      beamGrad.addColorStop(0, `rgba(239, 68, 68, ${0.1 * beamAlpha})`);
      beamGrad.addColorStop(0.3, `rgba(239, 68, 68, ${0.7 * beamAlpha})`);
      beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.95 * beamAlpha})`);
      beamGrad.addColorStop(0.7, `rgba(239, 68, 68, ${0.7 * beamAlpha})`);
      beamGrad.addColorStop(1, `rgba(239, 68, 68, ${0.1 * beamAlpha})`);

      ctx.save();
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = beamGrad;
      // fires stretching down to bottom
      ctx.fillRect(enemy.x - beamWidth / 2, enemy.y, beamWidth, height - enemy.y);
      ctx.restore();

      // Electro static crackles on the beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let currentY = enemy.y;
      ctx.moveTo(enemy.x, currentY);
      while (currentY < height) {
        currentY += 15 + Math.random() * 20;
        const dispX = enemy.x + (Math.random() - 0.5) * (beamWidth - 6);
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
      const beamHeight = 18 + Math.sin(enemy.laserTimer * 0.8) * 3;

      const hGrad = ctx.createLinearGradient(0, enemy.y - beamHeight / 2, 0, enemy.y + beamHeight / 2);
      hGrad.addColorStop(0, `rgba(239, 68, 68, ${0.15 * beamAlpha})`);
      hGrad.addColorStop(0.25, `rgba(239, 68, 68, ${0.85 * beamAlpha})`);
      hGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.98 * beamAlpha})`);
      hGrad.addColorStop(0.75, `rgba(239, 68, 68, ${0.85 * beamAlpha})`);
      hGrad.addColorStop(1, `rgba(239, 68, 68, ${0.15 * beamAlpha})`);

      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, enemy.y - beamHeight / 2, width, beamHeight);
      ctx.restore();

      // Horizontally travelling lightning bolt inside beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
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
    
    // Draw dust & collections particles
    state.particles.forEach((p, index) => {
      // Apply movement physics
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Fade out dynamically relative to remaining life
      p.alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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

        // Safe score updates
        const nextIntScore = Math.floor(stateRef.current.score);
        if (nextIntScore !== stateRef.current.renderedScore) {
          stateRef.current.renderedScore = nextIntScore;
          setScore(nextIntScore);
          if (nextIntScore > highScore) {
            setHighScore(nextIntScore);
          }
        }

        // Safe shield updates
        if (stateRef.current.player.shieldActive !== activeShield) {
          setActiveShield(stateRef.current.player.shieldActive);
        }
        const expectedShieldTime = stateRef.current.player.shieldActive ? stateRef.current.player.shieldTimer : 0;
        if (expectedShieldTime !== shieldTimeLeft) {
          setShieldTimeLeft(expectedShieldTime);
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
    
    // Smoothly accelerate over time until reaching the max limit cap
    if (state.speed < MAX_SPEED) {
      state.speed += ACCELERATION;
    }

    // --- MEATBALL POWERUP INTRO PHASE ---
    if (state.powerupState === 'intro_eating') {
      state.meatballIntroTimer--;

      // Spawn delicious meatballs!
      if (state.meatballIntroTimer % 28 === 0 && state.meatballIntroTimer > 25) {
        const targetLane = Math.floor(Math.random() * LANE_COUNT) as Lane;
        state.meatballs.push({
          id: `meatball_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: height * 0.45,
          width: 40,
          height: 40,
          speed: state.speed,
          angle: Math.random() * Math.PI,
          isCollected: false
        });
      }

      // Update meatballs
      for (let i = state.meatballs.length - 1; i >= 0; i--) {
        const mb = state.meatballs[i];
        
        // Fly towards screen coordinates
        const relativeDepth = (mb.y - height * 0.45) / (height * 0.55);
        mb.y += state.speed * (0.4 + relativeDepth * 1.15);
        mb.angle += 0.045;

        // Collision check with lion
        const distY = Math.abs(mb.y - state.player.y);
        const isInSameLane = state.player.lane === mb.lane;
        if (isInSameLane && distY < 35 && !mb.isCollected) {
          mb.isCollected = true;
          state.meatballs.splice(i, 1);
          state.meatballsEaten++;

          // Yummy explosions
          spawnExplosion(mb.x, mb.y, '#9c3d18', 12); // rich meatball brown
          spawnExplosion(mb.x, mb.y, '#f59e0b', 8);  // golden glowing sparkles
          
          audioSynth.playCollectCrystal(); // happy chomp sound equivalent
          state.score += 150;
          continue;
        }

        if (mb.y > height + 60) {
          state.meatballs.splice(i, 1);
        }
      }

      // Smooth buttery runner slide
      state.player.x += (state.player.targetX - state.player.x) * 0.14; // gentle kids action, no sudden jerks
      state.player.animFrame++;

      if (state.player.isJumping) {
        state.player.vz += BASE_GRAVITY;
        state.player.z -= state.player.vz;
        if (state.player.z <= 0) {
          state.player.z = 0;
          state.player.vz = 0;
          state.player.isJumping = false;
        }
      }

      // Transition out
      if (state.meatballIntroTimer <= 0) {
        state.powerupState = 'playing';
        state.player.shieldActive = true;
        state.player.shieldTimer = state.player.maxShieldTimer * 1.5; // premium extra-long kalkan
        audioSynth.playCollectShield();
        // Starry particles of ultimate strength!
        spawnExplosion(state.player.x, state.player.y - 20, '#06b6d4', 25);
        spawnExplosion(state.player.x, state.player.y - 20, '#f59e0b', 20);
      }
      return; // Skip normal obstacles & threats
    }

    // Gradually increment survival score
    state.score += 0.08 * (state.speed / INITIAL_SPEED);

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
    const spawnPeriod = Math.max(50, Math.floor(95 / (state.speed / INITIAL_SPEED)));
    if (state.frameCount % spawnPeriod === 0) {
      const targetLane = Math.floor(Math.random() * LANE_COUNT) as Lane;
      const decider = Math.random();

      if (decider < 0.62) {
        // Build cacti obstacle
        let cactusType: 'normal' | 'vLaser' | 'hLaser' = 'normal';
        const laserChance = Math.random();
        
        if (laserChance < 0.23) {
          cactusType = 'vLaser'; // vertical beam
        } else if (laserChance < 0.44) {
          cactusType = 'hLaser'; // widescreen jump-only beam
        }

        state.obstacles.push({
          id: `obs_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: height * 0.5 // trigger at horizon
          - 20,
          type: cactusType,
          width: 32,
          height: 52,
          laserTriggered: false,
          laserWarningTimer: LASER_WARNING_DURATION,
          laserTimer: LASER_ACTIVE_DURATION,
          isPassed: false,
        });
      } else {
        // Build items
        const isOasisWater = Math.random() < 0.18; // 18% chance for shield water, 82% for sand crystal
        state.collectibles.push({
          id: `item_${state.frameCount}`,
          lane: targetLane,
          x: getLaneX(targetLane),
          y: height * 0.5 - 20,
          type: isOasisWater ? 'oasis' : 'crystal',
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
        
        if (item.type === 'crystal') {
          // Play pick audio and update score state
          audioSynth.playCollectCrystal();
          state.score += 50;
          onCoinsCollected(1); // Notify tracker count
          spawnExplosion(item.x, item.y, '#22d3ee', 12);
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
    
    const finalScore = Math.floor(stateRef.current.itemsCollected * 50 + score);
    onGameOver(finalScore);

    // Blast lovely cloud particles around the dead character
    const playerObj = stateRef.current.player;
    spawnExplosion(playerObj.x, playerObj.y - 20, '#f1c40f', 24);
    spawnExplosion(playerObj.x, playerObj.y - 20, '#813200', 16);
  };

  const drawMeatball = (ctx: CanvasRenderingContext2D, mb: any) => {
    ctx.save();
    ctx.translate(mb.x, mb.y);
    ctx.rotate(mb.angle);

    // Glowing warm aroma
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#e67e22';

    // Meatball brown body
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    const gr = ctx.createRadialGradient(-5, -5, 3, 0, 0, 18);
    gr.addColorStop(0, '#ba8b67'); // lighter brown top
    gr.addColorStop(0.7, '#78431b'); // rich meatball brown
    gr.addColorStop(1, '#42240e'); // shadow brown
    ctx.fillStyle = gr;
    ctx.fill();

    ctx.shadowBlur = 0; // reset

    // Little specks of seasonings (parsley/herbs)
    ctx.fillStyle = '#22543d';
    ctx.beginPath();
    ctx.arc(-6, -4, 2, 0, Math.PI * 2);
    ctx.arc(4, 5, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -6, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // White gloss highlight for freshness
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(-5, -5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawIntroMeatballOverlay = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensions;
    const state = stateRef.current;
    
    ctx.save();
    ctx.textAlign = 'center';
    
    // Dark translucent backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(0, height * 0.28, width, 105);

    // Cute retro-colored yellow border lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.28);
    ctx.lineTo(width, height * 0.28);
    ctx.moveTo(0, height * 0.28 + 105);
    ctx.lineTo(width, height * 0.28 + 105);
    ctx.stroke();

    // Fun child-friendly title!
    ctx.font = 'bold 23px "Inter", sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#dc2626';
    ctx.fillText('🥩 KÖFTE ZAMANI! 🦁', width * 0.5, height * 0.33);

    // Warm instruction text
    ctx.font = '600 13px "Inter", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowBlur = 0;
    ctx.fillText('Köfteleri ye, güç topla!', width * 0.5, height * 0.37);

    // Multi-color dynamic star indicating shield status next
    const counterMsg = `Yenilen Köfte: ${state.meatballsEaten}`;
    ctx.font = '500 12px "Inter", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(counterMsg, width * 0.5, height * 0.41);

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

    // Render delicious meatballs!
    if (state.meatballs && state.meatballs.length > 0) {
      state.meatballs.forEach((mb) => {
        drawMeatball(ctx, mb);
      });
    }

    // Render coins crystals and vaha suyu (only spawn/render if we are actually playing or have some)
    state.collectibles.forEach((item) => {
      if (item.type === 'crystal') {
        drawSandCrystal(ctx, item);
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

    // Meatball intro overlay!
    if (state.powerupState === 'intro_eating') {
      drawIntroMeatballOverlay(ctx);
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

      {/* Touch overlays for manual button controls alongside Swipe */}
      {playState === 'PLAYING' && (
        <div id="mobileControlsOverlay" className="absolute bottom-4 left-0 right-0 px-4 flex justify-between items-center pointer-events-none z-20">
          <div className="flex gap-2">
            <button
              id="btnLeft"
              type="button"
              className="w-14 h-14 bg-slate-900/75 hover:bg-slate-900 active:bg-slate-950 text-white rounded-full flex items-center justify-center border-2 border-slate-700/60 shadow-lg select-none active:scale-95 transition-all pointer-events-auto cursor-pointer"
              onMouseDown={(e) => { e.preventDefault(); laneShiftLeft(); }}
              onTouchStart={(e) => { e.preventDefault(); laneShiftLeft(); }}
            >
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <button
              id="btnRight"
              type="button"
              className="w-14 h-14 bg-slate-900/75 hover:bg-slate-900 active:bg-slate-950 text-white rounded-full flex items-center justify-center border-2 border-slate-700/60 shadow-lg select-none active:scale-95 transition-all pointer-events-auto cursor-pointer"
              onMouseDown={(e) => { e.preventDefault(); laneShiftRight(); }}
              onTouchStart={(e) => { e.preventDefault(); laneShiftRight(); }}
            >
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </div>
          
          <button
            id="btnJump"
            type="button"
            className="w-16 h-16 bg-cyan-600/70 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-full flex flex-col items-center justify-center border-2 border-cyan-400/50 shadow-lg select-none active:scale-95 transition-all pointer-events-auto cursor-pointer"
            onMouseDown={(e) => { e.preventDefault(); triggerJump(); }}
            onTouchStart={(e) => { e.preventDefault(); triggerJump(); }}
          >
            <svg className="w-7 h-7 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
            <span className="text-[9px] font-bold tracking-tight">UP</span>
          </button>
        </div>
      )}
    </div>
  );
};
