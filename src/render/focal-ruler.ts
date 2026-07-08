// Act 2's teaching instrument: the focal-line ruler from the Sun out past
// 650 AU, with planet orbits, the Kuiper belt, heliopause, Voyager 1 and
// the lens milestones. All radii pass through the act's DistanceMap; the
// scale ribbon declares the compression.

import {
  BufferGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  RingGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
  type PerspectiveCamera
} from 'three';
import { PLANETS, orbitPathAU, planetPositionAU } from '../sim/orbits';
import { vec3d, scale as scaleVec, copy, type Vec3d } from '../sim/vec3d';
import { mapPosition, type DistanceMap } from './distance-map';
import { eclipticToScene } from './frames';
import { planetMesh } from './planet-textures';
import type { OriginFrame } from './floating-origin';

export interface Milestone {
  label: string;
  au: number;
  auEnd?: number;
  kind: string;
}

export interface LabelAnchor {
  text: string;
  displayPos: Vec3d;
  accent: boolean;
  dy?: number; // vertical screen offset in px, to de-overlap crowded labels
}

export interface ClickTarget {
  object: Object3D;
  title: string;
  rows: [string, string][];
}

const GREY = 0x8b97a5;
const DIM = 0x3d4a5a;
const ACCENT = 0xffb000;

export class FocalRuler {
  readonly group = new Group();
  private readonly dynamic = new Group(); // rebuilt on map change
  private map: DistanceMap;
  private readonly milestones: Milestone[];
  private readonly rulerDir: Vec3d; // unit, scene axes
  private readonly markers: { mesh: Mesh; baseScale: number }[] = [];
  private readonly planetDots = new Map<string, Mesh>();
  private readonly anchors: LabelAnchor[] = [];
  private readonly clicks: ClickTarget[] = [];
  private readonly scratch = new Vector3();
  private readonly scratchVec = vec3d();
  private daysSinceJ2000 = 0;

  constructor(milestones: Milestone[], rulerDirScene: Vec3d, map: DistanceMap) {
    this.milestones = milestones;
    this.rulerDir = rulerDirScene;
    this.map = map;
    this.group.add(this.dynamic);
    this.rebuild();
  }

  setMap(map: DistanceMap): void {
    this.map = map;
    this.rebuild();
  }

  get currentMap(): DistanceMap {
    return this.map;
  }

  get direction(): Vec3d {
    return this.rulerDir;
  }

  labelAnchors(): LabelAnchor[] {
    return this.anchors;
  }

  clickTargets(): ClickTarget[] {
    return this.clicks;
  }

  rulerPointDisplay(au: number, out: Vec3d): Vec3d {
    return scaleVec(out, this.rulerDir, this.map.toDisplay(au));
  }

  private rebuild(): void {
    this.dynamic.clear();
    this.markers.length = 0;
    this.planetDots.clear();
    this.anchors.length = 0;
    this.clicks.length = 0;

    this.buildAxis();
    this.buildOrbits();
    this.buildKuiperAndHeliopause();
    this.buildMilestoneMarkers();
  }

  private buildAxis(): void {
    const dir = new Vector3(this.rulerDir.x, this.rulerDir.y, this.rulerDir.z);
    const end = dir.clone().multiplyScalar(this.map.toDisplay(1200));
    const axis = new Line(
      new BufferGeometry().setFromPoints([dir.clone().multiplyScalar(0.02), end]),
      new LineBasicMaterial({ color: DIM, transparent: true, opacity: 0.85 })
    );
    this.dynamic.add(axis);

    // Perpendicular ticks at every milestone distance
    const tickPoints: Vector3[] = [];
    const up = new Vector3(0, 1, 0);
    const side = new Vector3().crossVectors(dir, up).normalize();
    for (const m of this.milestones) {
      const at = dir.clone().multiplyScalar(this.map.toDisplay(m.au));
      const len = m.kind === 'lens' ? 0.14 : 0.07;
      tickPoints.push(at.clone().addScaledVector(side, -len), at.clone().addScaledVector(side, len));
    }
    const ticks = new LineSegments(
      new BufferGeometry().setFromPoints(tickPoints),
      new LineBasicMaterial({ color: GREY, transparent: true, opacity: 0.6 })
    );
    this.dynamic.add(ticks);
  }

