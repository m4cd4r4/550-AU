// Global time controls: pause, warp cycle, tour scrub.

export interface TimeControlState {
  paused: boolean;
  warpLabel: string;
  progress: number | null; // null hides the scrub bar
}

export class TimeControls {
  readonly el: HTMLElement;
  private playPause: HTMLButtonElement;
  private warp: HTMLButtonElement;
  private scrub: HTMLInputElement;
  private scrubbing = false;
  private lastProgress: number | null = null;

  // The tour progress the current act last reported (null in Explore). Used by
  // the auto-advance controller to know when an act's tour has finished.
  get tourProgress(): number | null {
    return this.lastProgress;
  }

  constructor(
    parent: HTMLElement,
    handlers: {
      onPlayPause: () => void;
      onWarpCycle: () => void;
      onScrub: (progress: number) => void;
    }
  ) {
    this.el = document.createElement('div');
    this.el.className = 'time-controls panel';

    this.playPause = document.createElement('button');
    this.playPause.addEventListener('click', handlers.onPlayPause);

    this.warp = document.createElement('button');
    this.warp.addEventListener('click', handlers.onWarpCycle);

    this.scrub = document.createElement('input');
    this.scrub.type = 'range';
    this.scrub.min = '0';
    this.scrub.max = '1000';
    this.scrub.setAttribute('aria-label', 'Scrub the act timeline');
    this.scrub.addEventListener('pointerdown', () => {
      this.scrubbing = true;
    });
    this.scrub.addEventListener('pointerup', () => {
      this.scrubbing = false;
    });
    this.scrub.addEventListener('input', () => {
      handlers.onScrub(Number(this.scrub.value) / 1000);
    });

    this.el.append(this.scrub, this.playPause, this.warp);
    parent.appendChild(this.el);
  }

  set(state: TimeControlState): void {
    this.lastProgress = state.progress;
    const playLabel = state.paused ? 'PLAY' : 'PAUSE';
    if (this.playPause.textContent !== playLabel) this.playPause.textContent = playLabel;
    if (this.warp.textContent !== state.warpLabel) this.warp.textContent = state.warpLabel;
    const showScrub = state.progress !== null;
    this.scrub.style.display = showScrub ? '' : 'none';
    if (showScrub && !this.scrubbing) {
      this.scrub.value = String(Math.round((state.progress ?? 0) * 1000));
    }
  }
}
