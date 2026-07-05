import { describe, expect, it } from 'vitest';
import { R_SUN_M } from '../src/sim/constants';
import {
  deflectionRad,
  einsteinRingRad,
  focalDistanceM,
  impactParamForFocusM,
  solarAngularRadiusRad
} from '../src/sim/lensing';
import { auToM, mToAu, radToArcsec } from '../src/sim/units';
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
