// Generative ambient bed: a warm, evolving space pad built entirely in
// WebAudio, no sample files, so the repo stays licence-clean. A consonant
// chord of pure-ratio voices (no rough beating), a slow filter drift and a
// synthetic reverb give it air; sparse bell tones drawn from the chord add a
// gentle, inspirational shimmer. The chord shifts per act to colour the
// story. Muted state is persisted; audio only starts after a user gesture
// (browser autoplay policy).

const STORAGE_KEY = '550au.muted';

// Just-intonation chords as ratios above the root: consonant, so the voices
// reinforce rather than beat against each other.
const MAJOR_9 = [1, 1.5, 2, 2.25, 2.5];
const MINOR_9 = [1, 1.5, 2, 2.25, 2.4];
const MAJOR = [1, 1.5, 2, 2.5, 3];

interface Mood {
  root: number; // Hz
  chord: number[];
  cutoff: number; // pad brightness
}

// One mood per act; warm and low, brightening for the hopeful beats.
const MOODS: Record<number, Mood> = {
  0: { root: 73.42, chord: MINOR_9, cutoff: 620 }, // the problem: unresolved
  1: { root: 55.0, chord: MAJOR_9, cutoff: 780 }, // the lens opens
  2: { root: 65.41, chord: MINOR_9, cutoff: 560 }, // the vast focal line
  3: { root: 82.41, chord: MAJOR, cutoff: 1050 }, // the dive, bright and fast
  4: { root: 49.0, chord: MAJOR_9, cutoff: 720 }, // the steady string
  5: { root: 55.0, chord: MAJOR_9, cutoff: 1150 }, // the payoff, luminous
  6: { root: 87.31, chord: MAJOR_9, cutoff: 900 }, // many worlds, wonder
  7: { root: 65.41, chord: MAJOR, cutoff: 820 } // epilogue, warm resolution
};

const VOICES = 5;

export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private readonly voices: OscillatorNode[] = [];
  private readonly voiceGains: GainNode[] = [];
  private readonly chorus: OscillatorNode[] = [];
  private mood: Mood = MOODS[2] as Mood;
  private muted: boolean;
  private started = false;

  constructor() {
    this.muted = localStorage.getItem(STORAGE_KEY) === '1';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  // Called on the first user gesture. Safe to call repeatedly.
  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    this.started = true;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.22;
    this.masterGain.connect(ctx.destination);

    // Synthetic reverb for space: a decaying-noise impulse response.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx, 3.2, 2.6);
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.55;
    reverb.connect(this.wetGain).connect(this.masterGain);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.mood.cutoff;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.masterGain);
    this.filter.connect(reverb);

    // Slow cutoff drift: gentle, musical movement (not a rough beat).
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    this.lfo.connect(lfoGain).connect(this.filter.frequency);
    this.lfo.start();

    // Pad voices: one per chord tone, sine for a soft body.
    for (let i = 0; i < VOICES; i++) {
      const osc = ctx.createOscillator();
      osc.type = i < 3 ? 'sine' : 'triangle';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.filter);
      osc.start();
      this.voices.push(osc);
      this.voiceGains.push(gain);
      // A faintly detuned partner on the upper tones for a wide, airy shimmer.
      if (i >= 3) {
        const c = ctx.createOscillator();
        c.type = 'triangle';
        c.detune.value = i === 3 ? 7 : -6;
        const cg = ctx.createGain();
        cg.gain.value = 0.1; // constant airy shimmer over the upper tones
        c.connect(cg).connect(this.filter);
        c.start();
        this.chorus.push(c);
      }
    }

    this.applyMood(0.01);
    this.scheduleBell();
  }

  // Shift the pad toward an act's mood over a few seconds.
  setAct(actId: number): void {
    this.mood = MOODS[actId] ?? (MOODS[2] as Mood);
    if (this.ctx) this.applyMood(4.0);
  }

  private applyMood(glide: number): void {
    if (!this.ctx || !this.filter) return;
    const t = this.ctx.currentTime;
    const { root, chord, cutoff } = this.mood;
    this.filter.frequency.setTargetAtTime(cutoff, t, glide);
    // Quieter for the higher voices so the pad does not get shrill.
    const levels = [0.5, 0.32, 0.26, 0.16, 0.12];
    for (let i = 0; i < VOICES; i++) {
      const osc = this.voices[i];
      const gain = this.voiceGains[i];
      const ratio = chord[i];
      if (!osc || !gain) continue;
      if (ratio === undefined) {
        gain.gain.setTargetAtTime(0, t, glide);
        continue;
      }
      osc.frequency.setTargetAtTime(root * ratio, t, glide);
      gain.gain.setTargetAtTime(levels[i] ?? 0.1, t, glide);
    }
    for (let j = 0; j < this.chorus.length; j++) {
      const c = this.chorus[j];
      const ratio = chord[j + 3];
      if (c && ratio !== undefined) c.frequency.setTargetAtTime(root * ratio, t, glide);
    }
  }

  // Sparse chord-tone bells drifting through the reverb: the melodic layer.
  private scheduleBell(): void {
    if (!this.ctx) return;
    const delay = 3500 + Math.random() * 5000;
    window.setTimeout(() => {
      this.playBell();
      this.scheduleBell();
    }, delay);
  }

  private playBell(): void {
    const ctx = this.ctx;
    if (!ctx || !this.filter || this.muted) return;
    const { root, chord } = this.mood;
    const ratio = chord[1 + Math.floor(Math.random() * (chord.length - 1))] ?? 2;
    const octave = Math.random() < 0.5 ? 2 : 4;
    const freq = root * ratio * octave;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    osc.connect(gain).connect(this.filter);
    osc.start(t);
    osc.stop(t + 4.8);
  }

  // A soft mark for chapter changes and act events.
  tick(strength = 1): void {
    if (!this.ctx || !this.filter || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.mood.root * 4, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain).connect(this.filter);
    osc.start(t);
    osc.stop(t + 1.4);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.22, this.ctx.currentTime, 0.3);
    }
    return this.muted;
  }
}

// A short exponentially decaying stereo noise burst: a cheap, clean reverb tail.
function impulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}
