// SOLENA BAY — procedural WebAudio: engine, sirens, gunfire, radio sequencer.
// Everything is synthesized; no audio files. Silent until the first gesture.
import { RADIO } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.radioIdx = 0;
    this.radioTimer = null;
    this.radioStep = 0;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren: square wave, LFO sweeps the frequency
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 1.4;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 220;
      this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLfo.start();
      this.startRadio();
    } catch { this.ctx = null; }
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }

  engineStart() { /* engine gain is driven per-frame by setEngine */ }
  engineStop() { if (this.engineGain) this.engineGain.gain.value = 0; }
  setEngine(speedKmh, driving) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.045 + Math.min(0.05, speedKmh / 3000) : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.6, t, 0.1);
  }

  setSiren(level, nearestDist) {
    if (!this.ctx || !this.sirenGain) return;
    const g = level > 0 ? Math.max(0.008, 0.05 * (1 - Math.min(1, nearestDist / 120))) : 0;
    this.sirenGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.2);
  }

  noiseBurst(dur, freq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  tone(freq, dur, gain, type = 'sine', when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  gunshot(kind) {
    if (kind === 'shotgun') this.noiseBurst(0.28, 900, 0.5);
    else if (kind === 'smg') this.noiseBurst(0.09, 1800, 0.28);
    else this.noiseBurst(0.14, 1400, 0.35);
  }
  crash(impact) { this.noiseBurst(0.25, 300 + impact * 10, Math.min(0.5, 0.1 + impact * 0.02)); }
  explosion() { this.noiseBurst(0.9, 220, 0.7); this.tone(55, 0.8, 0.4, 'sine'); }
  swing() { this.noiseBurst(0.12, 2500, 0.12, 'bandpass'); }
  reload() { this.tone(900, 0.05, 0.12, 'square'); this.tone(600, 0.06, 0.12, 'square', 0.12); }
  blip() { this.tone(880, 0.09, 0.15, 'sine'); }
  sirenBlip() { this.tone(950, 0.15, 0.12, 'square'); this.tone(700, 0.15, 0.12, 'square', 0.16); }
  thud() { this.noiseBurst(0.15, 200, 0.3); }
  enemyDown() { this.tone(330, 0.12, 0.12, 'triangle'); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 0.16, 'triangle', i * 0.11)); }

  setRadio(i) {
    this.radioIdx = i;
    this.radioStep = 0;
  }

  startRadio() {
    if (this.radioTimer) return;
    const tick = () => {
      if (!this.ctx || this.muted) return;
      const st = RADIO[this.radioIdx];
      const stepDur = 60 / st.tempo / 2; // eighth notes
      const scale = st.scale;
      const deg = scale[this.radioStep % scale.length];
      const semis = deg + 12 * Math.floor(this.radioStep / scale.length / 2) % 12;
      const freq = st.root * Math.pow(2, semis / 12);
      // lead note (every step) + bass (every 4th)
      this.tone(freq, stepDur * 0.9, 0.05, st.wave);
      if (this.radioStep % 4 === 0) this.tone(st.root / 2, stepDur * 3, 0.06, 'sine');
      if (this.radioStep % 8 === 4) this.noiseBurst(0.05, 4000, 0.03, 'highpass'); // hat
      this.radioStep++;
      this.radioTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }
}
