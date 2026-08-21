/* =========================================================================
   Boot.

   One renderer, one camera, one paused timeline. The GSAP ticker is the only
   loop in the application — Three.js never runs a requestAnimationFrame of its
   own — and every frame it draws is a pure function of tour.time():

     tour.time()  →  rig.eye / rig.focus  →  camera
                  →  light levels, motes, grain
                  →  projected positions of the HTML overlays

   Because nothing consults the wall clock, pausing is a true freeze, scrubbing
   is a true seek, and the same timestamp always produces the same pixels.
   ========================================================================= */

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildTour, tick, rig, ROOMS } from './tour.js';
import { initOverlays } from './overlays.js';
import { initPost } from './post.js';
import { initControls } from './controls.js';

gsap.registerPlugin(TextPlugin, Draggable);

const CAPTURE = new URLSearchParams(location.search).has('capture');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Film grain on the DOM overlay layer, stepped off the tour rather than
   animated in CSS, for the same determinism reason as the shader grain. */
const GRAIN_STEPS = [[0, 0], [-38, 22], [26, -28], [-18, -14]];
function applyGrain(el, t) {
  const [x, y] = GRAIN_STEPS[Math.floor(t * 12) % 4];
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function boot() {
  const canvas = document.getElementById('gl');
  const grainEl = document.getElementById('grain');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0A0713, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0A0713, 0.016);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
  camera.position.copy(rig.eye);

  const world = buildWorld(scene);
  const overlays = initOverlays(camera);
  const post = initPost(renderer, scene, camera);
  const tour = buildTour(world, overlays);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* The single frame function. Order matters: the rig has to be applied and
     the camera matrices refreshed before the overlays project against them,
     or the HTML lags the scene by one frame and visibly swims. */
  function draw(t) {
    tick(world, t);

    camera.position.copy(rig.eye);
    camera.lookAt(rig.focus);
    camera.updateMatrixWorld();

    overlays.update();
    applyGrain(grainEl, t);
    post.render(t);
  }

  gsap.ticker.add(() => draw(tour.time()));

  document.documentElement.classList.remove('booting');

  if (CAPTURE) {
    document.documentElement.classList.add('capture');
    tour.pause(0);
    draw(0);
    window.film = {
      tour,
      duration: tour.duration(),
      rooms: ROOMS,
      seek(t) {
        tour.pause();
        tour.time(t, false);
        draw(t);
        return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    };
    window.dispatchEvent(new Event('film:ready'));
    return;
  }

  const controls = initControls(tour, ROOMS);
  gsap.ticker.add(controls.sync);

  if (reduced) gsap.globalTimeline.timeScale(1.5);

  tour.play();
  // handles for poking at in the console / profiling in the browser
  window.tour = tour;
  window.stage3d = { renderer, scene, camera, post, world };
}

/* Wait for the webfonts: the overlays are measured and centred on their
   projected points, and a late font swap would shift every one of them. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => requestAnimationFrame(boot));
} else {
  window.addEventListener('load', boot);
}
