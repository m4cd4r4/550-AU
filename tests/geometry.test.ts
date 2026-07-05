import { describe, expect, it } from 'vitest';
import { LY_M } from '../src/sim/constants';
import { imageCylinderDiameterM, imagePixelPitchM } from '../src/sim/geometry';
import { auToM } from '../src/sim/units';
import facts from '../src/data/mission-facts.json';
import targetsData from '../src/data/targets.json';

function expectWithin(actual: number, expected: number, relTol: number): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(relTol);
}

const proxima = targetsData.targets.find((t) => t.id === 'proxima-b');
if (!proxima || proxima.modelledDiameterKm === undefined) {
  throw new Error('proxima-b with modelled diameter missing from targets.json');
}
const planetDiameterM = proxima.modelledDiameterKm * 1000;
const sourceDistanceM = proxima.distanceLy * LY_M;

describe('image cylinder anchors (Proxima b)', () => {
  it('is 32 km across at 650 AU', () => {
    const d = imageCylinderDiameterM(auToM(650), planetDiameterM, sourceDistanceM);
    expectWithin(d / 1000, facts.imageCylinder.proximaBDiameterAt650AUKm, 0.05);
  });

  it('is 57 km across at 1200 AU', () => {
    const d = imageCylinderDiameterM(auToM(1200), planetDiameterM, sourceDistanceM);
    expectWithin(d / 1000, facts.imageCylinder.proximaBDiameterAt1200AUKm, 0.05);
  });

  it('grows linearly with heliocentric distance', () => {
    const d650 = imageCylinderDiameterM(auToM(650), planetDiameterM, sourceDistanceM);
    const d1300 = imageCylinderDiameterM(auToM(1300), planetDiameterM, sourceDistanceM);
    expectWithin(d1300, 2 * d650, 1e-9);
  });

  it('maps one final-image pixel to about 31 m of cylinder at 650 AU', () => {
    const pitch = imagePixelPitchM(
      auToM(650),
      planetDiameterM,
      sourceDistanceM,
      facts.imageCylinder.finalMapPixels
    );
    expectWithin(pitch, facts.lens.imagePixelPitchAt650AUM, 0.05);
  });
});
