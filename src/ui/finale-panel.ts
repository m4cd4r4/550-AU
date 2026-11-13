// Act 5's closing reveal: the finished map at full size beside what JWST
// gets of the same planet, one unresolved pixel. It calls back to Act 0.
// The map is procedural, so the watermark is drawn into the image itself.

import facts from '../data/mission-facts.json';

export class FinalePanel {
  readonly el: HTMLElement;

  // before: the element this overlay sits under in the UI layer, so captions
  // and the bottom controls stay on top of it.
  constructor(parent: HTMLElement, before: Node | null, source: HTMLCanvasElement) {
    this.el = document.createElement('div');
    this.el.className = 'finale';
    this.el.style.display = 'none';

    const map = facts.imageCylinder;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(source, 0, 0);
    const mean = meanColour(ctx, canvas.width, canvas.height);
    const pad = canvas.width / 64;
    const size = Math.round(canvas.width / 30);
    ctx.font = `${size}px ui-monospace, monospace`;
    ctx.fillStyle = 'rgba(5, 7, 11, 0.72)'; // the ice cap is white: back the text
    ctx.fillRect(pad, canvas.height - pad * 3 - size, ctx.measureText('SPECULATIVE').width + pad * 2, size + pad * 2);
    ctx.fillStyle = 'rgba(242, 246, 250, 0.92)';
    ctx.fillText('SPECULATIVE', pad * 2, canvas.height - pad * 2 - size * 0.12);

    const pixel = document.createElement('div');
    pixel.className = 'finale-frame finale-pixel';
    const dot = document.createElement('i');
    dot.style.background = mean;
    pixel.appendChild(dot);

    const frame = document.createElement('div');
    frame.className = 'finale-frame';
    frame.appendChild(canvas);

    this.el.append(
      figure('finale-before', "JWST'S VIEW: ONE PIXEL", pixel, 'The whole planet, unresolved'),
      figure(
        'finale-after',
        `FROM ${facts.lens.usefulImagingStartAU} AU: ${map.finalMapPixels} x ${map.finalMapPixels} PIXELS`,
        frame,
        `${map.finalMapResolutionKmPerPx} km per pixel. Surface shown is speculative`
      )
    );
    parent.insertBefore(this.el, before);
  }

  // k: 0 hidden, 1 fully revealed.
  setReveal(k: number): void {
    const display = k > 0 ? '' : 'none';
    if (this.el.style.display !== display) this.el.style.display = display;
    this.el.style.opacity = `${k}`;
  }
}

function figure(cls: string, title: string, body: HTMLElement, note: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `finale-fig ${cls}`;
  const head = document.createElement('div');
  head.className = 'finale-title';
  head.textContent = title;
  const foot = document.createElement('div');
  foot.className = 'finale-note';
  foot.textContent = note;
  el.append(head, body, foot);
  return el;
}

function meanColour(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const data = ctx.getImageData(0, 0, w, h).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i] as number;
    g += data[i + 1] as number;
    b += data[i + 2] as number;
  }
  const n = data.length / 4;
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}
