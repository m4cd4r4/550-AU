// The sundiver spacecraft: a small bus and the 16-panel solar sail on a
// central truss (two wings of eight). Local units are metres; the act
// scales the group for visibility and declares the exaggeration. Supports
// deployment, pitch (feathered to face-on) and jettison with drift.

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TorusGeometry
} from 'three';
import facts from '../data/mission-facts.json';

// Panel shape chosen so 16 panels total the published 16,000 m^2.
const PANEL_W = 25;
const PANEL_H = 40;
const PANEL_GAP = 4;
const WING_PANELS = facts.sundiver.sailPanelCount / 2;
const TRUSS_LENGTH = WING_PANELS * (PANEL_W + PANEL_GAP) * 2 + 20;

export class SailCraft {
  readonly group = new Group();
  // Local frame: +z faces the Sun when pitch = 0; truss runs along x.
  private readonly sailAssembly = new Group();
  private readonly panels: Mesh[] = [];
  private readonly panelMaterial: MeshBasicMaterial;
  private readonly trussMaterial: MeshBasicMaterial;
  private deployment = 0;
  private jettisonDrift = 0;

  constructor() {
    this.group.add(this.buildBus());

    this.trussMaterial = new MeshBasicMaterial({ color: 0x6f7a86, transparent: true });
    const truss = new Mesh(
      new CylinderGeometry(0.8, 0.8, TRUSS_LENGTH, 6),
      this.trussMaterial
    );
    truss.rotation.z = Math.PI / 2;
    this.sailAssembly.add(truss);

    // Tin-coated film: bright, slightly warm reflector.
    this.panelMaterial = new MeshBasicMaterial({
      color: 0xc4c9cf,
      side: DoubleSide,
      transparent: true
    });
    const geometry = new PlaneGeometry(PANEL_W, PANEL_H);
    for (let wing = -1; wing <= 1; wing += 2) {
      for (let i = 0; i < WING_PANELS; i++) {
        const panel = new Mesh(geometry, this.panelMaterial);
        const along = (i + 0.5) * (PANEL_W + PANEL_GAP) + 8;
        panel.position.x = wing * along;
        // A hint of independent steering: alternating slight tilts.
        panel.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.04;
        this.panels.push(panel);
        this.sailAssembly.add(panel);
      }
    }
    this.group.add(this.sailAssembly);
    this.setDeployment(0);
  }

  // The payload left behind after the sail is jettisoned: a small telescope
  // spacecraft (the same craft that goes on to fly as a pearl). Metres.
  private buildBus(): Group {
    const bus = new Group();
    const mat = (c: number): MeshBasicMaterial => new MeshBasicMaterial({ color: c });
    const alongZ = (m: Mesh): void => {
      m.rotation.x = Math.PI / 2;
    };

    const body = new Mesh(new CylinderGeometry(1.5, 1.8, 3, 8), mat(0x8a94a2));
    alongZ(body);
    const foil = new Mesh(new CylinderGeometry(1.55, 1.55, 0.7, 8), mat(0xd9a441));
    alongZ(foil);
    foil.position.z = -0.9;
    const tube = new Mesh(new CylinderGeometry(1.25, 1.25, 3.2, 16), mat(0xaab2bd));
    alongZ(tube);
    tube.position.z = 2.6;
    const ring = new Mesh(new TorusGeometry(1.25, 0.12, 8, 28), mat(0xcfd5dc));
    ring.position.z = 4.2;
    const shade = new Mesh(new ConeGeometry(1.7, 1.2, 20, 1, true), mat(0x6f7a86));
    shade.rotation.x = -Math.PI / 2;
    shade.position.z = 4.9;
    // High-gain dish on a short boom, and a radiator fin on the far side.
    const boom = new Mesh(new CylinderGeometry(0.07, 0.07, 2.2, 6), mat(0x6f7a86));
    boom.rotation.z = Math.PI / 2;
    boom.position.set(2, 0, -0.8);
    const dish = new Mesh(new ConeGeometry(1, 0.45, 20, 1, true), mat(0xc4c9cf));
    dish.rotation.z = Math.PI / 2 + 0.5;
    dish.position.set(3.2, 0, -0.8);
    const fin = new Mesh(new BoxGeometry(0.1, 2.6, 2), mat(0xff8f66));
    fin.position.set(-1.8, 0, -0.4);
    bus.add(body, foil, tube, ring, shade, boom, dish, fin);
    return bus;
  }

  // 0 = stowed, 1 = fully deployed. Panels unfurl outward along the truss.
  setDeployment(f: number): void {
    this.deployment = Math.min(1, Math.max(0, f));
    for (let i = 0; i < this.panels.length; i++) {
      const wingIndex = i % WING_PANELS;
      const start = wingIndex / WING_PANELS;
      const local = Math.min(1, Math.max(0.001, (this.deployment - start * 0.8) / 0.2));
      const panel = this.panels[i];
      if (panel) panel.scale.set(local, local, 1);
    }
  }

  // 0 = face-on to the Sun, PI/2 = feathered edge-on.
  setPitch(rad: number): void {
    if (this.jettisonDrift === 0) this.sailAssembly.rotation.y = rad;
  }

  // Seconds since jettison; the sail drifts anti-sunward, tumbles and fades.
  setJettison(sinceS: number): void {
    this.jettisonDrift = Math.max(0, sinceS);
    if (this.jettisonDrift === 0) {
      this.sailAssembly.position.set(0, 0, 0);
      this.panelMaterial.opacity = 1;
      this.trussMaterial.opacity = 1;
      return;
    }
    const drift = this.jettisonDrift * 2; // metres, visual only
    this.sailAssembly.position.set(0, drift * 0.12, -drift);
    this.sailAssembly.rotation.x += 0.0006 * this.jettisonDrift;
    const fade = Math.max(0, 1 - this.jettisonDrift / 240);
    this.panelMaterial.opacity = fade;
    this.trussMaterial.opacity = fade;
    this.sailAssembly.visible = fade > 0;
  }

  get deployed(): number {
    return this.deployment;
  }

  // Reference extent in metres for the act's angular-size scaling: the sail
  // span while attached, easing down to the bus once the sail is gone so
  // the craft never vanishes from frame.
  get spanM(): number {
    if (this.jettisonDrift === 0) return TRUSS_LENGTH;
    const f = Math.min(1, this.jettisonDrift / 240);
    return TRUSS_LENGTH + (8 - TRUSS_LENGTH) * f;
  }

  // Physical extent in metres, for the act's scale declaration.
  static readonly SPAN_M = TRUSS_LENGTH;
}
