// Act 3 - The Sundiver. Tour: ride the integrated trajectory from launch
// through the perihelion slingshot to the minimum focus, with the sail
// deploying, snapping face-on, and jettisoning at year 2. Explore: free
// camera around the craft, clickable for a data card.

import { Vector3 } from 'three';
import facts from '../data/mission-facts.json';
import { compressedMap } from '../render/distance-map';
import { eclipticToScene } from '../render/frames';
import { SailCraft } from '../render/sail';
import { TrajectoryTrail } from '../render/trajectory-trail';
import { AU_M, DAY_S, YEAR_S } from '../sim/constants';
import { integrateSundiver, sailEquilibriumTempC } from '../sim/sundiver';
import { auToM, lightTimeS } from '../sim/units';
import { vec3d } from '../sim/vec3d';
import { formatAu, formatCompression, formatDuration, formatKmFromAu } from '../ui/format';
import { RaceChart } from '../ui/race-chart';
import type { Act, ActMode, ActServices } from './act';
import {
  buildCaptions,
  buildTourWaypoints,
  END_CAPTION,
  TOUR_DURATION_S,
  tourTimeS
} from './act3-tour';

const COMPRESSION_D0_AU = 1.5;
const WARPS = [0.5, 1, 2, 4];
const CRAFT_ANGULAR_SIZE = 0.07; // fraction of camera distance the craft spans

export class Act3Sundiver implements Act {
  readonly id = 3;
  readonly title = 'THE SUNDIVER';
  readonly question = 'How do you get there in 20 years?';

  private readonly map = compressedMap(COMPRESSION_D0_AU);
  private readonly traj = integrateSundiver();
  private readonly waypoints = buildTourWaypoints(this.traj);
  private readonly captions = buildCaptions(this.traj);
  private readonly craft = new SailCraft();
  private readonly trail: TrajectoryTrail;
  private chart: RaceChart | null = null;
  private mode: ActMode = 'tour';
  private warpIndex = 1;
  private lastCaptionT = -1;
  private endShown = false;
  private exaggeration = 1;
  private missionT = 0;
  private readonly craftDisplay = vec3d();
  private readonly scratchV3 = new Vector3();
  private readonly sunScene = new Vector3();
  private readonly lookV3 = new Vector3();
  private readonly sideV3 = new Vector3();
  private readonly liftV3 = new Vector3();
  private readonly onClickBound = (event: MouseEvent) => this.onClick(event);

