// Act 2 - The Focal Line. Tour: exponential pullback from the Sun to the
// imaging start at 650 AU. Explore: free camera, clickable milestones,
// true-scale toggle.

import { Vector3 } from 'three';
import facts from '../data/mission-facts.json';
import targetsData from '../data/targets.json';
import { compressedMap, trueMap, type DistanceMap } from '../render/distance-map';
import { FocalRuler } from '../render/focal-ruler';
import { equatorialToEclipticDir, eclipticToScene } from '../render/frames';
import { AU_M, C } from '../sim/constants';
import { auToM, lightTimeS } from '../sim/units';
import { scale as scaleVec, vec3d, type Vec3d } from '../sim/vec3d';
import { formatAu, formatCompression, formatDuration, formatKmFromAu, formatMultipleOfC } from '../ui/format';
import type { Act, ActMode, ActServices } from './act';
import { buildCaptionEvents, END_CAPTION, INTRO_CAPTION, TOUR_DURATION_S, tourDistanceAU } from './act2-tour';

const COMPRESSION_D0_AU = 2;
const WARPS = [0.5, 1, 2, 4];

function antiTargetDirScene(): Vec3d {
  const proxima = targetsData.targets.find((t) => t.id === 'proxima-b');
  if (!proxima) throw new Error('proxima-b missing from targets.json');
  const dir = eclipticToScene(equatorialToEclipticDir(proxima.raDeg, proxima.decDeg));
  return vec3d(-dir.x, -dir.y, -dir.z);
}

export class Act2FocalLine implements Act {
  readonly id = 2;
  readonly title = 'THE FOCAL LINE';
  readonly question = 'Why 550 AU, and how far is that?';

  private map: DistanceMap = compressedMap(COMPRESSION_D0_AU);
  private trueScale = false;
  private mode: ActMode = 'tour';
  private readonly ruler: FocalRuler;
  private readonly dir: Vec3d;
  private readonly events = buildCaptionEvents();
  private readonly daysSinceJ2000 = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  private warpIndex = 1;
  private lastCaptionR = 0;
  private introShown = false;
  private endShown = false;
  private prevR = 0.1;
  private speedC = 0;
  private exploreR = 0.1;
  private readonly scratchVec = vec3d();
  private readonly scratchV3 = new Vector3();
  private readonly lookV3 = new Vector3();
  private readonly basisSide = new Vector3();
  private readonly basisUp = new Vector3();
  private readonly dirV3: Vector3;
  private readonly onClickBound = (event: MouseEvent) => this.onClick(event);

