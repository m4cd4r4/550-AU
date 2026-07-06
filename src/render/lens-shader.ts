// Fullscreen Einstein-ring shader: for each pixel near the Sun, invert the
// thin-lens mapping to the source plane and sample the exoplanet texture,
// composited over the corona backdrop with the coronagraph occulter.
// The GLSL lensToSource is a transcription of the tested src/sim/lensing.ts.

import { ShaderMaterial, Texture, Vector2 } from 'three';

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec2 uResolution;    // drawing buffer size, device px
uniform float uArcsecPerPx;  // angular scale, arcsec per device px
uniform float uThetaE;       // Einstein ring angular radius, arcsec
uniform float uThetaSun;     // solar photosphere angular radius, arcsec
uniform float uOcculterRsun; // coronagraph occulter radius, R_sun units
uniform vec2 uBetaS;         // source offset from the optical axis, arcsec
uniform float uSrcRadius;    // source angular radius, arcsec (exaggerated)
uniform float uJ2;           // effective quadrupole strength, 0 disables
uniform float uPoleAngle;    // solar rotation axis position angle, rad
uniform float uExposure;
uniform float uTime;
uniform sampler2D uSrcTex;      // procedural exoplanet map, wraps in x
uniform sampler2D uCorona;      // SOHO LASCO C2 frame
uniform float uHasCorona;       // 0 = procedural fallback everywhere
uniform float uCoronaHalfWidthRsun; // LASCO image half-width, R_sun units
uniform float uLascoInnerRsun;      // LASCO occulter edge, R_sun units

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Inverse thin-lens mapping, image angle -> source angle (see sim/lensing.ts)
vec2 lensToSource(vec2 theta) {
  float r2 = dot(theta, theta);
  float r = sqrt(r2);
  vec2 er = theta / r;
  float q = uJ2 * uThetaSun * uThetaSun / r2;
  float twoD = 2.0 * (atan(theta.y, theta.x) - uPoleAngle);
  float aR = (uThetaE * uThetaE / r) * (1.0 - q * cos(twoD));
  float aT = -(uThetaE * uThetaE / r) * q * sin(twoD);
  return theta - vec2(aR * er.x - aT * er.y, aR * er.y + aT * er.x);
}

// Radial streamer structure: azimuthal fbm sampled on the unit circle so the
// pattern stays continuous, stretched radially like real coronal rays.
vec3 proceduralCorona(vec2 er, float rho) {
  float streaks = fbm(er * 3.1 + 7.0);
  float rays = fbm(er * 9.0 + 41.0);
  float base = pow(max(rho, 1.0), -3.0);
  float b = base * (0.30 + 1.1 * streaks * streaks + 0.35 * rays);
  return vec3(1.0, 0.42, 0.13) * b * 1.1;
}

vec3 coronaColor(vec2 theta, vec2 er, float rho) {
  vec3 proc = proceduralCorona(er, rho);
  if (uHasCorona < 0.5) return proc;
  vec2 uv = vec2(0.5) + theta / (2.0 * uCoronaHalfWidthRsun * uThetaSun);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return proc;
  vec3 las = texture2D(uCorona, uv).rgb;
  las = las * las * 0.4; // approx sRGB to linear, gain matched to procedural
  float w = smoothstep(uLascoInnerRsun, uLascoInnerRsun + 0.5, rho)
          * (1.0 - smoothstep(5.5, 6.1, rho));
  return mix(proc, las, w);
}

vec3 lensedLight(vec2 theta) {
  vec2 beta = lensToSource(theta);
  vec2 d = (beta - uBetaS) / uSrcRadius;
  float m2 = dot(d, d);
  if (m2 > 1.0) return vec3(0.0);
  float m = sqrt(m2);
  vec2 uv = vec2(fract(0.5 + 0.5 * d.x + uTime * 0.008), 0.5 + 0.5 * d.y);
  vec3 c = texture2D(uSrcTex, uv).rgb;
  c = c * c;
  float limb = sqrt(max(0.0, 1.0 - m2)); // limb darkening on the source disc
  float edge = 1.0 - smoothstep(0.9, 1.0, m);
  return c * (5.0 * limb * edge);
}

void main() {
  vec2 theta = (gl_FragCoord.xy - 0.5 * uResolution) * uArcsecPerPx;
  float r = length(theta);
  vec2 er = r > 0.0 ? theta / r : vec2(1.0, 0.0);
  float rho = r / uThetaSun;

  vec3 color = coronaColor(theta, er, rho) + lensedLight(theta);

  float occR = uOcculterRsun * uThetaSun;
  float soft = 0.75 * uArcsecPerPx;
  float open = smoothstep(occR - soft, occR + soft, r);
  vec3 occulter = vec3(0.004, 0.005, 0.007);
  color = mix(occulter, color, open);

  gl_FragColor = vec4(color * uExposure, 1.0);
}
`;

export interface LensUniforms {
  uResolution: { value: Vector2 };
  uArcsecPerPx: { value: number };
  uThetaE: { value: number };
  uThetaSun: { value: number };
  uOcculterRsun: { value: number };
  uBetaS: { value: Vector2 };
  uSrcRadius: { value: number };
  uJ2: { value: number };
  uPoleAngle: { value: number };
  uExposure: { value: number };
  uTime: { value: number };
  uSrcTex: { value: Texture | null };
  uCorona: { value: Texture | null };
  uHasCorona: { value: number };
  uCoronaHalfWidthRsun: { value: number };
  uLascoInnerRsun: { value: number };
}

export function createLensMaterial(): ShaderMaterial & { uniforms: LensUniforms } {
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: new Vector2(1, 1) },
      uArcsecPerPx: { value: 0.01 },
      uThetaE: { value: 1.61 },
      uThetaSun: { value: 1.48 },
      uOcculterRsun: { value: 1.04 },
      uBetaS: { value: new Vector2(0, 0) },
      uSrcRadius: { value: 0.05 },
      uJ2: { value: 0 },
      uPoleAngle: { value: Math.PI / 2 },
      uExposure: { value: 1 },
      uTime: { value: 0 },
      uSrcTex: { value: null },
      uCorona: { value: null },
      uHasCorona: { value: 0 },
      uCoronaHalfWidthRsun: { value: 6.35 },
      uLascoInnerRsun: { value: 2.25 }
    }
  });
  return material as ShaderMaterial & { uniforms: LensUniforms };
}
