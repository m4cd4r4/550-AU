// Minimal double-precision vector for world-space positions (AU).
// Three.js Vector3 is float-safe only after conversion to camera-relative
// scene coordinates; all world math stays in these plain doubles.

export interface Vec3d {
  x: number;
  y: number;
  z: number;
}

export function vec3d(x = 0, y = 0, z = 0): Vec3d {
  return { x, y, z };
}

export function set(out: Vec3d, x: number, y: number, z: number): Vec3d {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copy(out: Vec3d, a: Vec3d): Vec3d {
  return set(out, a.x, a.y, a.z);
}

export function add(out: Vec3d, a: Vec3d, b: Vec3d): Vec3d {
  return set(out, a.x + b.x, a.y + b.y, a.z + b.z);
}

export function sub(out: Vec3d, a: Vec3d, b: Vec3d): Vec3d {
  return set(out, a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scale(out: Vec3d, a: Vec3d, s: number): Vec3d {
  return set(out, a.x * s, a.y * s, a.z * s);
}

export function length(a: Vec3d): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function distance(a: Vec3d, b: Vec3d): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function lerp(out: Vec3d, a: Vec3d, b: Vec3d, t: number): Vec3d {
  return set(out, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

export function normalize(out: Vec3d, a: Vec3d): Vec3d {
  const l = length(a);
  return l === 0 ? set(out, 0, 0, 0) : scale(out, a, 1 / l);
}
