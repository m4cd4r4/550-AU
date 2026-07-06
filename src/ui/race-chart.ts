// Act 3's speed-versus-distance race: the sundiver against Voyager 1 and
// the practical ceiling of chemical propulsion. Sundiver curve comes from
// the integrator; reference lines come from the facts table.

import facts from '../data/mission-facts.json';
import { YEAR_S, AU_M } from '../sim/constants';
import type { TrajectorySample } from '../sim/sundiver';

const W = 340;
const H = 190;
const PAD = { left: 42, right: 12, top: 16, bottom: 30 };
const R_MIN = 0.1;
const R_MAX = 700;
const V_MAX = 30;

export class RaceChart {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly curve: [number, number, number][] = []; // [rAU, speedAUYr, tS]

  constructor(parent: HTMLElement, samples: TrajectorySample[]) {
    this.el = document.createElement('div');
    this.el.className = 'race-chart panel';
    const title = document.createElement('div');
    title.className = 'chart-title';
    title.textContent = 'SPEED VS DISTANCE';
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);
    this.el.append(title, this.canvas);
    parent.appendChild(this.el);

    // Precompute the full curve once; drawing clips it to the current time.
    const stride = Math.max(1, Math.ceil(samples.length / 500));
    for (let i = 0; i < samples.length; i += stride) {
      const s = samples[i];
      if (s) this.curve.push([s.rAU, (s.speedMS * YEAR_S) / AU_M, s.tS]);
    }
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }

  private x(rAU: number): number {
    const f = Math.log10(Math.max(rAU, R_MIN) / R_MIN) / Math.log10(R_MAX / R_MIN);
    return PAD.left + f * (W - PAD.left - PAD.right);
  }

  private y(speedAUYr: number): number {
    return H - PAD.bottom - (Math.min(speedAUYr, V_MAX) / V_MAX) * (H - PAD.top - PAD.bottom);
  }

  draw(currentTS: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = '#1b2430';
    ctx.fillStyle = '#7d8896';
    ctx.font = '9px ui-monospace, monospace';
    ctx.lineWidth = 1;
    for (const r of [0.1, 1, 10, 100, 700]) {
      const px = this.x(r);
      ctx.beginPath();
      ctx.moveTo(px, PAD.top);
      ctx.lineTo(px, H - PAD.bottom);
      ctx.stroke();
      ctx.fillText(r >= 1 ? `${r}` : `${r}`, px - 6, H - PAD.bottom + 12);
    }
    for (const v of [10, 20, 30]) {
      const py = this.y(v);
      ctx.beginPath();
      ctx.moveTo(PAD.left, py);
      ctx.lineTo(W - PAD.right, py);
      ctx.stroke();
      ctx.fillText(`${v}`, PAD.left - 20, py + 3);
    }
    ctx.fillText('AU (log)', W - PAD.right - 44, H - 6);
    ctx.save();
    ctx.translate(10, H / 2 + 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('AU per year', 0, 0);
    ctx.restore();

    // Reference speeds: Voyager 1 and the chemical ceiling.
    const refs: [number, string, string, number][] = [
      [facts.voyager1.speedAUYr, 'VOYAGER 1', '#7d8896', 10],
      [facts.sundiver.chemicalMaxSpeedAUYr, 'CHEMICAL LIMIT', '#55606d', -4]
    ];
    for (const [v, label, colour, labelDy] of refs) {
      ctx.strokeStyle = colour;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, this.y(v));
      ctx.lineTo(W - PAD.right, this.y(v));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colour;
      ctx.fillText(label, PAD.left + 4, this.y(v) + labelDy);
    }

    // Sundiver curve up to the present.
    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let drew = false;
    let lastR = R_MIN;
    let lastV = 0;
    for (const point of this.curve) {
      const [r, v, tS] = point;
      if (tS > currentTS) break;
      if (!drew) {
        ctx.moveTo(this.x(r), this.y(v));
        drew = true;
      } else {
        ctx.lineTo(this.x(r), this.y(v));
      }
      lastR = r;
      lastV = v;
    }
    ctx.stroke();
    if (drew) {
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(this.x(lastR), this.y(lastV), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('SUNDIVER', Math.min(this.x(lastR) + 6, W - 70), this.y(lastV) - 5);
    }
  }
}
