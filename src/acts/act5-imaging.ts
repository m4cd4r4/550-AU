// Act 5 - Imaging the Ring. The payoff: first-person Einstein ring at true
// angular scale (the slice 2 shader integrated into the app), then the
// third-person image cylinder with four telescopes rastering cell to cell,
// a corona-reference subtraction beat, the ring degrading to arcs off-axis,
// and the reconstruction panel building the map. The cylinder view is a
// local frame (the 32 km cylinder drawn kilometres-scaled) and says so.

import { Mesh, PlaneGeometry, Texture, TextureLoader, Vector3 } from 'three';
import facts from '../data/mission-facts.json';
import targetsData from '../data/targets.json';
import { CylinderGrid } from '../render/cylinder-grid';
import { createExoplanetCanvas, createExoplanetTexture } from '../render/exoplanet-texture';
import type { LabelAnchor } from '../render/focal-ruler';
import { focalLineDirScene } from '../render/frames';
import { createLensMaterial } from '../render/lens-shader';
import { einsteinRingRad, solarAngularRadiusRad } from '../sim/lensing';
import { auToM, radToArcsec } from '../sim/units';
import { vec3d, type Vec3d } from '../sim/vec3d';
import { ReconPanel } from '../ui/recon-panel';
import { J2_EFFECTIVE } from '../spike/spike-controls';
import type { Act, ActMode, ActServices } from './act';
import {
  beatAt,
  buildCaptions,
  END_CAPTION,
  j2On,
  ringFovArcsec,
  scanFraction,
  scanMonths,
  sourceOffsetArcsec,
  SUBTRACTION_AT_S,
  TOUR_DURATION_S,
  type Act5View
} from './act5-tour';

const Z_AU = facts.lens.usefulImagingStartAU;
const KM_TO_SCENE = 1 / 40; // local frame: 40 km per scene unit, declared
const ACT_BLOOM = 0.4;
const APP_BLOOM = 0.85;

export class Act5Imaging implements Act {
  readonly id = 5;
  readonly title = 'IMAGING THE RING';
  readonly question = 'How does a ring become a map?';

  private readonly dir = proximaDir();
  private readonly dirV3: Vector3;
  private readonly anchorDisplay: Vec3d;
  private readonly lensMaterial = createLensMaterial();
  private readonly lensQuad: Mesh;
  private readonly cylinder = new CylinderGrid(facts.imageCylinder.proximaBDiameterAt650AUKm);
  private recon: ReconPanel | null = null;
  private readonly captions = buildCaptions();
  private readonly labelAnchors: LabelAnchor[];

  private mode: ActMode = 'tour';
  private tourT = 0;
  private view: Act5View = 'ring';
  private lastCaptionT = -1;
  private endShown = false;
  private readonly scratchV3 = new Vector3();
  private readonly sideV3 = new Vector3();
  private readonly liftV3 = new Vector3();
  private readonly onClickBound = (event: MouseEvent) => this.onClick(event);

