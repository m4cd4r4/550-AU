// Real-sky starfield from the bundled HYG subset. Stars render as a
// camera-centred point sphere: at AU scales every star is directional.
// Positions are real (RA/Dec), so focal lines can point anti-target.

import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial
} from 'three';
import hygCsv from '../data/hyg-subset.csv?raw';
import { equatorialToEclipticDir, eclipticToScene } from './frames';

export interface Star {
  name: string;
  raDeg: number;
  decDeg: number;
  distPc: number;
  mag: number;
  ci: number;
}

export function parseHygSubset(csv: string = hygCsv): Star[] {
  const lines = csv.split('\n');
  const stars: Star[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const f = line.split(',');
    if (f.length < 5) continue;
    const raHours = parseFloat(f[1] ?? '');
    const decDeg = parseFloat(f[2] ?? '');
    const mag = parseFloat(f[4] ?? '');
    if (!Number.isFinite(raHours) || !Number.isFinite(decDeg) || !Number.isFinite(mag)) continue;
    stars.push({
      name: (f[0] ?? '').trim(),
      raDeg: raHours * 15,
      decDeg,
      distPc: parseFloat(f[3] ?? '') || 0,
      mag,
      ci: parseFloat(f[5] ?? '') || 0.6
    });
  }
  return stars;
}

// B-V colour index to approximate linear RGB via blackbody temperature.
export function colorIndexToRgb(ci: number): [number, number, number] {
  const clamped = Math.min(2.0, Math.max(-0.4, ci));
  const t = 4600 * (1 / (0.92 * clamped + 1.7) + 1 / (0.92 * clamped + 0.62));
  const t100 = t / 100;
  let r: number, g: number, b: number;
  r = t100 <= 66 ? 255 : 329.7 * Math.pow(t100 - 60, -0.1332);
  g = t100 <= 66 ? 99.47 * Math.log(t100) - 161.12 : 288.12 * Math.pow(t100 - 60, -0.0755);
  b = t100 >= 66 ? 255 : t100 <= 19 ? 0 : 138.52 * Math.log(t100 - 10) - 305.04;
  const norm = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [norm(r), norm(g), norm(b)];
}

const VERT = /* glsl */ `
  attribute float size;
  attribute float intensity;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vColor = color;
    vIntensity = intensity;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float falloff = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor * vIntensity * falloff, 1.0);
  }
`;

export function createStarfield(radiusSceneUnits: number, pixelRatio: number): Points {
  const stars = parseHygSubset();
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const sizes = new Float32Array(stars.length);
  const intensities = new Float32Array(stars.length);

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    if (!star) continue;
    const dir = eclipticToScene(equatorialToEclipticDir(star.raDeg, star.decDeg));
    positions[i * 3] = dir.x * radiusSceneUnits;
    positions[i * 3 + 1] = dir.y * radiusSceneUnits;
    positions[i * 3 + 2] = dir.z * radiusSceneUnits;
    const [r, g, b] = colorIndexToRgb(star.ci);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    sizes[i] = Math.max(1.1, (5.4 - 0.62 * star.mag)) * pixelRatio;
    intensities[i] = Math.min(1, Math.max(0.05, Math.pow(10, -0.32 * (star.mag - 1.2))));
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('intensity', new Float32BufferAttribute(intensities, 1));

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -10;
  return points;
}
