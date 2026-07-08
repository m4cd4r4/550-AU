// Act 4 tour script: tour progress to mission years, plus captions keyed
// to mission years. The programme clock runs three decades so the string
// forms, the first pearl turns operational and the relay comes alive.

import facts from '../data/mission-facts.json';
import type { SundiverTrajectory } from '../sim/sundiver';
import { YEAR_S } from '../sim/constants';

export const TOUR_DURATION_S = 95;
export const TOUR_END_YEARS = 30;

// [progress, mission years]: slow through the first launches, quick through
// the accumulation, slow again as the lead pearl reaches the focus.
const WAYPOINTS: [number, number][] = [
  [0, 0],
  [0.14, 2.5],
  [0.3, 8],
  [0.52, 18],
  [0.68, 25],
  [0.8, 27],
  [1, TOUR_END_YEARS]
];

export function tourYears(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const next = WAYPOINTS[i];
    const prev = WAYPOINTS[i - 1];
    if (!next || !prev || p > next[0]) continue;
    const f = (p - prev[0]) / (next[0] - prev[0]);
    const e = f * f * (3 - 2 * f);
    return prev[1] + e * (next[1] - prev[1]);
  }
  return TOUR_END_YEARS;
}

export interface YearCaption {
  years: number;
  text: string;
}

export function buildCaptions(traj: SundiverTrajectory): YearCaption[] {
  const p = facts.pearls;
  const spacing = Math.round(traj.exitSpeedAUYr / p.launchesPerYear);
  const operatingYears = traj.timeToAU(facts.lens.usefulImagingStartAU) / YEAR_S;
  return [
    {
      years: 0.4,
      text: `One launch every year, each down the same dive and out along the same focal line.`
    },
    {
      years: 3,
      text: `Each pearl follows its siblings out at ${Math.round(traj.exitSpeedAUYr)} AU per year.`
    },
    {
      years: 8,
      text: `The cadence spaces them ${spacing} AU apart: a Sun-to-Neptune gap between neighbours.`
    },
    {
      years: 14,
      text: `Each launch carries ${p.cubesatsPerLaunch} CubeSats. In flight they self-assemble into a ${p.telescopeApertureM} metre telescope.`
    },
    {
      years: 20,
      text: `The formation is flown heritage: NASA's MMS kept four spacecraft in a string of pearls ${p.mmsFormationSeparationKmMin} to ${p.mmsFormationSeparationKmMax} km apart.`
    },
    {
      years: operatingYears + 0.3,
      text: `${facts.lens.usefulImagingStartAU} AU. The lead pearl starts imaging: ${p.imagingTelescopes} telescopes on the ring, ${p.coronaReferenceTelescopes} measuring bare corona.`
    },
    {
      years: operatingYears + 2.2,
      text: `Images hop home pearl to pearl: ${p.downlinkTransmitHours} hours of laser transmit, then ${p.lightTimeOneWayDaysAt550AU} days at light speed.`
    }
  ];
}

export const END_CAPTION = 'Every year, another pearl. The chain is fleet, relay and redundancy in one.';

export interface LoupeLabel {
  title: string;
  sub: string;
}

// Which Voyager the lead pearl is currently overtaking, if any, for the loupe.
export function voyagerLoupeAt(leadAU: number): LoupeLabel | null {
  const v1 = facts.voyager1.distanceAU;
  const v2 = facts.voyager2.distanceAU;
  if (leadAU < v2 - 10 || leadAU > v1 + 80) return null;
  const atV1 = leadAU >= (v1 + v2) / 2;
  return {
    title: atV1 ? 'VOYAGER 1' : 'VOYAGER 2',
    sub: `${atV1 ? v1 : v2} AU, the string sails past humanity's farthest craft`
  };
}
