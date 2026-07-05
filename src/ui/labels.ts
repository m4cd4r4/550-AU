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
      el.style.left = `${((this.scratch.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - this.scratch.y) / 2) * h + (anchor.dy ?? 0)}px`;
    }
  }
}
