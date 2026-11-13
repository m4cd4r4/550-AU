// Act 0 - The Problem. Why can't JWST do this? A procedural JWST beside the
// ghosted outline of the roughly 90 km aperture the same image would need
// by brute force, plus the contrast inset: a planet is about 1e10 times
// fainter than its star, and a coronagraph only buys about 1e6 of that.
// The aperture is drawn to the same scale as JWST and dwarfs the frame; that
// is the point, and the scale is stated. The tour pulls back at a constant
// zoom rate (each tenfold step takes equal time) past a ladder of real,
// sourced sizes, with a live readout of how much the view spans.

import { DirectionalLight, Group, HemisphereLight } from 'three';
import facts from '../data/mission-facts.json';
import { vec3d } from '../sim/vec3d';
import { buildJwstModel, loadJwstGltf } from '../render/jwst-model';
import type { LabelAnchor } from '../render/focal-ruler';
import { formatSize, ScaleLadder } from '../render/scale-ladder';
import type { Act, ActMode, ActServices } from './act';

// JWST primary is 6.5 m; the aperture the lens replaces is ~90 km. Draw both
// to one scene scale: 1 scene unit = the JWST mirror, so the ring radius is
// (90 km / 6.5 m) / 2 ~ 6920 units. Camera pulls back to reveal it.
const JWST_M = facts.problem.jwstApertureM;
const APERTURE_KM = facts.problem.requiredApertureKm;
const RING_RADIUS = ((APERTURE_KM * 1000) / JWST_M) / 2;
const TOUR_DURATION_S = 35;
// Tour beats as fractions of the act: hold on JWST, zoom out, rest on the ring.
const ZOOM_START_P = 0.08;
const ZOOM_END_P = 0.86;
const START_DIST = 3.2;
// The finished frame is this much wider than the ring, so it clears the chrome.
const FIT_MARGIN = 1.3;
const FAR_PLANE = 80000; // a portrait frame needs to stand further back than the shared far plane
const JWST_IMG = `${import.meta.env.BASE_URL}assets/renders/jwst.jpg`;

export class Act0Problem implements Act {
  readonly id = 0;
  readonly title = 'THE PROBLEM';
  readonly question = 'Why can JWST not do this?';

  private readonly group = new Group();
  private readonly jwst = new Group();
  private readonly keyLight = new DirectionalLight(0xfff2e0, 1.3);
  private readonly fillLight = new HemisphereLight(0xbcd2ff, 0x161d29, 0.6);
  // Opposite the key, so the sunshield's underside reads in Explore instead
  // of a black silhouette.
  private readonly backLight = new DirectionalLight(0xc8d4ff, 0.55);
  private readonly ladder = new ScaleLadder(facts.scaleLadder, JWST_M, APERTURE_KM * 1000);
  private readonly inset: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly readoutValue: HTMLElement;
  private readonly readoutBar: HTMLElement;
  private loupeShown = false;
  private sharedFar = 0;
  private readonly anchors: LabelAnchor[];
  private mode: ActMode = 'tour';
  private lastCaption = -1;
  private endShown = false;

