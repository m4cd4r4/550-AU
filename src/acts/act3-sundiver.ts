// Act 3 - The Sundiver. Tour: ride the integrated trajectory from launch
// through the perihelion slingshot to the minimum focus, with the sail
// deploying, snapping face-on, and jettisoning at year 2. Explore: free
// camera around the craft, clickable for a data card.

import { BufferAttribute, BufferGeometry, Points, PointsMaterial, Vector3 } from 'three';
import facts from '../data/mission-facts.json';
import { compressedMap, mapPosition } from '../render/distance-map';
import type { LabelAnchor } from '../render/focal-ruler';
import { eclipticToScene } from '../render/frames';
import { MotionStreaks } from '../render/motion-streaks';
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
// Fraction of the camera distance the craft spans: the sail while it is
// attached, larger through the perihelion close-up, and the bare bus after.
const CRAFT_ANGULAR_SIZE = 0.16;
const CRAFT_ANGULAR_SIZE_PERIHELION = 0.3;
const CRAFT_ANGULAR_SIZE_BUS = 0.075;
const PERIHELION_CLOSEUP_DAYS = 22;
const VOYAGER_IMG = `${import.meta.env.BASE_URL}assets/renders/voyager.jpg`;

// Distances the craft passes on the way out, marked on the trail where the
// integrated path crosses them. Values come from the Act 2 ruler.
const PASSED: { match: string; text: (au: number) => string; accent: boolean }[] = [
  { match: 'Jupiter', text: (au) => `JUPITER'S ORBIT ${au.toFixed(1)} AU`, accent: false },
  { match: 'Neptune', text: (au) => `NEPTUNE'S ORBIT ${au.toFixed(0)} AU`, accent: false },
  { match: 'Heliopause', text: (au) => `HELIOPAUSE ${au} AU`, accent: false },
  { match: 'Voyager 1', text: (au) => `AS FAR AS VOYAGER 1: ${au} AU`, accent: true },
  { match: 'Minimum focus', text: (au) => `MINIMUM FOCUS ${au} AU`, accent: true }
];

