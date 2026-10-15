// Lighting for the Act 4 pearl close-up, shared by the act and the
// /pearl.html spike so the two cannot drift apart.
//
// A polished metal surface with nothing to reflect renders black, so the
// craft needs an environment as well as lights. Deep space has almost none,
// which is physically right and reads as a silhouette; the rig keeps a faint
// one (intensity well under 1) purely so the mirror and the ring read as
// metal rather than as holes. The key light stands in for the Sun.

import {
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ENVIRONMENT_INTENSITY = 0.22;

export class PearlLighting {
  readonly keyLight = new DirectionalLight(0xfff2e0, 1.6);
  readonly fillLight = new HemisphereLight(0xbcd2ff, 0x161d29, 0.5);
  private environment: Texture | null = null;
  private savedEnvironment: Texture | null = null;
  private savedIntensity = 1;

  constructor() {
    this.keyLight.position.set(6, 8, 10);
  }

  // Adds the lights and the environment, remembering what the scene had so
  // exit() can hand it back unchanged.
  attach(scene: Scene, renderer: WebGLRenderer): void {
    if (!this.environment) {
      const pmrem = new PMREMGenerator(renderer);
      this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    this.savedEnvironment = scene.environment;
    this.savedIntensity = scene.environmentIntensity;
    scene.environment = this.environment;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    scene.add(this.keyLight, this.fillLight);
  }

  detach(scene: Scene): void {
    scene.remove(this.keyLight, this.fillLight);
    scene.environment = this.savedEnvironment;
    scene.environmentIntensity = this.savedIntensity;
  }
}
