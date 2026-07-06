import { describe, expect, it } from 'vitest';
import { R_SUN_M } from '../src/sim/constants';
import {
  deflectionRad,
  einsteinRingRad,
  focalDistanceM,
  impactParamForFocusM,
  lensToSource,
  pointSourceImageRadiiRad,
  ringRadiusRad,
  solarAngularRadiusRad,
  type LensParams
} from '../src/sim/lensing';
import { arcsecToRad, auToM, mToAu, radToArcsec } from '../src/sim/units';
import facts from '../src/data/mission-facts.json';

function expectWithin(actual: number, expected: number, relTol: number): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(relTol);
}

describe('solar gravitational lens anchors', () => {
  it('deflects limb-grazing light by 1.751 arcsec', () => {
    expectWithin(radToArcsec(deflectionRad(R_SUN_M)), facts.lens.deflectionAtLimbArcsec, 0.01);
  });

  it('focuses limb-grazing light at 547.8 AU', () => {
    expectWithin(mToAu(focalDistanceM(R_SUN_M)), facts.lens.minFocalDistanceAU, 0.01);
  });

  it('shows a 1.61 arcsec Einstein ring from 650 AU', () => {
    const thetaE = radToArcsec(einsteinRingRad(auToM(650)));
    expectWithin(thetaE, facts.lens.einsteinRingAt650AUArcsec, 0.01);
  });

  it('shows a 1.48 arcsec solar disc from 650 AU, inside the ring', () => {
    const solar = radToArcsec(solarAngularRadiusRad(auToM(650)));
    expectWithin(solar, facts.lens.solarAngularRadiusAt650AUArcsec, 0.01);
    expect(solar).toBeLessThan(radToArcsec(einsteinRingRad(auToM(650))));
  });

  it('round-trips impact parameter and focal distance', () => {
    for (const b of [R_SUN_M, 1.1 * R_SUN_M, 2 * R_SUN_M]) {
      expectWithin(impactParamForFocusM(focalDistanceM(b)), b, 1e-9);
    }
  });

  it('focuses larger impact parameters farther out', () => {
    expect(focalDistanceM(1.5 * R_SUN_M)).toBeGreaterThan(focalDistanceM(R_SUN_M));
    expectWithin(focalDistanceM(2 * R_SUN_M), 4 * focalDistanceM(R_SUN_M), 1e-9);
  });
});

function paramsAt650(j2 = 0): LensParams {
  const zM = auToM(650);
  return {
    thetaE: einsteinRingRad(zM),
    thetaSun: solarAngularRadiusRad(zM),
    j2,
    poleAngle: 0
  };
}

// Count the disjoint azimuthal arcs lit by a point-ish source: an azimuth is
// lit when some image radius maps back to within srcRadius of the source.
function countImageArcs(p: LensParams, betaS: number, srcRadius: number): number {
  const azimuths = 1440;
  const lit: boolean[] = [];
  for (let i = 0; i < azimuths; i++) {
    const phi = (i / azimuths) * 2 * Math.PI;
    let best = Infinity;
    for (let s = 0; s <= 600; s++) {
      const r = (0.2 + (s / 600) * 2.8) * p.thetaE;
      const beta = lensToSource({ x: r * Math.cos(phi), y: r * Math.sin(phi) }, p);
      best = Math.min(best, Math.hypot(beta.x - betaS, beta.y));
    }
    lit.push(best < srcRadius);
  }
  if (lit.every(Boolean)) return 1; // unbroken ring
  let arcs = 0;
  for (let i = 0; i < azimuths; i++) {
    if (lit[i] && !lit[(i + azimuths - 1) % azimuths]) arcs++;
  }
  return arcs;
}

describe('thin-lens inverse mapping (slice 2 spike)', () => {
  it('ring radius matches theta_E within 1% at 650 AU (ship criterion)', () => {
    const p = paramsAt650();
    const ring = ringRadiusRad(0, p);
    expectWithin(ring, einsteinRingRad(auToM(650)), 0.01);
    expectWithin(radToArcsec(ring), facts.lens.einsteinRingAt650AUArcsec, 0.01);
  });

  it('maps the ring to the on-axis source at every azimuth (circular ring)', () => {
    const p = paramsAt650();
    for (let i = 0; i < 32; i++) {
      const phi = (i / 32) * 2 * Math.PI;
      const r = ringRadiusRad(phi, p);
      expectWithin(r, p.thetaE, 1e-6);
      const beta = lensToSource({ x: r * Math.cos(phi), y: r * Math.sin(phi) }, p);
      expect(Math.hypot(beta.x, beta.y)).toBeLessThan(1e-9 * p.thetaE);
    }
  });

  it('produces one full ring on-axis and two arcs off-axis', () => {
    const p = paramsAt650();
    const srcRadius = 0.01 * p.thetaE;
    expect(countImageArcs(p, 0, srcRadius)).toBe(1);
    expect(countImageArcs(p, 0.5 * p.thetaE, srcRadius)).toBe(2);
  });

  it('places the two off-axis point images at the quadratic roots', () => {
    const p = paramsAt650();
    const betaS = arcsecToRad(0.8);
    const [outer, inner] = pointSourceImageRadiiRad(betaS, p.thetaE);
    for (const theta of [outer, inner]) {
      const beta = lensToSource({ x: theta, y: 0 }, p);
      expectWithin(beta.x, betaS, 1e-9);
      expect(Math.abs(beta.y)).toBeLessThan(1e-12 * p.thetaE);
    }
  });

  it('J2 quadrupole modulates the ring radius with a cos 2phi pattern', () => {
    const p = paramsAt650(0.05);
    const rPole = ringRadiusRad(0, p);
    const rDiag = ringRadiusRad(Math.PI / 4, p);
    const rEquator = ringRadiusRad(Math.PI / 2, p);
    expect(rPole).toBeLessThan(rDiag);
    expect(rEquator).toBeGreaterThan(rDiag);
    const q = p.j2 * (p.thetaSun / p.thetaE) ** 2;
    expectWithin(rEquator - rPole, p.thetaE * q, 0.05);
  });

  it('J2 off reduces exactly to the monopole mapping', () => {
    const p0 = paramsAt650(0);
    const theta = { x: 1.3 * p0.thetaE, y: -0.4 * p0.thetaE };
    const beta = lensToSource(theta, p0);
    const r2 = theta.x ** 2 + theta.y ** 2;
    expectWithin(beta.x, theta.x * (1 - p0.thetaE ** 2 / r2), 1e-12);
    expectWithin(beta.y, theta.y * (1 - p0.thetaE ** 2 / r2), 1e-12);
  });
});
