// Act 0's scale ladder: concentric reference rings at real, sourced sizes on
// the way out from JWST, ending on the 90 km aperture. Everything shares one
// true scale. Each ring fades in as the frame grows to hold it and fades out
// once it has shrunk to a speck, so the 90 km ring lands as the last of a
// series. The aperture's segment pattern is illustrative, not a design.

import {
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  RingGeometry
} from 'three';
import { vec3d } from '../sim/vec3d';
import type { LabelAnchor } from './focal-ruler';

export interface LadderRung {
  label: string;
  sizeM: number;
}

const RUNG_COLOUR = 0x9fb3c8;
const ACCENT = 0xffb000;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function formatSize(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

// A flat-top hexagon tiling: reads as a segmented mirror at any zoom.
function hexTexture(): CanvasTexture {
  const w = 192;
  const h = Math.round((w / 3) * Math.sqrt(3));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    const s = w / 3;
    const centres: [number, number][] = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
      [w / 2, h / 2]
    ];
    for (const [cx, cy] of centres) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * s;
        const y = cy + Math.sin(a) * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(26, 26 * Math.sqrt(3));
  return texture;
}

export class ScaleLadder {
  readonly group = new Group();
  readonly anchors: LabelAnchor[] = [];
  private readonly rungs: { diameter: number; material: MeshBasicMaterial; anchor: LabelAnchor }[] = [];
  private readonly rim: MeshBasicMaterial;
  private readonly halo: MeshBasicMaterial;
  private readonly disc: MeshBasicMaterial;
  private readonly apertureAnchor: LabelAnchor;
  private readonly apertureDiameter: number;
  private readonly discMesh: Mesh;
  private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // unitM: metres per scene unit. Sizes are diameters.
  constructor(rungs: LadderRung[], unitM: number, apertureM: number) {
    for (const rung of rungs) {
      const r = rung.sizeM / unitM / 2;
      const material = new MeshBasicMaterial({
        color: RUNG_COLOUR,
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        depthWrite: false
      });
      this.group.add(new Mesh(new RingGeometry(r * 0.996, r * 1.004, 160), material));
      const anchor: LabelAnchor = {
        text: `${rung.label} ${formatSize(rung.sizeM)}`,
        displayPos: vec3d(0, r, 0),
        accent: false,
        opacity: 0,
        align: 'center',
        dy: 8
      };
      this.anchors.push(anchor);
      this.rungs.push({ diameter: r * 2, material, anchor });
    }

    const R = apertureM / unitM / 2;
    this.apertureDiameter = R * 2;
    const flat = { transparent: true, opacity: 0, side: DoubleSide, depthWrite: false } as const;
    this.disc = new MeshBasicMaterial({ ...flat, color: ACCENT, map: hexTexture() });
    this.halo = new MeshBasicMaterial({ ...flat, color: ACCENT });
    this.rim = new MeshBasicMaterial({ ...flat, color: 0xffc94d });
    this.discMesh = new Mesh(new CircleGeometry(R, 200), this.disc);
    this.group.add(
      this.discMesh,
      new Mesh(new RingGeometry(R * 0.965, R * 1.035, 200), this.halo),
      new Mesh(new RingGeometry(R * 0.993, R * 1.007, 200), this.rim)
    );
    this.apertureAnchor = {
      text: `APERTURE NEEDED ${formatSize(apertureM)}`,
      displayPos: vec3d(0, R, 0),
      accent: true,
      opacity: 0,
      align: 'center',
      dy: 10
    };
    this.anchors.push(this.apertureAnchor);
  }

  // spanUnits: the shorter frame dimension at the JWST plane, in scene units.
  update(spanUnits: number, dtRealS: number): void {
    // A slow turn keeps the finished frame alive while the tour rests on it.
    if (!this.still) this.discMesh.rotation.z += dtRealS * 0.012;
    for (const { diameter, material, anchor } of this.rungs) {
      const fill = diameter / spanUnits; // 1 = the ring just fits the frame
      material.opacity = 0.7 * (1 - smoothstep(1.6, 2.6, fill)) * smoothstep(0.03, 0.12, fill);
      anchor.opacity = (1 - smoothstep(0.76, 0.86, fill)) * smoothstep(0.16, 0.32, fill);
    }
    const fill = this.apertureDiameter / spanUnits;
    const arrive = 1 - smoothstep(1.3, 4, fill);
    this.rim.opacity = arrive;
    this.halo.opacity = 0.14 * arrive;
    // Faint while the frame is still inside the mirror, full once the rim is in view.
    this.disc.opacity = 0.07 * arrive + 0.23 * (1 - smoothstep(1.0, 2.2, fill));
    this.apertureAnchor.opacity = 1 - smoothstep(0.78, 0.86, fill);
  }
}
