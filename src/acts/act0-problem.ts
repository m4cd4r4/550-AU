// Act 0 - The Problem. Why can't JWST do this? A procedural JWST beside the
// ghosted outline of the roughly 90 km aperture the same image would need
// by brute force, plus the contrast inset: a planet is about 1e10 times
// fainter than its star, and a coronagraph only buys about 1e6 of that.
// The aperture ring is drawn to the same scale as JWST and dwarfs the frame;
// that is the point, and the scale is stated.

import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial
} from 'three';
import facts from '../data/mission-facts.json';
import { vec3d } from '../sim/vec3d';
import { buildJwstModel, loadJwstGltf } from '../render/jwst-model';
import type { LabelAnchor } from '../render/focal-ruler';
import type { Act, ActMode, ActServices } from './act';

// JWST primary is 6.5 m; the aperture the lens replaces is ~90 km. Draw both
// to one scene scale: 1 scene unit = the JWST mirror, so the ring radius is
// (90 km / 6.5 m) / 2 ~ 6920 units. Camera pulls back to reveal it.
const JWST_M = facts.problem.jwstApertureM;
const APERTURE_KM = facts.problem.requiredApertureKm;
const RING_RADIUS = ((APERTURE_KM * 1000) / JWST_M) / 2;
const TOUR_DURATION_S = 60;
const JWST_IMG = `${import.meta.env.BASE_URL}assets/renders/jwst.jpg`;

export class Act0Problem implements Act {
  readonly id = 0;
  readonly title = 'THE PROBLEM';
  readonly question = 'Why can JWST not do this?';

  private readonly group = new Group();
  private readonly jwst = new Group();
  private readonly keyLight = new DirectionalLight(0xfff2e0, 1.3);
  private readonly fillLight = new HemisphereLight(0xbcd2ff, 0x161d29, 0.6);
  private readonly ring: Line;
  private readonly inset: HTMLElement;
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

    // 90 km aperture as a ghosted ring, concentric with the JWST mirror.
    const segments = 160;
    const pts = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts[i * 3] = Math.cos(a) * RING_RADIUS;
      pts[i * 3 + 1] = Math.sin(a) * RING_RADIUS;
      pts[i * 3 + 2] = 0;
    }
    const ringGeometry = new BufferGeometry();
    ringGeometry.setAttribute('position', new BufferAttribute(pts, 3));
    this.ring = new Line(
      ringGeometry,
      new LineBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.5 })
    );
    this.ring.frustumCulled = false;
    this.group.add(this.ring);

    this.anchors = [
      { text: `JWST ${JWST_M} m`, displayPos: vec3d(2.5, 1.5, 0), accent: false },
      { text: `APERTURE NEEDED ${APERTURE_KM} km`, displayPos: vec3d(0, RING_RADIUS * 1.02, 0), accent: true }
    ];

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
    this.s.scene.add(this.keyLight, this.fillLight);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    // Act 0 has its own JWST-scale frame; the shared Sun would sit on the
    // JWST at the shared origin. Hide it; the host star is an abstraction here.
    this.s.setSunVisible(false);
    this.s.setActHeading(`ACT 0 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.lastCaption = -1;
    this.endShown = false;
    (this.s.hud.el.parentElement ?? document.body).appendChild(this.inset);
    this.s.labels.setAnchors(this.anchors);
    this.s.loupe.show(JWST_IMG, 'JAMES WEBB SPACE TELESCOPE', '6.5 m mirror, actual NASA render');
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

  update(): void {
    if (this.mode === 'tour') {
      const p = this.progress();
      this.placeTourCamera(p);
      this.runCaptions(p);
      if (p >= 1 && !this.endShown) {
        this.endShown = true;
        this.s.timeline.pause();
      }
    }
    // Ring fades in as the camera pulls back to reveal its scale.
    const camDist = this.s.camera.position.length();
    (this.ring.material as LineBasicMaterial).opacity = Math.min(
      0.5,
      Math.max(0, (camDist - 6) / RING_RADIUS)
    );
    this.updateHud(camDist);
  }

  private placeTourCamera(p: number): void {
    // Hold on the JWST mirror, then pull back hard to reveal the whole 90 km
    // ring. Cubic easing keeps the craft readable through the first third;
    // the final distance frames the full ring inside the field of view.
    const dist = 3.2 + Math.pow(p, 3) * RING_RADIUS * 2.6;
    this.s.camera.position.set(Math.sin(p * 0.8) * dist * 0.06, dist * 0.05, dist);
    this.s.camera.lookAt(0, 0, 0);
  }

  private runCaptions(p: number): void {
    const beats = [
      { at: 0.02, text: `JWST sees exoplanets as unresolved points. Its mirror is ${JWST_M} metres across.` },
      { at: 0.4, text: `To resolve a planet's surface by aperture alone you would need a mirror about ${APERTURE_KM} km wide.` },
      { at: 0.75, text: 'The Sun already is that lens. You just have to travel to its focus.' }
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
    this.s.scene.remove(this.keyLight, this.fillLight);
    this.inset.remove();
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.loupe.hide();
  }
}