  private buildOrbits(): void {
    const material = new LineBasicMaterial({ color: DIM, transparent: true, opacity: 0.5 });
    for (const planet of PLANETS) {
      const path = orbitPathAU(planet, 0, 96).map((p) => {
        eclipticToScene(p);
        mapPosition(this.map, p, p);
        return new Vector3(p.x, p.y, p.z);
      });
      this.dynamic.add(new LineLoop(new BufferGeometry().setFromPoints(path), material));

      const dot = planetMesh(planet.name);
      this.dynamic.add(dot);
      this.planetDots.set(planet.name, dot);
      this.markers.push({ mesh: dot, baseScale: 0.013 });
      this.anchors.push({ text: planet.name, displayPos: vec3d(), accent: false });
      this.clicks.push({ object: dot, title: planet.name, rows: [] });
    }
  }

  private buildKuiperAndHeliopause(): void {
    const kuiper = new Mesh(
      new RingGeometry(this.map.toDisplay(30), this.map.toDisplay(50), 96),
      new MeshBasicMaterial({
        color: 0x6f7f92,
        transparent: true,
        opacity: 0.055,
        side: DoubleSide,
        depthWrite: false
      })
    );
    kuiper.rotation.x = -Math.PI / 2;
    this.dynamic.add(kuiper);

    const heliopauseRadius = this.map.toDisplay(120);
    const circle: Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      circle.push(new Vector3(Math.cos(a) * heliopauseRadius, 0, Math.sin(a) * heliopauseRadius));
    }
    const heliopause = new Line(
      new BufferGeometry().setFromPoints(circle),
      new LineBasicMaterial({ color: 0x4c6a8a, transparent: true, opacity: 0.35 })
    );
    this.dynamic.add(heliopause);
  }

  private buildMilestoneMarkers(): void {
    const dir = new Vector3(this.rulerDir.x, this.rulerDir.y, this.rulerDir.z);
    let alternate = 0;
    for (const m of this.milestones) {
      if (m.kind === 'planet' || m.kind === 'band') continue;
      const accent = m.kind === 'lens';
      const mesh =
        m.kind === 'lens'
          ? new Mesh(
              new TorusGeometry(1, 0.09, 10, 40),
              new MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95 })
            )
          : new Mesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: GREY }));
      const at = dir.clone().multiplyScalar(this.map.toDisplay(m.au));
      mesh.position.copy(at);
      if (m.kind === 'lens') mesh.lookAt(at.clone().add(dir));
      this.dynamic.add(mesh);
      this.markers.push({ mesh, baseScale: accent ? 0.011 : 0.006 });
      this.anchors.push({
        text: m.label,
        displayPos: vec3d(at.x, at.y, at.z),
        accent,
        dy: alternate++ % 2 === 0 ? -16 : 12
      });
      this.clicks.push({ object: mesh, title: m.label, rows: [] });
    }
  }

  update(origin: OriginFrame, camera: PerspectiveCamera, daysSinceJ2000: number): void {
    this.daysSinceJ2000 = daysSinceJ2000;
    origin.toScene(vec3d(0, 0, 0), this.scratch);
    this.group.position.copy(this.scratch);

    // Live planet positions through the current map
    for (const planet of PLANETS) {
      const dot = this.planetDots.get(planet.name);
      if (!dot) continue;
      const p = planetPositionAU(planet, this.daysSinceJ2000);
      eclipticToScene(p);
      mapPosition(this.map, p, p);
      dot.position.set(p.x, p.y, p.z);
      const anchor = this.anchors.find((a) => a.text === planet.name);
      if (anchor) copy(anchor.displayPos, p);
    }

    // Constant screen-size markers
    for (const { mesh, baseScale } of this.markers) {
      this.scratch.copy(mesh.position).add(this.group.position);
      const distance = Math.max(1e-6, this.scratch.distanceTo(camera.position));
      mesh.scale.setScalar(distance * baseScale);
    }

    // Non-planet anchors follow the (possibly re-mapped) marker positions
    for (const m of this.milestones) {
      if (m.kind === 'planet' || m.kind === 'band') continue;
      const anchor = this.anchors.find((a) => a.text === m.label);
      if (anchor) {
        this.rulerPointDisplay(m.au, this.scratchVec);
        copy(anchor.displayPos, this.scratchVec);
      }
    }
  }
}
