// Generative ambient bed: a slow synth drone built entirely in WebAudio, no
// sample files, so the repo stays licence-clean. The drone character shifts
// per act; subtle ticks mark chapter changes and act events. Muted state is
// persisted; audio only starts after a user gesture (browser autoplay policy).

const STORAGE_KEY = '550au.muted';

interface ActMood {
  root: number; // drone root frequency, Hz
  fifth: number; // interval partner
  cutoff: number; // low-pass character
  detune: number; // slow beat between the two voices
}

// One mood per act; near-monochrome sound, shifting colour with the story.
const MOODS: Record<number, ActMood> = {
  0: { root: 55, fifth: 82.4, cutoff: 420, detune: 0.12 },
  1: { root: 61.7, fifth: 92.5, cutoff: 520, detune: 0.18 },
  2: { root: 49, fifth: 73.4, cutoff: 380, detune: 0.1 },
  3: { root: 65.4, fifth: 98, cutoff: 640, detune: 0.3 },
  4: { root: 58.3, fifth: 87.3, cutoff: 460, detune: 0.16 },
  5: { root: 73.4, fifth: 110, cutoff: 720, detune: 0.22 },
  6: { root: 51.9, fifth: 77.8, cutoff: 400, detune: 0.14 },
  7: { root: 43.7, fifth: 65.4, cutoff: 340, detune: 0.08 }
};

export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voiceA: OscillatorNode | null = null;
  private voiceB: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
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
    this.ctx = new Ctor();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.16;
    this.masterGain.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 420;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.masterGain);

    this.voiceA = this.ctx.createOscillator();
    this.voiceA.type = 'sawtooth';
    this.voiceA.frequency.value = 55;
    const gainA = this.ctx.createGain();
    gainA.gain.value = 0.5;
    this.voiceA.connect(gainA).connect(this.filter);

    this.voiceB = this.ctx.createOscillator();
    this.voiceB.type = 'sine';
    this.voiceB.frequency.value = 82.4;
    const gainB = this.ctx.createGain();
    gainB.gain.value = 0.4;
    this.voiceB.connect(gainB).connect(this.filter);

    this.voiceA.start();
    this.voiceB.start();
  }

  // Shift the drone toward an act's mood over a few seconds.
  setAct(actId: number): void {
    if (!this.ctx || !this.voiceA || !this.voiceB || !this.filter) return;
    const mood = MOODS[actId] ?? MOODS[2];
    if (!mood) return;
    const t = this.ctx.currentTime;
    const glide = 3.5;
    this.voiceA.frequency.setTargetAtTime(mood.root, t, glide);
    this.voiceB.frequency.setTargetAtTime(mood.fifth + mood.detune, t, glide);
    this.filter.frequency.setTargetAtTime(mood.cutoff, t, glide);
  }

  // A short filtered click for chapter changes and act events.
  tick(strength = 1): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09 * strength, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.16, this.ctx.currentTime, 0.2);
    }
    return this.muted;
  }
}
