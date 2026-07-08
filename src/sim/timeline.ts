// Global mission clock. Time is double seconds since act start. Warp
// (simulated seconds per real second) is a shared, persistent playback speed:
// it survives act switches, so auto-advance and chapter jumps keep the pace
// the viewer last chose. reset() deliberately leaves it alone.

export class Timeline {
  private static readonly WARPS = [0.5, 1, 2, 4];
  private tS = 0;
  private warpFactor = 1;
  private isPaused = false;

  update(dtRealS: number): void {
    if (!this.isPaused) {
      this.tS += dtRealS * this.warpFactor;
    }
  }

  get seconds(): number {
    return this.tS;
  }

  scrubTo(tS: number): void {
    this.tS = tS;
  }

  get warp(): number {
    return this.warpFactor;
  }

  setWarp(simSecondsPerRealSecond: number): void {
    this.warpFactor = simSecondsPerRealSecond;
  }

  get warpLabel(): string {
    return `${this.warpFactor}X`;
  }

  // Step to the next playback speed, wrapping. Persists across acts.
  cycleWarp(): void {
    const i = Timeline.WARPS.indexOf(this.warpFactor);
    this.warpFactor = Timeline.WARPS[(i + 1) % Timeline.WARPS.length] ?? 1;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  toggle(): void {
    this.isPaused = !this.isPaused;
  }

  reset(): void {
    this.tS = 0;
    this.isPaused = false;
  }
}
