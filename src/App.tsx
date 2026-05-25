/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { PlayState, GameSettings } from './types';
import { audioSynth } from './utils/audio';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  Zap, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  Sparkles, 
  Flame, 
  Gauge, 
  AlertCircle,
  Smartphone,
  CheckCircle,
  Pause
} from 'lucide-react';

export default function App() {
  const [playState, setPlayState] = useState<PlayState>('MENU');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [sessionCrystals, setSessionCrystals] = useState<number>(0);
  const [activeShield, setActiveShield] = useState<boolean>(false);
  const [shieldTimeLeft, setShieldTimeLeft] = useState<number>(0);
  const [restartRequested, setRestartRequested] = useState<boolean>(false);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    soundEnabled: true,
    vibrationEnabled: true,
    difficulty: 'normal',
  });

  // Load High Score on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('aslan_kacis_high_score');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  const handleHighScoreUpdate = (newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('aslan_kacis_high_score', newScore.toString());
      setIsNewHighScore(true);
    }
  };

  const startGame = () => {
    setScore(0);
    setSessionCrystals(0);
    setActiveShield(false);
    setShieldTimeLeft(0);
    setIsNewHighScore(false);
    setRestartRequested(true);
    setPlayState('PLAYING');
  };

  const handleGameOver = (finalScore: number) => {
    setPlayState('GAMEOVER');
    if (finalScore > highScore) {
      handleHighScoreUpdate(finalScore);
    }
  };

  const handleCoinsCollected = (count: number) => {
    setSessionCrystals((prev) => prev + count);
  };

  const toggleSound = () => {
    setSettings((prev) => {
      const updated = !prev.soundEnabled;
      audioSynth.enabled = updated;
      return { ...prev, soundEnabled: updated };
    });
  };

  const toggleDifficulty = () => {
    setSettings((prev) => {
      let nextDiff: 'easy' | 'normal' | 'hard' = 'normal';
      if (prev.difficulty === 'easy') {
        nextDiff = 'normal';
      } else if (prev.difficulty === 'normal') {
        nextDiff = 'hard';
      } else if (prev.difficulty === 'hard') {
        nextDiff = 'easy';
      }
      return {
        ...prev,
        difficulty: nextDiff,
      };
    });
  };

  return (
    <div id="appContainer" className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* 1. TOP HEADER BANNER */}
      <header id="mainHeader" className="w-full bg-slate-900 border-b border-slate-800 py-3 px-6 shadow-md z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-xl border border-amber-400 shadow-md">
              <span className="text-xl font-bold font-sans">🦁</span>
            </div>
            <div>
              <h1 id="gameTitle" className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300 bg-clip-text text-transparent glow-orange">
                ASLAN KAÇIŞ
              </h1>
              <p id="gameSubtitle" className="text-[11px] font-mono text-slate-400 font-medium">
                PWA RETRO INFINITE RUNNER • v2.0
              </p>
            </div>
          </div>

          {/* Quick HUD Score and Audio parameters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950/85 py-1.5 px-4 rounded-lg border border-slate-800">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-mono font-medium text-slate-400">EN YÜKSEK:</span>
              <span id="txtHighScore" className="text-sm font-mono font-bold text-amber-400">{highScore}</span>
            </div>

            <button
              id="audioIconButton"
              type="button"
              onClick={toggleSound}
              className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer"
              title={settings.soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
            >
              {settings.soundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5 text-rose-500" />}
            </button>
          </div>

        </div>
      </header>

      {/* 2. GAME SECTION CORE */}
      <main id="mainGameContent" className="flex-1 min-h-0 w-full max-w-none px-2 py-3 flex flex-col justify-center items-center overflow-hidden">
        
        {/* CENTER COLUMN: ACTIVE ARCADE PLAYABLE CANVAS */}
        <section id="arcadeCabinet" className="w-full max-w-[500px] flex flex-col gap-2 items-center justify-center flex-1 min-h-0 py-1">
          
          {/* Active Shield Progress Indicators */}
          <div className="w-full max-w-[500px] h-8 flex items-center justify-between px-3 bg-slate-900 rounded-lg border border-slate-800 select-none shrink-0">
            {activeShield ? (
              <div className="w-full flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-wider shrink-0 animate-pulse">
                  🛡️ VAHA KALKANI AKTİF
                </span>
                <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full transition-all duration-75"
                    style={{ width: `${(shieldTimeLeft / 180) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full text-center text-[10px] font-mono text-slate-500 font-semibold tracking-wide">
                GÜÇLENDİRİCİ BEKLENİYOR • VAHA SUYU TOPLA
              </div>
            )}
          </div>

          <div className="relative flex-1 h-0 w-full game-container flex justify-center items-center">
            
            <GameCanvas
              playState={playState}
              settings={settings}
              score={score}
              setScore={setScore}
              highScore={highScore}
              setHighScore={handleHighScoreUpdate}
              onGameOver={handleGameOver}
              onCoinsCollected={handleCoinsCollected}
              activeShield={activeShield}
              setActiveShield={setActiveShield}
              shieldTimeLeft={shieldTimeLeft}
              setShieldTimeLeft={setShieldTimeLeft}
              onRestartRequest={restartRequested}
              setOnRestartRequest={setRestartRequested}
            />

            {/* --- CORE MENU SCREENS OVERLAYS --- */}

            {/* A. MENU START GAME SCREEN */}
            {playState === 'MENU' && (
              <div id="screenMenu" className="absolute inset-0 bg-slate-950/90 flex flex-col justify-center items-center p-6 text-center select-none z-30 rounded-2xl animate-fade-in">
                
                {/* Visual retro decorative background sand dust */}
                <div className="absolute top-1/4 left-1/4 w-12 h-12 bg-orange-500/10 blur-xl rounded-full" />
                <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-blue-500/10 blur-xl rounded-full" />

                <div className="mb-8">
                  <div className="text-5xl mb-4 animate-[bounce_2.5s_infinite]">🦁</div>
                  <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300 bg-clip-text text-transparent glow-orange">
                    ASLAN KAÇIŞ
                  </h2>
                  <p className="text-xs font-mono text-amber-500 font-semibold mt-1 tracking-wider uppercase">
                    Çöl Lazerlerinden Kaçış Macerası
                  </p>
                </div>

                <div className="w-full max-w-sm space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800 mb-8 z-10">
                  <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs font-mono font-medium text-slate-400">Zorluk Seviyesi:</span>
                    <button
                      id="btnToggleDifficulty"
                      type="button"
                      onClick={toggleDifficulty}
                      className="text-xs font-bold px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 capitalize text-amber-500 cursor-pointer"
                    >
                      {settings.difficulty === 'easy' ? 'Kolay' : settings.difficulty === 'normal' ? 'Normal' : 'Zor'}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed font-sans text-left space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <p className="font-bold text-amber-300">
                      {settings.difficulty === 'easy' ? '👶 Kolay Mod Özellikleri:' : settings.difficulty === 'normal' ? '🦁 Normal Mod Özellikleri:' : '🔥 Zor Mod Özellikleri:'}
                    </p>
                    {settings.difficulty === 'easy' && (
                      <>
                        <p className="flex items-start gap-1">🚶 Ekstra yavaş akış ve yumuşak zıplama.</p>
                        <p className="flex items-start gap-1">🛡️ Ekstra uzun koruyucu kalkan desteği.</p>
                        <p className="flex items-start gap-1">🌵 Daha uzun lazer uyarı süresi ve seyrek engeller.</p>
                      </>
                    )}
                    {settings.difficulty === 'normal' && (
                      <>
                        <p className="flex items-start gap-1">🚶 Dengeli akış ve tatlı zıplama hissiyatı.</p>
                        <p className="flex items-start gap-1">🛡️ Bölüm başında standart kalkan koruması.</p>
                        <p className="flex items-start gap-1">⚡ Orta dereceli refleks gereksinimi.</p>
                      </>
                    )}
                    {settings.difficulty === 'hard' && (
                      <>
                        <p className="flex items-start gap-1">🏃 Çok hızlı akış ve seri refleks sınavı.</p>
                        <p className="flex items-start gap-1">⚡ Kısa sürede ateşlenen tehlikeli lazerler.</p>
                        <p className="flex items-start gap-1">🏆 Rekor kırabilecek aslanlar için gerçek çöl mücadelesi!</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  id="btnStartGame"
                  type="button"
                  onClick={startGame}
                  className="w-full max-w-sm py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-sans font-bold text-lg rounded-xl tracking-wide shadow-lg border-2 border-amber-300/40 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  OYUNU BAŞLAT
                </button>
              </div>
            )}

            {/* B. GAME OVER SCREEN */}
            {playState === 'GAMEOVER' && (
              <div id="screenGameOver" className="absolute inset-0 bg-slate-950/95 flex flex-col justify-center items-center p-6 text-center select-none z-30 rounded-2xl">
                
                <div id="iconCrack" className="text-5xl mb-4">💥</div>
                
                <h2 className="text-4xl font-extrabold tracking-tight text-rose-500 glow-red mb-2">
                  OYUN BİTTİ
                </h2>
                
                <p className="text-xs text-slate-400 font-mono mb-6 uppercase tracking-widest">
                  Kaktüs ya da Lazer Seni Durdurdu!
                </p>

                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-3 font-mono">
                  
                  {isNewHighScore && (
                    <div className="bg-amber-500/20 text-amber-300 py-1.5 px-3 rounded-lg text-xs font-bold border border-amber-500/40 flex items-center justify-center gap-1.5 animate-pulse">
                      <Sparkles className="w-4 h-4" />
                      YENİ REKOR!
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Kazanılan Puan:</span>
                    <span id="statFinalScore" className="text-base font-bold text-slate-100">{score}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs py-1">
                    <span className="text-slate-400 font-sans font-semibold">Toplam Kristal:</span>
                    <span className="text-sm font-bold text-cyan-400">+{sessionCrystals * 50} PB ({sessionCrystals} X)</span>
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-3 z-10">
                  <button
                    id="btnPlayAgain"
                    type="button"
                    onClick={startGame}
                    className="w-full py-3.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold rounded-xl tracking-wide shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 stroke-[3px]" />
                    TEKRAR BAŞLA
                  </button>

                  <button
                    id="btnReturnMenu"
                    type="button"
                    onClick={() => setPlayState('MENU')}
                    className="w-full py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs rounded-xl border border-slate-800 cursor-pointer"
                  >
                    ANA MENÜYE DÖN
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* 3. FOOTER */}
      <footer id="mainFooter" className="w-full bg-slate-900 border-t border-slate-800 py-1.5 px-6 text-center text-[10px] font-mono text-slate-500 shrink-0">
        <p>🦁 Aslan Kaçış Oyunu © 2026 • Retro Runner</p>
      </footer>
    </div>
  );
}
