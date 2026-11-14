import { describe, expect, it } from 'vitest';
import { innerPlanetLabelOpacity } from '../src/render/focal-ruler';

describe('Act 2 inner-planet label fade', () => {
  it('hides Mercury, Venus and Earth once the view is well past 50 AU', () => {
    for (const name of ['Mercury', 'Venus', 'Earth']) expect(innerPlanetLabelOpacity(name, 80)).toBe(0);
  });
});
