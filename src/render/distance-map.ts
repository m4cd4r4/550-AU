// Honest-scale system: radial compression of heliocentric distance for
// display, always paired with the scale ribbon declaring the compression.

export interface DistanceMap {
  readonly id: 'compressed' | 'true';
  readonly label: string;
  toDisplay(rAU: number): number;
  fromDisplay(dAU: number): number;
  // Local compression factor at true distance r: how many true AU one
  // displayed AU represents there (1 means true scale).
  compressionAt(rAU: number): number;
}

// asinh mapping: true scale near the Sun (slope 1 at r = 0), logarithmic
// far out. d0 sets where compression begins to bite.
export function compressedMap(d0AU: number): DistanceMap {
  return {
    id: 'compressed',
    label: 'COMPRESSED',
    toDisplay: (r) => d0AU * Math.asinh(r / d0AU),
    fromDisplay: (d) => d0AU * Math.sinh(d / d0AU),
    compressionAt: (r) => Math.sqrt(1 + (r / d0AU) * (r / d0AU))
  };
}

export const trueMap: DistanceMap = {
  id: 'true',
  label: 'TRUE SCALE',
  toDisplay: (r) => r,
  fromDisplay: (d) => d,
  compressionAt: () => 1
};

// Apply a radial map to a heliocentric position (directions are preserved).
import { scale, type Vec3d } from '../sim/vec3d';

export function mapPosition(map: DistanceMap, worldAU: Vec3d, out: Vec3d): Vec3d {
  const r = Math.hypot(worldAU.x, worldAU.y, worldAU.z);
  if (r === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  return scale(out, worldAU, map.toDisplay(r) / r);
}
