/* =========================================================================
   The Cipher Room — the building.

   Six rooms sharing one continuous floor plan, laid out so the camera can
   physically walk from the street door to the night sky without ever passing
   through a wall. Nothing here animates itself: world.js builds geometry and
   hands back the handles (lights, door, portal, particles) that tour.js
   tweens. That split is what keeps the tour seekable.

   Plan, looking down (x →, z ↓). Camera enters bottom-centre.

        z=+6   ┌───────────┐
               │  01 HALL  │           x[-6,  6]  z[-16, +6]
        z=-16  └──┐ ▯ ┌────┘
               ┌──┘   └──────────────┬───────────┐
               │   02 MAIN BAR       ▯ 03 LOUNGE │  bar  x[-6, 22] z[-30,-16]
        z=-30  └─────────────────────┤           │  loun x[22, 36] z[-32,-16]
                                     └──┐ ▯ ┌────┘
                                     ┌──┘   └──┐
                                     │ 04 EVENT│              x[20, 38] z[-50,-32]
                                     └──┐ ▯ ┌──┘
                                        │   │
                                        │05 │  corridor       x[26, 32] z[-72,-50]
                                        └─▯─┘
                                       ┌─────┐
                                       │ 06  │  exit          x[24, 34] z[-80,-72]
                                       └──╫──┘  ← the door, then sky
   ========================================================================= */

import * as THREE from 'three';

/* ---------------------------------------------------------------- palette */

const C = {
  void:      new THREE.Color('#0A0713'),
  plaster:   new THREE.Color('#1A1526'),
  wood:      new THREE.Color('#2A1D28'),
  iris:      new THREE.Color('#7B6BF2'),
  persimmon: new THREE.Color('#FF7A4D'),
  nickel:    new THREE.Color('#AEB6C9'),
  porcelain: new THREE.Color('#F2EFF7'),
  rust:      new THREE.Color('#5A2418'),
  filament:  new THREE.Color('#FFB98F')
};

const mat = {
  wall:    new THREE.MeshStandardMaterial({ color: C.plaster, roughness: 0.96, metalness: 0.0 }),
  floor:   new THREE.MeshStandardMaterial({ color: 0x120D18, roughness: 0.82, metalness: 0.05 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0x0D0A14, roughness: 1.0 }),
  wood:    new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.7, metalness: 0.08 }),
  /* nickel where a bar of this vintage would use brass — the single decision
     that pulls the whole building off warm metal and onto cold */
  brass:   new THREE.MeshStandardMaterial({ color: C.nickel, roughness: 0.22, metalness: 0.95 }),
  copper:  new THREE.MeshStandardMaterial({ color: C.iris, roughness: 0.55, metalness: 0.7 }),
  oxblood: new THREE.MeshStandardMaterial({ color: 0x38150F, roughness: 0.86, metalness: 0.04 }),
  glass:   new THREE.MeshStandardMaterial({ color: 0x312B4A, roughness: 0.15, metalness: 0.3,
                                            transparent: true, opacity: 0.55 })
};

/* ------------------------------------------------------------- primitives */

const box = (w, h, d, m, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
};

/* A wall with an optional doorway punched through it, built as jambs plus a
   lintel rather than as CSG — three boxes are cheaper and read identically at
   this level of stylisation. `gap` is [from, to] along the wall's own axis. */
function wall(group, { axis, at, from, to, h, gap, thickness = 0.3, m = mat.wall }) {
  const spans = gap ? [[from, gap[0]], [gap[1], to]] : [[from, to]];

  for (const [a, b] of spans) {
    if (b - a <= 0.01) continue;
    const len = b - a, mid = (a + b) / 2;
    group.add(axis === 'x'
      ? box(len, h, thickness, m, mid, h / 2, at)
      : box(thickness, h, len, m, at, h / 2, mid));
  }

  if (gap) {                                   // lintel over the opening
    const len = gap[1] - gap[0], mid = (gap[0] + gap[1]) / 2;
    const lintelH = h - 2.6;
    if (lintelH > 0.05) {
      group.add(axis === 'x'
        ? box(len, lintelH, thickness, m, mid, h - lintelH / 2, at)
        : box(thickness, lintelH, len, m, at, h - lintelH / 2, mid));
    }
  }
}

