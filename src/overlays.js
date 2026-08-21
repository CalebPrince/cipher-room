/* =========================================================================
   HTML pinned into the 3D scene.

   Every `.anchor` in the markup names a point in the room. Each frame that
   point is projected through the same camera the renderer uses, and the
   element is moved to the resulting pixel. The copy therefore behaves like an
   object standing in the room — it slides as the camera tracks, grows as the
   camera approaches, and disappears when the camera turns away from it —
   while still being real, selectable, accessible text.

   Scale is clamped. A literal projection would make a headline fill the screen
   as the camera closes the last metre, so each anchor declares the distance it
   is designed to be read from and how far the scale may stray from it.

   Depth parallax is done by the browser, not here: #stage carries a CSS
   perspective and each anchor preserves 3d, so a child pushed on translateZ
   drifts against its siblings as the anchor moves off-centre. That is the
   `transform: translateZ()` layering the brief asks for, driven for free by
   the projection rather than by a second animation.
   ========================================================================= */

import * as THREE from 'three';

/* world position, the distance it reads best from, and its scale envelope */
const ANCHORS = {
  hero:     { p: [0, 1.75, -14.6],    ref: 11, min: 0.55, max: 1.30 },
  barTag:   { p: [1.5, 2.95, -28.6],  ref: 8,  min: 0.45, max: 1.05 },
  card1:    { p: [4, 1.62, -26.5],    ref: 6,  min: 0.58, max: 1.05 },
  card2:    { p: [9.5, 1.62, -26.5],  ref: 6,  min: 0.58, max: 1.05 },
  card3:    { p: [15, 1.62, -26.5],   ref: 6,  min: 0.58, max: 1.05 },
  /* The camera leaves the orbit facing +z, which puts +x on the LEFT of
     frame — so the plate takes the higher x to land on the left wall. They
     are pushed a further 2.2 units apart than the wall strictly needs so the
     pegboard and the prose read as two things on a wall rather than as one
     block that happens to contain a picture. */
  storyImg: { p: [32.7, 2.05, -16.55], ref: 11, min: 0.62, max: 1.15 },
  story:    { p: [23.6, 2.05, -16.55], ref: 11, min: 0.62, max: 1.15 },
  /* pushed 0.3 off each board along that board's own normal, not along +z:
     a flat z offset on an angled easel throws the card sideways on the board
     as soon as the camera is not square to the world axes */
  ev1:      { p: [21.78, 2.16, -42.81], ref: 8, min: 0.6, max: 1.35 },
  ev2:      { p: [29, 2.16, -48.2],     ref: 8, min: 0.6, max: 1.35 },
  ev3:      { p: [36.22, 2.16, -42.81], ref: 8, min: 0.6, max: 1.35 },
  quote:    { p: [29, 1.95, -70.2],   ref: 9,  min: 0.66, max: 1.25 },
  /* dropped clear of the combination dial on the door, which sits at 1.35 at
     the far end of the corridor and landed between quote and credit */
  attrib:   { p: [29, 1.05, -70.2],   ref: 9,  min: 0.66, max: 1.25 },
  /* Capped tighter than the rest, and hung lower on the wall. This is the
     only anchor the camera ends up close to: at its natural scale the contact
     plate covered the door it is supposed to be standing in, and sitting at
     eye level +1.5 it projected high enough that the top of the plate ran off
     the top of the browser window on anything shorter than 800px. */
  foot:     { p: [29, 2.5, -85.5],     ref: 11, min: 0.5,  max: 1.0 }
};

export function initOverlays(camera) {
  const stage = document.getElementById('stage');
  const items = [];

  const byName = {};

  document.querySelectorAll('.anchor').forEach((el) => {
    const spec = ANCHORS[el.dataset.anchor];
    if (!spec) return;

    /* Two layers, because two things want to write `transform`: this module
       writes the projection onto the outer .anchor every frame, and the tour
       tweens opacity and y on the inner wrapper. One element for both would
       mean the projection stamping over GSAP's tween sixty times a second. */
    const inner = document.createElement('div');
    inner.className = 'anchor-in';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    inner.style.opacity = '0';                  // the tour owns visibility

    items.push({ el, spec, world: new THREE.Vector3(...spec.p), v: new THREE.Vector3() });
    byName[el.dataset.anchor] = inner;

    inner.querySelectorAll('[data-depth]').forEach((child) => {
      child.style.transform = `translateZ(${child.dataset.depth}px)`;
    });
  });

  let w = window.innerWidth, h = window.innerHeight;
  const resize = () => { w = window.innerWidth; h = window.innerHeight; };
  window.addEventListener('resize', resize);

  function update() {
    for (const it of items) {
      it.v.copy(it.world).project(camera);

      /* z outside [-1,1] means the point is behind the lens or past the far
         plane; projecting it anyway would smear the element across the screen */
      const behind = it.v.z > 1 || it.v.z < -1;
      if (behind) {
        it.el.style.visibility = 'hidden';
        continue;
      }
      it.el.style.visibility = 'visible';

      const dist = camera.position.distanceTo(it.world);
      const scale = Math.min(it.spec.max, Math.max(it.spec.min, it.spec.ref / dist));

      const x = (it.v.x * 0.5 + 0.5) * w;
      const y = (-it.v.y * 0.5 + 0.5) * h;
      it.el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    }
  }

  return {
    update,
    /* tour.js tweens elements by handle rather than by selector string */
    el: (name) => byName[name] || stage
  };
}
