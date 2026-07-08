// Act 7 - Epilogue (lean). Two scenes plus closing cards, reusing the laser
// relay from Act 4 and the shared starfield. Scene A: a lens-to-lens comm
// link, Sun to Alpha Centauri, error-free at about 1e9 gain and closing on
//0.1 mW. Scene B: the Sagittarius A* thought experiment, the ultimate lens,
// flagged as beyond current engineering. No new physics below the visuals.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Line,
  LineBasicMaterial,
  BufferGeometry,
  BufferAttribute,
  SphereGeometry,
  RingGeometry,
  DoubleSide,
  Vector3
} from 'three';
import facts from '../data/mission-facts.json';
import { LaserRelay } from '../render/laser-relay';
import { equatorialToEclipticDir, eclipticToScene } from '../render/frames';
import type { LabelAnchor } from '../render/focal-ruler';
import { vec3d, scale as scaleVec, type Vec3d } from '../sim/vec3d';
import type { Act, ActMode, ActServices } from './act';

// Alpha Centauri A, J2000.
const ALPHA_CEN_RA = 219.902;
const ALPHA_CEN_DEC = -60.834;
const ALPHA_CEN_DIST = 5.5; // scene units (compressed)
const SCENE_SWITCH = 0.5;
const TOUR_DURATION_S = 64;

export class Act7Epilogue implements Act {
  readonly id = 7;
  readonly title = 'EPILOGUE';
  readonly question = 'What else does this unlock?';

  private readonly group = new Group();
  private readonly relay = new LaserRelay();
  private readonly alphaCen: Mesh;
  private readonly alphaPos: Vec3d;
  private readonly link: Line;
  private readonly sgrA = new Group();
  private readonly card: HTMLElement;
  private readonly anchors: LabelAnchor[];
  private mode: ActMode = 'tour';
  private scene: 'link' | 'sgra' = 'link';
  private lastCaption = -1;
  private readonly scratchV3 = new Vector3();

  constructor(private readonly s: ActServices) {
    const dir = eclipticToScene(equatorialToEclipticDir(ALPHA_CEN_RA, ALPHA_CEN_DEC));
    this.alphaPos = scaleVec(vec3d(), dir, ALPHA_CEN_DIST);

    this.alphaCen = new Mesh(
      new SphereGeometry(0.13, 16, 12),
      new MeshBasicMaterial({ color: 0xffe0a0 })
    );
    this.alphaCen.position.set(this.alphaPos.x, this.alphaPos.y, this.alphaPos.z);
    this.group.add(this.alphaCen);

    this.link = new Line(
      lineGeometry([0, 0, 0, this.alphaPos.x, this.alphaPos.y, this.alphaPos.z]),
      new LineBasicMaterial({ color: 0x4f9fd8, transparent: true, opacity: 0.3 })
    );
    this.link.frustumCulled = false;
    this.group.add(this.link);
    this.group.add(this.relay.group);

    this.buildSgrA();
    this.group.add(this.sgrA);

    this.anchors = [
      { text: 'SUN (LENS)', displayPos: vec3d(0, -0.28, 0), accent: false },
      { text: 'ALPHA CENTAURI (LENS)', displayPos: this.alphaPos, accent: true }
    ];

    this.card = document.createElement('div');
    this.card.className = 'epilogue-card panel';
  }

  private buildSgrA(): void {
    // A black disc with a thin hot accretion ring: no photosphere, no corona.
    const hole = new Mesh(
      new SphereGeometry(0.6, 32, 24),
      new MeshBasicMaterial({ color: 0x000000 })
    );
    const ring = new Mesh(
      new RingGeometry(0.62, 1.05, 64),
      new MeshBasicMaterial({ color: 0xffa64d, transparent: true, opacity: 0.55, side: DoubleSide })
    );
    ring.rotation.x = Math.PI / 2.6;
    this.sgrA.add(hole, ring);
    this.sgrA.position.set(0, 0, -4);
    this.sgrA.visible = false;
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.group);
    this.s.origin.setOrigin(vec3d(0, 0, 0));
    this.s.setActHeading(`ACT 7 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.lastCaption = -1;
    this.relay.setChain([vec3d(0, 0, 0), this.alphaPos]);
    (this.s.hud.el.parentElement ?? document.body).appendChild(this.card);
    this.setScene('link');
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.ribbon.setToggle(false, false);
    this.s.inspector.hide();
    if (mode === 'explore') {
      this.s.timeline.pause();
      this.s.controls.target.set(this.alphaPos.x * 0.5, 0, this.alphaPos.z * 0.5);
      this.s.camera.position.set(2, 2.5, 6);
    } else {
      this.s.captions.clear();
    }
  }

  private setScene(scene: 'link' | 'sgra'): void {
    this.scene = scene;
    const linkOn = scene === 'link';
    this.alphaCen.visible = linkOn;
    this.link.visible = linkOn;
    this.relay.group.visible = linkOn;
    this.sgrA.visible = !linkOn;
    this.s.labels.setAnchors(linkOn ? this.anchors : []);
    this.card.innerHTML = linkOn ? this.linkCard() : this.sgrCard();
  }

  private linkCard(): string {
    const e = facts.epilogue;
    return `<div class="chart-title">GRAVITATIONAL LENS COMMS</div>
      <div class="epi-row"><span>Link gain</span><b>${e.commLinkGain.toExponential(0)}</b></div>
      <div class="epi-row"><span>Transmit power to close</span><b>${e.sunAlphaCenTransmitPowerMW} mW</b></div>
      <div class="epi-row"><span>Throughput</span><b>${e.commLinkThroughputMBs} MB/s</b></div>
      <div class="epi-note">A receiver at each star's focal region turns the two suns into a near-lossless interstellar link.</div>`;
  }

