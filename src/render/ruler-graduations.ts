// Act 2's distance markers: labelled graduations on the focal-line ruler
// (1, 2, 5 AU and on out to 400 AU) and a cursor at the tour's current
// distance. The tour rides the ruler outward, so the graduations pass the
// cursor one after another; that is the act's sense of travel, read off real
// distances rather than a speed effect. Each graduation shows while the
// cursor is near it and fades once it is far behind, so the inner ones do
// not crowd the Sun as the frame pulls back.

import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Vector3,
  type PerspectiveCamera
} from 'three';
import { vec3d, type Vec3d } from '../sim/vec3d';
import type { DistanceMap } from './distance-map';
import type { LabelAnchor } from './focal-ruler';
import { formatAu } from '../ui/format';

// No 200 AU: it would print over the Heliopause and Voyager 1 labels.
const GRADUATIONS_AU = [1, 2, 5, 10, 20, 50, 100, 300, 400];
const TICK_SCREEN = 0.012; // half-length as a fraction of camera distance
const CURSOR_SCREEN = 0.007;
const TICK_AXIS = new Vector3(1, 0, 0);
const GREY = 0x8b97a5;
const ACCENT = 0xffb000;

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// How visible a graduation is when the cursor is at r AU: fades in ahead of
// the cursor, holds while it passes, fades well behind it.
export function graduationOpacity(au: number, r: number): number {
  return smoothstep(0.3 * au, 0.6 * au, r) * (1 - smoothstep(3 * au, 6 * au, r));
}

export class RulerGraduations {
  readonly group = new Group();
  readonly anchors: LabelAnchor[] = [];
  private readonly ticks: { au: number; line: Line; material: LineBasicMaterial; anchor: LabelAnchor }[] = [];
  private readonly cursor: Mesh;
  private readonly cursorAnchor: LabelAnchor;
  private readonly scratch = new Vector3();
  private readonly side = new Vector3();
  private readonly axis = new Vector3();

  constructor(map: DistanceMap, dir: Vec3d) {
    const d = new Vector3(dir.x, dir.y, dir.z);
    // Unit tick along local x; update() turns it across the ruler each frame.
    const geometry = new BufferGeometry().setFromPoints([new Vector3(-1, 0, 0), TICK_AXIS]);
    for (const au of GRADUATIONS_AU) {
      const at = d.clone().multiplyScalar(map.toDisplay(au));
      const material = new LineBasicMaterial({ color: GREY, transparent: true, opacity: 0 });
      const line = new Line(geometry, material);
      line.position.copy(at);
      this.group.add(line);
      const anchor: LabelAnchor = {
        text: `${au} AU`,
        displayPos: vec3d(at.x, at.y, at.z),
        accent: false,
        opacity: 0,
        align: 'center',
        dy: 10,
        nudge: true // step off the milestone labels on a narrow screen
      };
      this.anchors.push(anchor);
      this.ticks.push({ au, line, material, anchor });
    }

    this.cursor = new Mesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: ACCENT }));
    this.group.add(this.cursor);
    this.cursorAnchor = { text: '', displayPos: vec3d(), accent: true, opacity: 0, dy: -16, nudge: true };
    this.anchors.push(this.cursorAnchor);
  }

  // focusAU: the tour cursor's true distance, or null when there is no cursor
  // (Explore), in which case the graduations follow viewAU.
  update(
    camera: PerspectiveCamera,
    groupOffset: Vector3,
    map: DistanceMap,
    dir: Vec3d,
    viewAU: number,
    focusAU: number | null
  ): void {
    this.axis.set(dir.x, dir.y, dir.z);
    for (const { au, line, material, anchor } of this.ticks) {
      const a = graduationOpacity(au, viewAU);
      material.opacity = 0.75 * a;
      line.visible = a > 0.01;
      anchor.opacity = 0.85 * a;
      if (!line.visible) continue;
      this.scratch.copy(line.position).add(groupOffset);
      line.scale.setScalar(this.scratch.distanceTo(camera.position) * TICK_SCREEN);
      // Across the ruler and across the line of sight, so the tick meets the
      // ruler at a right angle on screen (as placeLanes() does in Act 7).
      this.scratch.sub(camera.position);
      this.side.crossVectors(this.axis, this.scratch);
      if (this.side.lengthSq() < 1e-12) continue; // looking straight down the ruler
      line.quaternion.setFromUnitVectors(TICK_AXIS, this.side.normalize());
    }

    const on = focusAU !== null;
    this.cursor.visible = on;
    this.cursorAnchor.opacity = 0;
    if (focusAU === null) return;
    // Past about 300 AU the lens milestones crowd the cursor; their labels and
    // the HUD's ruler distance take over.
    this.cursorAnchor.opacity = 1 - smoothstep(280, 380, focusAU);
    const r = map.toDisplay(focusAU);
    this.cursor.position.set(dir.x * r, dir.y * r, dir.z * r);
    this.scratch.copy(this.cursor.position).add(groupOffset);
    this.cursor.scale.setScalar(this.scratch.distanceTo(camera.position) * CURSOR_SCREEN);
    this.cursorAnchor.displayPos.x = dir.x * r;
    this.cursorAnchor.displayPos.y = dir.y * r;
    this.cursorAnchor.displayPos.z = dir.z * r;
    this.cursorAnchor.text = formatAu(focusAU);
  }
}
