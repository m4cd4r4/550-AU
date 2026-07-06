// Sundiver trajectory: RK4 integration of two-body gravity plus solar
// radiation pressure with the mission's sail attitude schedule. The sail is
// feathered (edge-on, no thrust) on the inbound leg, snaps face-on at
// perihelion for maximum photon thrust, and is jettisoned at year 2.
//
// The lightness number beta (SRP acceleration / solar gravity for a face-on
// sail) is TUNED to reproduce the published exit speed of 25-26 AU/yr from a
// 0.1 AU perihelion; it is an effective performance parameter, not derived
// from the sail's mass and area. See the clarification note appended to
// docs/BUILD-PROMPT.md for how the published timeline figures reconcile.

import { AU_M, G, M_SUN, YEAR_S } from './constants';

const MU = G * M_SUN;

export type SundiverPhase = 'inbound' | 'sailing' | 'coast';

export interface SundiverParams {
  startAU: number; // aphelion of the inbound transfer ellipse (launch)
  perihelionAU: number;
  beta: number; // tuned effective lightness number
  jettisonS: number; // sail jettison time after launch
  endAU: number; // stop integrating past this heliocentric distance
}

export const SUNDIVER_DEFAULTS: SundiverParams = {
  startAU: 1,
  perihelionAU: 0.1,
  beta: 0.9475,
  jettisonS: 2 * YEAR_S,
  endAU: 700
};

export interface TrajectorySample {
  tS: number;
  xAU: number; // heliocentric ecliptic plane, AU
  yAU: number;
  rAU: number;
  speedMS: number;
  thrustMS2: number; // SRP acceleration magnitude
  phase: SundiverPhase;
}

export interface SundiverTrajectory {
  samples: TrajectorySample[];
  perihelionS: number;
  perihelionAU: number;
  jettisonS: number;
  exitSpeedAUYr: number; // speed at the last sample, effectively asymptotic
  timeToAU(rAU: number): number; // first crossing time, seconds; NaN if never
  at(tS: number): TrajectorySample; // interpolated state
}

interface State {
  x: number; // metres
  y: number;
  vx: number; // m/s
  vy: number;
}

function accel(s: State, faceOn: boolean, beta: number, out: State): void {
  const r2 = s.x * s.x + s.y * s.y;
  const r = Math.sqrt(r2);
  // Face-on sail thrust is radially outward and scales as 1/r^2, exactly
  // opposing a beta fraction of solar gravity.
  const g = (MU / r2) * (faceOn ? 1 - beta : 1);
  out.vx = (-g * s.x) / r;
  out.vy = (-g * s.y) / r;
  out.x = s.vx;
  out.y = s.vy;
}

