// Act 5 tour script: beat timeline, captions, and the ring-view zoom and
// off-axis curves. The controller reads beat state each frame; this module
// is pure data so the choreography is auditable in one place.

import facts from '../data/mission-facts.json';

export const TOUR_DURATION_S = 110;

export type Act5View = 'ring' | 'cylinder';

export interface Act5Beat {
  start: number;
  end: number;
  view: Act5View;
}

// A: first-person ring. B: cylinder reveal. C: raster dance.
// D: off-axis arcs. E: end card.
export const BEATS: Act5Beat[] = [
  { start: 0, end: 26, view: 'ring' },
  { start: 26, end: 42, view: 'cylinder' },
  { start: 42, end: 78, view: 'cylinder' },
  { start: 78, end: 96, view: 'ring' },
  { start: 96, end: TOUR_DURATION_S, view: 'cylinder' }
];

export function beatAt(tS: number): Act5Beat {
  for (const beat of BEATS) {
    if (tS < beat.end) return beat;
  }
  return BEATS[BEATS.length - 1] as Act5Beat;
}

// Ring-view field of view (arcsec, vertical): starts wide, eases into the
// ring, holds tight through the off-axis beat.
export function ringFovArcsec(tS: number): number {
  if (tS <= 26) {
    const f = Math.min(1, tS / 20);
    const e = f * f * (3 - 2 * f);
    return 26 - e * 19; // 26 -> 7
  }
  return 7;
}

// Source off-axis offset (arcsec) for the arc-degradation beat: on-axis
// until D, then easing outward as the telescopes work off the centreline.
// Held small enough that the counter-arc stays clear of the occulter (past
// ~0.1 arcsec at 650 AU it is honestly hidden) and inside the exaggerated
// J2 caustic so the four-arc breakup shows.
export function sourceOffsetArcsec(tS: number): number {
  if (tS < 78) return 0;
  const f = Math.min(1, (tS - 78) / 12);
  return f * f * (3 - 2 * f) * 0.085;
}

export function j2On(tS: number): boolean {
  return tS >= 86;
}

// Scan progress: the dance runs through C, keeps accumulating during D
// (the telescopes do not stop for the camera), completes through E.
export function scanFraction(tS: number): number {
  if (tS < 42) return 0;
  if (tS < 78) return ((tS - 42) / 36) * 0.55;
  if (tS < 96) return 0.55 + ((tS - 78) / 18) * 0.25;
  return Math.min(1, 0.8 + ((tS - 96) / 10) * 0.2);
}

export const SUBTRACTION_AT_S = 60;

// True figures for the clock: a full pass is ~4.3 months (1e6 cells at the
// mean dwell across four telescopes); displayed months follow the scan.
export function scanMonths(fraction: number): number {
  const cells = facts.imageCylinder.finalMapPixels ** 2;
  const meanDwellS = (facts.pearls.dwellSecondsMin + facts.pearls.dwellSecondsMax) / 2;
  const passSeconds = (cells * meanDwellS) / facts.pearls.imagingTelescopes;
  return (fraction * passSeconds) / (30.44 * 86400);
}

export interface TimedCaption {
  tS: number;
  text: string;
}

export function buildCaptions(): TimedCaption[] {
  const lens = facts.lens;
  const cyl = facts.imageCylinder;
  const p = facts.pearls;
  return [
    {
      tS: 2,
      text: `650 AU out, a ${p.telescopeApertureM} metre telescope stares back at the Sun. The occulter blocks the glare.`
    },
    {
      tS: 11,
      text: `The Einstein ring: the planet's light bent around the Sun, amplified a hundred billion times.`
    },
    {
      tS: 19,
      text: `The ring sits ${lens.einsteinRingAt650AUArcsec} arcsec out, hugging the ${lens.solarAngularRadiusAt650AUArcsec} arcsec limb. Zoom is doing the work here.`
    },
    {
      tS: 27,
      text: `Pull back. The lens projects the planet onto a cylinder ${cyl.proximaBDiameterAt650AUKm} km across.`
    },
    {
      tS: 36,
      text: `Every cell of that cross-section is one pixel of the final image: ${lens.imagePixelPitchAt650AUM} metres per pixel.`
    },
    {
      tS: 44,
      text: `Four telescopes step cell to cell: hold position to ${p.positionToleranceM} metre, stare ${p.dwellSecondsMin} to ${p.dwellSecondsMax} seconds, move on.`
    },
    {
      tS: 54,
      text: `A fifth telescope waits outside the cylinder, staring at bare corona.`
    },
    {
      tS: SUBTRACTION_AT_S + 1,
      text: `Subtract its view, and the planet's light stands clear of the glare.`
    },
    {
      tS: 70,
      text: `The grid is drawn coarse here. The true raster is ${cyl.finalMapPixels} by ${cyl.finalMapPixels} cells.`
    },
    {
      tS: 80,
      text: `A fraction of an arcsecond off-axis, the ring tears into two arcs. Farther out, one hides behind the occulter.`
    },
    {
      tS: 88,
      text: `Solar oblateness warps the caustic too, exaggerated here to make it visible.`
    },
    {
      tS: 98,
      text: `Months of scanning, planet rotation and repeat visits average the clouds and build the map.`
    }
  ];
}

export const END_CAPTION = `Proxima b at ${facts.imageCylinder.finalMapResolutionKmPerPx} km per pixel. Speculative, until someone builds it.`;
