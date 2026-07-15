// sfx.js — synthesized game audio (WebAudio)
export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._noise = null;
  }
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
      } catch (e) { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  noiseBuf() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }
  _noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf();
    s.loop = true;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    return s;
  }
  boom(power = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const dur = 0.7 + 0.5 * power;
    // noise blast
    const n = this._noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900 + 600 * power, t);
    f.frequency.exponentialRampToValueAtTime(50, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9 * Math.min(1.4, power), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.1);
    // sub thump
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90 * Math.min(1.3, power), t);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.6);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.75);
  }
  rumble(amount = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const dur = 0.8 + amount * 0.8;
    const n = this._noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 140;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * Math.min(1, amount), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.1);
  }
  whistle(dur = 1.2) {
    if (!this.ctx) return () => {};
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    return () => { try { o.stop(); } catch (e) {} };
  }
  thunk() {
    if (!this.ctx) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.25);
    const n = this._noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 800;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(f); f.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.15);
  }
  click() {
    if (!this.ctx) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }
  chime(big = false) {
    if (!this.ctx) return;
    const t = this.t;
    const notes = big ? [523, 659, 784, 1047] : [659, 880];
    notes.forEach((f0, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f0;
      const g = this.ctx.createGain();
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.16, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + 0.55);
    });
  }
  fanfare() {
    if (!this.ctx) return;
    const t = this.t;
    [392, 523, 659, 784, 1047].forEach((f0, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f0;
      const g = this.ctx.createGain();
      const st = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.12, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.6);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + 0.65);
    });
  }
  // returns handle with stop() / setThrottle()
  engineStart(kind = 'dozer') {
    if (!this.ctx) return { stop() {}, setThrottle() {} };
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = kind === 'plane' ? 'sawtooth' : 'square';
    o.frequency.value = kind === 'plane' ? 95 : 42;
    const o2 = this.ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = kind === 'plane' ? 143 : 63;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = kind === 'plane' ? 700 : 320;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === 'plane' ? 0.14 : 0.18, t + 0.4);
    // wobble
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = kind === 'plane' ? 11 : 7;
    const lg = this.ctx.createGain(); lg.gain.value = kind === 'plane' ? 6 : 4;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o2.start(t); lfo.start(t);
    const ctx = this.ctx;
    return {
      setThrottle(v) {
        const base = kind === 'plane' ? 95 : 42;
        o.frequency.setTargetAtTime(base + v * (kind === 'plane' ? 30 : 34), ctx.currentTime, 0.1);
        o2.frequency.setTargetAtTime(base * 1.5 + v * 40, ctx.currentTime, 0.1);
      },
      stop() {
        const tt = ctx.currentTime;
        g.gain.cancelScheduledValues(tt);
        g.gain.setTargetAtTime(0.0001, tt, 0.15);
        setTimeout(() => { try { o.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 600);
      },
    };
  }
}