function rk4Step(s: State, dt: number, faceOn: boolean, beta: number): void {
  const k1: State = { x: 0, y: 0, vx: 0, vy: 0 };
  const k2: State = { x: 0, y: 0, vx: 0, vy: 0 };
  const k3: State = { x: 0, y: 0, vx: 0, vy: 0 };
  const k4: State = { x: 0, y: 0, vx: 0, vy: 0 };
  const tmp: State = { x: 0, y: 0, vx: 0, vy: 0 };

  accel(s, faceOn, beta, k1);
  tmp.x = s.x + 0.5 * dt * k1.x;
  tmp.y = s.y + 0.5 * dt * k1.y;
  tmp.vx = s.vx + 0.5 * dt * k1.vx;
  tmp.vy = s.vy + 0.5 * dt * k1.vy;
  accel(tmp, faceOn, beta, k2);
  tmp.x = s.x + 0.5 * dt * k2.x;
  tmp.y = s.y + 0.5 * dt * k2.y;
  tmp.vx = s.vx + 0.5 * dt * k2.vx;
  tmp.vy = s.vy + 0.5 * dt * k2.vy;
  accel(tmp, faceOn, beta, k3);
  tmp.x = s.x + dt * k3.x;
  tmp.y = s.y + dt * k3.y;
  tmp.vx = s.vx + dt * k3.vx;
  tmp.vy = s.vy + dt * k3.vy;
  accel(tmp, faceOn, beta, k4);

  s.x += (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
  s.y += (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y);
  s.vx += (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx);
  s.vy += (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy);
}

export function integrateSundiver(params: SundiverParams = SUNDIVER_DEFAULTS): SundiverTrajectory {
  const rA = params.startAU * AU_M;
  const rP = params.perihelionAU * AU_M;
  const a = (rA + rP) / 2;
  // Launch at the aphelion of the transfer ellipse: the kick stage has shed
  // most of Earth's orbital speed so the craft falls sunward.
  const vAphelion = Math.sqrt(MU * (2 / rA - 1 / a));
  const s: State = { x: rA, y: 0, vx: 0, vy: vAphelion };

  const samples: TrajectorySample[] = [];
  let tS = 0;
  let phase: SundiverPhase = 'inbound';
  let perihelionS = NaN;
  let perihelionAU = Infinity;
  let prevR = rA;
  let shrinking = true;

  const push = (): void => {
    const r = Math.hypot(s.x, s.y);
    const speed = Math.hypot(s.vx, s.vy);
    const faceOn = phase === 'sailing';
    samples.push({
      tS,
      xAU: s.x / AU_M,
      yAU: s.y / AU_M,
      rAU: r / AU_M,
      speedMS: speed,
      thrustMS2: faceOn ? (params.beta * MU) / (r * r) : 0,
      phase
    });
  };
  push();

  const endM = params.endAU * AU_M;
  let sinceSampleS = 0;
  const maxSteps = 4_000_000;
  for (let i = 0; i < maxSteps; i++) {
    const r = Math.hypot(s.x, s.y);
    if (r >= endM) break;

    // Step scales with the local dynamical time; capped for output fidelity.
    const dt = Math.min(2 * 86400, Math.max(60, 0.001 * Math.sqrt((r * r * r) / MU)));
    rk4Step(s, dt, phase === 'sailing', params.beta);
    tS += dt;
    sinceSampleS += dt;

    const rNow = Math.hypot(s.x, s.y);
    if (phase === 'inbound') {
      if (shrinking && rNow > prevR) {
        // Just passed perihelion: the sail snaps face-on.
        shrinking = false;
        phase = 'sailing';
        perihelionS = tS;
        perihelionAU = prevR / AU_M;
      }
      prevR = rNow;
    } else if (phase === 'sailing' && tS >= params.jettisonS) {
      phase = 'coast';
    }

    // Output cadence: dense near the Sun, sparse in the long cruise.
    const cadence = rNow < 2 * AU_M ? 0.002 * YEAR_S : 0.05 * YEAR_S;
    if (sinceSampleS >= cadence) {
      push();
      sinceSampleS = 0;
    }
  }
  push();

  const last = samples[samples.length - 1] as TrajectorySample;
  const exitSpeedAUYr = (last.speedMS * YEAR_S) / AU_M;

  const timeToAU = (targetAU: number): number => {
    // First outbound crossing (post-perihelion) of the target distance.
    for (let i = 1; i < samples.length; i++) {
      const b = samples[i] as TrajectorySample;
      const p = samples[i - 1] as TrajectorySample;
      if (b.tS <= perihelionS) continue;
      if (p.rAU < targetAU && b.rAU >= targetAU) {
        const f = (targetAU - p.rAU) / (b.rAU - p.rAU);
        return p.tS + f * (b.tS - p.tS);
      }
    }
    return NaN;
  };

  const at = (t: number): TrajectorySample => {
    const first = samples[0] as TrajectorySample;
    if (t <= first.tS) return first;
    if (t >= last.tS) return last;
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((samples[mid] as TrajectorySample).tS <= t) lo = mid;
      else hi = mid;
    }
    const p = samples[lo] as TrajectorySample;
    const b = samples[hi] as TrajectorySample;
    const f = (t - p.tS) / (b.tS - p.tS || 1);
    return {
      tS: t,
      xAU: p.xAU + f * (b.xAU - p.xAU),
      yAU: p.yAU + f * (b.yAU - p.yAU),
      rAU: p.rAU + f * (b.rAU - p.rAU),
      speedMS: p.speedMS + f * (b.speedMS - p.speedMS),
      thrustMS2: p.thrustMS2 + f * (b.thrustMS2 - p.thrustMS2),
      phase: p.phase
    };
  };

  return {
    samples,
    perihelionS,
    perihelionAU,
    jettisonS: params.jettisonS,
    exitSpeedAUYr,
    timeToAU,
    at
  };
}

// Flat-sail equilibrium temperature estimate, face-on to the Sun, radiating
// from both faces with absorptivity/emissivity ~1: T = 331 K / sqrt(r_AU).
// Displayed as an estimate; the sail is rated far higher (facts table).
export function sailEquilibriumTempC(rAU: number): number {
  return 331 / Math.sqrt(Math.max(rAU, 1e-4)) - 273.15;
}
