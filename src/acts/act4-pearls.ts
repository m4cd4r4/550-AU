// Act 4 - The String of Pearls. Tour: three decades of yearly launches
// marching out along Proxima b's focal line, the lead pearl turning
// operational at 650 AU and the laser relay coming alive. Explore: free
// camera; click a pearl to inspect the six-CubeSat cluster and the
// assembled telescope; click again to toggle the exploded view.

import { Mesh, Vector3 } from 'three';
import facts from '../data/mission-facts.json';
import targetsData from '../data/targets.json';
import { compressedMap, mapPosition } from '../render/distance-map';
import type { LabelAnchor } from '../render/focal-ruler';
import { eclipticToScene, focalLineDirScene } from '../render/frames';
import { LaserRelay } from '../render/laser-relay';
import { CUBESAT_ROLES, PearlModel } from '../render/pearl-models';
import { PearlString } from '../render/pearl-string';
import { planetMesh } from '../render/planet-textures';
import { PLANETS, planetPositionAU } from '../sim/orbits';
import { pearlStringAt, cruiseSpacingAU, type PearlState } from '../sim/pearls';
import { integrateSundiver } from '../sim/sundiver';
import { auToM, lightTimeS } from '../sim/units';
import { copy, vec3d, type Vec3d } from '../sim/vec3d';
import { formatAu, formatCompression, formatDuration } from '../ui/format';
import type { Act, ActMode, ActServices } from './act';
import { buildCaptions, END_CAPTION, TOUR_DURATION_S, tourYears, voyagerLoupeAt } from './act4-tour';

const COMPRESSION_D0_AU = 2;
const EARTH = PLANETS.find((p) => p.name === 'Earth');
const VOYAGER_IMG = `${import.meta.env.BASE_URL}assets/renders/voyager.jpg`;

function proximaDir(): Vec3d {
  const proxima = targetsData.targets.find((t) => t.id === 'proxima-b');
  if (!proxima) throw new Error('proxima-b missing from targets.json');
  return focalLineDirScene(proxima.raDeg, proxima.decDeg);
}

export class Act4Pearls implements Act {
  readonly id = 4;
  readonly title = 'STRING OF PEARLS';
  readonly question = 'Why hundreds of spacecraft?';

  private readonly map = compressedMap(COMPRESSION_D0_AU);
  private readonly traj = integrateSundiver();
  private readonly dir = proximaDir();
  private readonly string = new PearlString(this.dir);
  private readonly relay = new LaserRelay();
  private readonly detail = new PearlModel();
  private readonly earthMarker: Mesh;
  private readonly captions = buildCaptions(this.traj);
  private readonly daysSinceJ2000 = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;

  private mode: ActMode = 'tour';
  private missionYears = 0;
  private lastComputedYears = -1;
  private lastCaptionYears = -1;
  private endShown = false;
  private pearls: PearlState[] = [];
  private detailIndex = -1;
  private explodeTarget = 0;
  private readonly earthDisplay = vec3d();
  private readonly roleAnchors: LabelAnchor[] = CUBESAT_ROLES.map((r) => ({
    text: r.role,
    displayPos: vec3d(),
    accent: false
  }));
  private readonly focusDisplay = vec3d();
  private readonly scratchV3 = new Vector3();
  private readonly lookV3 = new Vector3();
  private readonly sideV3 = new Vector3();
  private readonly dirV3: Vector3;
  private readonly onClickBound = (event: MouseEvent) => this.onClick(event);

