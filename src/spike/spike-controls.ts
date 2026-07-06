// Control panel and readouts for the Act 5 lensing spike page.
// Values feed the shader uniforms; readouts are computed live from the
// lens equations so the panel doubles as a numerical check on the render.

import { SUN_J2 } from '../sim/constants';

export interface SpikeState {
  zAU: number;
  offsetArcsec: number;
  j2On: boolean;
  exposure: number;
  fovArcsec: number;
  guidesOn: boolean;
}

// Exaggerated effective J2 while the toggle is on. At the true value the
// caustic is micro-arcsecond scale and invisible at any sane zoom; the panel
// states the exaggeration factor next to the toggle.
export const J2_EFFECTIVE = 0.05;

export interface SpikeReadouts {
  thetaEArcsec: number;
  thetaSunArcsec: number;
  ringImpactRsun: number;
  occulterRsun: number;
  ringVisible: boolean;
}

function row(label: string): { wrap: HTMLDivElement; value: HTMLSpanElement } {
  const wrap = document.createElement('div');
  wrap.className = 'ctl-row';
  const name = document.createElement('span');
  name.className = 'ctl-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'ctl-value';
  wrap.append(name, value);
  return { wrap, value };
}

function slider(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
  format: (v: number) => string,
  onInput: (v: number) => void
): void {
  const { wrap, value } = row(label);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initial);
  value.textContent = format(initial);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    value.textContent = format(v);
    onInput(v);
  });
  wrap.appendChild(input);
  parent.appendChild(wrap);
}

function toggle(
  parent: HTMLElement,
  label: string,
  note: string,
  initial: boolean,
  onChange: (on: boolean) => void
): void {
  const wrap = document.createElement('div');
  wrap.className = 'ctl-row';
  const button = document.createElement('button');
  button.className = 'ctl-toggle';
  button.setAttribute('aria-pressed', String(initial));
  button.textContent = label;
  if (initial) button.classList.add('on');
  button.addEventListener('click', () => {
    const on = !button.classList.contains('on');
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
    onChange(on);
  });
  wrap.appendChild(button);
  if (note) {
    const noteEl = document.createElement('span');
    noteEl.className = 'ctl-note';
    noteEl.textContent = note;
    wrap.appendChild(noteEl);
  }
  parent.appendChild(wrap);
}

export class SpikePanel {
  readonly state: SpikeState = {
    zAU: 650,
    offsetArcsec: 0,
    j2On: false,
    exposure: 1,
    fovArcsec: 8,
    guidesOn: true
  };

  private readonly readoutValues = new Map<string, HTMLSpanElement>();
  private readonly status: HTMLDivElement;

  constructor(parent: HTMLElement, private readonly onChange: () => void) {
    const panel = document.createElement('div');
    panel.className = 'spike-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'LENS PARAMETERS';
    panel.appendChild(title);

    const s = this.state;
    const set = <K extends keyof SpikeState>(key: K, v: SpikeState[K]): void => {
      s[key] = v;
      this.onChange();
    };

    slider(panel, 'HELIOCENTRIC DISTANCE', 548, 1200, 1, s.zAU,
      (v) => `${v.toFixed(0)} AU`, (v) => set('zAU', v));
    slider(panel, 'SOURCE OFF-AXIS OFFSET', 0, 2, 0.005, s.offsetArcsec,
      (v) => `${v.toFixed(3)} arcsec`, (v) => set('offsetArcsec', v));
    slider(panel, 'EXPOSURE', 0.2, 4, 0.05, s.exposure,
      (v) => `${v.toFixed(2)}x`, (v) => set('exposure', v));
    slider(panel, 'FIELD OF VIEW', 4, 24, 0.5, s.fovArcsec,
      (v) => `${v.toFixed(1)} arcsec`, (v) => set('fovArcsec', v));

    const exaggeration = J2_EFFECTIVE / SUN_J2;
    toggle(
      panel,
      'J2 QUADRUPOLE',
      `exaggerated ${Math.round(exaggeration / 1000)}k x for visibility, true J2 ${SUN_J2}`,
      s.j2On,
      (on) => set('j2On', on)
    );
    toggle(panel, 'ANGULAR GUIDES', '', s.guidesOn, (on) => set('guidesOn', on));

    const readoutTitle = document.createElement('div');
    readoutTitle.className = 'panel-title';
    readoutTitle.textContent = 'COMPUTED LIVE';
    panel.appendChild(readoutTitle);

    const readoutRows: Array<[string, string]> = [
      ['thetaE', 'EINSTEIN RING theta_E'],
      ['thetaSun', 'SOLAR LIMB'],
      ['impact', 'RING IMPACT PARAMETER'],
      ['occulter', 'CORONAGRAPH OCCULTER']
    ];
    for (const [key, label] of readoutRows) {
      const { wrap, value } = row(label);
      this.readoutValues.set(key, value);
      panel.appendChild(wrap);
    }

    this.status = document.createElement('div');
    this.status.className = 'spike-status';
    panel.appendChild(this.status);

    parent.appendChild(panel);
  }

  updateReadouts(r: SpikeReadouts): void {
    this.readoutValues.get('thetaE')!.textContent = `${r.thetaEArcsec.toFixed(3)} arcsec`;
    this.readoutValues.get('thetaSun')!.textContent = `${r.thetaSunArcsec.toFixed(3)} arcsec`;
    this.readoutValues.get('impact')!.textContent = `${r.ringImpactRsun.toFixed(3)} R_sun`;
    this.readoutValues.get('occulter')!.textContent = `${r.occulterRsun.toFixed(2)} R_sun`;
    this.status.textContent = r.ringVisible
      ? 'Ring clear of the occulter'
      : 'Ring behind the occulter: move outward along the focal line';
    this.status.classList.toggle('warn', !r.ringVisible);
  }
}
