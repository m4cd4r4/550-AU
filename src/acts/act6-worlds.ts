// Act 6 - Many Worlds. The real 3D stellar neighbourhood: each target star
// sits in its true sky direction (RA/Dec) at a compressed distance, with a
// focal line radiating directly anti-target from the Sun and a short pearl
// string along it. Every target has its own focal line; TRAPPIST-1 yields
// three imageable planets from one line. Data cards carry real parameters.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Line,
  LineBasicMaterial,
  BufferGeometry,
  BufferAttribute,
  OctahedronGeometry,
  SphereGeometry,
  Vector3
} from 'three';
import targetsData from '../data/targets.json';
import { equatorialToEclipticDir, eclipticToScene, focalLineDirScene } from '../render/frames';
import type { LabelAnchor } from '../render/focal-ruler';
import { vec3d, scale as scaleVec, type Vec3d } from '../sim/vec3d';
import type { Act, ActMode, ActServices } from './act';

interface TargetView {
  id: string;
  name: string;
  star: string;
  distanceLy: number;
  blurb: string;
  starPos: Vec3d; // compressed scene position
  focalDir: Vec3d; // unit, anti-target
  starMesh: Mesh;
  pearls: Mesh[];
  focalLine: Line;
}

const PRIMARY = new Set(['proxima-b', 'trappist-1', 'gj-273b']);
const FOCAL_LEN = 1.6; // exaggerated focal-line length in scene units
const PEARLS_PER_LINE = 5;
const TOUR_DURATION_S = 78;

// Compress light-years to a readable scene radius (log, so 4 ly and 40 ly
// both fit while keeping their order).
function sceneRadius(ly: number): number {
  return 2.6 * (1 + Math.log10(ly / 4.0));
}

export class Act6Worlds implements Act {
  readonly id = 6;
  readonly title = 'MANY WORLDS';
  readonly question = 'Why stop at one planet?';

  private readonly group = new Group();
  private readonly targets: TargetView[] = [];
  private readonly anchors: LabelAnchor[] = [];
  private mode: ActMode = 'tour';
  private focusIndex = -1;
  private lastFocus = -1;
  private readonly scratchV3 = new Vector3();
  private readonly onClickBound = (event: MouseEvent) => this.onClick(event);

  constructor(private readonly s: ActServices) {
    for (const t of targetsData.targets) {
      if (!PRIMARY.has(t.id)) continue;
      this.targets.push(this.buildTarget(t));
    }
  }