  constructor(private readonly s: ActServices) {
    this.dirV3 = new Vector3(this.dir.x, this.dir.y, this.dir.z);
    this.earthMarker = planetMesh('Earth');
    this.detail.group.visible = false;
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.string.group, this.relay.group, this.detail.group, this.earthMarker);
    this.s.setActHeading(`ACT 4 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.lastCaptionYears = -1;
    this.lastComputedYears = -1;
    this.endShown = false;
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.inspector.hide();
    this.s.ribbon.setToggle(false, false);
    this.closeDetail();
    if (mode === 'explore') {
      this.s.timeline.pause();
      // Re-anchor on the current lead pearl: a scrub immediately before the
      // switch may not have had a tour frame to move the origin yet.
      this.recompute();
      this.anchorExploreCamera();
      this.s.controls.target.set(0, 0, 0);
    } else {
      this.s.captions.clear();
      this.lastCaptionYears = this.missionYears;
    }
  }

  // Park the camera beside the string, mid-way vantage on the lead pearl.
  private anchorExploreCamera(): void {
    const lead = this.pearls[0];
    const leadDisplay = this.map.toDisplay(Math.max(lead ? lead.rAU : 0.5, 0.5));
    copy(this.focusDisplay, this.dir);
    this.focusDisplay.x *= leadDisplay * 0.9;
    this.focusDisplay.y *= leadDisplay * 0.9;
    this.focusDisplay.z *= leadDisplay * 0.9;
    this.s.origin.setOrigin(this.focusDisplay);
    const side = this.sideV3.crossVectors(this.dirV3, this.s.camera.up).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    this.s.camera.position
      .copy(side)
      .multiplyScalar(0.8)
      .addScaledVector(this.s.camera.up, 0.35)
      .addScaledVector(this.dirV3, 0.2)
      .normalize()
      .multiplyScalar(0.12 + leadDisplay * 0.28);
    this.s.camera.lookAt(0, 0, 0);
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(dtRealS: number): void {
    const p = this.progress();
    if (this.mode === 'tour') {
      this.missionYears = tourYears(p);
      this.runCaptions();
      if (p >= 1 && !this.endShown) {
        this.s.captions.show(END_CAPTION, 10);
        this.endShown = true;
        this.s.timeline.pause();
      }
    }

    // Recompute whenever the clock moved so pearls track time smoothly; the
    // old throttle sampled coarsely and caused the stutter, worst at high warp.
    if (this.missionYears !== this.lastComputedYears) this.recompute();

    if (this.mode === 'tour') this.placeTourCamera(p);
    this.string.update(this.s.origin, this.s.camera);
    this.updateEarthMarker();
    this.updateDetail(dtRealS);
    const camDist = this.s.camera.position.length();
    this.relay.update(dtRealS, this.s.origin, Math.max(0.002, camDist * 0.012));
    this.updateHud();
    this.updateVoyagerLoupe();
  }

  // As the lead pearl overtakes the Voyagers, magnify the craft it is passing.
  private updateVoyagerLoupe(): void {
    const lead = this.pearls[0];
    const label = this.mode === 'tour' ? voyagerLoupeAt(lead ? lead.rAU : 0) : null;
    if (label) this.s.loupe.show(VOYAGER_IMG, label.title, label.sub);
    else this.s.loupe.hide();
  }

  // Rebuild pearl states and dependent structures. Runs each frame the clock
  // advances (cheap); the DOM label refresh below stays gated to launch count.
  private recompute(): void {
    this.lastComputedYears = this.missionYears;
    const hadCount = this.pearls.length;
    this.pearls = pearlStringAt(this.missionYears, this.traj);
    this.string.setPearls(this.pearls, this.map);

    const earthEcliptic = EARTH
      ? planetPositionAU(EARTH, this.daysSinceJ2000 + this.missionYears * 365.25)
      : vec3d(1, 0, 0);
    mapPosition(this.map, eclipticToScene(earthEcliptic), this.earthDisplay);

    const hasOperating = this.pearls.some((pearl) => pearl.phase === 'operating');
    if (hasOperating) {
      const chain: Vec3d[] = [];
      for (let i = 0; i < this.pearls.length; i++) {
        const pearl = this.pearls[i];
        const pos = this.string.displayPosOf(i);
        if (pearl && pos && pearl.phase !== 'diving') chain.push(pos);
      }
      chain.push(this.earthDisplay);
      this.relay.setChain(chain);
    } else {
      this.relay.setChain([]);
    }

    if (this.pearls.length !== hadCount || this.detailIndex >= 0) {
      this.refreshLabels();
    }
  }

  private refreshLabels(): void {
    const anchors = this.string.labelAnchors();
    anchors.push({ text: 'EARTH', displayPos: this.earthDisplay, accent: false });
    if (this.detailIndex >= 0 && this.explodeTarget > 0.5) {
      anchors.push(...this.roleAnchors);
    }
    this.s.labels.setAnchors(anchors);
  }

  private placeTourCamera(p: number): void {
    // Ride just behind the lead pearl; the string recedes sunward behind it.
    const lead = this.pearls[0];
    const leadDisplay = this.map.toDisplay(Math.max(lead ? lead.rAU : 0.5, 0.5));
    const focusR = leadDisplay * (0.85 - 0.1 * Math.sin(p * 2.2));
    copy(this.focusDisplay, this.dir);
    this.focusDisplay.x *= focusR;
    this.focusDisplay.y *= focusR;
    this.focusDisplay.z *= focusR;
    this.s.origin.setOrigin(this.focusDisplay);

    const side = this.sideV3.crossVectors(this.dirV3, this.s.camera.up).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const dist = 0.08 + leadDisplay * 0.32;
    const swing = 0.7 + 0.9 * p;
    this.s.camera.position
      .copy(side)
      .multiplyScalar(Math.cos(swing))
      .addScaledVector(this.s.camera.up, 0.42)
      .addScaledVector(this.dirV3, 0.45 * Math.sin(swing) + 0.25)
      .normalize()
      .multiplyScalar(dist);

    // Look back down the string toward the Sun so the chain reads.
    this.lookV3.copy(this.dirV3).multiplyScalar(-focusR * 0.3);
    this.s.camera.lookAt(this.lookV3);
  }

  private updateEarthMarker(): void {
    this.s.origin.toScene(this.earthDisplay, this.scratchV3);
    this.earthMarker.position.copy(this.scratchV3);
    const distance = this.scratchV3.distanceTo(this.s.camera.position);
    this.earthMarker.scale.setScalar(distance * 0.003);
  }

  private updateDetail(dtRealS: number): void {
    if (this.detailIndex < 0) return;
    const pos = this.string.displayPosOf(this.detailIndex);
    if (!pos) {
      this.closeDetail();
      return;
    }
    this.s.origin.toScene(pos, this.scratchV3);
    this.detail.group.position.copy(this.scratchV3);
    const camDist = this.scratchV3.distanceTo(this.s.camera.position);
    const scale = (camDist * 0.16) / PearlModel.SPAN_M;
    this.detail.group.scale.setScalar(scale);
    const ease = Math.min(1, dtRealS * 3);
    this.detail.setExplode(this.detail.explode + (this.explodeTarget - this.detail.explode) * ease);
    // The sail is only aboard while the pearl is diving; gone once cruising.
    this.detail.setSailShown(this.string.pearlAt(this.detailIndex)?.phase === 'diving');

    // Role labels track the CubeSats through the explode animation.
    for (let i = 0; i < this.roleAnchors.length; i++) {
      const anchor = this.roleAnchors[i];
      if (!anchor) continue;
      this.detail.cubesatWorldPos(i, this.lookV3);
      anchor.displayPos.x = this.s.origin.originDisplayAU.x + this.lookV3.x;
      anchor.displayPos.y = this.s.origin.originDisplayAU.y + this.lookV3.y;
      anchor.displayPos.z = this.s.origin.originDisplayAU.z + this.lookV3.z;
    }
  }

  private runCaptions(): void {
    for (const caption of this.captions) {
      if (this.lastCaptionYears < caption.years && this.missionYears >= caption.years) {
        this.s.captions.show(caption.text, 7);
      }
    }
    this.lastCaptionYears = Math.max(this.lastCaptionYears, this.missionYears);
  }

  private updateHud(): void {
    const lead = this.pearls[0];
    const operating = this.pearls.filter((pearl) => pearl.phase === 'operating').length;
    const leadR = lead ? lead.rAU : 0;
    const rows: [string, string][] = [
      ['MISSION TIME', `${this.missionYears.toFixed(1)} yr`],
      ['PEARLS LAUNCHED', `${this.pearls.length}`],
      ['LEAD PEARL', formatAu(leadR)],
      ['OPERATING', operating > 0 ? `${operating} (past 650 AU)` : 'NONE YET'],
      ['STRING SPACING', `${cruiseSpacingAU(this.traj).toFixed(1)} AU per launch`],
      [
        'DOWNLINK PER IMAGE',
        `${facts.pearls.downlinkTransmitHours} h transmit + ${facts.pearls.lightTimeOneWayDaysAt550AU} d light`
      ],
      ['LIGHT TIME TO EARTH', formatDuration(lightTimeS(auToM(leadR)))],
      ['DISPLAY SCALE', formatCompression(this.map.compressionAt(Math.max(leadR, 0.1)))]
    ];
    this.s.hud.setRows(rows);
    this.s.ribbon.set({
      mapLabel: this.map.label,
      compression: this.map.compressionAt(Math.max(leadR, 0.1)),
      trueDistanceAU: leadR
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
        this.lastCaptionYears = -1;
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
    this.missionYears = tourYears(progress);
    this.lastCaptionYears = this.missionYears;
    this.endShown = progress >= 1;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // Act 4's teaching is the cadence; the true-scale toggle lives in Act 2.
  }

  private onClick(event: MouseEvent): void {
    if (this.mode !== 'explore') return;
    const rect = this.s.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = 26;
    let picked = -1;
    for (let i = 0; i < this.string.pearlCount(); i++) {
      const pos = this.string.displayPosOf(i);
      if (!pos) continue;
      this.s.origin.toScene(pos, this.scratchV3).project(this.s.camera);
      if (this.scratchV3.z > 1) continue;
      const sx = ((this.scratchV3.x + 1) / 2) * rect.width;
      const sy = ((1 - this.scratchV3.y) / 2) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < best) {
        best = d;
        picked = i;
      }
    }
    if (picked < 0) {
      this.closeDetail();
      this.s.inspector.hide();
      return;
    }
    if (picked === this.detailIndex) {
      this.explodeTarget = this.explodeTarget > 0.5 ? 0 : 1;
    } else {
      this.detailIndex = picked;
      this.explodeTarget = 0;
      this.detail.group.visible = true;
      this.string.markerOf(picked)!.visible = false;
    }
    this.refreshLabels();
    const pearl = this.string.pearlAt(picked);
    if (!pearl) return;
    this.s.inspector.show(`PEARL ${pearl.index + 1}`, [
      ['LAUNCHED', `mission year ${pearl.launchYear}`],
      ['DISTANCE', formatAu(pearl.rAU)],
      ['PHASE', pearl.phase.toUpperCase()],
      ['CARRIES', `${facts.pearls.cubesatsPerLaunch} CubeSats, self-assembling`],
      ['TELESCOPE', `${facts.pearls.telescopeApertureM} m aperture`],
      ['ROLES', CUBESAT_ROLES.map((r) => r.role.split(' ')[0]).join(', ') ?? ''],
      ['CLICK AGAIN', this.explodeTarget > 0.5 ? 'ASSEMBLE' : 'EXPLODE VIEW']
    ]);
  }

  private closeDetail(): void {
    if (this.detailIndex >= 0) {
      const marker = this.string.markerOf(this.detailIndex);
      if (marker) marker.visible = true;
    }
    this.detailIndex = -1;
    this.explodeTarget = 0;
    this.detail.group.visible = false;
    this.detail.setExplode(0);
  }

  exit(): void {
    this.s.scene.remove(this.string.group, this.relay.group, this.detail.group, this.earthMarker);
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.closeDetail();
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.inspector.hide();
    this.s.loupe.hide();
  }
}
