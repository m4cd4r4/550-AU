// Act 3 tour script: maps tour progress to mission time with story-beat
// pacing (slow through launch and perihelion, accelerating through the
// cruise), plus the caption timeline. Camera math lives in the controller.

import facts from '../data/mission-facts.json';
import { YEAR_S, DAY_S } from '../sim/constants';
import type { SundiverTrajectory } from '../sim/sundiver';

export const TOUR_DURATION_S = 100;

export interface TourWaypoint {
  p: number; // tour progress 0..1
  tS: number; // mission time
}

// The mapping depends on the integrated trajectory (perihelion and
// milestone times), so it is built at act init rather than hardcoded.
export function buildTourWaypoints(traj: SundiverTrajectory): TourWaypoint[] {
  const tPeri = traj.perihelionS;
  const tVoyager = traj.timeToAU(facts.voyager1.distanceAU);
  const tMinFocus = traj.timeToAU(facts.lens.minFocalDistanceAU);
  return [
    { p: 0.0, tS: 0 },
    { p: 0.08, tS: 12 * DAY_S }, // launch and sail deployment
    { p: 0.26, tS: tPeri - 4 * DAY_S }, // the long fall sunward
    { p: 0.4, tS: tPeri + 6 * DAY_S }, // perihelion slow motion
    { p: 0.52, tS: 0.75 * YEAR_S }, // slingshot exit
    { p: 0.62, tS: traj.jettisonS + 30 * DAY_S }, // jettison beat
    { p: 0.78, tS: Number.isFinite(tVoyager) ? tVoyager : 7 * YEAR_S },
    { p: 1.0, tS: Number.isFinite(tMinFocus) ? tMinFocus + 0.4 * YEAR_S : 22 * YEAR_S }
  ];
}

export function tourTimeS(waypoints: TourWaypoint[], progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 1; i < waypoints.length; i++) {
    const next = waypoints[i];
    const prev = waypoints[i - 1];
    if (!next || !prev || p > next.p) continue;
    const f = (p - prev.p) / (next.p - prev.p);
    // Smoothstep within each segment so beats ease in and out.
    const e = f * f * (3 - 2 * f);
    return prev.tS + e * (next.tS - prev.tS);
  }
  return waypoints[waypoints.length - 1]?.tS ?? 0;
}

export interface TimedCaption {
  tS: number;
  text: string;
}

export function buildCaptions(traj: SundiverTrajectory): TimedCaption[] {
  const s = facts.sundiver;
  const peakKmS = Math.round(traj.at(traj.perihelionS).speedMS / 1000);
  const exit = traj.exitSpeedAUYr.toFixed(0);
  const tVoyager = traj.timeToAU(facts.voyager1.distanceAU);
  const tMinFocus = traj.timeToAU(facts.lens.minFocalDistanceAU);
  return [
    {
      tS: 2 * DAY_S,
      text: `Launch inward. The sail unfurls: ${s.sailPanelCount} panels, ${s.sailTotalAreaM2.toLocaleString('en-GB')} square metres, ${s.sailMassKg} kg of tin-coated film.`
    },
    {
      tS: 30 * DAY_S,
      text: 'Feathered edge-on to the light, the craft falls sunward for months.'
    },
    {
      tS: traj.perihelionS - 2 * DAY_S,
      text: `Perihelion: ${s.perihelionMillionKm} million km above the photosphere. The sail snaps face-on.`
    },
    {
      tS: traj.perihelionS + 10 * DAY_S,
      text: `${peakKmS} km/s at peak. No engine fired: photon pressure alone did this.`
    },
    {
      tS: 0.8 * YEAR_S,
      text: `Climbing out at ${exit} AU per year. Chemical rockets top out near ${s.chemicalMaxSpeedAUYr}.`
    },
    {
      tS: traj.jettisonS,
      text: `Year ${s.sailJettisonYear}: sunlight is too weak to push. The sail is let go.`
    },
    ...(Number.isFinite(tVoyager)
      ? [
          {
            tS: tVoyager,
            text: `Voyager 1 overtaken: ${facts.voyager1.distanceAU} AU, reached in ${(tVoyager / YEAR_S).toFixed(0)} years instead of ${facts.voyager1.yearsInFlight}.`
          }
        ]
      : []),
    ...(Number.isFinite(tMinFocus)
      ? [
          {
            tS: tMinFocus,
            text: `Year ${(tMinFocus / YEAR_S).toFixed(0)}: the ${facts.lens.minFocalDistanceAU} AU minimum focus. The lens opens ahead.`
          }
        ]
      : [])
  ];
}

export const END_CAPTION =
  'The craft coasts on along the focal line. Imaging begins at 650 AU.';
