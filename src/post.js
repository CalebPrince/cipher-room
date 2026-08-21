/* =========================================================================
   Post-processing chain.

     RenderPass  →  UnrealBloomPass  →  OutputPass  →  GrainVignettePass

   Bloom is what makes the practical lights read as light rather than as pale
   geometry: filament bulbs, the candles, the ring in the doorway. It runs on
   the linear buffer, before OutputPass tone-maps and converts to sRGB.

   Grain and vignette come last, deliberately. Both are darkroom effects — they
   belong to the print, not to the scene — so they are applied after the image
   has been graded rather than being tone-mapped along with it. Putting the
   vignette earlier would let bloom bleed back through the corners it just
   darkened.

   The grain is a function of the tour's own time, never of wall time. That is
   what allows a seeked frame to be identical every time it is drawn, and it is
   the difference between a page that can be exported as a video and one that
   can only be screen-recorded.
   ========================================================================= */

import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';

const GrainVignetteShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uTime:      { value: 0 },
    uGrain:     { value: 0.055 },
    uVignette:  { value: 1.15 },
    uTint:      { value: new THREE.Color('#6E5FD8') }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec4 col = texture2D(tDiffuse, vUv);

      // vignette: distance from centre, corrected so it is round rather than
      // stretched on a wide viewport
      vec2 d = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.24, 0.78, length(d) * uVignette);
      col.rgb *= mix(0.28, 1.0, vig);

      // the shadows drift toward iris — the room's own colour, so the
      // darkness reads as violet ink rather than as neutral grey
      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(col.rgb, uTint * luma * 1.25, (1.0 - luma) * 0.22);

      // grain, stepped so it strobes at ~12fps like real film rather than
      // shimmering at the display's refresh rate
      float frame = floor(uTime * 12.0);
      float n = hash(vUv * 900.0 + frame * 17.13);
      col.rgb += (n - 0.5) * uGrain;

      gl_FragColor = col;
    }`
};

export function initPost(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  /* strength, radius, threshold — the threshold is high on purpose so only
     the practical lights bloom and the plaster walls stay matte */
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.52, 0.7, 0.9);
  composer.addPass(bloom);

  const output = new OutputPass();
  composer.addPass(output);

  const grain = new ShaderPass(GrainVignetteShader);
  grain.renderToScreen = true;
  composer.addPass(grain);

  return {
    composer,
    bloom,
    grain,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    render(t) {
      grain.uniforms.uTime.value = t;
      composer.render();
    }
  };
}
