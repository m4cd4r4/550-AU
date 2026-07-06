// Laser downlink pulses hopping the pearl chain toward Earth. Purely
// visual pacing (a real image takes 13 hours of transmit per hop plus
// light-travel time; the captions carry the true numbers).

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  Line,
  LineBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3
} from 'three';
import type { Vec3d } from '../sim/vec3d';
import type { OriginFrame } from './floating-origin';

const PULSE_COUNT = 3;
const HOP_SECONDS = 0.5; // visual seconds per hop
const PULSE_SPACING_S = 7;

function pulseTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(160, 220, 255, 1)');
    g.addColorStop(0.3, 'rgba(110, 190, 255, 0.7)');
    g.addColorStop(1, 'rgba(60, 140, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

export class LaserRelay {
  readonly group = new Group();
  private chain: Vec3d[] = []; // display AU, outermost first, Earth last
  private readonly pulses: { sprite: Sprite; t: number }[] = [];
  private readonly line: Line;
  private readonly lineMaterial: LineBasicMaterial;
  private readonly linePositions = new Float32Array(64 * 3); // capacity 64 stations
  private clock = 0;
  private readonly scratchA = new Vector3();
  private readonly scratchB = new Vector3();

  constructor() {
    this.lineMaterial = new LineBasicMaterial({
      color: 0x4f9fd8,
      transparent: true,
      opacity: 0.28
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.linePositions, 3));
    this.line = new Line(geometry, this.lineMaterial);
    this.line.frustumCulled = false;
    this.group.add(this.line);

    const texture = pulseTexture();
    for (let i = 0; i < PULSE_COUNT; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: texture,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );
      sprite.visible = false;
      this.pulses.push({ sprite, t: -i * PULSE_SPACING_S });
      this.group.add(sprite);
    }
  }

  // Chain of display-space stations: operating pearls outward-in, then Earth.
  setChain(chain: Vec3d[]): void {
    this.chain = chain;
    this.group.visible = chain.length >= 2;
  }

  update(dtRealS: number, origin: OriginFrame, pulseScale: number): void {
    if (this.chain.length < 2) return;
    this.clock += dtRealS;

    const stations = Math.min(this.chain.length, 64);
    for (let i = 0; i < stations; i++) {
      const p = this.chain[i];
      if (!p) continue;
      origin.toScene(p, this.scratchA);
      this.linePositions[i * 3] = this.scratchA.x;
      this.linePositions[i * 3 + 1] = this.scratchA.y;
      this.linePositions[i * 3 + 2] = this.scratchA.z;
    }
    this.line.geometry.getAttribute('position').needsUpdate = true;
    this.line.geometry.setDrawRange(0, stations);

    const hops = this.chain.length - 1;
    const journeyS = hops * HOP_SECONDS;
    for (let i = 0; i < this.pulses.length; i++) {
      const pulse = this.pulses[i];
      if (!pulse) continue;
      const local = (this.clock + pulse.t) % (journeyS + PULSE_SPACING_S);
      if (local < 0 || local >= journeyS) {
        pulse.sprite.visible = false;
        continue;
      }
      const hopIndex = Math.floor(local / HOP_SECONDS);
      const f = (local - hopIndex * HOP_SECONDS) / HOP_SECONDS;
      const from = this.chain[hopIndex];
      const to = this.chain[hopIndex + 1];
      if (!from || !to) continue;
      origin.toScene(from, this.scratchA);
      origin.toScene(to, this.scratchB);
      pulse.sprite.position.lerpVectors(this.scratchA, this.scratchB, f);
      pulse.sprite.scale.setScalar(pulseScale);
      pulse.sprite.visible = true;
    }
  }
}
