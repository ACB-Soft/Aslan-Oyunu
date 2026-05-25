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
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);

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
    setSettings((prev) => ({
      ...prev,
      difficulty: prev.difficulty === 'normal' ? 'hard' : 'normal',
    }));
  };

  return (
    <div id="appContainer" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* 1. TOP HEADER BANNER */}
      <header id="mainHeader" className="w-full bg-slate-900 border-b border-slate-800 py-3.5 px-6 shadow-md z-10">
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
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-amber-500/30 bg-amber-500/10 hover:bg-amber-505/20 active:scale-95 text-amber-400 font-sans"
              title={isFullScreen ? "Klasik Mod" : "Çocuk / Tam Ekran Modu"}
            >
              {isFullScreen ? '📋 Kılavuzu Göster' : '👶 Çocuk Modu (Tam Ekran)'}
            </button>

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
      <main id="mainGameContent" className={isFullScreen ? "flex-grow w-full max-w-none px-2 py-4 flex flex-col justify-center items-center" : "flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"}>
        
        {/* LEFT SIDEBAR: GUIDE & CONTROLS TUTORIAL */}
        {!isFullScreen && (
          <section id="guidesCard" className="lg:col-span-3.5 flex flex-col justify-between gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg max-h-[85vh] overflow-y-auto">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2.5">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <h2 className="text-md font-bold text-slate-200">Nasıl Oynanır?</h2>
              </div>

              <div className="space-y-4 text-xs select-text">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block bg-cyan-600/30 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">YATAY LAZER</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-sans">
                    <strong>Kaktüsün gözlerinden çıkan yatay lazerler tüm şeritleri kaplar!</strong> Sağa sola kaçamazsın. Doğru zamanda <span className="text-cyan-300 font-semibold">Yukarı Kaydırarak</span> veya <span className="text-cyan-300 font-semibold">Space tuşuna basarak</span> üstünden <strong>Zıpla!</strong>
                  </p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block bg-rose-600/30 text-rose-500 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">DİKEY LAZER</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Belirli şeritlerde dikey kırmızı ışınlar belirir. Flashing (!) işareti başladığında o şeritten hemen kaç, ya da üzerinden atla!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1 items-center text-center">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <span className="font-bold text-slate-300 text-[11px]">Kum Kristali</span>
                    <span className="text-[10px] text-slate-400">+50 Ekstra Puan</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1 items-center text-center">
                    <Flame className="w-5 h-5 text-blue-400 animate-pulse" />
                    <span className="font-bold text-slate-300 text-[11px]">Vaha Suyu</span>
                    <span className="text-[10px] text-slate-400">3sn Dayanıklılık</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                Kontroller
              </h3>
              <div className="space-y-2 text-[11px] font-mono text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span>Sol / Sağ Şerit:</span>
                  <span className="text-slate-200">A / D veya ◀ / ▶</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span>Zıplama:</span>
                  <span className="text-slate-200">Space veya ▲ / W</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Mobil Swipe:</span>
                  <span className="text-slate-200">Yukarı / Sağa / Sola</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CENTER COLUMN: ACTIVE ARCADE PLAYABLE CANVAS */}
        <section id="arcadeCabinet" className={isFullScreen ? "w-full max-w-[500px] flex flex-col gap-3 items-center justify-center flex-grow py-1" : "lg:col-span-5 flex flex-col gap-4 items-center justify-center"}>
          
          {/* Active Shield Progress Indicators */}
          <div className="w-full max-w-[500px] h-8 flex items-center justify-between px-3 bg-slate-900 rounded-lg border border-slate-800 select-none">
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

          <div className="relative w-full game-container flex justify-center items-center">
            
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
                      {settings.difficulty === 'normal' ? 'Normal' : 'Zor'}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed font-sans text-left space-y-2">
                    <p className="flex items-start gap-1.5 font-bold text-amber-300">
                      👶 4-5 Yaş Çocuk Modu Özellikleri:
                    </p>
                    <p className="flex items-start gap-1.5 pl-2">
                      🥩 Lion starts game by eating meatballs!
                    </p>
                    <p className="flex items-start gap-1.5 pl-2">
                      🚶 Slower movement, soft smooth jumping controls.
                    </p>
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

        {/* RIGHT SIDEBAR: HIGH SCORE TABLES AND DESERT WISDOM */}
        {!isFullScreen && (
          <section id="leaderboardCard" className="lg:col-span-3.5 flex flex-col justify-between gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg max-h-[85vh] overflow-y-auto">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2.5">
                <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
                <h2 className="text-md font-bold text-slate-200">En Yüksek Skorlar</h2>
              </div>

              <div className="space-y-2.5 font-mono">
                <div className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-xl border border-amber-400/30 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-amber-400 font-bold">1.</span>
                    <span className="font-sans font-bold text-slate-200">Aslan Kral (Sen)</span>
                  </div>
                  <span className="font-bold text-amber-400">{Math.max(highScore, score)}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs opacity-80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-semibold">2.</span>
                    <span className="font-sans text-slate-300">Kum Kaplanı</span>
                  </div>
                  <span className="font-semibold text-slate-400">1250</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs opacity-70">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-semibold">3.</span>
                    <span className="font-sans text-slate-300">Vaha Koşucusu</span>
                  </div>
                  <span className="font-semibold text-slate-400">800</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs opacity-50">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-semibold">4.</span>
                    <span className="font-sans text-slate-300">Çöl Tilkisi</span>
                  </div>
                  <span className="font-semibold text-slate-400">350</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-505/10 text-center">
              <span className="text-[10px] font-mono text-amber-500 font-bold tracking-widest uppercase block mb-1">
                🏜️ Çöl Atasözü
              </span>
              <p className="text-[11px] text-slate-400 italic leading-relaxed">
                "Lazer kumsalları eritebilir ama aslanın cesaretine ve zıplama yeteneğine asla dokunamaz!"
              </p>
            </div>
          </section>
        )}

      </main>

      {/* 3. FOOTER */}
      <footer id="mainFooter" className="w-full bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs font-mono text-slate-400">
        <p>🦁 Aslan Kaçış Oyunu © 2026 • Yerli & Milli PWA Retro Game</p>
      </footer>
    </div>
  );
}
