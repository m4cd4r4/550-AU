// The pearl string renderable: one marker per launched pearl along the
// focal line, coloured by phase, drawn at a minimum angular size so the
// string reads at any zoom. Radii pass through the act's DistanceMap.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Vector3,
  type PerspectiveCamera
} from 'three';
import type { PearlState } from '../sim/pearls';
import { scale as scaleVec, vec3d, type Vec3d } from '../sim/vec3d';
import type { DistanceMap } from './distance-map';
import type { OriginFrame } from './floating-origin';
import type { LabelAnchor } from './focal-ruler';

const MAX_PEARLS = 40;
const MIN_ANGULAR = 0.0045; // marker never shrinks below this fraction of distance

const PHASE_COLOURS = {
  diving: 0xffb000,
  cruise: 0xaab4c0,
  operating: 0xffd24d
} as const;

export class PearlString {
  readonly group = new Group();
  private readonly markers: Mesh[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly displayPositions: Vec3d[] = [];
  private pearls: PearlState[] = [];
  private readonly scratch = new Vector3();

  constructor(private readonly dir: Vec3d) {
    const geometry = new OctahedronGeometry(1);
    for (let i = 0; i < MAX_PEARLS; i++) {
      const material = new MeshBasicMaterial({ color: PHASE_COLOURS.cruise });
      const marker = new Mesh(geometry, material);
      marker.visible = false;
      this.markers.push(marker);
      this.materials.push(material);
      this.displayPositions.push(vec3d());
      this.group.add(marker);
    }
  }

  setPearls(pearls: PearlState[], map: DistanceMap): void {
    this.pearls = pearls.slice(0, MAX_PEARLS);
    for (let i = 0; i < MAX_PEARLS; i++) {
      const marker = this.markers[i];
      const pearl = this.pearls[i];
      if (!marker) continue;
      if (!pearl) {
        marker.visible = false;
        continue;
      }
      marker.visible = true;
      const pos = this.displayPositions[i];
      if (pos) scaleVec(pos, this.dir, map.toDisplay(pearl.rAU));
      this.materials[i]?.color.setHex(PHASE_COLOURS[pearl.phase]);
    }
  }

  update(origin: OriginFrame, camera: PerspectiveCamera): void {
    for (let i = 0; i < this.pearls.length; i++) {
      const marker = this.markers[i];
      const pos = this.displayPositions[i];
      const pearl = this.pearls[i];
      if (!marker || !pos || !pearl || !marker.visible) continue;
      origin.toScene(pos, this.scratch);
      marker.position.copy(this.scratch);
      const distance = this.scratch.distanceTo(camera.position);
      const base = distance * MIN_ANGULAR;
      marker.scale.setScalar(pearl.phase === 'operating' ? base * 1.7 : base);
    }
  }

  // Label the lead pearl and every fifth launch.
  labelAnchors(): LabelAnchor[] {
    const anchors: LabelAnchor[] = [];
    for (let i = 0; i < this.pearls.length; i++) {
      const pearl = this.pearls[i];
      const pos = this.displayPositions[i];
      if (!pearl || !pos) continue;
      if (pearl.index !== 0 && pearl.index % 5 !== 0) continue;
      anchors.push({
        text: pearl.index === 0 ? 'PEARL 1 (LEAD)' : `PEARL ${pearl.index + 1}`,
        displayPos: pos, // mutated in place by setPearls each update
        accent: pearl.phase === 'operating'
      });
    }
    return anchors;
  }

  pearlCount(): number {
    return this.pearls.length;
  }

  pearlAt(i: number): PearlState | undefined {
    return this.pearls[i];
  }

  displayPosOf(i: number): Vec3d | undefined {
    return i < this.pearls.length ? this.displayPositions[i] : undefined;
  }

  markerOf(i: number): Mesh | undefined {
    return i < this.pearls.length ? this.markers[i] : undefined;
  }
}