  constructor(private readonly s: ActServices) {
    this.dirV3 = new Vector3(this.dir.x, this.dir.y, this.dir.z);
    this.anchorDisplay = vec3d(this.dir.x * Z_AU, this.dir.y * Z_AU, this.dir.z * Z_AU);

    this.lensQuad = new Mesh(new PlaneGeometry(2, 2), this.lensMaterial);
    this.lensQuad.frustumCulled = false;
    this.lensQuad.renderOrder = 9999;
    this.lensQuad.visible = false;

    const zM = auToM(Z_AU);
    this.lensMaterial.uniforms.uThetaE.value = radToArcsec(einsteinRingRad(zM));
    this.lensMaterial.uniforms.uThetaSun.value = radToArcsec(solarAngularRadiusRad(zM));
    this.lensMaterial.uniforms.uSrcTex.value = createExoplanetTexture();
    new TextureLoader().load(
      `${import.meta.env.BASE_URL}assets/textures/corona-lasco-c2.jpg`,
      (texture: Texture) => {
        this.lensMaterial.uniforms.uCorona.value = texture;
        this.lensMaterial.uniforms.uHasCorona.value = 1;
      },
      undefined,
      () => {
        this.lensMaterial.uniforms.uHasCorona.value = 0;
      }
    );

    this.cylinder.group.scale.setScalar(KM_TO_SCENE);
    this.cylinder.group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), this.dirV3);

    this.labelAnchors = [
      {
        text: `IMAGE CYLINDER ${facts.imageCylinder.proximaBDiameterAt650AUKm} KM`,
        displayPos: vec3d(),
        accent: true
      },
      { text: 'CORONA REFERENCE', displayPos: vec3d(), accent: false }
    ];
  }

  enter(mode: ActMode): void {
    this.s.scene.add(this.lensQuad, this.cylinder.group);
    this.s.setActHeading(`ACT 5 / ${this.title}`, this.question);
    this.s.timeline.reset();
    this.s.setBloom(ACT_BLOOM);
    this.s.renderer.domElement.addEventListener('click', this.onClickBound);
    this.recon = new ReconPanel(this.s.hud.el.parentElement ?? document.body, createExoplanetCanvas());
    this.s.origin.setOrigin(this.anchorDisplay);
    this.lastCaptionT = -1;
    this.endShown = false;
    this.tourT = 0;
    this.setView(beatAt(0).view);
    this.setMode(mode);
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.s.controls.enabled = mode === 'explore';
    this.s.inspector.hide();
    this.s.ribbon.setToggle(false, false);
    if (mode === 'explore') {
      this.s.timeline.pause();
      this.setView('cylinder');
      this.s.controls.target.set(0, 0, 0);
      this.s.camera.position.set(1.3, 0.9, 1.7);
      this.s.camera.lookAt(0, 0, 0);
    } else {
      this.s.captions.clear();
      this.lastCaptionT = this.tourT;
    }
  }

  private setView(view: Act5View): void {
    this.view = view;
    this.lensQuad.visible = view === 'ring';
    this.cylinder.group.visible = view === 'cylinder';
    this.s.labels.setAnchors(view === 'cylinder' ? this.labelAnchors : []);
  }

  private progress(): number {
    return Math.min(1, this.s.timeline.seconds / TOUR_DURATION_S);
  }

  update(): void {
    if (this.mode === 'tour') {
      this.tourT = this.progress() * TOUR_DURATION_S;
      const beat = beatAt(this.tourT);
      if (beat.view !== this.view) this.setView(beat.view);
      this.runCaptions();
      if (this.progress() >= 1 && !this.endShown) {
        this.s.captions.show(END_CAPTION, 12);
        this.endShown = true;
        this.s.timeline.pause();
      }
    }

    this.s.origin.setOrigin(this.anchorDisplay);
    const f = scanFraction(this.tourT);
    const scan = this.cylinder.setScan(f);
    this.cylinder.group.updateMatrixWorld(true);

    if (this.view === 'ring') {
      this.updateRingView();
    } else {
      if (this.mode === 'tour') this.placeCylinderCamera();
      this.updateCylinderLabels();
    }

    const subtracted = this.tourT >= SUBTRACTION_AT_S || this.mode === 'explore';
    this.recon?.setVisible(this.view === 'cylinder' && f > 0);
    this.recon?.draw(f, subtracted, scanMonths(f));
    this.updateHud(scan.displayCell, scan.displayCells, f);
  }

  private updateRingView(): void {
    const u = this.lensMaterial.uniforms;
    this.s.renderer.getDrawingBufferSize(u.uResolution.value);
    u.uArcsecPerPx.value = ringFovArcsec(this.tourT) / u.uResolution.value.y;
    u.uBetaS.value.set(sourceOffsetArcsec(this.tourT), 0);
    u.uJ2.value = j2On(this.tourT) ? J2_EFFECTIVE : 0;
    u.uTime.value = this.tourT;
  }

  private placeCylinderCamera(): void {
    // Slow orbit around the cylinder; the end card settles face-on to the
    // disc with the Sun behind the camera shoulder.
    const t = this.tourT;
    const endBlend = Math.min(1, Math.max(0, (t - 96) / 8));
    const angle = 0.6 + t * 0.012;
    const dist = 2.1 - 0.5 * Math.min(1, Math.max(0, (t - 26) / 16));

    const side = this.sideV3.crossVectors(this.dirV3, this.s.camera.up).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const lift = this.liftV3.crossVectors(side, this.dirV3).normalize();

    this.scratchV3
      .copy(side)
      .multiplyScalar(Math.cos(angle) * (1 - endBlend))
      .addScaledVector(lift, 0.55 * Math.sin(angle) * (1 - endBlend) + 0.15 * endBlend)
      .addScaledVector(this.dirV3, 0.35 + 0.65 * endBlend)
      .normalize()
      .multiplyScalar(dist);
    this.s.camera.position.copy(this.scratchV3);
    this.s.camera.lookAt(0, 0, 0);
  }

  private updateCylinderLabels(): void {
    const edge = this.labelAnchors[0];
    if (edge) {
      const r = (facts.imageCylinder.proximaBDiameterAt650AUKm / 2) * KM_TO_SCENE;
      this.sideV3.crossVectors(this.dirV3, this.s.camera.up).normalize();
      edge.displayPos.x = this.anchorDisplay.x + this.sideV3.x * r;
      edge.displayPos.y = this.anchorDisplay.y + this.sideV3.y * r + r * 0.35;
      edge.displayPos.z = this.anchorDisplay.z + this.sideV3.z * r;
    }
    const reference = this.labelAnchors[1];
    if (reference) {
      this.cylinder.scopeWorldPos(4, this.scratchV3);
      reference.displayPos.x = this.anchorDisplay.x + this.scratchV3.x;
      reference.displayPos.y = this.anchorDisplay.y + this.scratchV3.y;
      reference.displayPos.z = this.anchorDisplay.z + this.scratchV3.z;
    }
  }

  private runCaptions(): void {
    for (const caption of this.captions) {
      if (this.lastCaptionT < caption.tS && this.tourT >= caption.tS) {
        this.s.captions.show(caption.text, 7);
      }
    }
    this.lastCaptionT = Math.max(this.lastCaptionT, this.tourT);
  }

  private updateHud(displayCell: number, displayCells: number, f: number): void {
    const lens = facts.lens;
    let rows: [string, string][];
    if (this.view === 'ring') {
      const offset = sourceOffsetArcsec(this.tourT);
      rows = [
        ['VIEWPOINT', `LEAD PEARL, ${Z_AU} AU`],
        ['EINSTEIN RING', `${this.lensMaterial.uniforms.uThetaE.value.toFixed(2)} arcsec`],
        ['SOLAR LIMB', `${this.lensMaterial.uniforms.uThetaSun.value.toFixed(2)} arcsec`],
        ['FIELD OF VIEW', `${ringFovArcsec(this.tourT).toFixed(1)} arcsec`],
        ['AMPLIFICATION', 'about 1e11 x'],
        ['SOURCE OFFSET', offset > 0 ? `${offset.toFixed(2)} arcsec off-axis` : 'ON AXIS'],
        ['J2 QUADRUPOLE', j2On(this.tourT) ? 'ON (exaggerated for visibility)' : 'OFF']
      ];
    } else {
      const trueCells = facts.imageCylinder.finalMapPixels ** 2;
      rows = [
        ['CYLINDER', `${facts.imageCylinder.proximaBDiameterAt650AUKm} km at ${Z_AU} AU`],
        ['PIXEL PITCH', `${lens.imagePixelPitchAt650AUM} m of cylinder per pixel`],
        ['SCAN', `${Math.round(f * 100)}% of pass 1`],
        ['TRUE RASTER', `${Math.floor(f * trueCells).toLocaleString('en-GB')} of ${trueCells.toLocaleString('en-GB')} cells`],
        ['GRID SHOWN', `${displayCell} of ${displayCells} cells (coarse)`],
        ['DWELL', `${facts.pearls.dwellSecondsMin} to ${facts.pearls.dwellSecondsMax} s per cell`],
        ['ELAPSED', `${scanMonths(f).toFixed(1)} months`]
      ];
    }
    this.s.hud.setRows(rows);
    this.s.ribbon.set({
      mapLabel: this.view === 'ring' ? 'ANGULAR VIEW' : 'LOCAL FRAME, KM SCALE',
      compression: 1,
      trueDistanceAU: Z_AU
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
        this.recon?.reset();
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
    const newT = progress * TOUR_DURATION_S;
    if (newT < this.tourT) this.recon?.reset();
    this.tourT = newT;
    this.lastCaptionT = this.tourT;
    this.endShown = progress >= 1;
    this.s.captions.clear();
  }

  onToggleTrueScale(): void {
    // Both Act 5 views declare their frames; the toggle lives in Act 2.
  }

  private onClick(event: MouseEvent): void {
    if (this.mode !== 'explore') return;
    const rect = this.s.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = 30;
    let picked = -1;
    for (let i = 0; i < 5; i++) {
      this.cylinder.scopeWorldPos(i, this.scratchV3).project(this.s.camera);
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
      this.s.inspector.hide();
      return;
    }
    const p = facts.pearls;
    if (picked === 4) {
      this.s.inspector.show('CORONA REFERENCE TELESCOPE', [
        ['POSITION', 'outside the image cylinder'],
        ['ROLE', 'stares at bare corona'],
        ['PURPOSE', 'its view is subtracted from the imaging four'],
        ['APERTURE', `${p.telescopeApertureM} m`]
      ]);
    } else {
      this.s.inspector.show(`IMAGING TELESCOPE ${picked + 1}`, [
        ['ROLE', 'rasters the cylinder cross-section'],
        ['POSITION HOLD', `${p.positionToleranceM} m tolerance`],
        ['DWELL', `${p.dwellSecondsMin} to ${p.dwellSecondsMax} s per cell`],
        ['APERTURE', `${p.telescopeApertureM} m`],
        ['ONE CELL', `${facts.lens.imagePixelPitchAt650AUM} m of cylinder = 1 image pixel`]
      ]);
    }
  }

  exit(): void {
    this.s.scene.remove(this.lensQuad, this.cylinder.group);
    this.s.renderer.domElement.removeEventListener('click', this.onClickBound);
    this.s.setBloom(APP_BLOOM);
    this.recon?.el.remove();
    this.recon = null;
    this.s.labels.setAnchors([]);
    this.s.captions.clear();
    this.s.inspector.hide();
  }
}

function proximaDir(): Vec3d {
  const proxima = targetsData.targets.find((t) => t.id === 'proxima-b');
  if (!proxima) throw new Error('proxima-b missing from targets.json');
  return focalLineDirScene(proxima.raDeg, proxima.decDeg);
}
