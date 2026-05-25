/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioSynth {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  // Lazily initialize the AudioContext upon first user interaction
  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playJump() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      // Sweep frequency upwards for jump
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio play failure:", e);
    }
  }

  playCollectCrystal() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const now = audioCtx.currentTime;

      // Sparkle arpeggio (two sweet high-pitched notes)
      const notes = [880, 1318.51]; 
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.15);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.18);
      });
    } catch (e) {
      console.warn("Audio play failure:", e);
    }
  }

  playCollectShield() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const now = audioCtx.currentTime;
      
      // An ascending magical chord
      const chords = [329.63, 392.00, 523.25, 659.25]; // E4, G4, C5, E5
      chords.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.04 + 0.2);

        gain.gain.setValueAtTime(0.08, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.04 + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.3);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  playLaserWarning() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.warn(e);
    }
  }

  playLaserActive() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      // Heavy electric buzz
      osc.frequency.setValueAtTime(90, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  }

  playShieldWarning() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.warn(e);
    }
  }

  playHit() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn(e);
    }
  }

  playGameOver() {
    if (!this.enabled) return;
    try {
      const audioCtx = this.init();
      const now = audioCtx.currentTime;

      // Melancholic descending synth melody
      const notes = [293.66, 261.63, 220.00, 196.00, 146.83]; // D4, C4, A3, G3, D3
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.15, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.01, now + (idx + 1) * 0.15);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + (idx + 1) * 0.15 + 0.05);
      });
    } catch (e) {
      console.warn(e);
    }
  }
}

export const audioSynth = new AudioSynth();
