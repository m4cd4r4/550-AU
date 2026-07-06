import { describe, expect, it } from 'vitest';
import { AU_M, G, M_SUN, YEAR_S } from '../src/sim/constants';
import {
  integrateSundiver,
  sailEquilibriumTempC,
  SUNDIVER_DEFAULTS,
  type TrajectorySample
} from '../src/sim/sundiver';
import facts from '../src/data/mission-facts.json';

// Shared across tests; integration is deterministic.
const traj = integrateSundiver();

describe('sundiver trajectory anchors', () => {
  it('reaches perihelion near 0.1 AU within the first few months', () => {
    expect(traj.perihelionAU).toBeGreaterThan(0.093);
    expect(traj.perihelionAU).toBeLessThan(0.107);
    expect(traj.perihelionS / YEAR_S).toBeGreaterThan(0.1);
    expect(traj.perihelionS / YEAR_S).toBeLessThan(0.35);
  });

  it('exits at 25-26 AU/yr (published figure; beta tuned to reproduce it)', () => {
    expect(traj.exitSpeedAUYr).toBeGreaterThan(25);
    expect(traj.exitSpeedAUYr).toBeLessThan(26.5);
  });

  it('reaches the 547.8 AU minimum focus around year 20 (19-22 yr)', () => {
    // The published "reaches 650 AU ~year 20" cannot coexist with a 25-26
    // AU/yr exit speed; ~20 yr matches the 547.8 AU minimum focus instead.
    // See the clarification note appended to docs/BUILD-PROMPT.md.
    const years = traj.timeToAU(facts.lens.minFocalDistanceAU) / YEAR_S;
    expect(years).toBeGreaterThan(19);
    expect(years).toBeLessThan(22);
  });

  it('reaches 650 AU in 23-27 yr, consistent with the exit speed', () => {
    const years = traj.timeToAU(facts.lens.usefulImagingStartAU) / YEAR_S;
    expect(years).toBeGreaterThan(23);
    expect(years).toBeLessThan(27);
  });

  it('passes Voyager 1 distance around year 7', () => {
    const years = traj.timeToAU(facts.voyager1.distanceAU) / YEAR_S;
    expect(years).toBeGreaterThan(5.5);
    expect(years).toBeLessThan(8);
  });

  it('thrusts only between perihelion and jettison at year 2', () => {
    for (const sample of traj.samples) {
      const thrusting = sample.thrustMS2 > 0;
      if (sample.tS < traj.perihelionS - 86400) expect(thrusting).toBe(false);
      if (sample.tS > traj.jettisonS + 86400) expect(thrusting).toBe(false);
      if (sample.phase === 'sailing') expect(thrusting).toBe(true);
    }
  });

  it('conserves orbital energy on the ballistic coast after jettison', () => {
    const mu = G * M_SUN;
    const coast = traj.samples.filter((s) => s.phase === 'coast');
    expect(coast.length).toBeGreaterThan(10);
    const energy = (s: TrajectorySample): number =>
      0.5 * s.speedMS * s.speedMS - mu / (s.rAU * AU_M);
    const first = energy(coast[0] as TrajectorySample);
    const last = energy(coast[coast.length - 1] as TrajectorySample);
    expect(Math.abs(last - first) / Math.abs(first)).toBeLessThan(1e-6);
  });

  it('interpolates states monotonically through the cruise', () => {
    const early = traj.at(3 * YEAR_S);
    const late = traj.at(10 * YEAR_S);
    expect(late.rAU).toBeGreaterThan(early.rAU);
    expect(early.rAU).toBeGreaterThan(traj.perihelionAU);
  });

  it('uses the tuned lightness number recorded in the facts table', () => {
    expect(SUNDIVER_DEFAULTS.beta).toBe(facts.sundiverModel.tunedLightnessBeta);
  });
});

describe('sail temperature estimate', () => {
  it('stays well under the rated limit at perihelion', () => {
    const tempC = sailEquilibriumTempC(traj.perihelionAU);
    expect(tempC).toBeGreaterThan(500);
    expect(tempC).toBeLessThan(facts.sundiver.sailSurvivalTempC);
  });

  it('falls with distance', () => {
    expect(sailEquilibriumTempC(1)).toBeLessThan(sailEquilibriumTempC(0.1));
  });
});
