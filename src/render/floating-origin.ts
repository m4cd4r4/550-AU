// Camera-relative rendering: world math stays in double-precision display
// coordinates (AU); only small origin-relative float coordinates reach the
// scene graph. Acts move the origin to their point of interest each frame.

import type { Vector3 } from 'three';
import { copy, vec3d, type Vec3d } from '../sim/vec3d';

export class OriginFrame {
  readonly originDisplayAU: Vec3d = vec3d();

  setOrigin(displayAU: Vec3d): void {
    copy(this.originDisplayAU, displayAU);
  }

  // Convert a display-space position (AU, double) to origin-relative scene
  // units (1 unit = 1 display AU). The subtraction happens in doubles.
  toScene(displayAU: Vec3d, out: Vector3): Vector3 {
    out.set(
      displayAU.x - this.originDisplayAU.x,
      displayAU.y - this.originDisplayAU.y,
      displayAU.z - this.originDisplayAU.z
    );
    return out;
  }
}
