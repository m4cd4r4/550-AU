// The Sun: textured photosphere sphere plus an additive glow sprite that
// keeps a minimum on-screen size, so the Sun stays a visibly bright point
// during pullbacks. Falls back to a procedural granulation texture.

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type PerspectiveCamera,
  type Texture
} from 'three';
import { AU_M, R_SUN_M } from '../sim/constants';
import { vec3d } from '../sim/vec3d';
import type { OriginFrame } from './floating-origin';

export const SUN_RADIUS_AU = R_SUN_M / AU_M; // ~0.00465 AU

const SUN_WORLD = vec3d(0, 0, 0);
const MIN_ANGULAR_SIZE_RAD = 0.014; // glow never shrinks below ~this on screen

function proceduralPhotosphere(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffb24d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 4000; i++) {
      const shade = 150 + Math.floor(Math.random() * 105);
      ctx.fillStyle = `rgba(${shade + 60}, ${shade}, ${Math.floor(shade * 0.45)}, 0.35)`;
      const r = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 244, 224, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 214, 140, 0.85)');
    gradient.addColorStop(0.5, 'rgba(255, 170, 70, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new CanvasTexture(canvas);
}

export class Sun {
  readonly group = new Group();
  private readonly surface: Mesh;
  private readonly glow: Sprite;
  private readonly scratch = new Vector3();

  constructor() {
    const material = new MeshBasicMaterial({ color: new Color(2.4, 2.1, 1.7) });
    new TextureLoader().load(
      `${import.meta.env.BASE_URL}assets/textures/2k-sun.jpg`,
      (texture: Texture) => {
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        material.map = proceduralPhotosphere();
        material.needsUpdate = true;
      }
    );
    this.surface = new Mesh(new SphereGeometry(1, 48, 32), material);
    this.surface.scale.setScalar(SUN_RADIUS_AU);

    this.glow = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(2.6, 2.3, 1.9),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false
      })
    );
    this.group.add(this.surface, this.glow);
  }

  update(origin: OriginFrame, camera: PerspectiveCamera): void {
    origin.toScene(SUN_WORLD, this.scratch);
    this.group.position.copy(this.scratch);
    const distance = this.scratch.distanceTo(camera.position);
    const glowScale = Math.max(SUN_RADIUS_AU * 5, distance * MIN_ANGULAR_SIZE_RAD);
    this.glow.scale.setScalar(glowScale);
  }
}
