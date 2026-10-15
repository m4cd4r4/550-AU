// Pearl-model spike: the Act 4 close-up on its own, under the same key and
// fill lights the act adds, at a fixed camera. Act 4 only ever shows this
// model after a click on a moving pearl, which makes the craft hard to look
// at while tuning its materials. Kept as a dev tool (third Vite entry,
// /pearl.html), the same way the Act 5 lensing spike is.
//
// Query string: ?explode=1 for the six CubeSats, ?sail=1 for the diving
// configuration, ?spin=0 to hold still for a screenshot.

import { ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createComposer } from '../render/bloom';
import { PearlLighting } from '../render/pearl-lighting';
import { CUBESAT_ROLES, PearlModel } from '../render/pearl-models';
import './spike.css';

const params = new URLSearchParams(window.location.search);
const flag = (name: string, fallback = false): boolean => {
  const raw = params.get(name);
  return raw === null ? fallback : raw !== '0' && raw !== 'false';
};

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);

// The same rig Act 4 attaches, so what the spike shows is what the act shows.
new PearlLighting().attach(scene, renderer);

const pearl = new PearlModel();
scene.add(pearl.group);

const exploded = flag('explode');
const spin = flag('spin', true);
pearl.setSailShown(flag('sail'));
pearl.setExplode(exploded ? 1 : 0);

// Frame the assembled telescope tightly; back off for the exploded ring.
// Pull back on a narrow viewport so the craft still fits at phone width.
const fit = Math.max(1, 1.5 / Math.max(camera.aspect, 0.3));
camera.position.set(
  (exploded ? 7.5 : 3.4) * fit,
  (exploded ? 3.8 : 1.8) * fit,
  (exploded ? 9.2 : 4.6) * fit
);
camera.lookAt(0, 0, 0.2);

const { composer, resize: resizeComposer } = createComposer(renderer, scene, camera, 0.5);

const roles = document.createElement('div');
roles.className = 'spike-panel';
roles.innerHTML =
  '<div class="panel-title">CUBESAT ROLES</div>' +
  CUBESAT_ROLES.map(
    (r) =>
      `<div class="ctl-row"><span class="ctl-label">${r.role}</span></div>`
  ).join('') +
  '<div class="ctl-note">?explode=1 &middot; ?sail=1 &middot; ?spin=0</div>';
document.body.appendChild(roles);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeComposer(window.innerWidth, window.innerHeight);
});

let t = 0;
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (spin) {
    t += dt;
    pearl.group.rotation.y = Math.sin(t * 0.25) * 0.9;
  }
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