  constructor(private readonly s: ActServices) {
    this.trail = new TrajectoryTrail(this.traj.samples, this.map);
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.trail.group, this.craft.group);
    this.s.setActHeading(`ACT 3 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.timeline.setWarp(WARPS[this.warpIndex] ?? 1);
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.chart = new RaceChart(this.s.hud.el.parentElement ?? document.body, this.traj.samples);
    this.lastCaptionT = -1;
    this.endShown = false;
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.inspector.hide();
    this.s.ribbon.setToggle(false, false);
    if (mode === 'explore') {
      this.s.timeline.pause();
      this.s.controls.target.set(0, 0, 0);
    } else {
      this.s.captions.clear();
      this.lastCaptionT = this.missionT;
    }
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(): void {
    const p = this.progress();
    if (this.mode === 'tour') {
      this.missionT = tourTimeS(this.waypoints, p);
      this.runCaptions();
      if (p >= 1 && !this.endShown) {
        this.s.captions.show(END_CAPTION, 10);
        this.endShown = true;
        this.s.timeline.pause();
      }
    }

    const state = this.traj.at(this.missionT);

    // Craft display position through the distance map; origin rides it.
    const world = eclipticToScene(vec3d(state.xAU, state.yAU, 0));
    const r = Math.max(state.rAU, 1e-6);
    const displayR = this.map.toDisplay(r);
    this.craftDisplay.x = (world.x / r) * displayR;
    this.craftDisplay.y = (world.y / r) * displayR;
    this.craftDisplay.z = (world.z / r) * displayR;
    this.s.origin.setOrigin(this.craftDisplay);
    this.craft.group.position.set(0, 0, 0);

    if (this.mode === 'tour') this.placeTourCamera(p, displayR);

    // Sun direction for sail orientation (Sun sits at world zero).
    this.s.origin.toScene(vec3d(0, 0, 0), this.sunScene);
    this.craft.group.lookAt(this.sunScene);

    // Sail state from the mission clock.
    this.craft.setDeployment((this.missionT - DAY_S) / (9 * DAY_S));
    const sincePeri = this.missionT - this.traj.perihelionS;
    const pitch = sincePeri < 0 ? Math.PI / 2 : Math.PI / 2 - Math.min(1, sincePeri / DAY_S) * (Math.PI / 2);
    this.craft.setPitch(pitch);
    const sinceJettison = this.missionT - this.traj.jettisonS;
    this.craft.setJettison(sinceJettison > 0 ? sinceJettison / 3600 : 0);

    // Craft visual scale: never below true scale, exaggerated for visibility.
    // The angular reference span eases to the bus once the sail is gone.
    const camDist = this.s.camera.position.distanceTo(this.craft.group.position);
    const trueScale = 1 / AU_M; // metres to AU
    const visScale = (camDist * CRAFT_ANGULAR_SIZE) / this.craft.spanM;
    const scale = Math.max(trueScale, visScale);
    this.craft.group.scale.setScalar(scale);
    this.exaggeration = scale / trueScale;

    this.trail.update(this.s.origin, this.missionT);
    this.chart?.draw(this.missionT);
    this.updateHud(state.rAU, state.speedMS, state.thrustMS2);
  }

  private placeTourCamera(p: number, displayR: number): void {
    // Hero framing: camera anti-sunward of the craft with a drifting side
    // offset, looking sunward past it, so the Sun looms through perihelion
    // and recedes to a point during the cruise. Close early, pulling back
    // through the cruise so the trail stays in frame.
    const closeDist = 6e-4;
    const cruiseDist = 0.06 + displayR * 0.55;
    const cruiseBlend = Math.min(1, Math.max(0, (p - 0.45) / 0.3));
    const dist = closeDist + (cruiseDist - closeDist) * cruiseBlend * cruiseBlend;

    const sunDir = this.scratchV3.copy(this.sunScene).normalize();
    const side = this.sideV3.crossVectors(sunDir, this.s.camera.up).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const lift = this.liftV3.crossVectors(side, sunDir).normalize();

    const wobble = 0.8 + 0.7 * p;
    this.s.camera.position
      .copy(sunDir)
      .multiplyScalar(-0.8)
      .addScaledVector(side, 0.55 * Math.cos(wobble))
      .addScaledVector(lift, 0.3 + 0.15 * Math.sin(wobble * 1.7))
      .normalize()
      .multiplyScalar(dist);

    // Aim between the craft and the Sun; sun-weighted through perihelion.
    const periBlend = 1 - Math.min(1, Math.abs(this.missionT - this.traj.perihelionS) / (40 * DAY_S));
    this.lookV3.copy(sunDir).multiplyScalar(dist * (0.35 + 0.45 * periBlend));
    this.s.camera.lookAt(this.lookV3);
  }

  private runCaptions(): void {
    for (const caption of this.captions) {
      if (this.lastCaptionT < caption.tS && this.missionT >= caption.tS) {
        this.s.captions.show(caption.text, 7);
      }
    }
    this.lastCaptionT = Math.max(this.lastCaptionT, this.missionT);
  }

  private updateHud(rAU: number, speedMS: number, thrustMS2: number): void {
    const speedAUYr = (speedMS * YEAR_S) / AU_M;
    const rows: [string, string][] = [
      ['MISSION TIME', formatDuration(this.missionT)],
      ['DISTANCE', formatAu(rAU)],
      ['IN KILOMETRES', formatKmFromAu(rAU)],
      ['SPEED', `${(speedMS / 1000).toFixed(1)} km/s / ${speedAUYr.toFixed(1)} AU/yr`],
      ['SAIL THRUST', thrustMS2 > 0 ? `${(thrustMS2 * 1000).toFixed(2)} mm/s^2` : 'NONE'],
      [
        'SAIL TEMP EST',
        this.missionT < this.traj.jettisonS
          ? `${sailEquilibriumTempC(rAU).toFixed(0)} C (rated ${facts.sundiver.sailSurvivalTempC} C)`
          : 'JETTISONED'
      ],
      ['LIGHT TIME TO EARTH', formatDuration(lightTimeS(auToM(rAU)))],
      ['DISPLAY SCALE', formatCompression(this.map.compressionAt(rAU))],
      [
        'CRAFT SCALE',
        this.exaggeration > 1e5
          ? 'NOT TO SCALE (marker)'
          : `${Math.round(this.exaggeration).toLocaleString('en-GB')}x (visual)`
      ]
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({
      mapLabel: this.map.label,
      compression: this.map.compressionAt(rAU),
      trueDistanceAU: rAU
    });
    this.s.timeControls.set({
      paused: this.s.timeline.paused,
      warpLabel: `${WARPS[this.warpIndex] ?? 1}X`,
      progress: this.mode === 'tour' ? this.progress() : null
    });
  }

  onPlayPause(): void {
    if (this.mode !== 'tour') return;
    if (this.s.timeline.paused) {
      if (this.progress() >= 1) {
        this.s.timeline.scrubTo(0);
        this.lastCaptionT = -1;
        this.endShown = false;
      }
      this.s.timeline.resume();
    } else {
      this.s.timeline.pause();
    }
  }

  onWarpCycle(): void {
    this.warpIndex = (this.warpIndex + 1) % WARPS.length;
    this.s.timeline.setWarp(WARPS[this.warpIndex] ?? 1);
  }

  onScrub(progress: number): void {
    this.s.timeline.scrubTo(progress * TOUR_DURATION_S);
    this.missionT = tourTimeS(this.waypoints, progress);
    this.lastCaptionT = this.missionT;
    this.endShown = progress >= 1;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // Act 3 keeps its compressed map; the true-scale toggle lives in Act 2.
  }

  private onClick(event: MouseEvent): void {
    if (this.mode !== 'explore') return;
    const rect = this.s.renderer.domElement.getBoundingClientRect();
    this.craft.group.getWorldPosition(this.scratchV3).project(this.s.camera);
    const sx = ((this.scratchV3.x + 1) / 2) * rect.width;
    const sy = ((1 - this.scratchV3.y) / 2) * rect.height;
    const d = Math.hypot(sx - (event.clientX - rect.left), sy - (event.clientY - rect.top));
    if (d > 80) {
      this.s.inspector.hide();
      return;
    }
    const s = facts.sundiver;
    this.s.inspector.show('SUNDIVER SPACECRAFT', [
      ['LAUNCH MASS', `under ${s.launchMassKg} kg`],
      ['SAIL', `${s.sailPanelCount} panels, ${s.sailTotalAreaM2.toLocaleString('en-GB')} m^2`],
      ['SAIL MASS', `${s.sailMassKg} kg`],
      ['RATED TO', `${s.sailSurvivalTempC} C`],
      ['PERIHELION', `${s.perihelionAU} AU`],
      ['EXIT SPEED', `${this.traj.exitSpeedAUYr.toFixed(1)} AU/yr (model)`],
      ['MODEL', `beta ${facts.sundiverModel.tunedLightnessBeta} (tuned)`]
    ]);
  }

  exit(): void {
    this.s.scene.remove(this.trail.group, this.craft.group);
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.chart?.el.remove();
    this.chart = null;
    this.s.captions.clear();
    this.s.inspector.hide();
  }
}