  constructor(private readonly s: ActServices) {
    this.dir = antiTargetDirScene();
    this.dirV3 = new Vector3(this.dir.x, this.dir.y, this.dir.z);
    this.basisSide.crossVectors(this.dirV3, new Vector3(0, 1, 0)).normalize();
    if (this.basisSide.lengthSq() < 0.5) this.basisSide.set(1, 0, 0);
    this.basisUp.crossVectors(this.basisSide, this.dirV3).normalize();
    this.ruler = new FocalRuler(facts.act2Milestones, this.dir, this.map);
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.ruler.group);
    this.s.labels.setAnchors(this.ruler.labelAnchors());
    this.s.setActHeading(`ACT 2 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.timeline.setWarp(WARPS[this.warpIndex] ?? 1);
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.introShown = false;
    this.endShown = false;
    this.lastCaptionR = 0;
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.inspector.hide();
    if (mode === 'explore') {
      this.s.timeline.pause();
      this.s.controls.target.set(0, 0, 0);
      this.exploreR = Math.max(0.02, this.prevR);
      this.s.ribbon.setToggle(true, this.trueScale);
    } else {
      this.s.captions.clear();
      this.s.ribbon.setToggle(false, this.trueScale);
      this.lastCaptionR = tourDistanceAU(this.progress());
    }
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(dtRealS: number): void {
    let trueR: number;
    if (this.mode === 'tour') {
      trueR = this.updateTour(dtRealS);
    } else {
      trueR = this.updateExplore();
    }
    this.ruler.update(this.s.origin, this.s.camera, this.daysSinceJ2000);
    this.updateHudAndRibbon(trueR);
  }

  private updateTour(dtRealS: number): number {
    const p = this.progress();
    const r = tourDistanceAU(p);

    const dtSim = this.s.timeline.paused ? 0 : dtRealS * this.s.timeline.warp;
    if (dtSim > 0) {
      this.speedC = (((r - this.prevR) / dtSim) * AU_M) / C;
      this.prevR = r;
    } else if (this.s.timeline.paused) {
      this.speedC = 0;
    }

    if (!this.introShown && this.s.timeline.seconds > 0.5) {
      this.s.captions.show(INTRO_CAPTION, 7);
      this.introShown = true;
    }
    for (const event of this.events) {
      if (this.lastCaptionR < event.au && r >= event.au) {
        this.s.captions.show(event.text, 7);
      }
    }
    this.lastCaptionR = Math.max(this.lastCaptionR, r);
    if (p >= 1 && !this.endShown) {
      this.s.captions.show(END_CAPTION, 10);
      this.endShown = true;
      this.s.timeline.pause();
    }

    // Camera: origin rides the focus point on the ruler
    const displayR = this.map.toDisplay(r);
    scaleVec(this.scratchVec, this.dir, displayR);
    this.s.origin.setOrigin(this.scratchVec);

    // Side-on composition: camera ahead of and beside the focus, looking
    // back along the ruler so the Sun stays in frame and visibly shrinks.
    const theta = 0.85 + 0.35 * p;
    const viewDist = 0.05 + displayR * 0.85;
    this.scratchV3
      .copy(this.basisSide)
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(this.basisUp, Math.sin(theta))
      .addScaledVector(this.dirV3, 0.35)
      .normalize()
      .multiplyScalar(viewDist);
    this.s.camera.position.copy(this.scratchV3);

    // Look at a point between the Sun and the focus so both stay framed;
    // drift toward the lens milestones for the finale
    const lookEase = p < 0.72 ? 0 : Math.min(1, (p - 0.72) / 0.2);
    const lookFactor = 0.45 + 0.3 * lookEase * lookEase;
    this.lookV3.set(this.dir.x, this.dir.y, this.dir.z).multiplyScalar(displayR * lookFactor);
    this.s.origin.toScene(vec3d(this.lookV3.x, this.lookV3.y, this.lookV3.z), this.lookV3);
    this.s.camera.lookAt(this.lookV3);
    return r;
  }

  private updateExplore(): number {
    // The camera has no honest physical position in a compressed display;
    // report the true distance of the orbit focus instead.
    const o = this.s.origin.originDisplayAU;
    const t = this.s.controls.target;
    const displayR = Math.hypot(o.x + t.x, o.y + t.y, o.z + t.z);
    this.exploreR = this.map.fromDisplay(displayR);
    this.speedC = 0;
    return this.exploreR;
  }

  private updateHudAndRibbon(trueR: number): void {
    const rows: [string, string][] = [
      ['ELAPSED', formatDuration(this.s.timeline.seconds)],
      [this.mode === 'tour' ? 'RULER DISTANCE' : 'FOCUS DISTANCE', formatAu(trueR)],
      ['IN KILOMETRES', formatKmFromAu(trueR)],
      ['LIGHT TIME TO EARTH', formatDuration(lightTimeS(auToM(trueR)))],
      ['TOUR SPEED', this.mode === 'tour' ? formatMultipleOfC(Math.max(0, this.speedC)) : 'FREE CAMERA'],
      ['DISPLAY SCALE', formatCompression(this.map.compressionAt(trueR))]
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({
      mapLabel: this.map.label,
      compression: this.map.compressionAt(trueR),
      trueDistanceAU: trueR
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
        this.lastCaptionR = 0;
        this.prevR = tourDistanceAU(0);
        this.introShown = false;
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
    const r = tourDistanceAU(progress);
    this.lastCaptionR = r;
    this.prevR = r;
    this.endShown = progress >= 1;
    this.introShown = true;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    if (this.mode !== 'explore') return;
    const rFocus = this.map.fromDisplay(
      Math.hypot(
        this.s.origin.originDisplayAU.x,
        this.s.origin.originDisplayAU.y,
        this.s.origin.originDisplayAU.z
      )
    );
    const oldDisplay = this.map.toDisplay(Math.max(rFocus, 0.02));
    this.trueScale = !this.trueScale;
    this.map = this.trueScale ? trueMap : compressedMap(COMPRESSION_D0_AU);
    this.ruler.setMap(this.map);
    this.s.labels.setAnchors(this.ruler.labelAnchors());
    const newDisplay = this.map.toDisplay(Math.max(rFocus, 0.02));
    scaleVec(this.scratchVec, this.dir, newDisplay);
    this.s.origin.setOrigin(this.scratchVec);
    const ratio = newDisplay / Math.max(oldDisplay, 1e-9);
    this.s.camera.position.multiplyScalar(ratio);
    this.s.controls.target.set(0, 0, 0);
    this.s.ribbon.setToggle(true, this.trueScale);
  }

  private onClick(event: MouseEvent): void {
    if (this.mode !== 'explore') return;
    // Markers are a few pixels wide; pick the nearest one in screen space.
    const rect = this.s.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let target: ReturnType<FocalRuler['clickTargets']>[number] | undefined;
    let best = 24; // px tolerance
    for (const candidate of this.ruler.clickTargets()) {
      candidate.object.getWorldPosition(this.scratchV3).project(this.s.camera);
      if (this.scratchV3.z > 1) continue;
      const sx = ((this.scratchV3.x + 1) / 2) * rect.width;
      const sy = ((1 - this.scratchV3.y) / 2) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < best) {
        best = d;
        target = candidate;
      }
    }
    if (!target) {
      this.s.inspector.hide();
      return;
    }
    const milestone = facts.act2Milestones.find((m) => m.label === target.title);
    const au = milestone ? milestone.au : 0;
    this.s.inspector.show(target.title.toUpperCase(), [
      ['TRUE DISTANCE', formatAu(au)],
      ['IN KILOMETRES', formatKmFromAu(au)],
      ['LIGHT TIME FROM SUN', formatDuration(lightTimeS(auToM(au)))]
    ]);
  }

  exit(): void {
    this.s.scene.remove(this.ruler.group);
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.inspector.hide();
  }
}
