// The pearl close-up: six CubeSats that self-assemble into a 1 m telescope.
// Local units are metres; the act scales the group for visibility. The
// explode parameter animates between the assembled telescope (0) and the
// six labelled CubeSats spread on a ring (1). The assembly choreography is
// illustrative, not docking dynamics, per the plan.

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3
} from 'three';

export interface CubesatRole {
  role: string;
  colour: number;
}

// One launch carries six CubeSats with specialised roles (facts table).
export const CUBESAT_ROLES: CubesatRole[] = [
  { role: 'MIRROR SEGMENTS A', colour: 0xb9c4d0 },
  { role: 'MIRROR SEGMENTS B', colour: 0xa8b4c2 },
  { role: 'CORONAGRAPH', colour: 0xffb000 },
  { role: 'LASER COMMS', colour: 0x8fd0ff },
  { role: 'POWER (RADIOISOTOPE)', colour: 0xff8f66 },
  { role: 'ASSEMBLY / SPARES', colour: 0x9aa4b0 }
];

const EXPLODE_RADIUS_M = 3.2;

export class PearlModel {
  readonly group = new Group();
  private readonly cubesats: Mesh[] = [];
  private readonly telescope = new Group();
  private readonly telescopeMaterials: MeshBasicMaterial[] = [];
  private explodeF = 0;

  constructor() {
    // Assembled 1 m telescope: tube, primary ring, sunshade cone, laser
    // terminal and radiator fin. Simple silhouettes, instrument-grey.
    const tubeMat = this.material(0x9aa4b0);
    const tube = new Mesh(new CylinderGeometry(0.5, 0.5, 1.6, 20), tubeMat);
    tube.rotation.x = Math.PI / 2;
    const ringMat = this.material(0xc4c9cf);
    const ring = new Mesh(new TorusGeometry(0.5, 0.06, 8, 28), ringMat);
    ring.position.z = 0.82;
    const shadeMat = this.material(0x6f7a86);
    const shade = new Mesh(new ConeGeometry(0.62, 0.5, 20, 1, true), shadeMat);
    shade.rotation.x = -Math.PI / 2;
    shade.position.z = 1.1;
    const terminalMat = this.material(0x8fd0ff);
    const terminal = new Mesh(new BoxGeometry(0.25, 0.25, 0.35), terminalMat);
    terminal.position.set(0.55, 0.3, -0.5);
    const finMat = this.material(0xff8f66);
    const fin = new Mesh(new BoxGeometry(0.06, 0.9, 0.6), finMat);
    fin.position.set(-0.6, 0, -0.4);
    this.telescope.add(tube, ring, shade, terminal, fin);
    this.group.add(this.telescope);

    for (let i = 0; i < CUBESAT_ROLES.length; i++) {
      const cubesat = new Mesh(
        new BoxGeometry(0.3, 0.3, 0.45),
        this.material(CUBESAT_ROLES[i]?.colour ?? 0x9aa4b0)
      );
      this.cubesats.push(cubesat);
      this.group.add(cubesat);
    }
    this.setExplode(0);
  }

  private material(colour: number): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ color: colour, transparent: true });
    this.telescopeMaterials.push(m);
    return m;
  }

  // 0 = assembled telescope, 1 = six CubeSats on a ring with the telescope
  // ghosted out. Smoothstep on position so the ends ease.
  setExplode(f: number): void {
    this.explodeF = Math.min(1, Math.max(0, f));
    const e = this.explodeF * this.explodeF * (3 - 2 * this.explodeF);
    for (let i = 0; i < this.cubesats.length; i++) {
      const cubesat = this.cubesats[i];
      if (!cubesat) continue;
      const angle = (i / this.cubesats.length) * Math.PI * 2;
      const radius = 0.15 + e * EXPLODE_RADIUS_M;
      cubesat.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, 0.2);
      cubesat.rotation.z = angle + e * 0.6;
      cubesat.visible = e > 0.02;
      (cubesat.material as MeshBasicMaterial).opacity = Math.min(1, e * 2);
    }
    this.telescope.visible = e < 0.98;
    for (const child of this.telescope.children) {
      ((child as Mesh).material as MeshBasicMaterial).opacity = 1 - e * 0.85;
    }
  }

  get explode(): number {
    return this.explodeF;
  }

  // World position of CubeSat i, for role labels.
  cubesatWorldPos(i: number, out: Vector3): Vector3 {
    const cubesat = this.cubesats[i];
    if (!cubesat) return out.set(0, 0, 0);
    return cubesat.getWorldPosition(out);
  }

  static readonly SPAN_M = 2 * EXPLODE_RADIUS_M + 1;
}
