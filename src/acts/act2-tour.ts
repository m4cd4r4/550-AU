// Act 2 tour script: distance profile and caption timeline. Camera math
// lives in the act controller; this module is pure data and physics.

import facts from '../data/mission-facts.json';
import { auToM, lightTimeS } from '../sim/units';

export const TOUR_DURATION_S = 90;

// Story-beat pacing: piecewise log-linear waypoints so the tour lingers at
// milestones instead of spending equal time per decade. [progress, AU]
const WAYPOINTS: [number, number][] = [
  [0.0, 0.1],
  [0.05, 0.2],
  [0.2, 1.05],
  [0.38, 31],
  [0.48, 52],
  [0.58, 125],
  [0.68, 172],
  [0.82, 540],
  [0.9, 560],
  [0.97, 652],
  [1.0, 700]
];

export function tourDistanceAU(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const next = WAYPOINTS[i];
    const prev = WAYPOINTS[i - 1];
    if (!next || !prev || p > next[0]) continue;
    const t = (p - prev[0]) / (next[0] - prev[0]);
    return Math.pow(10, Math.log10(prev[1]) + t * (Math.log10(next[1]) - Math.log10(prev[1])));
  }
  return WAYPOINTS[WAYPOINTS.length - 1]?.[1] ?? 700;
}

export interface CaptionEvent {
  au: number;
  text: string;
}

function milestoneAu(label: string): number {
  const m = facts.act2Milestones.find((entry) => entry.label === label);
  return m ? m.au : 0;
}

export function buildCaptionEvents(): CaptionEvent[] {
  const earthAu = milestoneAu('Earth');
  const neptuneAu = milestoneAu('Neptune');
  const heliopauseAu = milestoneAu('Heliopause');
  const voyagerAu = milestoneAu('Voyager 1');
  const minFocusAu = milestoneAu('Minimum focus');
  const imagingAu = milestoneAu('Imaging begins');
  const earthLightMin = Math.round(lightTimeS(auToM(earthAu)) / 60);
  const neptuneLightH = Math.floor(lightTimeS(auToM(neptuneAu)) / 3600);

  return [
    {
      au: earthAu,
      text: `Earth. ${earthAu} AU from the Sun. Light makes the trip in ${earthLightMin} minutes.`
    },
    {
      au: neptuneAu,
      text: `Neptune, ${neptuneAu} AU out. Sunlight takes more than ${neptuneLightH} hours to get here.`
    },
    { au: 42, text: 'The Kuiper belt. Icy debris from 30 to 50 AU.' },
    {
      au: heliopauseAu,
      text: `The heliopause, near ${heliopauseAu} AU. The solar wind gives way to interstellar space.`
    },
    {
      au: voyagerAu,
      text: `Voyager 1, the farthest spacecraft: ${voyagerAu} AU after ${facts.voyager1.yearsInFlight} years of flight.`
    },
    {
      au: minFocusAu,
      text: `${minFocusAu} AU. Light grazing the solar limb converges here. The lens opens.`
    },
    {
      au: imagingAu,
      text: `${imagingAu} AU. Rays passing clear of the corona focus here. Imaging begins.`
    }
  ];
}

export const INTRO_CAPTION =
  'The ruler runs from the Sun to the gravitational focus. Every number on it is real.';

export const END_CAPTION = 'The focal line never ends. Farther out, the ring only grows.';
