// The image cylinder at 650 AU: a translucent 32 km tube with a gridded
// cross-section disc. Each true grid cell is one pixel of the final image
// (31 m pitch, 1000 x 1000); the displayed grid is far coarser and the act
// says so. Four imaging telescopes raster the disc cell to cell while a
// fifth sits outside the cylinder measuring bare corona. Local units: km.

import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  RingGeometry,
  Vector3
} from 'three';

const GRID_N = 20; // display grid; the true raster is 1000 x 1000
const TUBE_LENGTH_KM = 130;

export interface ScanState {
  displayCell: number;
  displayCells: number;
  dwellPhase: number; // 0..1 within the current dwell
}

export class CylinderGrid {
  readonly group = new Group();
  private readonly cellCentres: [number, number][] = [];
  private readonly scopes: Mesh[] = [];
  private readonly referenceScope: Mesh;
  private readonly radiusKm: number;

  constructor(diameterKm: number) {
    this.radiusKm = diameterKm / 2;
    const r = this.radiusKm;

    // Cross-section disc: faint fill plus grid chords clipped to the circle.
    const disc = new Mesh(
      new RingGeometry(0, r, 48, 1),
      new MeshBasicMaterial({
        color: 0x2a3546,
        transparent: true,
        opacity: 0.16,
        side: DoubleSide,
        depthWrite: false
      })
    );
    this.group.add(disc);

    const gridVerts: number[] = [];
    for (let i = 0; i <= GRID_N; i++) {
      const t = (i / GRID_N) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - t * t));
      gridVerts.push(t * r, -half * r, 0, t * r, half * r, 0);
      gridVerts.push(-half * r, t * r, 0, half * r, t * r, 0);
    }
    const gridGeometry = new BufferGeometry();
    gridGeometry.setAttribute('position', new Float32BufferAttribute(gridVerts, 3));
    const grid = new LineSegments(
      gridGeometry,
      new LineBasicMaterial({ color: 0x54637a, transparent: true, opacity: 0.5 })
    );
    this.group.add(grid);

    // Cell centres inside the circle, raster order (top row first).
    for (let row = 0; row < GRID_N; row++) {
      for (let col = 0; col < GRID_N; col++) {
        const x = ((col + 0.5) / GRID_N) * 2 - 1;
        const y = 1 - ((row + 0.5) / GRID_N) * 2;
        if (x * x + y * y <= 0.94) this.cellCentres.push([x * r, y * r]);
      }
    }

    // The cylinder itself, ghosted, running along the focal line (+z).
    const tube = new Mesh(
      new CylinderGeometry(r, r, TUBE_LENGTH_KM, 40, 1, true),
      new MeshBasicMaterial({
        color: 0x3a4a5e,
        transparent: true,
        opacity: 0.07,
        side: DoubleSide,
        depthWrite: false
      })
    );
    tube.rotation.x = Math.PI / 2;
    this.group.add(tube);

    const scopeGeometry = new OctahedronGeometry(0.7);
    for (let i = 0; i < 4; i++) {
      const scope = new Mesh(scopeGeometry, new MeshBasicMaterial({ color: 0xffb000 }));
      this.scopes.push(scope);
      this.group.add(scope);
    }
    this.referenceScope = new Mesh(
      scopeGeometry,
      new MeshBasicMaterial({ color: 0x8fd0ff })
    );
    this.referenceScope.position.set(r * 1.8, 0, 0);
    this.group.add(this.referenceScope);
  }

  // Advance the raster. Each of the four scopes takes every fourth cell;
  // within a dwell the scope holds position (the hold is the point).
  setScan(fraction: number): ScanState {
    const cells = this.cellCentres.length;
    const perScope = Math.floor(cells / 4);
    const f = Math.min(1, Math.max(0, fraction));
    const stepFloat = f * perScope;
    const step = Math.min(perScope - 1, Math.floor(stepFloat));
    for (let k = 0; k < 4; k++) {
      const cell = this.cellCentres[Math.min(cells - 1, k + 4 * step)];
      const scope = this.scopes[k];
      if (cell && scope) scope.position.set(cell[0], cell[1], 1.2);
    }
    return {
      displayCell: Math.min(cells, Math.floor(f * cells)),
      displayCells: cells,
      dwellPhase: stepFloat - Math.floor(stepFloat)
    };
  }

  scopeWorldPos(i: number, out: Vector3): Vector3 {
    const scope = i < 4 ? this.scopes[i] : this.referenceScope;
    if (!scope) return out.set(0, 0, 0);
    return scope.getWorldPosition(out);
  }

  get referenceScopeMesh(): Mesh {
    return this.referenceScope;
  }
}