  constructor(private readonly s: ActServices) {
    // Procedural placeholder now; swap in the real NASA model when it loads.
    this.jwst.add(buildJwstModel());
    loadJwstGltf((model) => {
      this.jwst.clear();
      this.jwst.add(model);
    });
    this.group.add(this.jwst);

    this.group.add(this.ladder.group);

    this.anchors = [
      { text: `JWST ${JWST_M} m`, displayPos: vec3d(2.5, 1.5, 0), accent: false },
      ...this.ladder.anchors
    ];

    this.readout = document.createElement('div');
    this.readout.className = 'frame-readout panel';
    this.readout.innerHTML = `
      <div class="k">THIS VIEW SPANS</div>
      <div class="v"></div>
      <div class="bar"><i></i></div>
      <div class="k">MIRROR NEEDED <b>${APERTURE_KM} km</b></div>`;
    this.readoutValue = this.readout.querySelector('.v') as HTMLElement;
    this.readoutBar = this.readout.querySelector('.bar i') as HTMLElement;

    this.inset = document.createElement('div');
    this.inset.className = 'contrast-inset panel';
    this.inset.innerHTML = `
      <div class="chart-title">THE CONTRAST PROBLEM</div>
      <div class="contrast-row"><span class="dot star"></span><span>Host star</span><b>brightness 1</b></div>
      <div class="contrast-row"><span class="dot planet"></span><span>Planet</span><b>1e-10 as bright</b></div>
      <div class="contrast-note">A coronagraph suppresses about 1e6 of the glare. The gravitational lens amplifies the planet about 1e11 instead.</div>`;
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.group);
    // Light the NASA model (its materials are lit; the rest of the scene is
    // unlit MeshBasic and ignores these).
    this.keyLight.position.set(6, 8, 10);
    this.backLight.position.set(-6, -8, -10);
    this.s.scene.add(this.keyLight, this.fillLight, this.backLight);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    // Act 0 has its own JWST-scale frame; the shared Sun would sit on the
    // JWST at the shared origin. Hide it; the host star is an abstraction here.
    this.s.setSunVisible(false);
    this.s.setActHeading(`ACT 0 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.lastCaption = -1;
    this.endShown = false;
    this.s.hud.root.appendChild(this.inset);
    this.s.hud.stack.appendChild(this.readout);
    this.s.labels.setAnchors(this.anchors);
    this.loupeShown = false;
    this.sharedFar = this.s.camera.far;
    this.s.camera.far = FAR_PLANE;
    this.s.camera.updateProjectionMatrix();
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.ribbon.setToggle(false, false);
    this.s.inspector.hide();
    if (mode === 'explore') {
      this.s.timeline.pause();
      // Explore inspects the JWST up close; the full-ring reveal is the
      // tour's job (the ring radius exceeds the shared camera max distance).
      this.s.controls.target.set(0, 0, 0);
      this.s.camera.position.set(6, 3, 11);
    } else {
      this.s.captions.clear();
    }
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(dtRealS: number): void {
    if (this.mode === 'tour') {
      const p = this.progress();
      this.placeTourCamera(p);
      this.runCaptions(p);
      if (p >= 1 && !this.endShown) {
        this.endShown = true;
        this.s.timeline.pause();
      }
    }
    const camDist = this.s.camera.position.length();
    const span = camDist * this.spanPerDist();
    this.ladder.update(span, dtRealS, this.s.camera.aspect < 1);

    // The loupe keeps JWST in view while it shrinks to a dot, then clears
    // the frame for the ring's arrival.
    const wantLoupe = span < RING_RADIUS;
    if (wantLoupe !== this.loupeShown) {
      this.loupeShown = wantLoupe;
      if (wantLoupe) this.s.loupe.show(JWST_IMG, 'JAMES WEBB SPACE TELESCOPE', `${JWST_M} m mirror`);
      else this.s.loupe.hide();
    }

    const startSpan = START_DIST * this.spanPerDist();
    const endSpan = RING_RADIUS * 2 * FIT_MARGIN;
    const filled = Math.log(span / startSpan) / Math.log(endSpan / startSpan);
    this.readoutValue.textContent = formatSize(span * JWST_M);
    this.readoutBar.style.width = `${(Math.min(1, Math.max(0, filled)) * 100).toFixed(1)}%`;
    this.updateHud(camDist);
  }

  // Scene units spanned by the shorter frame dimension, per unit of camera distance.
  private spanPerDist(): number {
    const tanHalf = Math.tan((this.s.camera.fov * Math.PI) / 360);
    return 2 * tanHalf * Math.min(1, this.s.camera.aspect);
  }

  private placeTourCamera(p: number): void {
    // Hold on the JWST mirror, then pull back at a constant zoom rate until
    // the whole 90 km ring sits inside the shorter frame dimension. Constant
    // rate in log distance means each tenfold step takes the same time; only
    // the first and last tenth ease, so the move does not jerk.
    const f = Math.min(1, Math.max(0, (p - ZOOM_START_P) / (ZOOM_END_P - ZOOM_START_P)));
    const k = 0.1;
    const v = 1 / (1 - k);
    const z = f < k ? (v * f * f) / (2 * k) : f > 1 - k ? 1 - (v * (1 - f) * (1 - f)) / (2 * k) : v * (f - k / 2);
    const endDist = (RING_RADIUS * 2 * FIT_MARGIN) / this.spanPerDist();
    const dist = START_DIST * Math.pow(endDist / START_DIST, z);
    this.s.camera.position.set(Math.sin(p * 0.8) * dist * 0.06, dist * 0.05, dist);
    this.s.camera.lookAt(0, 0, 0);
  }

  private runCaptions(p: number): void {
    const beats = [
      { at: 0.015, text: `JWST sees exoplanets as unresolved points. Its mirror is ${JWST_M} metres across.` },
      { at: 0.2, text: `To resolve a planet's surface by aperture alone you would need a mirror about ${APERTURE_KM} km wide.` },
      { at: 0.84, text: 'The Sun already is that lens. You just have to travel to its focus.' }
    ];
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      if (beat && this.lastCaption < i && p >= beat.at) {
        this.s.captions.show(beat.text, 7);
        this.lastCaption = i;
      }
    }
  }

  private updateHud(_camDist: number): void {
    const rows: [string, string][] = [
      ['JWST APERTURE', `${JWST_M} m`],
      ['APERTURE FOR A MAP', `${APERTURE_KM} km`],
      ['RATIO', `${Math.round((APERTURE_KM * 1000) / JWST_M).toLocaleString('en-GB')} to 1`],
      ['STAR / PLANET CONTRAST', `${facts.problem.starPlanetContrastRatio.toExponential(0)}`],
      ['CORONAGRAPH LIMIT', `${facts.problem.coronagraphContrastLimit.toExponential(0)}`],
      ['LENS AMPLIFICATION', `${facts.lens.lightAmplificationVisible.toExponential(0)}`]
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({ mapLabel: 'TRUE SCALE, JWST : 90 KM', compression: 1, trueDistanceAU: 1 });
    this.s.timeControls.set({
      paused: this.s.timeline.paused,
      warpLabel: this.s.timeline.warpLabel,
      progress: this.mode === 'tour' ? this.progress() : null
    });
  }

  onPlayPause(): void {
    if (this.mode !== 'tour') return;
    if (this.s.timeline.paused) {
      if (this.progress() >= 1) {
        this.s.timeline.scrubTo(0);
        this.lastCaption = -1;
        this.endShown = false;
        this.s.captions.clear();
      }
      this.s.timeline.resume();
    } else {
      this.s.timeline.pause();
    }
  }

  onWarpCycle(): void {
    this.s.timeline.cycleWarp();
  }

  onScrub(progress: number): void {
    this.s.timeline.scrubTo(progress * TOUR_DURATION_S);
    this.lastCaption = 2;
    this.endShown = progress >= 1;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // Act 0 is already true scale (JWST : 90 km).
  }

  exit(): void {
    this.s.scene.remove(this.group);
    this.s.scene.remove(this.keyLight, this.fillLight, this.backLight);
    this.inset.remove();
    this.readout.remove();
    this.s.camera.far = this.sharedFar;
    this.s.camera.updateProjectionMatrix();
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.loupe.hide();
  }
}