  private buildTarget(t: (typeof targetsData.targets)[number]): TargetView {
    const dir = eclipticToScene(equatorialToEclipticDir(t.raDeg, t.decDeg));
    const starPos = scaleVec(vec3d(), dir, sceneRadius(t.distanceLy));
    const focalDir = focalLineDirScene(t.raDeg, t.decDeg);

    const starMesh = new Mesh(
      new SphereGeometry(0.09, 16, 12),
      new MeshBasicMaterial({ color: 0xffd27a })
    );
    starMesh.position.set(starPos.x, starPos.y, starPos.z);
    this.group.add(starMesh);

    // Focal line from the Sun (origin) going anti-target.
    const end = scaleVec(vec3d(), focalDir, FOCAL_LEN);
    const focalLine = new Line(
      lineGeometry([0, 0, 0, end.x, end.y, end.z]),
      new LineBasicMaterial({ color: 0x3d4a5a, transparent: true, opacity: 0.6 })
    );
    focalLine.frustumCulled = false;
    this.group.add(focalLine);

    const pearls: Mesh[] = [];
    for (let i = 0; i < PEARLS_PER_LINE; i++) {
      const f = (i + 1) / (PEARLS_PER_LINE + 0.5);
      const pearl = new Mesh(
        new OctahedronGeometry(0.03),
        new MeshBasicMaterial({ color: 0xaab4c0 })
      );
      pearl.position.set(focalDir.x * FOCAL_LEN * f, focalDir.y * FOCAL_LEN * f, focalDir.z * FOCAL_LEN * f);
      pearls.push(pearl);
      this.group.add(pearl);
    }

    this.anchors.push({ text: t.name.toUpperCase(), displayPos: starPos, accent: false });
    return {
      id: t.id,
      name: t.name,
      star: t.star,
      distanceLy: t.distanceLy,
      blurb: t.blurb,
      starPos,
      focalDir,
      starMesh,
      pearls,
      focalLine
    };
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.group);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    this.s.setActHeading(`ACT 6 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.timeline.setWarp(1);
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.s.labels.setAnchors(this.anchors);
    this.focusIndex = -1;
    this.lastFocus = -1;
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.ribbon.setToggle(false, false);
    if (mode === 'explore') {
      this.s.timeline.pause();
      this.s.controls.target.set(0, 0, 0);
      this.s.camera.position.set(4, 3, 7);
      this.s.inspector.hide();
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
      // Cycle focus across the three targets, dwelling on each.
      const n = this.targets.length;
      this.focusIndex = Math.min(n - 1, Math.floor(p * n * 0.999));
      if (this.focusIndex !== this.lastFocus) {
        this.showCard(this.focusIndex);
        this.lastFocus = this.focusIndex;
      }
      this.placeTourCamera(p);
      this.highlightFocus();
    }
    this.spinPearls();
    this.updateHud();
  }

  private highlightFocus(): void {
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (!t) continue;
      const on = i === this.focusIndex;
      (t.focalLine.material as LineBasicMaterial).opacity = on ? 0.95 : 0.4;
      (t.focalLine.material as LineBasicMaterial).color.setHex(on ? 0xffb000 : 0x3d4a5a);
      for (const pearl of t.pearls) {
        (pearl.material as MeshBasicMaterial).color.setHex(on ? 0xffd24d : 0xaab4c0);
      }
    }
  }

  private spinPearls(): void {
    for (const t of this.targets) {
      for (const pearl of t.pearls) {
        const dist = this.scratchV3.copy(pearl.position).distanceTo(this.s.camera.position);
        pearl.scale.setScalar(Math.max(1, dist * 0.02));
      }
      const sd = this.scratchV3.copy(t.starMesh.position).distanceTo(this.s.camera.position);
      t.starMesh.scale.setScalar(Math.max(1, sd * 0.02));
    }
  }

  private placeTourCamera(p: number): void {
    const focus = this.targets[this.focusIndex];
    // Orbit the neighbourhood, drifting the look toward the focused target.
    const angle = 0.4 + p * 2.4;
    const dist = 8.5;
    this.s.camera.position.set(Math.sin(angle) * dist, 2.5 + Math.sin(p * 3) * 1.2, Math.cos(angle) * dist);
    if (focus) {
      this.s.camera.lookAt(focus.starPos.x * 0.4, focus.starPos.y * 0.4, focus.starPos.z * 0.4);
    } else {
      this.s.camera.lookAt(0, 0, 0);
    }
  }

  private showCard(index: number): void {
    const t = this.targets[index];
    if (!t) return;
    const raw = targetsData.targets.find((x) => x.id === t.id);
    const rows: [string, string][] = [
      ['STAR', t.star],
      ['DISTANCE', `${t.distanceLy} ly`],
      ['FOCAL LINE', 'directly opposite the target'],
      ['NOTE', t.blurb]
    ];
    if (t.id === 'trappist-1') {
      rows.splice(3, 0, ['IMAGEABLE', 'three rocky planets, one focal line']);
    }
    if (raw && 'modelledDiameterKm' in raw) {
      rows.push(['MODELLED DIAMETER', `${(raw as { modelledDiameterKm: number }).modelledDiameterKm.toLocaleString('en-GB')} km`]);
    }
    this.s.inspector.show(t.name.toUpperCase(), rows);
  }

  private updateHud(): void {
    const t = this.targets[this.focusIndex];
    const rows: [string, string][] = [
      ['NEIGHBOURHOOD', `${this.targets.length} target focal lines`],
      ['FOCUSED TARGET', t ? t.name : 'none'],
      ['DISTANCE', t ? `${t.distanceLy} ly` : '-'],
      ['FOCAL DIRECTION', 'anti-target, past the Sun'],
      ['STAR POSITIONS', 'real RA/Dec (HYG)'],
      ['DISTANCE SCALE', 'log-compressed for the frame']
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({
      mapLabel: 'REAL SKY, LOG DISTANCE',
      compression: 1,
      trueDistanceAU: 0
    });
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
        this.s.timeline.scrubTo(0);
        this.lastFocus = -1;
      }
      this.s.timeline.resume();
    } else {
      this.s.timeline.pause();
    }
  }

  onWarpCycle(): void {
    // No warp in Act 6.
  }

  onScrub(progress: number): void {
    this.s.timeline.scrubTo(progress * TOUR_DURATION_S);
  }

  onToggleTrueScale(): void {
    // The lesson is the directions; distance is declared log-compressed.
  }

  private onClick(event: MouseEvent): void {
    if (this.mode !== 'explore') return;
    const rect = this.s.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = 64; // stars are large glowing targets; be generous
    let picked = -1;
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (!t) continue;
      t.starMesh.getWorldPosition(this.scratchV3).project(this.s.camera);
      if (this.scratchV3.z > 1) continue;
      const sx = ((this.scratchV3.x + 1) / 2) * rect.width;
      const sy = ((1 - this.scratchV3.y) / 2) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < best) {
        best = d;
        picked = i;
      }
    }
    if (picked < 0) {
      this.s.inspector.hide();
      this.focusIndex = -1;
      this.highlightFocus();
      return;
    }
    this.focusIndex = picked;
    this.highlightFocus();
    this.showCard(picked);
  }

  exit(): void {
    this.s.scene.remove(this.group);
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.inspector.hide();
  }
}

function lineGeometry(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}
