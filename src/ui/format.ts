// Display formatting for HUD telemetry. British English, no special dashes.

import { AU_M } from '../sim/constants';

export function formatAu(au: number): string {
  if (au < 1) return `${au.toFixed(3)} AU`;
  if (au < 10) return `${au.toFixed(2)} AU`;
  if (au < 100) return `${au.toFixed(1)} AU`;
  return `${au.toFixed(0)} AU`;
}

export function formatKmFromAu(au: number): string {
  const km = (au * AU_M) / 1000;
  if (km < 1e6) return `${Math.round(km).toLocaleString('en-GB')} km`;
  if (km < 1e9) return `${(km / 1e6).toFixed(1)} million km`;
  return `${(km / 1e9).toFixed(1)} billion km`;
}

export function formatDuration(seconds: number): string {
  const s = Math.abs(seconds);
  if (s < 90) return `${s.toFixed(0)} s`;
  if (s < 5400) {
    const min = Math.floor(s / 60);
    return `${min} min ${Math.round(s - min * 60)} s`;
  }
  if (s < 172800) {
    const h = Math.floor(s / 3600);
    return `${h} h ${Math.round((s - h * 3600) / 60)} min`;
  }
  if (s < 63115200) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / 31557600).toFixed(1)} yr`;
}

export function formatCompression(factor: number): string {
  if (factor < 1.05) return '1:1';
  if (factor < 10) return `1:${factor.toFixed(1)}`;
  return `1:${Math.round(factor).toLocaleString('en-GB')}`;
}

export function formatMultipleOfC(speedC: number): string {
  if (speedC < 0.001) return `${(speedC * 299792.458).toFixed(0)} km/s`;
  if (speedC < 10) return `${speedC.toFixed(2)} c`;
  return `${Math.round(speedC).toLocaleString('en-GB')} c`;
}
