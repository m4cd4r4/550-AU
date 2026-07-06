// The sundiver's path, drawn in display space through the act's distance
// map. Two overlaid lines: the full route dim, the travelled portion in
// accent, split by draw range at the current sample index.

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Vector3
} from 'three';
import type { TrajectorySample } from '../sim/sundiver';
import { vec3d, type Vec3d } from '../sim/vec3d';
import { mapPosition, type DistanceMap } from './distance-map';
import { eclipticToScene } from './frames';
import type { OriginFrame } from './floating-origin';

const MAX_POINTS = 900;

export class TrajectoryTrail {
  readonly group = new Group();
  private readonly displayPoints: Vec3d[] = [];
  private readonly sampleTimes: number[] = [];
  private readonly fullLine: Line;
  private readonly travelled: Line;
  private readonly fullPositions: Float32Array;
  private readonly travelledPositions: Float32Array;
  private readonly scratch = new Vector3();

  constructor(samples: TrajectorySample[], map: DistanceMap) {
    const stride = Math.max(1, Math.ceil(samples.length / MAX_POINTS));
    for (let i = 0; i < samples.length; i += stride) {
      const s = samples[i];
      if (!s) continue;
      const world = eclipticToScene(vec3d(s.xAU, s.yAU, 0));
      this.displayPoints.push(mapPosition(map, world, vec3d()));
      this.sampleTimes.push(s.tS);
    }

    const n = this.displayPoints.length;
    this.fullPositions = new Float32Array(n * 3);
    this.travelledPositions = new Float32Array(n * 3);

    const fullGeometry = new BufferGeometry();
    fullGeometry.setAttribute('position', new BufferAttribute(this.fullPositions, 3));
    this.fullLine = new Line(
      fullGeometry,
      new LineBasicMaterial({ color: 0x3d4a5a, transparent: true, opacity: 0.9 })
    );
    this.fullLine.frustumCulled = false;

    const travelledGeometry = new BufferGeometry();
    travelledGeometry.setAttribute('position', new BufferAttribute(this.travelledPositions, 3));
    this.travelled = new Line(
      travelledGeometry,
      new LineBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.85 })
    );
    this.travelled.frustumCulled = false;

    this.group.add(this.fullLine, this.travelled);
  }

  update(origin: OriginFrame, currentTS: number): void {
    for (let i = 0; i < this.displayPoints.length; i++) {
      const p = this.displayPoints[i];
      if (!p) continue;
      origin.toScene(p, this.scratch);
      this.fullPositions[i * 3] = this.scratch.x;
      this.fullPositions[i * 3 + 1] = this.scratch.y;
      this.fullPositions[i * 3 + 2] = this.scratch.z;
      this.travelledPositions[i * 3] = this.scratch.x;
      this.travelledPositions[i * 3 + 1] = this.scratch.y;
      this.travelledPositions[i * 3 + 2] = this.scratch.z;
    }
    let travelledCount = this.sampleTimes.length;
    for (let i = 0; i < this.sampleTimes.length; i++) {
      const t = this.sampleTimes[i];
      if (t !== undefined && t > currentTS) {
        travelledCount = i;
        break;
      }
    }
    this.fullLine.geometry.getAttribute('position').needsUpdate = true;
    this.travelled.geometry.getAttribute('position').needsUpdate = true;
    this.travelled.geometry.setDrawRange(0, Math.max(2, travelledCount));
  }
}