function room(group, { x0, x1, z0, z1, h, walls }) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, h, cz);
  group.add(ceil);

  for (const spec of walls) wall(group, { h, ...spec });
}

/* --------------------------------------------------------------- fittings */

/* Bottles on the back bar. One InstancedMesh so a hundred of them cost one
   draw call — they exist to catch highlights, not to be looked at. */
function bottles(count, x0, x1, y, z, seed) {
  const geo = new THREE.CylinderGeometry(0.05, 0.06, 0.34, 6);
  const inst = new THREE.InstancedMesh(geo, mat.glass, count);
  const m4 = new THREE.Matrix4();
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    m4.makeTranslation(
      x0 + (x1 - x0) * t + (rnd() - 0.5) * 0.12,
      y + rnd() * 0.1,
      z + (rnd() - 0.5) * 0.16
    );
    m4.scale(new THREE.Vector3(1, 0.75 + rnd() * 0.7, 1));
    inst.setMatrixAt(i, m4);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

function easel(x, z, faceY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = faceY;

  /* Sized to hold a card, not to be scale-accurate: the HTML poster is ~230px
     wide and the board has to read as its support, so the board leads and the
     frame follows. */
  g.add(box(0.07, 3.1, 0.07, mat.wood, -1.0, 1.55, 0));
  g.add(box(0.07, 3.1, 0.07, mat.wood, 1.0, 1.55, 0));
  g.add(box(2.14, 0.08, 0.12, mat.wood, 0, 0.86, 0.03));     // the ledge
  g.add(box(0.07, 2.4, 0.07, mat.wood, 0, 1.2, 0.42));       // back leg

  const board = box(2.0, 2.6, 0.05, mat.wood, 0, 2.16, 0.01);
  /* light enough that a candle beside it reads the board as a surface —
     the card pinned to it needs something to be pinned to */
  board.material = new THREE.MeshStandardMaterial({ color: 0x1C1533, roughness: 0.95 });
  g.add(board);
  return g;
}

/* A practical: the visible source of a light, not the light itself. A dark
   room lit only by invisible PointLights reads as flat and grey — the eye has
   nothing to anchor exposure against. Putting an emissive object where each
   light lives gives the bloom pass something to catch, and does more for the
   sense of "lit" than any amount of extra intensity. */
function practical(geo, color, intensity, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: color, emissiveIntensity: intensity,
    roughness: 1, toneMapped: true
  }));
  m.position.set(x, y, z);
  return m;
}

const BULB = new THREE.SphereGeometry(0.075, 10, 8);
const FLAME = new THREE.SphereGeometry(0.045, 8, 6);

/* A procedural star cube map. The spec asks for CubeTextureLoader; loading six
   files would mean six assets to ship and a load race inside the tour, so the
   faces are painted once into canvases and handed to CubeTexture directly —
   same object, no network, and seeded so every render is identical. */
