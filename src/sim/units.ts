import { AU_M, C, YEAR_S } from './constants';

export const ARCSEC_PER_RAD = 648_000 / Math.PI; // 206264.8...
export const DEG_PER_RAD = 180 / Math.PI;

export function auToM(au: number): number {
  return au * AU_M;
}

export function mToAu(m: number): number {
  return m / AU_M;
}

export function radToArcsec(rad: number): number {
  return rad * ARCSEC_PER_RAD;
}

export function arcsecToRad(arcsec: number): number {
  return arcsec / ARCSEC_PER_RAD;
}

export function degToRad(deg: number): number {
  return deg / DEG_PER_RAD;
}

export function kmsToAuPerYr(kms: number): number {
  return (kms * 1000 * YEAR_S) / AU_M;
}

export function auPerYrToKms(auPerYr: number): number {
  return (auPerYr * AU_M) / YEAR_S / 1000;
}

// One-way light travel time in seconds for a distance in metres
export function lightTimeS(distM: number): number {
  return distM / C;
}
