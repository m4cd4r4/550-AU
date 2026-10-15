// The pearl close-up: six CubeSats that self-assemble into a 1 m telescope.
// Local units are metres; the act scales the group for visibility. The
// explode parameter animates between the assembled telescope (0) and the
// six labelled CubeSats spread on a ring (1). The assembly choreography is
// illustrative, not docking dynamics, per the plan.
//
// The six roles come from the facts table. Their silhouettes are read from
// those roles (a mirror carrier shows segments, the power unit shows a
// radiator) so a viewer can tell them apart without reading the labels;
// the shapes are illustrative, not engineering drawings. Surfaces are lit:
// Act 4 adds the key and fill lights, as Act 0 does for the JWST model.

import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  Vector3
} from 'three';
import facts from '../data/mission-facts.json';

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

const SAIL_R = 3.4;

// Bus structure: machined aluminium under a dark multi-layer blanket.
const BUS_METAL = 0.55;
const BUS_ROUGH = 0.52;

export class PearlModel {
  readonly group = new Group();
  private readonly cubesats: Group[] = [];
  // Every material that fades with the explode parameter, grouped by owner.
  private readonly cubesatMaterials: MeshStandardMaterial[][] = [];
  private readonly telescope = new Group();
  private readonly telescopeMaterials: MeshStandardMaterial[] = [];
  private readonly sails = new Group();
  private readonly sailMaterials: { mat: MeshBasicMaterial; base: number }[] = [];
  private explodeF = 0;
  private tumbleT = 0;
  private sailShown = false;

  constructor() {
    this.buildTelescope();
    this.group.add(this.telescope);
    this.buildSails();

    for (let i = 0; i < CUBESAT_ROLES.length; i++) {
      const mats: MeshStandardMaterial[] = [];
      const cubesat = this.buildCubesat(i, mats);
      this.cubesats.push(cubesat);
      this.cubesatMaterials.push(mats);
      this.group.add(cubesat);
    }
    this.setExplode(0);
  }

  // Assembled 1 m telescope: tube, primary mirror in its ring, sunshade cone,
  // laser terminal and radiator fin. Simple silhouettes, instrument-grey.
  private buildTelescope(): void {
    const tube = new Mesh(
      new CylinderGeometry(0.5, 0.5, 1.6, 24),
      this.material(0x9aa4b0, { metalness: BUS_METAL, roughness: BUS_ROUGH })
    );
    tube.rotation.x = Math.PI / 2;
    const ring = new Mesh(
      new TorusGeometry(0.5, 0.06, 10, 32),
      this.material(0xc4c9cf, { metalness: 0.85, roughness: 0.3 })
    );
    ring.position.z = 0.82;
    // The 1 m primary itself: a polished disc set just inside the ring, so a
    // light sweeping past the craft catches it the way a mirror would.
    const primary = new Mesh(
      new CircleGeometry(0.47, 32),
      this.material(0xdfe8f2, { metalness: 1, roughness: 0.06 })
    );
    primary.position.z = 0.7;
    // Open flared baffle rather than a closed cone, so the barrel and the
    // primary stay visible down the bore the way a real shade would leave them.
    const shade = new Mesh(
      new CylinderGeometry(0.92, 0.6, 0.55, 28, 1, true),
      this.material(0x6f7a86, { metalness: 0.3, roughness: 0.7, side: DoubleSide })
    );
    shade.rotation.x = Math.PI / 2;
    shade.position.z = 1.15;
    const terminal = new Mesh(
      new BoxGeometry(0.25, 0.25, 0.35),
      this.material(0x8fd0ff, { metalness: 0.5, roughness: 0.35, emissive: 0x16303f })
    );
    terminal.position.set(0.55, 0.3, -0.5);
    const fin = new Mesh(
      new BoxGeometry(0.06, 0.9, 0.6),
      this.material(0xff8f66, { metalness: 0.2, roughness: 0.8, emissive: 0x30120a })
    );
    fin.position.set(-0.6, 0, -0.4);
    this.telescope.add(tube, ring, primary, shade, terminal, fin);
  }