function starfield(size = 512) {
  const faces = [];
  let s = 20250821;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;

  for (let f = 0; f < 6; f++) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');

    const sky = ctx.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#07051a');
    sky.addColorStop(1, '#100B24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 320; i++) {
      const x = rnd() * size, y = rnd() * size;
      const r = Math.pow(rnd(), 3.2) * 1.9 + 0.25;
      const a = 0.25 + rnd() * 0.75;
      const warm = rnd() > 0.78;
      ctx.fillStyle = warm
        ? `rgba(255, 206, 184, ${a})`
        : `rgba(212, 208, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    faces.push(cv);
  }

  const tex = new THREE.CubeTexture(faces);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ build */

export function buildWorld(scene) {
  const shell = new THREE.Group();
  scene.add(shell);

  /* Each room is its own Group so the tour can hide the ones the camera is
     nowhere near. Nothing is occlusion-culled otherwise — the whole building
     would be shaded every frame, including six rooms' worth of wall stacked
     behind whichever one is actually on screen. */
  const G = {};
  for (const k of ['hall', 'bar', 'lounge', 'event', 'corridor', 'exit']) {
    G[k] = new THREE.Group();
    shell.add(G[k]);
  }
  let g = G.hall;
  const put = (m) => g.add(m);

  /* ── 01 · entrance hall ─────────────────────────────────────────────── */
  room(g, {
    x0: -6, x1: 6, z0: -16, z1: 6, h: 5,
    walls: [
      { axis: 'x', at: 6,   from: -6, to: 6, thickness: 0.4 },              // street end
      { axis: 'x', at: -16, from: -6, to: 6, gap: [-1.7, 1.7] },            // into the bar
      { axis: 'z', at: -6,  from: -16, to: 6 },
      { axis: 'z', at: 6,   from: -16, to: 6 }
    ]
  });

  // panelled dado down both sides — the only ornament the hall gets
  for (let z = -15; z < 5; z += 1.6) {
    put(box(0.08, 1.1, 1.3, mat.wood, -5.7, 0.62, z));
    put(box(0.08, 1.1, 1.3, mat.wood, 5.7, 0.62, z));
  }
  // the two bulbs the hall is actually lit by, on their flexes
  for (const z of [-2, -12.5]) {
    put(box(0.02, 1.2, 0.02, mat.brass, 0, 4.4, z));
    put(practical(BULB, C.filament, 2.6, 0, 3.4, z));
  }

  // the doorway's brass surround, the first sight of the motif
  put(box(0.12, 2.7, 0.12, mat.brass, -1.78, 1.35, -16));
  put(box(0.12, 2.7, 0.12, mat.brass, 1.78, 1.35, -16));
  put(box(3.7, 0.12, 0.12, mat.brass, 0, 2.72, -16));

  g = G.bar;
  /* ── 02 · main bar ──────────────────────────────────────────────────── */
  room(g, {
    x0: -6, x1: 22, z0: -30, z1: -16, h: 4.4,
    walls: [
      { axis: 'x', at: -30, from: -6, to: 22 },                             // back bar
      { axis: 'z', at: -6,  from: -30, to: -16 },
      { axis: 'z', at: 22,  from: -30, to: -16, gap: [-24.8, -21.2] }       // into the lounge
    ]
  });

  const counter = box(22, 1.12, 0.9, mat.wood, 8, 0.56, -27.4);
  put(counter);
  put(box(22, 0.07, 1.06, mat.brass, 8, 1.15, -27.4));                // brass rail top
  put(box(22, 0.5, 0.6, mat.wood, 8, 0.25, -28.6));                   // duckboard / kick
  put(box(21.6, 0.1, 0.7, mat.wood, 8, 1.55, -29.3));                 // back-bar shelves
  put(box(21.6, 0.1, 0.7, mat.wood, 8, 2.15, -29.3));
  put(bottles(64, -2, 18, 1.78, -29.3, 12345));
  put(bottles(58, -2, 18, 2.38, -29.3, 999331));

  /* Iris strips under each shelf. These are what make the back bar read
     from across the room — the bottles in front of them go to silhouette and
     catch rim light, which is exactly how a real back bar looks. */
  for (const y of [1.52, 2.12]) {
    const strip = practical(new THREE.BoxGeometry(21.4, 0.035, 0.1), C.iris, 1.45, 8, y, -28.92);
    put(strip);
  }
  // pendants over the counter, one above each cocktail
  for (const x of [4, 9.5, 15]) {
    put(box(0.02, 1.0, 0.02, mat.brass, x, 3.9, -26.4));
    put(box(0.34, 0.16, 0.34, mat.brass, x, 3.34, -26.4));
    put(practical(BULB, C.filament, 2.3, x, 3.2, -26.4));
  }

  // stools, so the counter has a human scale in front of it
  for (let x = 0; x <= 16; x += 2.6) {
    put(box(0.42, 0.06, 0.42, mat.wood, x, 0.78, -26.2));
    put(box(0.07, 0.78, 0.07, mat.brass, x, 0.39, -26.2));
  }

  g = G.lounge;
  /* ── 03 · private lounge ────────────────────────────────────────────── */
  room(g, {
    x0: 22, x1: 36, z0: -32, z1: -16, h: 4.2,
    walls: [
      { axis: 'x', at: -16, from: 22, to: 36 },                             // north wall (the prose)
      { axis: 'x', at: -32, from: 22, to: 36, gap: [26.4, 29.6] },          // into the event room
      { axis: 'z', at: 36,  from: -32, to: -16 }                            // east wall (fireplace)
    ]
  });

  // the hearth
  put(box(0.5, 2.4, 3.0, mat.wood, 35.6, 1.2, -24));
  const firebox = box(0.3, 1.1, 1.7, new THREE.MeshStandardMaterial({ color: 0x0B0810, roughness: 1 }),
                      35.35, 0.55, -24);
  put(firebox);
  put(box(0.7, 0.12, 3.4, mat.brass, 35.5, 2.5, -24));                // mantel

  // two chesterfields facing the fire
  for (const z of [-21.4, -26.6]) {
    put(box(2.2, 0.5, 0.95, mat.oxblood, 31.4, 0.34, z));
    put(box(2.2, 0.9, 0.28, mat.oxblood, 31.4, 0.8, z + (z < -24 ? -0.45 : 0.45)));
  }
  put(box(1.1, 0.08, 1.1, mat.brass, 31.4, 0.5, -24));                // low table

  // the burning part of the hearth, and a lamp so the seating reads at all
  const emberBed = practical(new THREE.BoxGeometry(0.14, 0.42, 1.35), 0xFF5A22, 1.7, 35.28, 0.42, -24);
  put(emberBed);
  put(box(0.05, 0.5, 0.05, mat.brass, 31.4, 0.79, -24));
  put(practical(new THREE.SphereGeometry(0.085, 12, 10), C.filament, 1.1, 31.4, 1.08, -24));

  g = G.event;
  /* ── 04 · event room ────────────────────────────────────────────────── */
  room(g, {
    x0: 20, x1: 38, z0: -50, z1: -32, h: 4.6,
    walls: [
      { axis: 'x', at: -50, from: 20, to: 38, gap: [27.4, 30.6] },          // into the corridor
      { axis: 'z', at: 20,  from: -50, to: -32 },
      { axis: 'z', at: 38,  from: -50, to: -32 }
    ]
  });

  /* Three easels on an arc centred on where the camera will stand, so the
     180° pan meets each one square-on instead of at a glancing angle. */
  const EASEL_ARC = [
    { x: 21.5, z: -42.7, face: Math.PI * 0.62 },
    { x: 29.0, z: -48.5, face: 0 },
    { x: 36.5, z: -42.7, face: -Math.PI * 0.62 }
  ];
  EASEL_ARC.forEach((e) => {
    put(easel(e.x, e.z, e.face));
    put(box(0.07, 0.26, 0.07, mat.brass, e.x + 0.86, 0.99, e.z + 0.5));
    put(practical(FLAME, C.filament, 2.8, e.x + 0.86, 1.19, e.z + 0.5));
  });

  g = G.corridor;
  /* ── 05 · gallery corridor ──────────────────────────────────────────── */
  room(g, {
    x0: 26, x1: 32, z0: -72, z1: -50, h: 3.6,
    walls: [
      { axis: 'x', at: -72, from: 26, to: 32, gap: [27.6, 30.4] },
      { axis: 'z', at: 26,  from: -72, to: -50 },
      { axis: 'z', at: 32,  from: -72, to: -50 }
    ]
  });

  // frames marching down both walls — the corridor's whole job is perspective
  /* The frame geometry is already wall-oriented — thin on x, tall on y, wide
     on z. Rotating it would swing that 0.82 depth out into the corridor. */
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x14101F, roughness: 0.9, emissive: C.iris, emissiveIntensity: 0.95
  });
  for (let z = -53; z > -71; z -= 2.4) {
    for (const x of [26.2, 31.8]) {
      const inward = x < 29 ? 1 : -1;
      put(box(0.05, 1.12, 0.84, mat.brass, x, 1.85, z));
      put(box(0.02, 0.88, 0.62, plateMat, x + 0.04 * inward, 1.85, z));
    }
  }

  g = G.exit;
  /* ── 06 · exit ──────────────────────────────────────────────────────── */
  room(g, {
    x0: 24, x1: 34, z0: -80, z1: -72, h: 4.0,
    walls: [
      { axis: 'x', at: -80, from: 24, to: 34, gap: [27.4, 30.6] },          // the doorway itself
      { axis: 'z', at: 24,  from: -80, to: -72 },
      { axis: 'z', at: 34,  from: -80, to: -72 }
    ]
  });

  /* The door hangs off a hinge group so rotating the group swings the leaf
     about its edge — rotating the mesh would spin it about its middle. */
  const hinge = new THREE.Group();
  hinge.position.set(27.4, 0, -80);
  const leaf = box(3.2, 2.6, 0.12, mat.oxblood, 1.6, 1.3, 0);
  hinge.add(leaf);
  hinge.add(box(0.5, 0.5, 0.06, mat.brass, 1.6, 1.35, 0.09));               // the dial, on the door
  hinge.add(box(0.1, 0.1, 0.08, mat.brass, 1.6, 1.55, 0.12));
  put(hinge);

  /* The portal: a ring of light standing in the opened doorway. */
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x0F0B18, emissive: C.persimmon, emissiveIntensity: 0.1,
    roughness: 0.3, metalness: 0.6
  });
  const portal = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.045, 12, 64), portalMat);
  portal.position.set(29, 1.15, -80.4);
  put(portal);

  /* ── sky beyond the door ────────────────────────────────────────────── */
  scene.background = null;                     // the rooms sit on black
  const sky = new THREE.Mesh(
    new THREE.BoxGeometry(400, 400, 400),
    new THREE.MeshBasicMaterial({ envMap: starfield(), side: THREE.BackSide, fog: false })
  );
  sky.position.set(29, 0, -80);
  scene.add(sky);

  /* ── lighting ───────────────────────────────────────────────────────
     A travelling rig, not a fixture list. Three.js evaluates every light in
     the scene for every lit fragment, with no per-object culling, so twenty
     standing lights cost twenty times over on surfaces that only ever see
     one room's worth of them. Instead there is one pool — three points and
     three spots — that tick() re-places into whichever room the camera is
     currently standing in. Seven lights total, and the shader never has to
     be recompiled because the count never changes. */

  const ambient = new THREE.AmbientLight(0x342B52, 2.6);
  scene.add(ambient);

  const L = {
    key: [0, 1, 2].map(() => {
      const p = new THREE.PointLight(C.filament, 0, 26, 2);
      scene.add(p);
      return p;
    }),
    spot: [0, 1, 2].map(() => {
      const sp = new THREE.SpotLight(C.filament, 0, 22, Math.PI / 6, 0.6, 1.6);
      scene.add(sp);
      scene.add(sp.target);
      return sp;
    })
  };

  /* ── golden motes in the entrance hall ──────────────────────────────── */
  const COUNT = 420;
  const pos = new Float32Array(COUNT * 3);
  const seedA = new Float32Array(COUNT);
  let s = 4242;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = -5.4 + rnd() * 10.8;
    pos[i * 3 + 1] = 0.3 + rnd() * 4.2;
    pos[i * 3 + 2] = 5 + rnd() * -20;
    seedA[i] = rnd();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));

  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uFade:  { value: 1 },
      uScale: { value: 900 },
      uColor: { value: C.filament }
    },
    vertexShader: /* glsl */`
      uniform float uTime, uFade, uScale;
      attribute float aSeed;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.30 + aSeed * 31.0) * 0.34;
        p.x += cos(uTime * 0.22 + aSeed * 17.0) * 0.28;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = uFade * (0.30 + 0.70 * abs(sin(uTime * 0.75 + aSeed * 44.0)));
        gl_PointSize = (0.026 + aSeed * 0.05) * uScale / max(-mv.z, 0.001);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = pow(1.0 - d * 2.0, 2.6) * vA;
        if (a <= 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  /* Anything that flickers needs somewhere to keep the level the tour asked
     for. tick() writes `intensity` every frame, so if the tour tweened
     intensity directly the flicker would multiply the value it found and
     compound itself down to nothing the moment the tween let go. */
  const levels = {
    hall:   { v: 0 },
    spots:  [{ v: 0 }, { v: 0 }, { v: 0 }],   // cocktails, then reused for candles
    wash:   { v: 0 },
    fire:   { v: 0 },
    wall:   { v: 0 },
    track:  { v: 0 },
    exit:   { v: 0 }
  };

  return { shell, rooms: G, lights: L, levels, easels: EASEL_ARC,
           ambient, door: hinge, portal, portalMat, dust, sky };
}

export { C as PALETTE };
