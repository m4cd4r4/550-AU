// Real planet surfaces for the Act 2 solar-system ruler: textured spheres
// (Solar System Scope maps, CC BY 4.0), the same set the cosmos-collective
// solar-system page uses. Unlit to match the schematic scene; a per-planet
// colour stands in until the texture loads, so it still works offline.

import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Texture,
  TextureLoader
} from 'three';

const BASE = `${import.meta.env.BASE_URL}assets/textures/planets/`;
const loader = new TextureLoader();
const cache = new Map<string, Texture>();
const SPHERE = new SphereGeometry(1, 24, 16);
// Hold the textured surface just under the scene's bloom threshold so the map
// reads instead of blooming out to a white dot; only the brightest features
// (ice, cloud) glow a little.
const TINT = 0x9a9a9a;

const FILE: Record<string, string> = {
  Mercury: 'mercury.jpg',
  Venus: 'venus.jpg',
  Earth: 'earth.jpg',
  Mars: 'mars.jpg',
  Jupiter: 'jupiter.jpg',
  Saturn: 'saturn.jpg',
  Uranus: 'uranus.jpg',
  Neptune: 'neptune.jpg'
};

// Fallback tints (rough real colours) shown until the map loads, or offline.
const COLOUR: Record<string, number> = {
  Mercury: 0x9c8b7a,
  Venus: 0xd9b892,
  Earth: 0x6fa8ff,
  Mars: 0xc1622f,
  Jupiter: 0xd8b98c,
  Saturn: 0xe3cfa0,
  Uranus: 0x9fe3e0,
  Neptune: 0x466de8
};

function applyTexture(file: string, mat: MeshBasicMaterial): void {
  const hit = cache.get(file);
  const set = (tex: Texture): void => {
    mat.map = tex;
    mat.color.setHex(TINT);
    mat.needsUpdate = true;
  };
  if (hit) {
    set(hit);
    return;
  }
  loader.load(BASE + file, (tex) => {
    cache.set(file, tex);
    set(tex);
  });
}

// A unit-radius textured planet. Saturn gets its ring. Constant screen size
// and world position are the caller's job (the ruler scales it each frame).
export function planetMesh(name: string): Mesh {
  const mat = new MeshBasicMaterial({ color: COLOUR[name] ?? 0xd7dee6 });
  const file = FILE[name];
  if (file) applyTexture(file, mat);
  const mesh = new Mesh(SPHERE, mat);
  if (name === 'Saturn') mesh.add(saturnRing());
  return mesh;
}

function saturnRing(): Mesh {
  const inner = 1.35;
  const outer = 2.3;
  const geo = new RingGeometry(inner, outer, 48);
  // Remap UVs radially so the strip texture reads from inner to outer edge.
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (pos && uv) {
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
    }
  }
  const mat = new MeshBasicMaterial({
    color: 0xe3cfa0,
    transparent: true,
    opacity: 0.9,
    side: DoubleSide,
    depthWrite: false
  });
  applyTexture('saturn_ring.png', mat);
  const ring = new Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2 + 0.47; // equatorial ring, tilted like Saturn
  return ring;
}
