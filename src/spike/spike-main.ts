// Act 5 lensing-shader spike: standalone harness proving the Einstein ring
// renders correctly at true angular scale before Acts 3-5 depend on it.
// Kept permanently as a dev tool (second Vite entry, /spike.html).

import {
  ACESFilmicToneMapping,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  TextureLoader,
  WebGLRenderer
} from 'three';
import { createComposer } from '../render/bloom';
import { createExoplanetTexture } from '../render/exoplanet-texture';
import { createLensMaterial } from '../render/lens-shader';
import { einsteinRingRad, solarAngularRadiusRad } from '../sim/lensing';
import { auToM, radToArcsec } from '../sim/units';
import { SpikePanel, J2_EFFECTIVE } from './spike-controls';
import './spike.css';

const OCCULTER_RSUN = 1.04;
// Proxima b at 4.24 ly subtends ~3e-8 arcsec from 650 AU; at true size the
// ring would be far thinner than a pixel. The spike uses a visibly thick
// source and the page says so (speculative watermark covers the surface too).
const SOURCE_RADIUS_ARCSEC = 0.05;

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
const material = createLensMaterial();
scene.add(new Mesh(new PlaneGeometry(2, 2), material));

const { composer, resize: resizeComposer } = createComposer(renderer, scene, camera, 0.4);

material.uniforms.uSrcTex.value = createExoplanetTexture();
material.uniforms.uOcculterRsun.value = OCCULTER_RSUN;
material.uniforms.uSrcRadius.value = SOURCE_RADIUS_ARCSEC;

new TextureLoader().load(
  './assets/textures/corona-lasco-c2.jpg',
  (texture) => {
    material.uniforms.uCorona.value = texture;
    material.uniforms.uHasCorona.value = 1;
  },
  undefined,
  () => {
    // Missing asset: the shader's procedural corona covers the full field.
    material.uniforms.uHasCorona.value = 0;
  }
);

// Angular guides: DOM circles at the solar limb and theta_E radii.
const guides = document.getElementById('guides') as HTMLDivElement;
const limbGuide = document.getElementById('guide-limb') as HTMLDivElement;
const ringGuide = document.getElementById('guide-ring') as HTMLDivElement;
const scaleBar = document.getElementById('scale-bar') as HTMLDivElement;

const panel = new SpikePanel(document.body, applyState);

function applyState(): void {
  const s = panel.state;
  const zM = auToM(s.zAU);
  const thetaE = radToArcsec(einsteinRingRad(zM));
  const thetaSun = radToArcsec(solarAngularRadiusRad(zM));

  material.uniforms.uThetaE.value = thetaE;
  material.uniforms.uThetaSun.value = thetaSun;
  material.uniforms.uBetaS.value.set(s.offsetArcsec, 0);
  material.uniforms.uJ2.value = s.j2On ? J2_EFFECTIVE : 0;
  material.uniforms.uExposure.value = s.exposure;

  panel.updateReadouts({
    thetaEArcsec: thetaE,
    thetaSunArcsec: thetaSun,
    ringImpactRsun: thetaE / thetaSun,
    occulterRsun: OCCULTER_RSUN,
    ringVisible: thetaE > OCCULTER_RSUN * thetaSun
  });

  const arcsecPerCssPx = s.fovArcsec / window.innerHeight;
  const circle = (el: HTMLDivElement, radiusArcsec: number, label: string): void => {
    const r = radiusArcsec / arcsecPerCssPx;
    el.style.width = `${2 * r}px`;
    el.style.height = `${2 * r}px`;
    el.dataset.label = `${label} ${radiusArcsec.toFixed(2)} arcsec`;
  };
  guides.style.display = s.guidesOn ? '' : 'none';
  circle(limbGuide, thetaSun, 'solar limb');
  circle(ringGuide, thetaE, 'theta_E');

  const barArcsec = 1;
  scaleBar.style.width = `${barArcsec / arcsecPerCssPx}px`;
  scaleBar.textContent = `${barArcsec} arcsec`;
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeComposer(window.innerWidth, window.innerHeight);
  const buffer = renderer.getDrawingBufferSize(material.uniforms.uResolution.value);
  material.uniforms.uResolution.value.copy(buffer);
  material.uniforms.uArcsecPerPx.value = panel.state.fovArcsec / buffer.y;
  applyState();
}
window.addEventListener('resize', resize);
resize();

const start = performance.now();
renderer.setAnimationLoop(() => {
  material.uniforms.uArcsecPerPx.value =
    panel.state.fovArcsec / material.uniforms.uResolution.value.y;
  material.uniforms.uTime.value = (performance.now() - start) / 1000;
  composer.render();
});
