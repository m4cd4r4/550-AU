// Solar gravitational lens: monopole deflection and focal geometry.
// Slice 1 covers the scalar relations; the vector inverse mapping and the
// J2 quadrupole term for the Act 5 shader land in slice 2.

import { FOUR_GM_OVER_C2, R_SUN_M } from './constants';

// Deflection angle for a light ray with impact parameter b (m): alpha = 4GM / (c^2 b)
export function deflectionRad(impactParamM: number): number {
  return FOUR_GM_OVER_C2 / impactParamM;
}

// Heliocentric focal distance for rays with impact parameter b (m):
// z(b) = b^2 c^2 / 4GM. Minimum focus is z(R_sun) = 547.8 AU.
export function focalDistanceM(impactParamM: number): number {
  return (impactParamM * impactParamM) / FOUR_GM_OVER_C2;
}

// Impact parameter whose rays focus at heliocentric distance z (m); inverse of focalDistanceM.
export function impactParamForFocusM(zM: number): number {
  return Math.sqrt(zM * FOUR_GM_OVER_C2);
}

// Einstein ring angular radius seen from heliocentric distance z (m):
// theta_E = sqrt(4GM / (c^2 z)). At 650 AU this is 1.61 arcsec.
export function einsteinRingRad(zM: number): number {
  return Math.sqrt(FOUR_GM_OVER_C2 / zM);
}

// Apparent angular radius of the solar photosphere from distance z (m).
export function solarAngularRadiusRad(zM: number): number {
  return R_SUN_M / zM;
}
