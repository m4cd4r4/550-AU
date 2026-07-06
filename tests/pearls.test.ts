import { describe, expect, it } from 'vitest';
import { YEAR_S } from '../src/sim/constants';
import { cruiseSpacingAU, pearlStringAt } from '../src/sim/pearls';
import { integrateSundiver } from '../src/sim/sundiver';
import facts from '../src/data/mission-facts.json';

const traj = integrateSundiver();

describe('string of pearls', () => {
  it('launches one pearl per year', () => {
    const pearls = pearlStringAt(30, traj);
    expect(pearls.length).toBe(31); // years 0 through 30 inclusive
    expect(pearls[0]?.launchYear).toBe(0);
    expect(pearls[30]?.launchYear).toBe(30);
  });

  it('orders older pearls farther out, monotonically', () => {
    const pearls = pearlStringAt(30, traj);
    for (let i = 1; i < pearls.length; i++) {
      expect(pearls[i - 1]!.rAU).toBeGreaterThan(pearls[i]!.rAU - 1e-9);
    }
  });

  it('spaces cruising pearls ~25 AU apart (published figure within 10%)', () => {
    const spacing = cruiseSpacingAU(traj);
    expect(Math.abs(spacing - facts.pearls.spacingAU) / facts.pearls.spacingAU).toBeLessThan(0.1);

    const pearls = pearlStringAt(20, traj).filter((p) => p.phase === 'cruise' && p.rAU > 60);
    expect(pearls.length).toBeGreaterThan(5);
    for (let i = 1; i < pearls.length; i++) {
      const gap = pearls[i - 1]!.rAU - pearls[i]!.rAU;
      expect(gap).toBeGreaterThan(23);
      expect(gap).toBeLessThan(28);
    }
  });

  it('marks the first pearl operating once past 650 AU', () => {
    const arrival = traj.timeToAU(facts.lens.usefulImagingStartAU) / YEAR_S;
    const before = pearlStringAt(arrival - 1, traj);
    const after = pearlStringAt(arrival + 1, traj);
    expect(before[0]?.phase).toBe('cruise');
    expect(after[0]?.phase).toBe('operating');
  });

  it('marks fresh launches as diving until perihelion', () => {
    const pearls = pearlStringAt(10.05, traj);
    const newest = pearls[pearls.length - 1]!;
    expect(newest.phase).toBe('diving');
    expect(newest.rAU).toBeLessThan(1.05);
  });
});
