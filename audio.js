// =========================================================
// PROCEDURAL AUDIO SYNTHESIZER (WEB AUDIO API)
// Provides instant high-quality sound effects without external files
// =========================================================

class GameAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Clockwork Tick Sound
  playTick() {
    try {
      this.init();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.04);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.045);
    } catch (e) {
      console.warn('Audio tick failed:', e);
    }
  }

  // 2. Card Draw / Play Whoosh
  playCard() {
    try {
      this.init();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.09);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.11);
    } catch (e) {}
  }

  // 3. Guillotine Blade Slam (CHOP!)
  playChop() {
    try {
      this.init();
      const t = this.ctx.currentTime;

      // Heavy bass impact
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);

      // Metallic screech / slice
      const noise = this.ctx.createOscillator();
      const nGain = this.ctx.createGain();
      noise.type = 'square';
      noise.frequency.setValueAtTime(800, t);
      noise.frequency.exponentialRampToValueAtTime(90, t + 0.18);
      nGain.gain.setValueAtTime(0.4, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(t);
      noise.stop(t + 0.22);
    } catch (e) {}
  }

  // 4. Midnight Cathedral Bell
  playMidnightBell() {
    try {
      this.init();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(175, t); // Low F
      osc.frequency.setValueAtTime(174, t + 0.5);

      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 1.85);
    } catch (e) {}
  }

  // 5. Sacred Chime (Number 9 Blessed)
  playBlessing() {
    try {
      this.init();
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.05);

        gain.gain.setValueAtTime(0.18, t + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + i * 0.05);
        osc.stop(t + i * 0.05 + 0.45);
      });
    } catch (e) {}
  }
}

const audio = new GameAudio();
