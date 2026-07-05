import { describe, expect, it } from 'vitest';
import { PLANETS, planetPositionAU, solveEccentricAnomaly } from '../src/sim/orbits';
import { length } from '../src/sim/vec3d';

function planet(name: string) {
  const p = PLANETS.find((pl) => pl.name === name);
  if (!p) throw new Error(`no elements for ${name}`);
  return p;
}

describe('Kepler propagation', () => {
  it('solves the Kepler equation', () => {
    for (const e of [0, 0.2, 0.6, 0.9]) {
      for (const m of [-2.5, -0.3, 0, 1.1, 3.0]) {
        const eAnom = solveEccentricAnomaly(m, e);
        expect(eAnom - e * Math.sin(eAnom)).toBeCloseTo(m, 9);
      }
    }
  });

  it('keeps Earth near 1 AU across a full orbit', () => {
    for (let day = 0; day < 366; day += 30) {
      const r = length(planetPositionAU(planet('Earth'), day));
      expect(r).toBeGreaterThan(0.97);
      expect(r).toBeLessThan(1.03);
    }
  });

  it('returns Earth to the same place after one year', () => {
    const a = planetPositionAU(planet('Earth'), 0);
    const b = planetPositionAU(planet('Earth'), 365.25);
    const separation = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(separation).toBeLessThan(0.05);
  });

  it('keeps Neptune near 30 AU', () => {
    const r = length(planetPositionAU(planet('Neptune'), 9500));
    expect(r).toBeGreaterThan(29.5);
    expect(r).toBeLessThan(30.5);
  });

  it('keeps Mercury between perihelion and aphelion', () => {
    for (let day = 0; day < 88; day += 7) {
      const r = length(planetPositionAU(planet('Mercury'), day));
      expect(r).toBeGreaterThan(0.30);
      expect(r).toBeLessThan(0.47);
    }
  });
});
