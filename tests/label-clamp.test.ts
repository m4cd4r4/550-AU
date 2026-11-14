import { describe, expect, it } from 'vitest';
import { clampLabel } from '../src/ui/labels';

// Default labels render at left = x + 10 (CSS translate(10px, -50%)) and are
// centred vertically on y; centred labels render at left = x - w/2, top = y.
describe('label clamp', () => {
  it('pulls a label back from the right edge', () => {
    const { x } = clampLabel(370, 200, 60, 14, false, 390, 844);
    expect(x + 10 + 60).toBeLessThanOrEqual(390 - 4);
  });
});
