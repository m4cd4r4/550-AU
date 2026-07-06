// Solar gravitational lens: monopole deflection, focal geometry, and the
// vector thin-lens inverse mapping (monopole + J2 quadrupole) that the Act 5
// fragment shader transcribes into GLSL. This module is the tested reference.

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

// Parameters of the thin-lens mapping, all angles in radians.
export interface LensParams {
  thetaE: number; // Einstein ring angular radius at the observer's z
  thetaSun: number; // solar photosphere angular radius (sets the quadrupole scale)
  j2: number; // effective quadrupole strength; 0 disables (true solar J2 is SUN_J2)
  poleAngle: number; // position angle of the solar rotation axis in the image plane
}

export interface Angle2 {
  x: number;
  y: number;
}

// Inverse thin-lens mapping: image-plane angle theta -> source-plane angle beta.
// Monopole: beta = theta - thetaE^2 * theta / |theta|^2.
// Quadrupole: from the lens potential
//   psi = thetaE^2 [ ln r + (j2/2) (thetaSun/r)^2 cos 2(phi - poleAngle) ],
// whose gradient adds, with q(r) = j2 (thetaSun/r)^2 and d = phi - poleAngle,
//   alpha_r = (thetaE^2/r)(1 - q cos 2d),  alpha_t = -(thetaE^2/r) q sin 2d.
// On-axis this keeps the ring circular for j2 = 0 and breaks it into the
// four-cusp astroid caustic structure when j2 > 0 and the source moves off-axis.
export function lensToSource(theta: Angle2, p: LensParams): Angle2 {
  const r2 = theta.x * theta.x + theta.y * theta.y;
  if (r2 === 0) return { x: 0, y: 0 };
  const r = Math.sqrt(r2);
  const ex = theta.x / r;
  const ey = theta.y / r;
  const q = (p.j2 * p.thetaSun * p.thetaSun) / r2;
  const twoD = 2 * (Math.atan2(theta.y, theta.x) - p.poleAngle);
  const alphaR = ((p.thetaE * p.thetaE) / r) * (1 - q * Math.cos(twoD));
  const alphaT = -((p.thetaE * p.thetaE) / r) * q * Math.sin(twoD);
  // alpha = alphaR * e_r + alphaT * e_t with e_r = (ex, ey), e_t = (-ey, ex)
  return {
    x: theta.x - (alphaR * ex - alphaT * ey),
    y: theta.y - (alphaR * ey + alphaT * ex)
  };
}

// Ring radius at image-plane azimuth phi for an on-axis source: the root of
// the radial lens equation f(r) = r - alpha_r(r, phi). Bisection; f is
// monotonic in r over the bracket.
export function ringRadiusRad(phi: number, p: LensParams): number {
  const twoD = 2 * (phi - p.poleAngle);
  const f = (r: number): number => {
    const q = (p.j2 * p.thetaSun * p.thetaSun) / (r * r);
    return r - ((p.thetaE * p.thetaE) / r) * (1 - q * Math.cos(twoD));
  };
  let lo = 0.2 * p.thetaE;
  let hi = 3 * p.thetaE;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Image radii of a point source offset betaS from the axis (monopole only):
// theta^2 - betaS theta - thetaE^2 = 0, one image each side of the ring.
export function pointSourceImageRadiiRad(betaS: number, thetaE: number): [number, number] {
  const disc = Math.sqrt(betaS * betaS + 4 * thetaE * thetaE);
  return [(betaS + disc) / 2, (betaS - disc) / 2];
}
