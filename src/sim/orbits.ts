// Kepler propagation for solar-system context scenes.
// JPL approximate planetary elements (Standish, valid 1800-2050), heliocentric
// ecliptic J2000 frame: x toward vernal equinox, z toward north ecliptic pole.

import { degToRad } from './units';
import { vec3d, type Vec3d } from './vec3d';

export interface PlanetElements {
  name: string;
  // [J2000 value, per-Julian-century rate]
  aAU: [number, number]; // semi-major axis
  e: [number, number]; // eccentricity
  iDeg: [number, number]; // inclination
  lDeg: [number, number]; // mean longitude
  wBarDeg: [number, number]; // longitude of perihelion
  omegaDeg: [number, number]; // longitude of ascending node
}

export const PLANETS: PlanetElements[] = [
  { name: 'Mercury', aAU: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], iDeg: [7.00497902, -0.00594749], lDeg: [252.2503235, 149472.67411175], wBarDeg: [77.45779628, 0.16047689], omegaDeg: [48.33076593, -0.12534081] },
  { name: 'Venus', aAU: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], iDeg: [3.39467605, -0.0007889], lDeg: [181.9790995, 58517.81538729], wBarDeg: [131.60246718, 0.00268329], omegaDeg: [76.67984255, -0.27769418] },
  { name: 'Earth', aAU: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], iDeg: [-0.00001531, -0.01294668], lDeg: [100.46457166, 35999.37244981], wBarDeg: [102.93768193, 0.32327364], omegaDeg: [0, 0] },
  { name: 'Mars', aAU: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], iDeg: [1.84969142, -0.00813131], lDeg: [-4.55343205, 19140.30268499], wBarDeg: [-23.94362959, 0.44441088], omegaDeg: [49.55953891, -0.29257343] },
  { name: 'Jupiter', aAU: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], iDeg: [1.30439695, -0.00183714], lDeg: [34.39644051, 3034.74612775], wBarDeg: [14.72847983, 0.21252668], omegaDeg: [100.47390909, 0.20469106] },
  { name: 'Saturn', aAU: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], iDeg: [2.48599187, 0.00193609], lDeg: [49.95424423, 1222.49362201], wBarDeg: [92.59887831, -0.41897216], omegaDeg: [113.66242448, -0.28867794] },
  { name: 'Uranus', aAU: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], iDeg: [0.77263783, -0.00242939], lDeg: [313.23810451, 428.48202785], wBarDeg: [170.9542763, 0.40805281], omegaDeg: [74.01692503, 0.04240589] },
  { name: 'Neptune', aAU: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], iDeg: [1.77004347, 0.00035372], lDeg: [-55.12002969, 218.45945325], wBarDeg: [44.96476227, -0.32241464], omegaDeg: [131.78422574, -0.00508664] }
];

function elementAt(pair: [number, number], centuriesJ2000: number): number {
  return pair[0] + pair[1] * centuriesJ2000;
}

// Solve Kepler's equation E - e sin E = M by Newton iteration. Angles in radians.
export function solveEccentricAnomaly(meanAnomalyRad: number, e: number): number {
  const twoPi = 2 * Math.PI;
  const mWrapped = ((meanAnomalyRad % twoPi) + 3 * Math.PI) % twoPi - Math.PI;
  const turns = meanAnomalyRad - mWrapped; // multiple of 2 pi; E shifts by the same amount
  let eAnom = mWrapped + e * Math.sin(mWrapped);
  for (let i = 0; i < 20; i++) {
    const delta = (eAnom - e * Math.sin(eAnom) - mWrapped) / (1 - e * Math.cos(eAnom));
    eAnom -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return eAnom + turns;
}

// Heliocentric ecliptic position (AU) at daysSinceJ2000.
export function planetPositionAU(planet: PlanetElements, daysSinceJ2000: number): Vec3d {
  const t = daysSinceJ2000 / 36525;
  const a = elementAt(planet.aAU, t);
  const e = elementAt(planet.e, t);
  const i = degToRad(elementAt(planet.iDeg, t));
  const l = elementAt(planet.lDeg, t);
  const wBar = elementAt(planet.wBarDeg, t);
  const omega = degToRad(elementAt(planet.omegaDeg, t));
  const w = degToRad(wBar) - omega; // argument of perihelion
  const m = degToRad(((l - wBar) % 360 + 540) % 360 - 180); // mean anomaly in [-pi, pi)

  const eAnom = solveEccentricAnomaly(m, e);
  const xOrb = a * (Math.cos(eAnom) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(eAnom);

  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosO = Math.cos(omega), sinO = Math.sin(omega);
  const cosI = Math.cos(i), sinI = Math.sin(i);

  const x = (cosW * cosO - sinW * sinO * cosI) * xOrb + (-sinW * cosO - cosW * sinO * cosI) * yOrb;
  const y = (cosW * sinO + sinW * cosO * cosI) * xOrb + (-sinW * sinO + cosW * cosO * cosI) * yOrb;
  const z = sinW * sinI * xOrb + cosW * sinI * yOrb;
  return vec3d(x, y, z);
}

// Sampled orbit path (AU) for drawing orbit rings.
export function orbitPathAU(planet: PlanetElements, daysSinceJ2000: number, segments = 128): Vec3d[] {
  const t = daysSinceJ2000 / 36525;
  const periodDays = 365.25 * Math.pow(elementAt(planet.aAU, t), 1.5);
  const points: Vec3d[] = [];
  for (let s = 0; s <= segments; s++) {
    points.push(planetPositionAU(planet, daysSinceJ2000 + (s / segments) * periodDays));
  }
  return points;
}
