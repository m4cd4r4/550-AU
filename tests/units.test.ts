import { describe, expect, it } from 'vitest';
import { AU_M } from '../src/sim/constants';
import {
  arcsecToRad,
  auPerYrToKms,
  kmsToAuPerYr,
  lightTimeS,
  radToArcsec
} from '../src/sim/units';
import { Timeline } from '../src/sim/timeline';

describe('unit conversions', () => {
  it('converts 125 km/s to about 26 AU/yr (sundiver exit speed)', () => {
    const auYr = kmsToAuPerYr(125);
    expect(auYr).toBeGreaterThan(26);
    expect(auYr).toBeLessThan(26.5);
    expect(auPerYrToKms(auYr)).toBeCloseTo(125, 6);
  });

  it('round-trips arcseconds and radians', () => {
    expect(radToArcsec(arcsecToRad(1.751))).toBeCloseTo(1.751, 9);
  });

  it('gives 499 s of light time for 1 AU', () => {
    expect(lightTimeS(AU_M)).toBeCloseTo(499.005, 1);
  });

  it('gives about 3.2 days of light time at 550 AU', () => {
    const days = lightTimeS(550 * AU_M) / 86400;
    expect(days).toBeGreaterThan(3.1);
    expect(days).toBeLessThan(3.3);
  });
});

describe('timeline', () => {
  it('advances by warp factor and pauses', () => {
    const tl = new Timeline();
    tl.setWarp(3600);
    tl.update(2);
    expect(tl.seconds).toBe(7200);
    tl.pause();
    tl.update(5);
    expect(tl.seconds).toBe(7200);
    tl.resume();
    tl.update(1);
    expect(tl.seconds).toBe(10800);
  });
});
