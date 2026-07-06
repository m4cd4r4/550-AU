import { ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Act2FocalLine } from './acts/act2-focal-line';
import { Act3Sundiver } from './acts/act3-sundiver';
import { Act4Pearls } from './acts/act4-pearls';
import type { Act, ActMode, ActServices } from './acts/act';
import { createComposer } from './render/bloom';
import { OriginFrame } from './render/floating-origin';
import { createStarfield } from './render/starfield';
import { Sun } from './render/sun';
import { Timeline } from './sim/timeline';
import { Captions } from './ui/captions';
import { ChapterRail } from './ui/chapter-rail';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { LabelLayer } from './ui/labels';
import { ScaleRibbon } from './ui/scale-ribbon';
import { TimeControls } from './ui/time-controls';
import './ui/styles.css';

const CHAPTERS = [
  { id: 0, title: 'THE PROBLEM', available: false },
  { id: 1, title: "EINSTEIN'S LENS", available: false },
  { id: 2, title: 'THE FOCAL LINE', available: true },
  { id: 3, title: 'THE SUNDIVER', available: true },
  { id: 4, title: 'STRING OF PEARLS', available: true },
  { id: 5, title: 'IMAGING THE RING', available: false },
  { id: 6, title: 'MANY WORLDS', available: false },
  { id: 7, title: 'EPILOGUE', available: false }
];

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

const renderer = new WebGLRenderer({
  antialias: true,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 5e-5, 30000);
camera.position.set(0, 0.02, 0.11);
scene.add(camera);

const { composer, resize: resizeComposer } = createComposer(renderer, scene, camera);

const starfield = createStarfield(5000, renderer.getPixelRatio());
scene.add(starfield);

const sun = new Sun();
scene.add(sun.group);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1e-3;
controls.maxDistance = 4000;
controls.enabled = false;

// UI shell
const ui = document.createElement('div');
ui.className = 'ui';
app.appendChild(ui);

const topbar = document.createElement('header');
topbar.className = 'topbar';
const brand = document.createElement('div');
brand.className = 'brand';
brand.innerHTML = '550 AU<span class="sub">SOLAR GRAVITATIONAL LENS</span>';
const heading = document.createElement('div');
heading.className = 'act-heading';
const actName = document.createElement('div');
actName.className = 'act-name';
const actQuestion = document.createElement('div');
actQuestion.className = 'act-question';
heading.append(actName, actQuestion);
const modeToggle = document.createElement('div');
modeToggle.className = 'mode-toggle';
const tourButton = document.createElement('button');
tourButton.textContent = 'TOUR';
const exploreButton = document.createElement('button');
exploreButton.textContent = 'EXPLORE';
modeToggle.append(tourButton, exploreButton);
topbar.append(brand, heading, modeToggle);
ui.appendChild(topbar);

const labels = new LabelLayer(ui);
const hud = new Hud(ui);
const captions = new Captions(ui);
const inspector = new Inspector(ui);
const timeline = new Timeline();

let currentAct: Act | null = null;
let mode: ActMode = 'tour';

const ribbon = new ScaleRibbon(ui, () => currentAct?.onToggleTrueScale());
const timeControls = new TimeControls(ui, {
  onPlayPause: () => currentAct?.onPlayPause(),
  onWarpCycle: () => currentAct?.onWarpCycle(),
  onScrub: (p) => currentAct?.onScrub(p)
});

const rail = new ChapterRail(ui, CHAPTERS, (id) => switchAct(id));

function setMode(next: ActMode): void {
  mode = next;
  tourButton.classList.toggle('active', mode === 'tour');
  exploreButton.classList.toggle('active', mode === 'explore');
  currentAct?.setMode(mode);
}
tourButton.addEventListener('click', () => setMode('tour'));
exploreButton.addEventListener('click', () => setMode('explore'));

const services: ActServices = {
  scene,
  camera,
  renderer,
  controls,
  origin: new OriginFrame(),
  timeline,
  hud,
  captions,
  ribbon,
  labels,
  inspector,
  timeControls,
  setActHeading: (name, question) => {
    actName.textContent = name;
    actQuestion.textContent = question;
  }
};

const actFactories = new Map<number, (s: ActServices) => Act>([
  [2, (s) => new Act2FocalLine(s)],
  [3, (s) => new Act3Sundiver(s)],
  [4, (s) => new Act4Pearls(s)]
]);
const actCache = new Map<number, Act>();

function switchAct(id: number): void {
  const factory = actFactories.get(id);
  if (!factory || currentAct?.id === id) return;
  currentAct?.exit();
  let act = actCache.get(id);
  if (!act) {
    act = factory(services);
    actCache.set(id, act);
  }
  currentAct = act;
  rail.setActive(id);
  currentAct.enter(mode);
  setMode(mode);
}

switchAct(2);

let statsUpdate: (() => void) | null = null;
if (import.meta.env.DEV) {
  import('three/addons/libs/stats.module.js').then(({ default: Stats }) => {
    const stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;bottom:0;left:0;z-index:9;opacity:0.8;';
    document.body.appendChild(stats.dom);
    statsUpdate = () => stats.update();
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeComposer(window.innerWidth, window.innerHeight);
});

let prevTime = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - prevTime) / 1000);
  prevTime = now;

  timeline.update(dt);
  currentAct?.update(dt);
  if (controls.enabled) controls.update();
  sun.update(services.origin, camera);
  starfield.position.copy(camera.position);
  labels.update(services.origin, camera);
  composer.render();
  statsUpdate?.();
});
