// Act 1 - Einstein's Lens. Schematic (labelled): parallel photon rays from
// the source graze the Sun at impact parameter b, kink toward the axis in
// the thin-lens approximation, and cross at the focal distance z(b). Rays
// from opposite limbs converge on the same point. As b grows the crossing
// moves outward, so the focal line draws itself. The bend is dramatised;
// the alpha(b) and z(b) numbers on the HUD are the true values.

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry
} from 'three';
import facts from '../data/mission-facts.json';
import { deflectionRad, focalDistanceM } from '../sim/lensing';
import { R_SUN_M } from '../sim/constants';
import { mToAu, radToArcsec } from '../sim/units';
import { vec3d } from '../sim/vec3d';
import type { LabelAnchor } from '../render/focal-ruler';
import type { Act, ActMode, ActServices } from './act';

// Impact parameters to trace, in solar radii (limb-grazing first).
const B_OVER_RSUN = [1.0, 1.08, 1.18, 1.3, 1.45, 1.62, 1.82];
const Y_PER_RSUN = 0.34; // scene height of a limb-grazing ray
const X_SOURCE = -4.2; // rays enter here
const X_END = 6.6; // and continue past the crossing to here
const XC0 = 1.9; // crossing x for a limb-grazing ray
const XC1 = 1.35; // crossing x gained per (z/z_min - 1)
const TOUR_DURATION_S = 82;

function crossingX(bOverRsun: number): number {
  const zRatio = bOverRsun * bOverRsun; // z = b^2 z(R_sun)
  return XC0 + XC1 * (zRatio - 1);
}

export class Act1Lens implements Act {
  readonly id = 1;
  readonly title = "EINSTEIN'S LENS";
  readonly question = 'How does gravity bend light?';

  private readonly group = new Group();
  private readonly rays: { line: Line; b: number }[] = [];
  private readonly focalLine: Line;
  private readonly focalPositions: Float32Array;
  private readonly marker: Mesh;
  private readonly axis: Line;
  private readonly anchors: LabelAnchor[];
  private mode: ActMode = 'tour';
  private revealed = 0;
  private lastCaptionIndex = -1;
  private endShown = false;

