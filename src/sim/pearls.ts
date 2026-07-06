// The string of pearls: one sundiver launch per year along a target's focal
// line. Every pearl flies the same tuned trajectory, so pearl k's state at
// mission time t is the trajectory evaluated at age t - k years. Successive
// cruise pearls end up ~25 AU apart (exit speed x launch cadence).

import facts from '../data/mission-facts.json';
import { YEAR_S } from './constants';
import type { SundiverTrajectory } from './sundiver';

export type PearlPhase = 'diving' | 'cruise' | 'operating';

export interface PearlState {
  index: number; // launch number, 0 = first away
  launchYear: number;
  ageS: number;
  rAU: number;
  phase: PearlPhase;
}

export function pearlPhaseFor(rAU: number, ageS: number, traj: SundiverTrajectory): PearlPhase {
  if (ageS <= traj.perihelionS) return 'diving';
  return rAU >= facts.lens.usefulImagingStartAU ? 'operating' : 'cruise';
}

// All pearls launched by missionYears, newest first excluded if pre-launch.
export function pearlStringAt(
  missionYears: number,
  traj: SundiverTrajectory,
  launchesPerYear = facts.pearls.launchesPerYear
): PearlState[] {
  const pearls: PearlState[] = [];
  const count = Math.floor(missionYears * launchesPerYear) + 1;
  for (let index = 0; index < count; index++) {
    const launchYear = index / launchesPerYear;
    const ageS = (missionYears - launchYear) * YEAR_S;
    if (ageS < 0) continue;
    const state = traj.at(ageS);
    pearls.push({
      index,
      launchYear,
      ageS,
      rAU: state.rAU,
      phase: pearlPhaseFor(state.rAU, ageS, traj)
    });
  }
  return pearls;
}

// Spacing between two adjacent pearls once both are coasting: one cadence
// interval of cruise speed. The published figure is 25 AU.
export function cruiseSpacingAU(traj: SundiverTrajectory, launchesPerYear = 1): number {
  return traj.exitSpeedAUYr / launchesPerYear;
}
