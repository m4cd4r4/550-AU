// Screen-projected labels for scene anchors. Anchors carry display-space
// positions (AU doubles); projection goes through the floating origin so
// large coordinates never hit float32.

import { Vector3, type PerspectiveCamera } from 'three';
import type { LabelAnchor } from '../render/focal-ruler';
import type { OriginFrame } from '../render/floating-origin';

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
      label.className = anchor.accent ? 'label accent' : 'label';
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
      const x = ((this.scratch.x + 1) / 2) * w;
      let y = ((1 - this.scratch.y) / 2) * h + (anchor.dy ?? 0);
      const alpha = anchor.opacity ?? 1;
      el.style.opacity = alpha >= 1 ? '' : `${alpha}`;
      if (anchor.nudge) {
        const bw = el.offsetWidth;
        const bh = el.offsetHeight || 14;
        for (let tries = 0; tries < 6; tries++) {
          const hit = placed.find(
            (r) => x < r.x + r.w && x + bw > r.x && y < r.y + r.h && y + bh > r.y
          );
          if (!hit) break;
          y = hit.y + hit.h + 1;
        }
        placed.push({ x, y, w: bw, h: bh });
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }
}