  constructor(private readonly s: ActServices) {
    this.axis = new Line(
      lineGeometry([X_SOURCE, 0, 0, X_END, 0, 0]),
      new LineBasicMaterial({ color: 0x2a3546, transparent: true, opacity: 0.7 })
    );
    this.axis.frustumCulled = false;
    this.group.add(this.axis);

    for (const bR of B_OVER_RSUN) {
      for (const sign of [1, -1]) {
        const line = new Line(
          rayGeometry(bR, sign),
          new LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 })
        );
        line.frustumCulled = false;
        line.visible = false;
        this.rays.push({ line, b: bR });
        this.group.add(line);
      }
    }

    this.focalPositions = new Float32Array(B_OVER_RSUN.length * 3);
    const focalGeometry = new BufferGeometry();
    focalGeometry.setAttribute('position', new BufferAttribute(this.focalPositions, 3));
    this.focalLine = new Line(
      focalGeometry,
      new LineBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.95 })
    );
    this.focalLine.frustumCulled = false;
    this.group.add(this.focalLine);

    this.marker = new Mesh(
      new SphereGeometry(0.05, 16, 12),
      new MeshBasicMaterial({ color: 0xffb000 })
    );
    this.marker.visible = false;
    this.group.add(this.marker);

    this.anchors = [
      { text: 'SOURCE LIGHT', displayPos: vec3d(X_SOURCE + 0.1, Y_PER_RSUN * 1.9, 0), accent: false },
      { text: 'SUN', displayPos: vec3d(0, -0.32, 0), accent: false },
      { text: 'FOCAL LINE', displayPos: vec3d(crossingX(1.0), 0.12, 0), accent: true }
    ];
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.group);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    this.s.setActHeading(`ACT 1 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.timeline.setWarp(1);
    this.revealed = 0;
    this.lastCaptionIndex = -1;
    this.endShown = false;
    this.s.labels.setAnchors(this.anchors);
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.ribbon.setToggle(false, false);
    this.s.inspector.hide();
    if (mode === 'explore') {
      this.revealAll();
      this.s.timeline.pause();
      this.s.controls.target.set(1.4, 0, 0);
      this.s.camera.position.set(1.2, 1.6, 4.6);
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
      // Reveal impact parameters in order; the focal line extends outward.
      const target = Math.round(p * B_OVER_RSUN.length);
      while (this.revealed < target) this.revealNext();
      this.runCaptions(p);
      this.placeTourCamera(p);
      if (p >= 1 && !this.endShown) {
        this.endShown = true;
        this.s.timeline.pause();
      }
    }
    this.updateMarker();
    this.updateHud();
  }

  private revealNext(): void {
    const idx = this.revealed;
    if (idx >= B_OVER_RSUN.length) return;
    const bR = B_OVER_RSUN[idx] ?? 1;
    for (const ray of this.rays) {
      if (Math.abs(ray.b - bR) < 1e-6) ray.line.visible = true;
    }
    const cx = crossingX(bR);
    this.focalPositions[idx * 3] = cx;
    this.focalPositions[idx * 3 + 1] = 0;
    this.focalPositions[idx * 3 + 2] = 0;
    this.revealed++;
    this.focalLine.geometry.getAttribute('position').needsUpdate = true;
    this.focalLine.geometry.setDrawRange(0, this.revealed);
    this.s.captions.show(this.captionForReveal(bR), 6);
  }

  private revealAll(): void {
    while (this.revealed < B_OVER_RSUN.length) this.revealNext();
  }

  private captionForReveal(bR: number): string {
    const b = bR * R_SUN_M;
    const zAU = mToAu(focalDistanceM(b));
    const alpha = radToArcsec(deflectionRad(b));
    if (bR === 1.0) {
      return `Light grazing the limb bends ${alpha.toFixed(2)} arcsec and focuses at ${zAU.toFixed(0)} AU.`;
    }
    return `A ray at ${bR.toFixed(2)} solar radii bends less and focuses farther, at ${zAU.toFixed(0)} AU.`;
  }

  private runCaptions(p: number): void {
    const beats = [
      { at: 0.02, text: 'Mass curves space. Light from a distant world bends as it passes the Sun.' },
      { at: 0.9, text: 'Every impact parameter has its own focus. Together they draw the focal line.' }
    ];
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      if (beat && this.lastCaptionIndex < i && p >= beat.at) {
        this.s.captions.show(beat.text, 7);
        this.lastCaptionIndex = i;
      }
    }
  }

  private placeTourCamera(p: number): void {
    // Ease from a limb close-up out to the full converging bundle.
    const dist = 3.4 + p * 3.6;
    const angle = 0.5 + p * 0.35;
    const height = 1.1 + p * 1.4;
    this.s.camera.position.set(
      1.2 + crossingX(1.6) * 0.3 * p + Math.sin(angle) * 0.4,
      height,
      dist
    );
    this.s.camera.lookAt(1.2 + p * 1.6, 0, 0);
  }

  private updateMarker(): void {
    if (this.revealed === 0) {
      this.marker.visible = false;
      return;
    }
    const bR = B_OVER_RSUN[this.revealed - 1] ?? 1;
    this.marker.visible = true;
    this.marker.position.set(crossingX(bR), 0, 0);
    const dist = this.marker.position.distanceTo(this.s.camera.position);
    this.marker.scale.setScalar(Math.max(1, dist * 0.02));
  }

  private updateHud(): void {
    const bR = B_OVER_RSUN[Math.max(0, this.revealed - 1)] ?? 1;
    const b = bR * R_SUN_M;
    const rows: [string, string][] = [
      ['DEFLECTION LAW', 'alpha = 4GM / c^2 b'],
      ['IMPACT PARAMETER', `${bR.toFixed(2)} solar radii`],
      ['DEFLECTION alpha', `${radToArcsec(deflectionRad(b)).toFixed(3)} arcsec`],
      ['LIMB DEFLECTION', `${facts.lens.deflectionAtLimbArcsec} arcsec`],
      ['FOCAL DISTANCE z(b)', `${mToAu(focalDistanceM(b)).toFixed(0)} AU`],
      ['MINIMUM FOCUS', `${facts.lens.minFocalDistanceAU} AU at the limb`],
      ['NOTE', 'bend dramatised, numbers real']
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({ mapLabel: 'SCHEMATIC', compression: 1, trueDistanceAU: mToAu(focalDistanceM(b)) });
    this.s.timeControls.set({
      paused: this.s.timeline.paused,
      warpLabel: '1X',
      progress: this.mode === 'tour' ? this.progress() : null
    });
  }

  onPlayPause(): void {
    if (this.mode !== 'tour') return;
    if (this.s.timeline.paused) {
      if (this.progress() >= 1) {
        this.reset();
      }
      this.s.timeline.resume();
    } else {
      this.s.timeline.pause();
    }
  }

  private reset(): void {
    this.s.timeline.scrubTo(0);
    this.revealed = 0;
    this.lastCaptionIndex = -1;
    this.endShown = false;
    for (const ray of this.rays) ray.line.visible = false;
    this.focalLine.geometry.setDrawRange(0, 0);
    this.s.captions.clear();
  }

  onWarpCycle(): void {
    // Act 1 has no time warp; the reveal is tied to tour progress.
  }

  onScrub(progress: number): void {
    this.s.timeline.scrubTo(progress * TOUR_DURATION_S);
    const target = Math.round(progress * B_OVER_RSUN.length);
    this.revealed = 0;
    for (const ray of this.rays) ray.line.visible = false;
    this.focalLine.geometry.setDrawRange(0, 0);
    while (this.revealed < target) {
      const idx = this.revealed;
      const bR = B_OVER_RSUN[idx] ?? 1;
      for (const ray of this.rays) if (Math.abs(ray.b - bR) < 1e-6) ray.line.visible = true;
      this.focalPositions[idx * 3] = crossingX(bR);
      this.revealed++;
    }
    this.focalLine.geometry.getAttribute('position').needsUpdate = true;
    this.focalLine.geometry.setDrawRange(0, this.revealed);
    this.lastCaptionIndex = 1;
    this.endShown = progress >= 1;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // No true-scale toggle here; the deflection is explicitly dramatised.
  }

  exit(): void {
    this.s.scene.remove(this.group);
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
  }
}

function lineGeometry(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}

// A photon path: straight from the source to the grazing point, a thin-lens
// kink at the Sun, straight through the axis crossing and out the far side.
function rayGeometry(bOverRsun: number, sign: number): BufferGeometry {
  const y = sign * Y_PER_RSUN * bOverRsun;
  const cx = crossingX(bOverRsun);
  // Direction after the kink continues to the mirror-image height past crossing.
  const slope = -y / cx; // from (0, y) to (cx, 0)
  const yEnd = y + slope * (X_END - 0);
  return lineGeometry([X_SOURCE, y, 0, 0, y, 0, cx, 0, 0, X_END, yEnd, 0]);
}
