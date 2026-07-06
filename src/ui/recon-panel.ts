// Act 5's reconstruction panel: the planet map filling in cell by cell
// behind the raster scan, noisy until the corona reference is subtracted,
// sharpening as passes accumulate. The deconvolution itself is dramatised
// as progressive reveal, per the plan; the map is procedural and the panel
// is watermarked speculative throughout.

import facts from '../data/mission-facts.json';

const PANEL_PX = 236;
const REVEAL_N = 46; // reveal blocks per side; the true map is 1000 x 1000

export class ReconPanel {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reveal: HTMLCanvasElement;
  private readonly revealCtx: CanvasRenderingContext2D;
  private readonly noise: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private revealedBlocks = 0;

  constructor(parent: HTMLElement, private readonly source: HTMLCanvasElement) {
    this.el = document.createElement('div');
    this.el.className = 'recon-panel panel';

    const title = document.createElement('div');
    title.className = 'chart-title';
    title.textContent = 'RECONSTRUCTION';

    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = PANEL_PX * dpr;
    this.canvas.height = PANEL_PX * dpr;
    this.canvas.style.width = `${PANEL_PX}px`;
    this.canvas.style.height = `${PANEL_PX}px`;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);

    this.status = document.createElement('div');
    this.status.className = 'recon-status';

    this.el.append(title, this.canvas, this.status);
    parent.appendChild(this.el);

    this.reveal = document.createElement('canvas');
    this.reveal.width = PANEL_PX;
    this.reveal.height = PANEL_PX;
    const revealCtx = this.reveal.getContext('2d');
    if (!revealCtx) throw new Error('2d context unavailable');
    this.revealCtx = revealCtx;
    this.revealCtx.fillStyle = '#05070b';
    this.revealCtx.fillRect(0, 0, PANEL_PX, PANEL_PX);

    // Static noise tile, re-offset each frame while un-subtracted.
    this.noise = document.createElement('canvas');
    this.noise.width = 128;
    this.noise.height = 128;
    const noiseCtx = this.noise.getContext('2d');
    if (noiseCtx) {
      const img = noiseCtx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 90 + Math.random() * 165;
        img.data[i] = v;
        img.data[i + 1] = v * 0.9;
        img.data[i + 2] = v * 0.8;
        img.data[i + 3] = 255;
      }
      noiseCtx.putImageData(img, 0, 0);
    }
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }

  // fraction: scan progress 0..1 (raster order, top row first).
  // subtracted: corona reference subtraction active (noise drops).
  draw(fraction: number, subtracted: boolean, monthsElapsed: number): void {
    const totalBlocks = REVEAL_N * REVEAL_N;
    const target = Math.min(totalBlocks, Math.floor(fraction * totalBlocks));
    const block = PANEL_PX / REVEAL_N;
    const srcBlock = this.source.width / REVEAL_N;
    while (this.revealedBlocks < target) {
      const i = this.revealedBlocks;
      const row = Math.floor(i / REVEAL_N);
      const col = i % REVEAL_N;
      this.revealCtx.drawImage(
        this.source,
        col * srcBlock,
        row * srcBlock,
        srcBlock,
        srcBlock,
        col * block,
        row * block,
        block,
        block
      );
      this.revealedBlocks++;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, PANEL_PX, PANEL_PX);
    ctx.drawImage(this.reveal, 0, 0);

    // Corona noise rides on everything until the reference is subtracted.
    ctx.globalAlpha = subtracted ? 0.07 : 0.34;
    const ox = Math.floor(Math.random() * 96);
    const oy = Math.floor(Math.random() * 96);
    for (let x = -1; x < 3; x++) {
      for (let y = -1; y < 3; y++) {
        ctx.drawImage(this.noise, x * 128 - ox, y * 128 - oy);
      }
    }
    ctx.globalAlpha = 1;

    // Scan cursor: the row currently being written.
    if (fraction < 1) {
      const row = Math.floor((target / totalBlocks) * REVEAL_N);
      ctx.fillStyle = 'rgba(255, 176, 0, 0.55)';
      ctx.fillRect(0, row * block, PANEL_PX, 1.2);
    }

    // The surface is procedural: watermark the image itself.
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(242, 246, 250, 0.75)';
    ctx.fillText('SPECULATIVE', 8, PANEL_PX - 8);

    const map = facts.imageCylinder;
    this.status.textContent =
      fraction >= 1
        ? `${map.finalMapPixels} x ${map.finalMapPixels} px, ${map.finalMapResolutionKmPerPx} km per px, ${map.finalImageSizeMB} MB`
        : `pass 1: ${Math.round(fraction * 100)}%  /  month ${monthsElapsed.toFixed(1)}  /  ${subtracted ? 'corona subtracted' : 'corona in beam'}`;
  }

  reset(): void {
    this.revealedBlocks = 0;
    this.revealCtx.fillStyle = '#05070b';
    this.revealCtx.fillRect(0, 0, PANEL_PX, PANEL_PX);
  }
}