interface Milestone {
  au: number;
  anchor: LabelAnchor;
}

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
  private readonly streaks = new MotionStreaks();
  private readonly milestones: Milestone[] = [];
  private readonly milestonePoints: Points;
  private readonly peakSpeedMS: number;
  private readonly peakTempC: number;
  private readonly velocityV3 = new Vector3();
  private readonly closeLookV3 = new Vector3();
  private chart: RaceChart | null = null;
  private mode: ActMode = 'tour';
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
    const peri = this.traj.at(this.traj.perihelionS);
    this.peakSpeedMS = peri.speedMS;
    this.peakTempC = sailEquilibriumTempC(peri.rAU);

    for (const passed of PASSED) {
      const row = facts.act2Milestones.find((m) => m.label === passed.match);
      const tS = row ? this.traj.timeToAU(row.au) : NaN;
      if (!row || !Number.isFinite(tS)) continue;
      const at = this.traj.at(tS);
      const displayPos = mapPosition(this.map, eclipticToScene(vec3d(at.xAU, at.yAU, 0)), vec3d());
      this.milestones.push({
        au: row.au,
        anchor: { text: passed.text(row.au), displayPos, accent: passed.accent, nudge: true, opacity: 0 }
      });
    }
    const geometry = new BufferGeometry();
    const n = this.milestones.length;
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
    this.milestonePoints = new Points(
      geometry,
      new PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true })
    );
    this.milestonePoints.frustumCulled = false;
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.trail.group, this.craft.group, this.streaks.object, this.milestonePoints);
    this.s.labels.setAnchors(this.milestones.map((m) => m.anchor));
    this.s.setActHeading(`ACT 3 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.chart = new RaceChart(this.s.hud.stack, this.traj.samples);
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

  update(dtRealS: number): void {
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
    // The film glows as the estimated temperature climbs toward its peak.
    const heat = (sailEquilibriumTempC(r) - 60) / (this.peakTempC - 60);
    this.craft.setHeat(heat > 0 ? Math.pow(heat, 1.6) : 0);

    // Craft visual scale: never below true scale, exaggerated for visibility.
    // The angular reference span eases to the bus once the sail is gone.
    const camDist = this.s.camera.position.distanceTo(this.craft.group.position);
    const trueScale = 1 / AU_M; // metres to AU
    const sailGone = Math.min(1, Math.max(0, sinceJettison / (240 * 3600)));
    const angular =
      CRAFT_ANGULAR_SIZE +
      (CRAFT_ANGULAR_SIZE_PERIHELION - CRAFT_ANGULAR_SIZE) * this.perihelionCloseness() +
      (CRAFT_ANGULAR_SIZE_BUS - CRAFT_ANGULAR_SIZE) * sailGone;
    // A portrait frame is narrower than the sail is wide at these sizes.
    const fit = Math.min(1, this.s.camera.aspect * 1.5);
    const visScale = (camDist * angular * fit) / this.craft.spanM;
    const scale = Math.max(trueScale, visScale);
    this.craft.group.scale.setScalar(scale);
    this.exaggeration = scale / trueScale;

    this.trail.update(this.s.origin, this.missionT, this.craft.group.position);
    this.updateStreaks(dtRealS, state.speedMS, camDist);
    this.updateMilestones(state.rAU);
    this.updateVoyagerLoupe(state.rAU);
    this.chart?.draw(this.missionT);
    this.updateHud(state.rAU, state.speedMS, state.thrustMS2);
  }

  // 1 at perihelion, easing to 0 a few weeks either side.
  private perihelionCloseness(): number {
    const f = 1 - Math.abs(this.missionT - this.traj.perihelionS) / (PERIHELION_CLOSEUP_DAYS * DAY_S);
    return f <= 0 ? 0 : f * f * (3 - 2 * f);
  }

  // Streaks flow against the direction of travel, scaled by speed. Tour only.
  private updateStreaks(dtRealS: number, speedMS: number, camDist: number): void {
    const a = this.traj.at(this.missionT);
    const b = this.traj.at(this.missionT + 600);
    const step = eclipticToScene(vec3d(b.xAU - a.xAU, b.yAU - a.yAU, 0));
    this.velocityV3.set(step.x, step.y, step.z);
    const moving = this.velocityV3.lengthSq() > 0 && this.mode === 'tour' && !this.s.timeline.paused;
    if (moving) this.velocityV3.normalize();
    const strength = moving ? Math.pow(speedMS / this.peakSpeedMS, 1.5) : 0;
    this.streaks.update(dtRealS, this.craft.group.position, this.velocityV3, strength, camDist * 1.1);
  }

  // A marker and its label fade in as the craft closes on each distance, so
  // none of them floats across the perihelion close-up.
  private updateMilestones(rAU: number): void {
    const positions = this.milestonePoints.geometry.getAttribute('position');
    const colours = this.milestonePoints.geometry.getAttribute('color');
    const outbound = this.missionT > this.traj.perihelionS + 30 * DAY_S || this.mode === 'explore';
    for (let i = 0; i < this.milestones.length; i++) {
      const m = this.milestones[i];
      if (!m) continue;
      const alpha = outbound ? Math.min(1, Math.max(0, (rAU / m.au - 0.25) / 0.2)) : 0;
      m.anchor.opacity = alpha;
      this.s.origin.toScene(m.anchor.displayPos, this.scratchV3);
      positions.setXYZ(i, this.scratchV3.x, this.scratchV3.y, this.scratchV3.z);
      // Amber once passed, cool grey while still ahead.
      const passed = rAU >= m.au;
      colours.setXYZ(i, alpha * (passed ? 1 : 0.62), alpha * (passed ? 0.69 : 0.68), alpha * (passed ? 0 : 0.75));
    }
    positions.needsUpdate = true;
    colours.needsUpdate = true;
  }

  // The caption says Voyager 1 is overtaken, so show the craft being passed.
  private updateVoyagerLoupe(rAU: number): void {
    const v = facts.voyager1;
    if (this.mode === 'tour' && rAU > v.distanceAU - 70 && rAU < v.distanceAU + 110) {
      const ratio = Math.round(this.traj.exitSpeedAUYr / v.speedAUYr);
      this.s.loupe.show(
        VOYAGER_IMG,
        'VOYAGER 1',
        `${v.distanceAU} AU out after ${v.yearsInFlight} years. The sundiver is ${ratio} times faster`
      );
    } else {
      this.s.loupe.hide();
    }
  }

  private placeTourCamera(p: number, displayR: number): void {
    // Hero framing: camera anti-sunward of the craft, looking sunward past
    // it, so the Sun looms through perihelion and recedes to a point during
    // the cruise. During the fall the camera swings out to the side, because
    // a feathered sail seen from behind is an edge-on sliver; from the side
    // it is the full 500 m of film. Close early, pulling back through the
    // cruise so the trail stays in frame.
    const closeDist = 6e-4;
    const cruiseDist = 0.06 + displayR * 0.55;
    const cruiseBlend = Math.min(1, Math.max(0, (p - 0.5) / 0.28));
    const unfurled = Math.min(1, Math.max(0, (this.missionT - 2 * DAY_S) / (10 * DAY_S)));
    const faceOn = Math.min(1, Math.max(0, (this.missionT - this.traj.perihelionS) / (2 * DAY_S)));
    const sideSwing = (0.6 * unfurled + (0.3 - 0.6 * unfurled) * faceOn) * (1 - cruiseBlend);
    const dist = closeDist + (cruiseDist - closeDist) * cruiseBlend * cruiseBlend;

    const sunDir = this.scratchV3.copy(this.sunScene).normalize();
    const side = this.sideV3.crossVectors(sunDir, this.s.camera.up).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const lift = this.liftV3.crossVectors(side, sunDir).normalize();

    // A gentle drift keeps the shot alive without swinging the trajectory
    // line around the craft; the earlier amplitude read as a wobble.
    const wobble = 0.8 + 0.4 * p;
    this.s.camera.position
      .copy(sunDir)
      .multiplyScalar(-0.8)
      .addScaledVector(side, 0.16 * Math.cos(wobble) + sideSwing)
      .addScaledVector(lift, 0.28 + 0.05 * Math.sin(wobble * 1.3))
      .normalize()
      .multiplyScalar(dist);

    // Aim between the craft and the Sun; sun-weighted through perihelion.
    const periBlend = 1 - Math.min(1, Math.abs(this.missionT - this.traj.perihelionS) / (40 * DAY_S));
    this.lookV3.copy(sunDir).multiplyScalar(dist * (0.35 + 0.45 * periBlend));
    // In the close-up, aim between the craft and the Sun instead, weighted
    // sunward so both sit in the clear area left of the readouts. A portrait
    // frame is too narrow for both, so it stays on the craft.
    const portrait = this.s.camera.aspect < 1;
    this.closeLookV3
      .copy(this.s.camera.position)
      .normalize()
      .multiplyScalar(portrait ? -0.78 : -0.42)
      .addScaledVector(sunDir, portrait ? 0.22 : 0.58)
      .normalize()
      .multiplyScalar(dist)
      .add(this.s.camera.position);
    this.lookV3.lerp(this.closeLookV3, 1 - cruiseBlend);
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
      warpLabel: this.s.timeline.warpLabel,
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
    this.s.timeline.cycleWarp();
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
    this.s.scene.remove(this.trail.group, this.craft.group, this.streaks.object, this.milestonePoints);
    this.s.labels.setAnchors([]);
    this.s.loupe.hide();
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.chart?.el.remove();
    this.chart = null;
    this.s.captions.clear();
    this.s.inspector.hide();
  }
}
