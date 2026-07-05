// The honesty instrument: always states the display mapping, the local
// compression factor, and the true distance. Hosts the true-scale toggle.

import { formatAu, formatCompression } from './format';

export interface RibbonState {
  mapLabel: string;
  compression: number;
  trueDistanceAU: number;
}

export class ScaleRibbon {
  readonly el: HTMLElement;
  private mode: HTMLElement;
  private compression: HTMLElement;
  private distance: HTMLElement;
  private toggle: HTMLButtonElement;

  constructor(parent: HTMLElement, onToggleTrueScale: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'scale-ribbon panel';

    this.mode = document.createElement('span');
    this.mode.className = 'mode';

    this.compression = document.createElement('span');
    this.compression.className = 'fact';

    this.distance = document.createElement('span');
    this.distance.className = 'fact';

    this.toggle = document.createElement('button');
    this.toggle.textContent = 'TRUE SCALE';
    this.toggle.addEventListener('click', onToggleTrueScale);

    this.el.append(this.mode, this.compression, this.distance, this.toggle);
    parent.appendChild(this.el);
  }

  set(state: RibbonState): void {
    this.mode.textContent = state.mapLabel;
    this.compression.innerHTML = `LOCAL SCALE <b>${formatCompression(state.compression)}</b>`;
    this.distance.innerHTML = `TRUE DISTANCE <b>${formatAu(state.trueDistanceAU)}</b>`;
  }

  setToggle(enabled: boolean, active: boolean): void {
    this.toggle.disabled = !enabled;
    this.toggle.classList.toggle('active', active);
    this.toggle.textContent = active ? 'COMPRESSED VIEW' : 'TRUE SCALE';
  }
}
