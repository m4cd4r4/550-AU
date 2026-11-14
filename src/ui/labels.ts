// Screen-projected labels for scene anchors. Anchors carry display-space
// positions (AU doubles); projection goes through the floating origin so
// large coordinates never hit float32.

import { Vector3, type PerspectiveCamera } from 'three';
import type { LabelAnchor } from '../render/focal-ruler';
import type { OriginFrame } from '../render/floating-origin';

const EDGE = 4; // px kept clear at every viewport edge
const OFFSET_X = 10; // matches .labels .label { transform: translate(10px, -50%) }

// Keep a label of size bw x bh fully inside a w x h viewport. x, y are the
// anchor point as the CSS positions it: a default label starts OFFSET_X right
// of x and is centred on y; a centred label is centred on x and hangs below y.
export function clampLabel(
  x: number,
  y: number,
  bw: number,
  bh: number,
  centred: boolean,
  w: number,
  h: number
): { x: number; y: number } {
  const left = centred ? -bw / 2 : OFFSET_X; // rendered left edge minus x
  const top = centred ? 0 : -bh / 2; // rendered top edge minus y
  const cx = Math.min(Math.max(x, EDGE - left), w - EDGE - bw - left);
  const cy = Math.min(Math.max(y, EDGE - top), h - EDGE - bh - top);
  return { x: cx, y: cy };
}

export class LabelLayer {
  readonly el: HTMLElement;
  private items: { el: HTMLElement; anchor: LabelAnchor }[] = [];
  private readonly scratch = new Vector3();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'labels';
    parent.appendChild(this.el);
  }

  setAnchors(anchors: LabelAnchor[]): void {
    this.el.innerHTML = '';
    this.items = anchors.map((anchor) => {
      const label = document.createElement('div');
      label.className = `label${anchor.accent ? ' accent' : ''}${anchor.align === 'center' ? ' center' : ''}`;
      label.textContent = anchor.text;
      this.el.appendChild(label);
      return { el: label, anchor };
    });
  }

  update(origin: OriginFrame, camera: PerspectiveCamera): void {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const { el, anchor } of this.items) {
      if (el.textContent !== anchor.text) el.textContent = anchor.text; // live labels
      origin.toScene(anchor.displayPos, this.scratch).project(camera);
      const visible =
        this.scratch.z < 1 &&
        this.scratch.x > -1.05 &&
        this.scratch.x < 1.05 &&
        this.scratch.y > -1.05 &&
        this.scratch.y < 1.05;
      if (!visible) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      if (el.style.display === 'none') el.style.display = '';
      const alpha = anchor.opacity ?? 1;
      el.style.opacity = alpha >= 1 ? '' : `${alpha}`;
      if (alpha <= 0.01) continue; // faded out: no layout read, no room taken
      const bw = el.offsetWidth;
      const bh = el.offsetHeight || 14;
      const centred = anchor.align === 'center';
      // Clamp x first so the nudge stack sees where the label really lands.
      let { x, y } = clampLabel(
        ((this.scratch.x + 1) / 2) * w,
        ((1 - this.scratch.y) / 2) * h + (anchor.dy ?? 0),
        bw,
        bh,
        centred,
        w,
        h
      );
      if (anchor.nudge) {
        for (let tries = 0; tries < 6; tries++) {
          const hit = placed.find(
            (r) => x < r.x + r.w && x + bw > r.x && y < r.y + r.h && y + bh > r.y
          );
          if (!hit) break;
          y = hit.y + hit.h + 1;
        }
        placed.push({ x, y, w: bw, h: bh });
        y = clampLabel(x, y, bw, bh, centred, w, h).y;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }
}
