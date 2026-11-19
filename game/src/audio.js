// audio.js — every sound in Neon Tide is synthesised with WebAudio; the game
// ships no audio files. A tiny synth voice plays blips, cash-register chimes,
// mission jingles, a two-tone siren loop while the police are interested, and
// an engine hum whose pitch follows the speed of the car you are driving.
// Nothing starts until the first user gesture, as browsers require.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sirenNodes = null;
    this.engineNodes = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  tone(freq, dur, { type = 'square', gain = 0.2, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  blip() {
    this.tone(880, 0.08, { type: 'square', gain: 0.12 });
  }

  door() {
    this.tone(220, 0.18, { type: 'sine', gain: 0.2, slide: -120 });
    this.tone(440, 0.12, { type: 'sine', gain: 0.1, delay: 0.1 });
  }

  punch() {
    this.tone(140, 0.1, { type: 'triangle', gain: 0.3, slide: -80 });
  }

  crash(strength = 1) {
    this.tone(90, 0.22, { type: 'sawtooth', gain: 0.25 * strength, slide: -50 });
    this.tone(60, 0.3, { type: 'square', gain: 0.15 * strength, slide: -30 });
  }

  cash() {
    this.tone(1320, 0.09, { type: 'square', gain: 0.14 });
    this.tone(1760, 0.14, { type: 'square', gain: 0.14, delay: 0.08 });
  }

  stepJingle() {
    this.tone(660, 0.1, { type: 'triangle', gain: 0.16 });
    this.tone(990, 0.16, { type: 'triangle', gain: 0.16, delay: 0.09 });
  }

  missionJingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', gain: 0.18, delay: i * 0.11 }));
  }

  finaleJingle() {
    const notes = [392, 523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.18, delay: i * 0.13 }));
    this.tone(1568, 0.5, { type: 'sine', gain: 0.14, delay: 0.8 });
  }

  bustedSting() {
    const notes = [440, 415, 392, 370];
    notes.forEach((f, i) => this.tone(f, 0.2, { type: 'sawtooth', gain: 0.12, delay: i * 0.14 }));
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const amp = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 800;
      lfo.frequency.value = 0.7;
      lfoGain.gain.value = 180;
      amp.gain.value = 0.045;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(amp).connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, lfo, amp };
    } else if (!on && this.sirenNodes) {
      const { osc, lfo } = this.sirenNodes;
      try { osc.stop(); lfo.stop(); } catch { /* already stopped */ }
      this.sirenNodes = null;
    }
  }

  setEngine(on, speedRatio = 0) {
    if (!this.ctx) return;
    if (on && !this.engineNodes) {
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      amp.gain.value = 0.05;
      osc.connect(amp).connect(this.master);
      osc.start();
      this.engineNodes = { osc, amp };
    }
    if (this.engineNodes) {
      this.engineNodes.osc.frequency.value = 55 + Math.abs(speedRatio) * 130;
      if (!on) {
        try { this.engineNodes.osc.stop(); } catch { /* already stopped */ }
        this.engineNodes = null;
      }
    }
  }
}
