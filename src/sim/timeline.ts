// Global mission clock. Time is double seconds since act start; each act
// sets its own default warp (simulated seconds per real second).

export class Timeline {
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
