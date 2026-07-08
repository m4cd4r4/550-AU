// The pearl string renderable: one small craft glyph per launched pearl along
// the focal line, coloured by phase, drawn at a minimum angular size so the
// string reads at any zoom. Each glyph is a compact telescope (tube, aperture
// ring, sunshade) pointing anti-sunward down the flight line, with a small
// solar sail shown only while the pearl is still diving. Radii pass through
// the act's DistanceMap. The detailed 16-panel close-up lives in PearlModel.

import {
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  TorusGeometry,
  Vector3,
  type Object3D,
  type PerspectiveCamera
} from 'three';
import type { PearlState } from '../sim/pearls';
import { scale as scaleVec, vec3d, type Vec3d } from '../sim/vec3d';
import type { DistanceMap } from './distance-map';
import type { OriginFrame } from './floating-origin';
import type { LabelAnchor } from './focal-ruler';

const MAX_PEARLS = 40;
const MIN_ANGULAR = 0.0058; // marker never shrinks below this fraction of distance

// Bright phase hues so the craft stand out from the background starfield.
const PHASE_COLOURS = {
  diving: 0xffb000,
  cruise: 0xaab4c0,
  operating: 0xffd24d
} as const;

// Glyph geometries, built once and shared across all markers. Local +z is the
// flight direction (anti-sunward); the sail sits at -z, facing the Sun.
const TUBE_GEO = new CylinderGeometry(0.26, 0.26, 1.2, 10);
const RING_GEO = new TorusGeometry(0.26, 0.05, 6, 14);
const SHADE_GEO = new ConeGeometry(0.4, 0.34, 10, 1, true);
const TRUSS_GEO = new CylinderGeometry(0.03, 0.03, 1.6, 5);
const SAIL_GEO = new PlaneGeometry(0.62, 0.82);
const SAIL_MATERIAL = new MeshBasicMaterial({
  color: 0xc4c9cf,
  transparent: true,
  opacity: 0.5,
  side: DoubleSide,
  depthWrite: false
});

export class PearlString {
  readonly group = new Group();
  private readonly markers: Group[] = [];
  private readonly bodyMaterials: MeshBasicMaterial[] = [];
  private readonly sails: Group[] = [];
  private readonly displayPositions: Vec3d[] = [];
  private pearls: PearlState[] = [];
  private readonly scratch = new Vector3();

  constructor(private readonly dir: Vec3d) {
    // Orient every glyph so its local +z runs down the focal line.
    const orient = new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      new Vector3(this.dir.x, this.dir.y, this.dir.z).normalize()
    );
    for (let i = 0; i < MAX_PEARLS; i++) {
      const marker = this.buildGlyph();
      marker.quaternion.copy(orient);
      marker.visible = false;
      this.markers.push(marker);
      this.displayPositions.push(vec3d());
      this.group.add(marker);
    }
  }

  // One craft glyph: telescope body plus a stowable sail sub-group.
  private buildGlyph(): Group {
    const marker = new Group();
    const bodyMat = new MeshBasicMaterial({ color: PHASE_COLOURS.cruise });
    this.bodyMaterials.push(bodyMat);

    const tube = new Mesh(TUBE_GEO, bodyMat);
    tube.rotation.x = Math.PI / 2;
    const ring = new Mesh(RING_GEO, bodyMat);
    ring.position.z = 0.62;
    const shade = new Mesh(SHADE_GEO, bodyMat);
    shade.rotation.x = -Math.PI / 2;
    shade.position.z = 0.88;
    marker.add(tube, ring, shade);

    // Sail: a short truss with a wing panel either side, sunward of the body.
    const sail = new Group();
    sail.position.z = -0.4;
    const truss = new Mesh(TRUSS_GEO, SAIL_MATERIAL);
    truss.rotation.z = Math.PI / 2;
    sail.add(truss);
    for (let wing = -1; wing <= 1; wing += 2) {
      const panel = new Mesh(SAIL_GEO, SAIL_MATERIAL);
      panel.position.x = wing * 0.5;
      sail.add(panel);
    }
    sail.visible = false;
    marker.add(sail);
    this.sails.push(sail);
    return marker;
  }

  setPearls(pearls: PearlState[], map: DistanceMap): void {
    this.pearls = pearls.slice(0, MAX_PEARLS);
    for (let i = 0; i < MAX_PEARLS; i++) {
      const marker = this.markers[i];
      const pearl = this.pearls[i];
      if (!marker) continue;
      if (!pearl) {
        marker.visible = false;
        continue;
      }
      marker.visible = true;
      const pos = this.displayPositions[i];
      if (pos) scaleVec(pos, this.dir, map.toDisplay(pearl.rAU));
      this.bodyMaterials[i]?.color.setHex(PHASE_COLOURS[pearl.phase]);
      const sail = this.sails[i];
      if (sail) sail.visible = pearl.phase === 'diving';
    }
  }

  update(origin: OriginFrame, camera: PerspectiveCamera): void {
    for (let i = 0; i < this.pearls.length; i++) {
      const marker = this.markers[i];
      const pos = this.displayPositions[i];
      const pearl = this.pearls[i];
      if (!marker || !pos || !pearl || !marker.visible) continue;
      origin.toScene(pos, this.scratch);
      marker.position.copy(this.scratch);
      const distance = this.scratch.distanceTo(camera.position);
      const base = distance * MIN_ANGULAR;
      marker.scale.setScalar(pearl.phase === 'operating' ? base * 1.7 : base);
    }
  }

  // Label the lead pearl and every fifth launch.
  labelAnchors(): LabelAnchor[] {
    const anchors: LabelAnchor[] = [];
    for (let i = 0; i < this.pearls.length; i++) {
      const pearl = this.pearls[i];
      const pos = this.displayPositions[i];
      if (!pearl || !pos) continue;
      if (pearl.index !== 0 && pearl.index % 5 !== 0) continue;
      anchors.push({
        text: pearl.index === 0 ? 'PEARL 1 (LEAD)' : `PEARL ${pearl.index + 1}`,
        displayPos: pos, // mutated in place by setPearls each update
        accent: pearl.phase === 'operating'
      });
    }
    return anchors;
  }

  pearlCount(): number {
    return this.pearls.length;
  }

  pearlAt(i: number): PearlState | undefined {
    return this.pearls[i];
  }

  displayPosOf(i: number): Vec3d | undefined {
    return i < this.pearls.length ? this.displayPositions[i] : undefined;
  }

  markerOf(i: number): Object3D | undefined {
    return i < this.pearls.length ? this.markers[i] : undefined;
  }
}
