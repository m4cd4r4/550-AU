// Procedural exoplanet surface map: continents, oceans, ice caps, clouds.
// Speculative by definition (no one has imaged Proxima b); every use in the
// app is watermarked as such. Deterministic seed so screenshots reproduce.
// Wraps horizontally so slow rotation can sweep longitudes through the ring.

import { CanvasTexture, LinearFilter, RepeatWrapping } from 'three';

const SIZE = 512;

// Small seeded LCG; Math.random would make screenshots unreproducible.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildPermutation(rand: () => number): number[] {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i] as number;
    p[i] = p[j] as number;
    p[j] = tmp;
  }
  return p.concat(p);
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

// Value noise on a torus in x so the map wraps seamlessly at the date line.
function makeNoise(perm: number[], period: number) {
  const at = (xi: number, yi: number): number =>
    (perm[((perm[((xi % period) + period) % period] as number) + yi) & 255] as number) / 255;
  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const top = at(xi, yi) * (1 - u) + at(xi + 1, yi) * u;
    const bottom = at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u;
    return top * (1 - v) + bottom * v;
  };
}

export function createExoplanetTexture(seed = 550): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const rand = lcg(seed);
  const landNoise = makeNoise(buildPermutation(rand), 8);
  const cloudNoise = makeNoise(buildPermutation(rand), 8);

  const fbm = (noise: (x: number, y: number) => number, x: number, y: number): number => {
    let value = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 5; o++) {
      value += amp * noise(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2;
    }
    return value;
  };

  const img = ctx.createImageData(SIZE, SIZE);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const x = (px / SIZE) * 8;
      const y = (py / SIZE) * 8;
      const lat = Math.abs(py / SIZE - 0.5) * 2; // 0 equator, 1 pole

      const elevation = fbm(landNoise, x, y);
      let r: number;
      let g: number;
      let b: number;
      if (elevation > 0.58) {
        const h = (elevation - 0.58) / 0.42;
        r = 96 + 70 * h;
        g = 82 + 52 * h;
        b = 48 + 30 * h;
      } else if (elevation > 0.54) {
        r = 194;
        g = 178;
        b = 128; // coastline
      } else {
        const depth = elevation / 0.54;
        r = 8 + 20 * depth;
        g = 40 + 45 * depth;
        b = 92 + 70 * depth;
      }
      const ice = Math.max(0, (lat - 0.78) / 0.22 + (elevation - 0.6) * 0.3);
      if (ice > 0) {
        const w = Math.min(1, ice * 1.6);
        r = r * (1 - w) + 235 * w;
        g = g * (1 - w) + 240 * w;
        b = b * (1 - w) + 245 * w;
      }
      const cloud = fbm(cloudNoise, x * 1.7 + 3, y * 1.7 + 3);
      if (cloud > 0.56) {
        const w = Math.min(1, (cloud - 0.56) * 4);
        r = r * (1 - w) + 230 * w;
        g = g * (1 - w) + 232 * w;
        b = b * (1 - w) + 236 * w;
      }

      const i = (py * SIZE + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}