  private sgrCard(): string {
    const e = facts.epilogue;
    return `<div class="chart-title">THE ULTIMATE LENS</div>
      <div class="epi-row"><span>Sagittarius A*</span><b>${e.sgrAMassSolar.toExponential(0)} solar masses</b></div>
      <div class="epi-row"><span>Photosphere / corona</span><b>none</b></div>
      <div class="epi-row"><span>Minimum focal distance</span><b>none</b></div>
      <div class="epi-note">A telescope a light-year out could resolve buildings on a world across the galaxy. Pure thought experiment: far beyond any engineering we have.</div>`;
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(dtRealS: number): void {
    if (this.mode === 'tour') {
      const p = this.progress();
      const want = p < SCENE_SWITCH ? 'link' : 'sgra';
      if (want !== this.scene) this.setScene(want);
      this.runCaptions(p);
      this.placeTourCamera(p);
      if (p >= 1) this.s.timeline.pause();
    }
    if (this.scene === 'link') {
      this.relay.update(dtRealS, this.s.origin, Math.max(0.02, this.s.camera.position.length() * 0.02));
      this.alphaCen.scale.setScalar(
        Math.max(1, this.scratchV3.copy(this.alphaCen.position).distanceTo(this.s.camera.position) * 0.02)
      );
    } else {
      this.sgrA.rotation.y += dtRealS * 0.1;
    }
    this.updateHud();
  }

  private runCaptions(p: number): void {
    const beats = [
      { at: 0.02, text: 'The lens works both ways. Put a receiver at each star\'s focus and you have a link.' },
      { at: 0.28, text: `Sun to Alpha Centauri closes at ${facts.epilogue.sunAlphaCenTransmitPowerMW} milliwatts, ${facts.epilogue.commLinkThroughputMBs} megabytes a second.` },
      { at: SCENE_SWITCH + 0.02, text: 'And the Sun is a modest lens. A black hole has no surface and no corona to dodge.' },
      { at: 0.8, text: 'Sagittarius A* could image a planet across the galaxy. We are nowhere near building it.' }
    ];
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      if (beat && this.lastCaption < i && p >= beat.at) {
        this.s.captions.show(beat.text, 8);
        this.lastCaption = i;
      }
    }
  }

  private placeTourCamera(p: number): void {
    if (p < SCENE_SWITCH) {
      const a = 0.6 + p * 1.5;
      this.s.camera.position.set(Math.sin(a) * 5.5, 2 + p, Math.cos(a) * 5.5);
      this.s.camera.lookAt(this.alphaPos.x * 0.5, this.alphaPos.y * 0.5, this.alphaPos.z * 0.5);
    } else {
      const q = (p - SCENE_SWITCH) / (1 - SCENE_SWITCH);
      this.s.camera.position.set(Math.sin(q * 0.8) * 2.5, 0.6, -4 + 4.5 + q * 0.5);
      this.s.camera.lookAt(0, 0, -4);
    }
  }

  private updateHud(): void {
    const e = facts.epilogue;
    const rows: [string, string][] =
      this.scene === 'link'
        ? [
            ['SCENE', 'lens-to-lens comms'],
            ['LINK', 'Sun to Alpha Centauri'],
            ['GAIN', `${e.commLinkGain.toExponential(0)}`],
            ['TRANSMIT POWER', `${e.sunAlphaCenTransmitPowerMW} mW`],
            ['THROUGHPUT', `${e.commLinkThroughputMBs} MB/s`],
            ['RED DWARF FOCUS', `from about ${e.redDwarfFocalStartAU} AU`]
          ]
        : [
            ['SCENE', 'the ultimate lens'],
            ['LENS', 'Sagittarius A*'],
            ['MASS', `${e.sgrAMassSolar.toExponential(0)} solar masses`],
            ['CORONA', 'none'],
            ['MIN FOCAL DISTANCE', 'none'],
            ['STATUS', 'thought experiment only']
          ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({ mapLabel: 'SCHEMATIC', compression: 1, trueDistanceAU: 0 });
    this.s.timeControls.set({
      paused: this.s.timeline.paused,
      warpLabel: this.s.timeline.warpLabel,
      progress: this.mode === 'tour' ? this.progress() : null
    });
  }

  onPlayPause(): void {
    if (this.mode !== 'tour') return;
    if (this.s.timeline.paused) {
      if (this.progress() >= 1) {
        this.s.timeline.scrubTo(0);
        this.lastCaption = -1;
        this.setScene('link');
      }
      this.s.timeline.resume();
    } else {
      this.s.timeline.pause();
    }
  }

  onWarpCycle(): void {
    this.s.timeline.cycleWarp();
  }

  onScrub(progress: number): void {
    this.s.timeline.scrubTo(progress * TOUR_DURATION_S);
    this.setScene(progress < SCENE_SWITCH ? 'link' : 'sgra');
    this.lastCaption = progress < SCENE_SWITCH ? 0 : 2;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // Schematic; no true-scale toggle.
  }

  exit(): void {
    this.s.scene.remove(this.group);
    this.card.remove();
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
  }
}

function lineGeometry(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}
