import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { OriginFrame } from '../render/floating-origin';
import type { Timeline } from '../sim/timeline';
import type { Captions } from '../ui/captions';
import type { Hud } from '../ui/hud';
import type { Inspector } from '../ui/inspector';
import type { LabelLayer } from '../ui/labels';
import type { ScaleRibbon } from '../ui/scale-ribbon';
import type { TimeControls } from '../ui/time-controls';

export type ActMode = 'tour' | 'explore';

export interface ActServices {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  origin: OriginFrame;
  timeline: Timeline;
  hud: Hud;
  captions: Captions;
  ribbon: ScaleRibbon;
  labels: LabelLayer;
  inspector: Inspector;
  timeControls: TimeControls;
  setActHeading: (name: string, question: string) => void;
}

export interface Act {
  readonly id: number;
  readonly title: string;
  readonly question: string;
  enter(mode: ActMode): void;
  setMode(mode: ActMode): void;
  update(dtRealS: number): void;
  exit(): void;
  onPlayPause(): void;
  onWarpCycle(): void;
  onScrub(progress: number): void;
  onToggleTrueScale(): void;
}
