// A recognisable James Webb Space Telescope built from primitives: the
// 18-segment gold hexagonal primary in its true honeycomb layout (an inner
// ring of six and an outer ring of twelve, the centre empty where the aft
// optics sit), the secondary mirror on a tripod boom, and the five-layer
// diamond sunshield. Unlit (MeshBasicMaterial) to match the schematic scene,
// so it needs no external asset, loader or light and composites cleanly over
// the starfield. It reads as JWST at a glance; that is the point.

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const GOLD = 0xe7b448;
const STRUT = 0x8b93a3;
const SHIELD = 0x9aa6cf;

const SEG = 0.2; // hexagon centre-to-corner, scene units
const SEAM = 0.93; // <1 leaves thin seams between segments
const BOOM = 1.25; // secondary-mirror stand-off in front of the primary

// Flat-topped hexagon: axial (q, r) to planar centre for circumradius SEG.
const SQRT3 = Math.sqrt(3);
function hexCentre(q: number, r: number): [number, number] {
  return [SEG * 1.5 * q, SEG * SQRT3 * (r + q / 2)];
}

export function buildJwstModel(): Group {
  const jwst = new Group();

  // --- Primary mirror: 18 hexagonal segments in the JWST honeycomb. ---
  const goldMat = new MeshBasicMaterial({ color: GOLD });
  // Hex prism: cylinder with 6 sides, face laid into the x-y plane toward +z.
  const hexGeom = new CylinderGeometry(SEG * SEAM, SEG * SEAM, 0.05, 6);
  hexGeom.rotateX(Math.PI / 2);
  const mirror = new Group();
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 2) continue;
      if (q === 0 && r === 0) continue; // centre empty: 19 - 1 = 18 segments
      const [x, y] = hexCentre(q, r);
      const seg = new Mesh(hexGeom, goldMat);
      seg.position.set(x, y, 0);
      mirror.add(seg);
    }
  }
  jwst.add(mirror);

  // --- Secondary mirror on a tripod boom, in front of the empty centre. ---
  const secondary = new Mesh(new CircleGeometry(0.13, 24), new MeshBasicMaterial({
    color: GOLD,
    side: DoubleSide
  }));
  secondary.position.set(0, 0, BOOM);
  jwst.add(secondary);

  const strutMat = new LineBasicMaterial({ color: STRUT, transparent: true, opacity: 0.8 });
  const rim: [number, number][] = [
    [0, 0.72], // top
    [-0.62, -0.36], // lower-left
    [0.62, -0.36] // lower-right
  ];
  for (const [rx, ry] of rim) {
    jwst.add(new Line(
      lineGeom([0, 0, BOOM, rx, ry, 0]),
      strutMat
    ));
  }

  // --- Five-layer diamond sunshield behind and below, kite-shaped. It sits
  // well back and translucent so the gold mirror stays the hero, as on the
  // real telescope. ---
  const shield = new Group();
  for (let i = 0; i < 5; i++) {
    const s = 1 + i * 0.08;
    const layer = new Mesh(
      new PlaneGeometry(2.7 * s, 1.9 * s),
      new MeshBasicMaterial({
        color: SHIELD,
        transparent: true,
        opacity: 0.1 - i * 0.011,
        side: DoubleSide,
        depthWrite: false
      })
    );
    layer.rotation.z = Math.PI / 4; // square to diamond
    layer.position.z = -0.8 - i * 0.16;
    shield.add(layer);
  }
  shield.position.y = -0.2;
  shield.rotation.x = -0.34; // tilt so the layers read from a head-on view
  jwst.add(shield);

  return jwst;
}

function lineGeom(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}

// The real thing: NASA's public-domain JWST model (glTF 2.0, Draco). Loaded
// lazily and swapped in over the procedural placeholder; if it fails (offline)
// the placeholder stays. Needs a light in the scene (its materials are lit).
const MODEL_URL = `${import.meta.env.BASE_URL}assets/models/jwst.glb`;
const DRACO_PATH = `${import.meta.env.BASE_URL}assets/draco/`;
const TARGET_SIZE = 6; // largest bounding dimension, scene units

export function loadJwstGltf(onLoad: (model: Group) => void): void {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    MODEL_URL,
    (gltf) => {
      const inner = gltf.scene;
      const box = new Box3().setFromObject(inner);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      inner.position.sub(center); // centre the model on the origin
      const wrap = new Group();
      wrap.add(inner);
      wrap.scale.setScalar(TARGET_SIZE / (Math.max(size.x, size.y, size.z) || 1));
      // Face the gold mirror toward +z (the tour looks straight on; Explore
      // sees it three-quarter), with a slight roll so it reads as a solid.
      wrap.rotation.set(Math.PI, Math.PI, 0.12);
      draco.dispose();
      onLoad(wrap);
    },
    undefined,
    (err) => console.warn('JWST glTF failed to load; keeping procedural model', err)
  );
}
