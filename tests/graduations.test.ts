// tdd-guard:allow - backfill for the Act 2 graduation fade, built and checked on screen first.
import { describe, expect, it } from 'vitest';
import { graduationOpacity } from '../src/render/ruler-graduations';

describe('Act 2 graduation fade', () => {
  it('is hidden well before the cursor reaches it', () => {
    expect(graduationOpacity(100, 20)).toBe(0);
  });

  it('is fully shown as the cursor passes it', () => {
    expect(graduationOpacity(100, 100)).toBe(1);
  });

  it('fades out well behind the cursor', () => {
    expect(graduationOpacity(1, 6)).toBe(0);
    expect(graduationOpacity(1, 4)).toBeGreaterThan(0);
    expect(graduationOpacity(1, 4)).toBeLessThan(1);
  });
});
