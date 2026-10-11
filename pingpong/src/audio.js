// All game sound is synthesised with the Web Audio API — no audio files to ship.
// The ball's click and the bat's thwack are shaped noise bursts, so their pitch
// and brightness follow how hard the ball was hit.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambience = null;
    this.enabled = true;
    this.noise = null;
  }

  /** Must be called from a user gesture before anything will make a sound. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    // Two seconds of white noise, reused by every percussive sound.
    const frames = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.85 : 0;
    if (!on) this.stopAmbience();
  }

  noiseBurst({ gain = 0.5, freq = 2400, q = 1.2, dur = 0.06, type = 'bandpass', sweep = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    if (sweep) {
      filter.frequency.setValueAtTime(freq, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq + sweep), now + dur);
    }
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  tone({ freq = 200, gain = 0.2, dur = 0.08, type = 'sine', to = null }) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, now + dur);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /** The bat: a short bright thwack, harder hits ring lower and louder. */
  paddle(power = 0.5) {
    const p = Math.min(1, Math.max(0, power));
    this.noiseBurst({ gain: 0.22 + p * 0.4, freq: 2600 - p * 900, q: 1.1, dur: 0.05 + p * 0.03 });
    this.tone({ freq: 240 - p * 80, gain: 0.1 + p * 0.12, dur: 0.07, type: 'triangle' });
  }

  /** The table: shorter and brighter than the bat. */
  bounce(speed = 1) {
    const p = Math.min(1, speed / 9);
    this.noiseBurst({ gain: 0.12 + p * 0.26, freq: 3600 + p * 900, q: 1.6, dur: 0.035 });
    this.tone({ freq: 420 + p * 120, gain: 0.05, dur: 0.04, type: 'square' });
  }

  net() {
    this.noiseBurst({ gain: 0.3, freq: 900, q: 0.7, dur: 0.12, type: 'lowpass' });
    this.tone({ freq: 120, gain: 0.12, dur: 0.12, type: 'sine' });
  }

  floor() {
    this.noiseBurst({ gain: 0.14, freq: 700, q: 0.8, dur: 0.09, type: 'lowpass' });
  }

  /** Crowd swell, scaled by how big the point was. */
  cheer(strength = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const s = Math.min(1, Math.max(0, strength));
    this.noiseBurst({ gain: 0.1 + s * 0.22, freq: 800, q: 0.4, dur: 0.5 + s * 0.9, type: 'bandpass' });
    this.noiseBurst({ gain: 0.06 + s * 0.14, freq: 1800, q: 0.6, dur: 0.35 + s * 0.7 });
  }

  whistle() {
    this.tone({ freq: 2100, to: 1500, gain: 0.12, dur: 0.35, type: 'sine' });
  }

  ui() {
    this.tone({ freq: 620, gain: 0.09, dur: 0.06, type: 'triangle' });
  }

  /** Very quiet hall hum so silence never feels dead. */
  startAmbience() {
    if (!this.ctx || !this.enabled || this.ambience) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const amp = this.ctx.createGain();
    amp.gain.value = 0.035;
    src.connect(filter).connect(amp).connect(this.master);
    src.start();
    this.ambience = { src, amp };
  }

  stopAmbience() {
    if (!this.ambience) return;
    try {
      this.ambience.src.stop();
    } catch {
      /* already stopped */
    }
    this.ambience = null;
  }
}
