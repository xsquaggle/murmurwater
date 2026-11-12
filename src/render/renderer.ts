/** WebGL renderer + post-processing chain, configured by graphics quality. */
import { HalfFloatType, NoToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Uniform, Vector3, WebGLRenderer } from 'three';
import {
  BlendFunction, BloomEffect, Effect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  pixelRatio: number;
  msaa: number;
  shadows: boolean;
  shadowSize: number;
  waterSegments: number;
  bloom: boolean;
  smaa: boolean;
  viewDistance: number;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 0.75, msaa: 0, shadows: false, shadowSize: 1024, waterSegments: 160, bloom: false, smaa: true, viewDistance: 1800 },
  medium: { pixelRatio: 1, msaa: 0, shadows: true, shadowSize: 1024, waterSegments: 256, bloom: true, smaa: true, viewDistance: 3000 },
  high: { pixelRatio: 1, msaa: 4, shadows: true, shadowSize: 2048, waterSegments: 384, bloom: true, smaa: false, viewDistance: 4500 },
  ultra: { pixelRatio: 1.5, msaa: 4, shadows: true, shadowSize: 4096, waterSegments: 512, bloom: true, smaa: false, viewDistance: 6000 },
};

/** Split-tone colour grade: warm highlights, cool violet shadows, gentle saturation lift. */
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform vec3 uShadowTint;
      uniform vec3 uHighlightTint;
      uniform float uSaturation;
      uniform float uContrast;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSaturation);
        c = (c - 0.5) * uContrast + 0.5;
        float sh = 1.0 - smoothstep(0.0, 0.55, l);
        float hi = smoothstep(0.45, 1.0, l);
        c += uShadowTint * sh * 0.06 + uHighlightTint * hi * 0.05;
        outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uShadowTint', new Uniform(new Vector3(0.23, 0.16, 0.42))],
        ['uHighlightTint', new Uniform(new Vector3(1.0, 0.7, 0.36))],
        ['uSaturation', new Uniform(1.08)],
        ['uContrast', new Uniform(1.04)],
      ]),
    });
  }
}

export class Renderer {
  readonly gl: WebGLRenderer;
  composer!: EffectComposer;
  private toneMapping!: ToneMappingEffect;
  bloom?: BloomEffect;
  profile: QualityProfile;

  constructor(readonly canvas: HTMLCanvasElement, quality: Quality, private scene: Scene, private camera: PerspectiveCamera) {
    this.profile = QUALITY[quality];
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, preserveDrawingBuffer: false });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = NoToneMapping;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    this.setQuality(quality);
  }

  setQuality(q: Quality) {
    this.profile = QUALITY[q];
    const p = this.profile;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * p.pixelRatio);
    this.gl.shadowMap.enabled = p.shadows;
    this.composer?.dispose();
    this.composer = new EffectComposer(this.gl, { frameBufferType: HalfFloatType, multisampling: p.msaa });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const effects: Effect[] = [];
    if (p.bloom) {
      this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 0.85, radius: 0.72 });
      effects.push(this.bloom);
    } else this.bloom = undefined;
    this.toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    effects.push(this.toneMapping);
    effects.push(new GradeEffect());
    effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.52 }));
    this.composer.addPass(new EffectPass(this.camera, ...effects));
    if (p.smaa) this.composer.addPass(new EffectPass(this.camera, new SMAAEffect()));
    this.resize();
  }

  setExposure(e: number) { this.gl.toneMappingExposure = e; }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number) { this.composer.render(dt); }
}
