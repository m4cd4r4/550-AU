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
  starDir: Vec3d; // unit, toward the target
  focalDir: Vec3d; // unit, anti-target
  starMesh: Mesh;
  starMaterial: MeshBasicMaterial;
  pearls: Mesh[];
  focalLine: Line;
  sightLine: Line; // star through the Sun: makes the collinearity explicit
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
  private readonly vDir = new Vector3();
  private readonly vPerp = new Vector3();
  private readonly vUp2 = new Vector3();
  private readonly vLook = new Vector3();
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

    const starMaterial = new MeshBasicMaterial({ color: 0xffd27a });
    const starMesh = new Mesh(new SphereGeometry(0.09, 16, 12), starMaterial);
    starMesh.position.set(starPos.x, starPos.y, starPos.z);
    this.group.add(starMesh);

    // Sight line from the star through the Sun (origin): the axis the focal
    // line continues. Drawn dim, brightened for the focused target so the
    // star, Sun and pearls visibly form one straight line.
    const sightLine = new Line(
      lineGeometry([starPos.x, starPos.y, starPos.z, 0, 0, 0]),
      new LineBasicMaterial({ color: 0x2b3442, transparent: true, opacity: 0.35 })
    );
    sightLine.frustumCulled = false;
    this.group.add(sightLine);

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
      starDir: dir,
      focalDir,
      starMesh,
      starMaterial,
      pearls,
      focalLine,
      sightLine
    };
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.group);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    this.s.setActHeading(`ACT 6 / ${this.title}`, this.question);
    this.s.timeline.reset();
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
      this.focusIndex = -1;
      this.lastFocus = -1;
      this.highlightFocus();
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
    const anyFocus = this.focusIndex >= 0;
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (!t) continue;
      const on = i === this.focusIndex;
      (t.focalLine.material as LineBasicMaterial).opacity = on ? 0.95 : 0.4;
      (t.focalLine.material as LineBasicMaterial).color.setHex(on ? 0xffb000 : 0x3d4a5a);
      const sight = t.sightLine.material as LineBasicMaterial;
      sight.opacity = on ? 0.75 : 0.16;
      sight.color.setHex(on ? 0xffb000 : 0x2b3442);
      t.starMaterial.color.setHex(on ? 0xfff0c4 : anyFocus ? 0x8f8360 : 0xffd27a);
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
    if (!focus) {
      this.s.camera.position.set(4, 3, 7);
      this.s.camera.lookAt(0, 0, 0);
      return;
    }
    // View the focused target's axis edge-on so the star, the Sun and the
    // focal-line pearls read as one straight line. The camera sits on a
    // plane perpendicular to the star direction and slowly swings within it.
    const n = this.targets.length;
    const q = Math.min(1, Math.max(0, p * n - this.focusIndex));
    const radius = Math.hypot(focus.starPos.x, focus.starPos.y, focus.starPos.z);

    this.vDir.set(focus.starDir.x, focus.starDir.y, focus.starDir.z).normalize();
    this.vPerp.crossVectors(this.vDir, this.s.camera.up);
    if (this.vPerp.lengthSq() < 1e-4) this.vPerp.set(1, 0, 0);
    this.vPerp.normalize();
    this.vUp2.crossVectors(this.vPerp, this.vDir).normalize();

    // Look at a point biased toward the star so the distant star stays framed.
    this.vLook.copy(this.vDir).multiplyScalar(radius * 0.28);
    const span = radius + FOCAL_LEN;
    const dist = span * 1.05 + 1.6;
    const swing = (q - 0.5) * 1.1; // slow rotation about the axis
    const rise = 0.22 + 0.12 * Math.sin(q * Math.PI);

    this.s.camera.position
      .copy(this.vLook)
      .addScaledVector(this.vPerp, Math.cos(swing) * dist)
      .addScaledVector(this.vUp2, Math.sin(swing) * dist * 0.35 + rise * dist);
    this.s.camera.lookAt(this.vLook);
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
      warpLabel: this.s.timeline.warpLabel,
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
    this.s.timeline.cycleWarp();
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
