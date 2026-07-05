import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): { composer: EffectComposer; resize: (w: number, h: number) => void } {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1920, 1080), 0.85, 0.55, 0.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    composer,
    resize: (w, h) => {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    }
  };
}
