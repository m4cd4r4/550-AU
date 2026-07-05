// Reference-frame conversions. World frame: heliocentric ecliptic J2000
// (x toward vernal equinox, z toward north ecliptic pole). Scene frame:
// three.js y-up, mapped as (x, y, z)_ecliptic -> (x, z, -y)_scene.

import { degToRad } from '../sim/units';
import { vec3d, type Vec3d } from '../sim/vec3d';

const OBLIQUITY_RAD = degToRad(23.43928);
const COS_E = Math.cos(OBLIQUITY_RAD);
const SIN_E = Math.sin(OBLIQUITY_RAD);

// Unit direction in the ecliptic frame for equatorial RA/Dec (degrees).
export function equatorialToEclipticDir(raDeg: number, decDeg: number): Vec3d {
  const ra = degToRad(raDeg);
  const dec = degToRad(decDeg);
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return vec3d(x, y * COS_E + z * SIN_E, -y * SIN_E + z * COS_E);
}

// Ecliptic position (AU or unit direction) to scene axes, in place.
export function eclipticToScene(v: Vec3d): Vec3d {
  const y = v.y;
  v.y = v.z;
  v.z = -y;
  return v;
}
