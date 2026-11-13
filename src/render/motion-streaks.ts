// Speed streaks: short lines streaming past the subject, opposite to its
// direction of travel. The starfield is at infinity and cannot show motion,
// so long flights look static without a cue. This is a visual cue only (it
// is not dust or anything physical) and it is switched off entirely when the
// viewer asks for reduced motion.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Vector3
} from 'three';

const STREAK_COUNT = 70;
// Unit-box lengths per second at full strength.
const FLOW_RATE = 1.6;
const MAX_OPACITY = 0.38;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class MotionStreaks {
  readonly object: LineSegments;
  private readonly material: LineBasicMaterial;
  private readonly positions = new Float32Array(STREAK_COUNT * 6);
  private readonly seeds: Vector3[] = [];
  private readonly enabled = !prefersReducedMotion();
  private phase = 0;
  private readonly perp = new Vector3();

  constructor(colour = 0x9fb4cc) {
    // Deterministic scatter so the pattern is the same on every visit.
    let s = 20261113;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    for (let i = 0; i < STREAK_COUNT; i++) {
      this.seeds.push(new Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1));
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.material = new LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.object = new LineSegments(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  // centre: scene-space point the streaks surround. dir: unit direction of
  // travel in scene space. strength 0..1 sets speed, length and brightness.
  // extent: half-size of the streak volume in scene units.
  update(dtRealS: number, centre: Vector3, dir: Vector3, strength: number, extent: number): void {
    const k = Math.min(1, Math.max(0, strength));
    if (!this.enabled || k < 0.02) {
      this.object.visible = false;
      return;
    }
    this.object.visible = true;
    this.material.opacity = MAX_OPACITY * k;
    this.phase += dtRealS * FLOW_RATE * k;
    const length = extent * 0.1 * k;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const seed = this.seeds[i];
      if (!seed) continue;
      const along = seed.dot(dir);
      // Slide backwards along the travel direction, wrapping inside the box.
      const wrapped = ((((along - this.phase) % 2) + 2) % 2) - 1;
      this.perp.copy(seed).addScaledVector(dir, -along).addScaledVector(dir, wrapped);
      const x = centre.x + this.perp.x * extent;
      const y = centre.y + this.perp.y * extent;
      const z = centre.z + this.perp.z * extent;
      const o = i * 6;
      this.positions[o] = x;
      this.positions[o + 1] = y;
      this.positions[o + 2] = z;
      this.positions[o + 3] = x - dir.x * length;
      this.positions[o + 4] = y - dir.y * length;
      this.positions[o + 5] = z - dir.z * length;
    }
    this.object.geometry.getAttribute('position').needsUpdate = true;
  }
}