  // One CubeSat, shaped by its role. The bus is the same 30 x 30 x 45 cm box
  // in every case; what is bolted to it is what tells them apart.
  private buildCubesat(index: number, mats: MeshStandardMaterial[]): Group {
    const g = new Group();
    const colour = CUBESAT_ROLES[index]?.colour ?? 0x9aa4b0;
    const bus = new Mesh(
      new BoxGeometry(0.3, 0.3, 0.45),
      this.material(colour, { metalness: BUS_METAL, roughness: BUS_ROUGH }, mats)
    );
    g.add(bus);

    switch (index) {
      case 0:
      case 1: {
        // Mirror carrier: three hexagonal segments stowed on the long face.
        const segMat = this.material(0xdfe8f2, { metalness: 0.7, roughness: 0.7 }, mats);
        for (let i = 0; i < 3; i++) {
          const seg = new Mesh(new CircleGeometry(0.11, 6), segMat);
          seg.position.set(0.16, (i - 1) * 0.1, 0.06);
          seg.rotation.y = Math.PI / 2;
          seg.rotation.z = index === 0 ? 0 : Math.PI / 6;
          g.add(seg);
        }
        break;
      }
      case 2: {
        // Coronagraph: a barrel with a dark occulting disc at its mouth.
        const barrel = new Mesh(
          new CylinderGeometry(0.1, 0.1, 0.34, 18, 1, true),
          this.material(0x7b6530, { metalness: 0.7, roughness: 0.4, side: DoubleSide }, mats)
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.33;
        const occulter = new Mesh(
          new CircleGeometry(0.075, 24),
          this.material(0x14171d, { metalness: 0.1, roughness: 0.95 }, mats)
        );
        occulter.position.z = 0.48;
        g.add(barrel, occulter);
        break;
      }
      case 3: {
        // Laser comms: a gimballed aperture cone, lit from inside.
        const horn = new Mesh(
          new ConeGeometry(0.13, 0.26, 20, 1, true),
          this.material(0xbcd8ec, { metalness: 0.8, roughness: 0.25, side: DoubleSide }, mats)
        );
        horn.rotation.x = -Math.PI / 2;
        horn.position.z = 0.35;
        const aperture = new Mesh(
          new CircleGeometry(0.07, 20),
          this.material(0x8fd0ff, { metalness: 0.2, roughness: 0.3, emissive: 0x2e6c93 }, mats)
        );
        aperture.position.z = 0.24;
        g.add(horn, aperture);
        break;
      }
      case 4: {
        // Radioisotope power: a finned canister with two radiator panels.
        const canister = new Mesh(
          new CylinderGeometry(0.09, 0.09, 0.3, 16),
          this.material(0xb3733f, { metalness: 0.75, roughness: 0.45 }, mats)
        );
        canister.rotation.z = Math.PI / 2;
        canister.position.set(0, 0, 0.32);
        const radMat = this.material(0xe4e8ed, { metalness: 0.3, roughness: 0.75 }, mats);
        for (const side of [-1, 1]) {
          const panel = new Mesh(new BoxGeometry(0.02, 0.26, 0.3), radMat);
          panel.position.set(side * 0.19, 0, 0.1);
          g.add(panel);
        }
        g.add(canister);
        break;
      }
      default: {
        // Assembly and spares: a stowed arm and a spare mirror ring.
        const arm = new Mesh(
          new CylinderGeometry(0.022, 0.022, 0.4, 10),
          this.material(0xced4da, { metalness: 0.7, roughness: 0.4 }, mats)
        );
        arm.rotation.z = Math.PI / 2;
        arm.position.set(0.05, 0.17, 0.05);
        const spare = new Mesh(
          new TorusGeometry(0.1, 0.022, 8, 20),
          this.material(0x9aa4b0, { metalness: 0.8, roughness: 0.35 }, mats)
        );
        spare.position.z = 0.3;
        g.add(arm, spare);
        break;
      }
    }
    return g;
  }

  private material(
    colour: number,
    opts: {
      metalness?: number;
      roughness?: number;
      emissive?: number;
      side?: typeof DoubleSide;
    } = {},
    into?: MeshStandardMaterial[]
  ): MeshStandardMaterial {
    const m = new MeshStandardMaterial({
      color: colour,
      transparent: true,
      metalness: opts.metalness ?? BUS_METAL,
      roughness: opts.roughness ?? BUS_ROUGH,
      ...(opts.emissive === undefined ? {} : { emissive: opts.emissive }),
      ...(opts.side === undefined ? {} : { side: opts.side })
    });
    (into ?? this.telescopeMaterials).push(m);
    return m;
  }

  // The sail film stays unlit. It is a metres-thin reflector seen edge-on as
  // often as not, and under the key light a lit film reads as a black panel
  // whenever it faces away; flat emission is both prettier and no less true.
  private sailMaterial(colour: number, base: number): MeshBasicMaterial {
    const m = new MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: base,
      side: DoubleSide,
      depthWrite: false
    });
    this.sailMaterials.push({ mat: m, base });
    return m;
  }

  // The sundiver's solar sail: 16 panels in two wings of eight on a central
  // truss, matching Act 3 and the published 16,000 m^2. Shown only while the
  // pearl is still diving; it is jettisoned before the cruise, so operating
  // pearls fly bare. Sized for the close-up, not literal scale.
  private buildSails(): void {
    const wingPanels = facts.sundiver.sailPanelCount / 2;
    const panelMat = this.sailMaterial(0xc4c9cf, 0.42);
    const trussMat = this.sailMaterial(0x6f7a86, 0.7);
    const truss = new Mesh(new CylinderGeometry(0.02, 0.02, SAIL_R * 2, 6), trussMat);
    truss.rotation.z = Math.PI / 2;
    this.sails.add(truss);

    const pw = 0.34;
    const geo = new PlaneGeometry(pw, 0.55);
    for (let wing = -1; wing <= 1; wing += 2) {
      for (let i = 0; i < wingPanels; i++) {
        const panel = new Mesh(geo, panelMat);
        panel.position.x = wing * ((i + 0.5) * (pw + 0.05) + 0.25);
        panel.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.05; // hint of steering
        this.sails.add(panel);
      }
    }
    this.group.add(this.sails);
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
      // Once apart, each CubeSat drifts slowly so the cluster reads as free
      // bodies rather than a frozen diagram; out of phase so they never sync.
      cubesat.rotation.x = Math.sin(this.tumbleT * 0.7 + i * 1.9) * 0.45 * e;
      cubesat.rotation.y = Math.cos(this.tumbleT * 0.5 + i * 1.3) * 0.45 * e;
      cubesat.visible = e > 0.02;
      const opacity = Math.min(1, e * 2);
      for (const mat of this.cubesatMaterials[i] ?? []) mat.opacity = opacity;
    }
    this.telescope.visible = e < 0.98;
    for (const mat of this.telescopeMaterials) mat.opacity = 1 - e * 0.85;
    this.updateSails();
  }

  // Show the sail only for a diving pearl; it is gone once cruising. Combined
  // with the explode state so it also retracts as the craft breaks apart.
  setSailShown(shown: boolean): void {
    if (this.sailShown === shown) return;
    this.sailShown = shown;
    this.updateSails();
  }

  private updateSails(): void {
    const e = this.explodeF * this.explodeF * (3 - 2 * this.explodeF);
    this.sails.visible = this.sailShown && e < 0.995;
    const k = this.sailShown ? 1 - e : 0;
    for (const { mat, base } of this.sailMaterials) mat.opacity = base * k;
  }

  // Advances the free-drift phase used while the CubeSats are apart.
  advance(dtS: number): void {
    this.tumbleT += dtS;
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
