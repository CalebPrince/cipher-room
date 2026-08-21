/* =========================================================================
   The tour — one paused GSAP timeline that owns the camera and everything
   the camera is meant to notice.

     tour.add(entrance, 0).add(bar, 22.5).add(lounge, 58.5)
         .add(event, 85.5).add(gallery, 123.75).add(exit, 150.75)

   MOVE, SETTLE, HOLD. Every room is authored as a camera move that finishes
   *before* its copy arrives, then a hold with the rig completely at rest for
   as long as the copy takes to read. The overlays are projected through this
   camera, so while it is moving they slide, scale and drift across the frame
   — legible as motion, not as text. They are only ever asked to be read once
   the camera has stopped, and they stay up for several seconds after that.
   The bar and the event room, which used to be one continuous sweep past
   three things, are now three stops with a hold on each.

   The camera is never tweened directly. Two proxy vectors are tweened — where
   the camera stands (`eye`) and what it is looking at (`focus`) — and the rig
   does `position.copy(eye); lookAt(focus)` once per frame. Authoring a 90°
   orbit or a 140° turn then becomes a matter of moving a point around the
   room, which is far easier to reason about than interpolating rotations, and
   it can never gimbal-lock halfway through a turn.

   Nothing reads wall-clock time. Every flicker, mote and pulse is a function
   of tour.time(), so any timestamp renders identically every time — the same
   discipline that lets this be exported frame-by-frame as a video.
   ========================================================================= */

import * as THREE from 'three';

const QUOTE = 'You do not find The Cipher Room. It decides, on a given night, to be findable.';

/* Seconds of screen time per second of authored time.

   The room timelines below are written in their own compact units — a dolly
   is "2.4 seconds", a hold is "1.8" — because that is the scale at which the
   choreography inside a room is legible while writing it. Playing each of
   them back at SCREEN_TIME stretches every move and every hold in the
   building by the same factor, without touching a single beat's relationship
   to its neighbours, which is what a hand-retimed version would quietly
   break.

   At 4.5 the film runs 180s. Every one of the eleven holds is at least five
   seconds of completely static frame; the contact plate at the end gets
   thirteen.

   Anything whose *rate* should not slow with the camera — the hearth flicker,
   the film grain, the caret blink, the ring's breathing — is derived from
   real seconds instead, and is marked where it happens. */
export const SCREEN_TIME = 4.5;

/* real seconds → authored seconds, for the handful of beats that are
   intervals in the world rather than camera moves */
const real = (s) => s / SCREEN_TIME;

const BLINK  = real(0.45);   // half a caret blink
const BREATH = real(2.2);    // half a breath of the ring in the doorway

/* Room offsets, in real seconds of the finished 180s walk. Retime the tour
   here and nowhere else — the scrubber, its ticks, its labels and the skip
   buttons all read this. Each slot is its own room's authored length times
   SCREEN_TIME: 5, 8, 6, 8.5, 6 and 6.5 authored seconds respectively. The
   rooms with three stops in them get the longest slots, because a stop that
   is not held is just a slower version of the sweep this replaced. */
export const ROOMS = [
  { id: 'entrance', label: 'Entrance Hall', name: 'Entrance Hall',    at: 0 },
  { id: 'bar',      label: 'Main Bar',      name: 'Main Bar',         at: 22.5 },
  { id: 'lounge',   label: 'Lounge',        name: 'Private Lounge',   at: 58.5 },
  { id: 'event',    label: 'Events',        name: 'Event Room',       at: 85.5 },
  { id: 'gallery',  label: 'Gallery',       name: 'Gallery Corridor', at: 123.75 },
  { id: 'exit',     label: 'Exit',          name: 'The Door',         at: 150.75 }
];

/* The rig the whole film is authored against. */
export const rig = {
  eye:   new THREE.Vector3(0, 1.65, 4.5),
  focus: new THREE.Vector3(0, 1.55, -24)
};

const eyeTo = (x, y, z, d, ease = 'power2.inOut') =>
  ({ x, y, z, duration: d, ease });

/* Declares a room's full slot. A GSAP timeline is only as long as its last
   beat, so without this the trailing hold — the whole point of the structure
   — would not exist: the room would end the moment its copy finished fading
   and the next would start early. A zero-duration marker at the slot's end
   makes the authored length the planned one rather than an emergent one, and
   is what makes the six slots add to exactly 180s. */
const endsAt = (tl, t) => tl.set({}, {}, t);

/* ------------------------------------------------------------------ rooms */

/* 01 · ENTRANCE HALL — a straight dolly through the doorway that stops before
   the hero settles in front of it.

   MOVE 0–2.4 · HOLD 2.4–4.5 · OUT 4.5–5.0   (authored; ×4.5 on screen) */
function entranceTimeline(w, ov) {
  const tl = gsap.timeline();

  tl.to(rig.eye, eyeTo(0, 1.65, -11, 2.4), 0)
    .fromTo(w.dust.material.uniforms.uFade, { value: 0 }, { value: 1, duration: 1.0, ease: 'power2.out' }, 0)
    .fromTo(w.levels.hall, { v: 0 }, { v: 110, duration: 1.4, ease: 'power2.out' }, 0.1)
    .to('#blackout', { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, 0.15)

    /* the lettering lands as the dolly eases out, and is completely still
       from 2.4 — nine seconds of static frame to read four lines */
    .fromTo(ov.el('hero'), { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 1.55)
    .from('#a-hero .eyebrow', { y: 18, opacity: 0, duration: 0.6, ease: 'power4.out' }, 1.65)
    .from('#a-hero h1',       { y: 42, opacity: 0, duration: 0.8, ease: 'power4.out' }, 1.78)
    .from('#a-hero .lede',    { y: 26, opacity: 0, duration: 0.7, ease: 'power4.out' }, 2.0)
    .from('#a-hero .ctas',    { y: 30, opacity: 0, duration: 0.7, ease: 'power4.out' }, 2.2)

    /* the camera is about to pass through the lettering, so it goes first */
    .to(ov.el('hero'), { opacity: 0, duration: 0.5, ease: 'power2.in' }, 4.5);

  return endsAt(tl, 5.0);
}

/* 02 · MAIN BAR — three stops, not one sweep. The camera turns the corner
   onto the first cocktail and rests, slides to the second and rests, slides
   to the third and rests again. Each card is dead still while it is being
   read; the ones already passed drift out of frame on the next move, which is
   what keeps it reading as a bar rather than as a slideshow.

   MOVE 0–1.3 · HOLD →3.1 · MOVE →4.0 · HOLD →5.4 · MOVE →6.3
   HOLD →7.5 · OUT 7.5–8.0    (8.1s, 6.3s and 5.4s of stillness) */
function barTimeline(w, ov) {
  const tl = gsap.timeline();

  /* One stop per cocktail. The eye sits 2.9 short of the card in x and 6.4
     off the counter in z — the angle the back bar reads best from, and the
     one the original single sweep passed through three times. */
  const STOP = [
    { eye: [1.1, 1.65, -21],  focus: [4.6, 1.45, -27.4] },
    { eye: [6.6, 1.65, -21],  focus: [10.1, 1.45, -27.4] },
    { eye: [12.1, 1.65, -21], focus: [15.6, 1.45, -27.4] }
  ];
  const ARRIVE = [1.3, 4.0, 6.3];        // when the camera comes to rest on k
  const cards = ['card1', 'card2', 'card3'];

  /* arrive at the first cocktail */
  tl.to(rig.eye,   eyeTo(...STOP[0].eye, 1.3), 0)
    .to(rig.focus, eyeTo(...STOP[0].focus, 1.3), 0)
    .to(w.dust.material.uniforms.uFade, { value: 0, duration: 0.7, ease: 'power2.in' }, 0)
    .to(w.levels.hall, { v: 0, duration: 0.6 }, 0)
    .to(w.levels.wash, { v: 150, duration: 1.0, ease: 'power2.out' }, 0.5)

    .fromTo(ov.el('barTag'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.5)
    .from('#a-bar-tag .rule', { scaleX: 0, duration: 0.7, ease: 'power2.inOut' }, 0.55)
    .to(ov.el('barTag'), { opacity: 0, duration: 0.4 }, 2.4);

  /* stops two and three, each preceded by its own move */
  [1, 2].forEach((k) => {
    tl.to(rig.eye,   eyeTo(...STOP[k].eye, 0.9, 'power2.inOut'), ARRIVE[k] - 0.9)
      .to(rig.focus, eyeTo(...STOP[k].focus, 0.9, 'power2.inOut'), ARRIVE[k] - 0.9);
  });

  /* each pendant comes up, then its card, as the camera settles under it */
  cards.forEach((name, k) => {
    const at = ARRIVE[k] - 0.3;
    tl.to(w.levels.spots[k], { v: 150, duration: 0.8, ease: 'power2.out' }, at - 0.2)
      .fromTo(ov.el(name), { opacity: 0, y: 44 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out' }, at);
  });

  /* all three leave together, so the last hold is the whole counter lit */
  tl.to(cards.map(ov.el), { opacity: 0, duration: 0.4, stagger: 0.05 }, 7.5);

  return endsAt(tl, 8.0);
}

/* 03 · PRIVATE LOUNGE — walk in facing the hearth, orbit 90° around the
   middle of the room, and only then let the wall arrive. The orbit used to
   carry the copy round with it, which is exactly what could not be read.

   MOVE 0–1.2 · ORBIT 1.2–3.0 · HOLD 3.0–5.4 · OUT 5.4–5.9 */
function loungeTimeline(w, ov) {
  const tl = gsap.timeline();
  const CX = 28.6, CZ = -22, R = 5.5;
  const orbit = { a: 190 };                        // degrees, measured in XZ

  tl.to(rig.eye,   eyeTo(23.18, 1.65, -22.96, 1.2), 0)
    .to(rig.focus, eyeTo(30, 1.5, -22, 1.2), 0)

    .to([w.levels.spots[0], w.levels.spots[1], w.levels.spots[2]], { v: 0, duration: 0.6 }, 0)
    .to(w.levels.wash, { v: 0, duration: 0.6 }, 0)
    .to(w.levels.wall, { v: 95, duration: 1.0, ease: 'power2.out' }, 0.3)
    .to(w.levels.fire, { v: 95, duration: 1.2, ease: 'power2.out' }, 0.2)

    /* the orbit itself: the eye rides a circle, the focus stays on the room's
       centre, so the walls sweep past at a constant rate */
    .fromTo(orbit, { a: 190 }, {
      a: 280, duration: 1.8, ease: 'power2.inOut', immediateRender: false,
      onUpdate() {
        const r = (orbit.a * Math.PI) / 180;
        rig.eye.set(CX + Math.cos(r) * R, 1.65, CZ + Math.sin(r) * R);
        rig.focus.set(CX, 1.75, CZ);
      }
    }, 1.2)

    /* the wall is square on from 3.0. Left of frame: the pegboard wipes open.
       Right of frame: the copy arrives. Both hold still for eleven seconds. */
    .fromTo(ov.el('storyImg'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 2.85)
    .fromTo('#a-story-img .plate-inner',
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power3.inOut' }, 2.9)
    .fromTo(ov.el('story'), { opacity: 0, x: 44 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }, 3.1)
    .from('#a-story h2', { y: 20, opacity: 0, duration: 0.7, ease: 'power4.out' }, 3.25)
    .from('#a-story p:not(.eyebrow)', { y: 16, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.14 }, 3.45)

    .to([ov.el('storyImg'), ov.el('story')], { opacity: 0, duration: 0.4 }, 5.4);

  return endsAt(tl, 6.0);
}

/* 04 · EVENT ROOM — walk up to each easel in turn and stand in front of it.

   This was a 150° pan from the middle of the room, which is a handsome move
   and completely useless: standing at the centre of an eighteen-metre room
   puts every easel nine metres away, so all three boards were small, dim and
   at a glancing angle, and two-thirds of every frame was empty floor. The
   camera now steps to a point 4.2m off each board's own face — the same
   move-and-rest rhythm as the bar — which is the difference between seeing
   that there are notices and being able to read one.

   MOVE 0–1.8 · HOLD →3.2 · MOVE →4.2 · HOLD →5.6 · MOVE →6.6
   HOLD →8.0 · OUT 8.0–8.5    (6.3s of stillness on each of the three) */
function eventTimeline(w, ov) {
  const tl = gsap.timeline();

  /* Each stand is the easel's position pushed 4.2m out along the direction
     that easel faces, so every board is met square-on rather than edge-on.
     They land on a line across the room, which turns the section into three
     short lateral steps. */
  const STAND = [
    { eye: [25.4, 1.65, -44.3], focus: [21.5, 1.95, -42.7] },
    { eye: [29.0, 1.65, -44.3], focus: [29.0, 1.95, -48.5] },
    { eye: [32.6, 1.65, -44.3], focus: [36.5, 1.95, -42.7] }
  ];
  const ARRIVE = [1.8, 4.2, 6.6];
  const evs = ['ev1', 'ev2', 'ev3'];

  tl.to(rig.eye,   eyeTo(...STAND[0].eye, 1.8), 0)
    .to(rig.focus, eyeTo(...STAND[0].focus, 1.8), 0)
    .to(w.levels.fire, { v: 0, duration: 0.7 }, 0)
    .to(w.levels.wall, { v: 0, duration: 0.7 }, 0);

  [1, 2].forEach((k) => {
    tl.to(rig.eye,   eyeTo(...STAND[k].eye, 1.0, 'power2.inOut'), ARRIVE[k] - 1.0)
      .to(rig.focus, eyeTo(...STAND[k].focus, 1.0, 'power2.inOut'), ARRIVE[k] - 1.0);
  });

  /* candle, then card, exactly as the camera stops in front of each easel */
  evs.forEach((name, k) => {
    tl.to(w.levels.spots[k], { v: 60, duration: 0.7, ease: 'power2.out' }, ARRIVE[k] - 0.7)
      .fromTo(ov.el(name), { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out' }, ARRIVE[k] - 0.25);
  });

  tl.to(evs.map(ov.el), { opacity: 0, duration: 0.4, stagger: 0.05 }, 8.0);

  return endsAt(tl, 8.5);
}

/* 05 · GALLERY CORRIDOR — a long dolly on a hard vanishing point that stops,
   and only then does the press line type itself out. Typing under a moving
   camera was unreadable twice over.

   MOVE 0–2.6 · TYPE 2.6–4.6 (camera still) · HOLD to 6.0 */
function galleryTimeline(w, ov) {
  const tl = gsap.timeline();

  tl.to(rig.eye,   eyeTo(29, 1.65, -52, 0.9), 0)
    .to(rig.focus, eyeTo(29, 1.55, -66, 0.9), 0)
    .to([w.levels.spots[0], w.levels.spots[1], w.levels.spots[2]], { v: 0, duration: 0.6 }, 0)

    .to(rig.eye,   eyeTo(29, 1.65, -66.5, 1.7, 'power1.inOut'), 0.9)
    .to(rig.focus, eyeTo(29, 1.55, -80, 1.7, 'power1.inOut'), 0.9)

    .to(w.levels.track, { v: 150, duration: 0.8, ease: 'power2.out' }, 0.6)
    /* enough wash that the corridor walls exist either side of the frame —
       at 42 the vignette ate everything that was not a lit plate */
    .to(w.levels.wash, { v: 88, duration: 0.8, ease: 'power2.out' }, 0.5)

    .fromTo(ov.el('quote'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 2.5)
    .to('.caret', { opacity: 1, duration: 0.12 }, 2.55)
    /* A blink is a real-world interval, not a camera move, so it is written in
       screen seconds and divided back out — a literal 0.18 here would have
       become a slow pulse once the film was stretched to three minutes. It is
       a timeline tween rather than a CSS animation, so a seeked frame always
       shows the same caret. */
    .to('.caret i', {
      opacity: 0, ease: 'steps(1)', yoyo: true,
      duration: BLINK,
      repeat: Math.round(2.4 / BLINK) - 1
    }, 2.55)
    .to('#quote-text', { duration: 2.0, ease: 'none', text: { value: QUOTE, delimiter: '' } }, 2.6)
    .to('.caret', { opacity: 0, duration: 0.3 }, 4.7)
    .fromTo(ov.el('attrib'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 4.75);

  return endsAt(tl, 6.0);
}

/* 06 · EXIT — the door swings out of the way, the sky arrives, the ring in
   the doorway starts breathing, and the contact plate holds perfectly still
   for the last eighteen seconds of the film.

   MOVE 0–2.4 · CARD IN 2.6–3.6 · HOLD 3.6–6.5   (13s of stillness) */
function exitTimeline(w, ov) {
  const tl = gsap.timeline();

  tl.to(rig.eye,   eyeTo(29, 1.65, -71, 1.0), 0)
    .to(rig.focus, eyeTo(29, 1.6, -84, 1.0), 0)
    .to([ov.el('quote'), ov.el('attrib')], { opacity: 0, duration: 0.4 }, 0)
    .to(w.levels.track, { v: 0, duration: 0.6 }, 0.2)
    .to(w.levels.wash, { v: 0, duration: 0.6 }, 0.2)

    /* +PI/2 about the hinge swings the leaf away from us. The brief writes
       -PI/2, which would swing it inward through the camera — the prose says
       outward, so the sign follows the prose. */
    .to(w.door.rotation, { y: Math.PI / 2, duration: 1.3, ease: 'power3.inOut' }, 0.5)
    .to(w.levels.exit, { v: 95, duration: 1.4, ease: 'power2.out' }, 0.8)

    .to(rig.eye, eyeTo(29, 1.7, -76.6, 1.4, 'power2.inOut'), 1.0)

    /* A yoyo:-1 tween would make the parent timeline infinitely long and break
       the scrubber, so the pulse repeats a counted number of times instead —
       same breathing, finite duration, still seekable. Its period is a real
       interval, so it too is written in screen seconds. */
    .to(w.portalMat, {
      emissiveIntensity: 0.7, ease: 'sine.inOut', yoyo: true,
      duration: BREATH,
      repeat: Math.round(4.8 / BREATH) - 1
    }, 1.2)

    .fromTo(ov.el('foot'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 2.6)
    .from('#a-foot .foot-grid > div', { opacity: 0, y: 16, duration: 0.6, ease: 'power3.out', stagger: 0.14 }, 2.75)
    .from('#a-foot .dial', { opacity: 0, scale: 0.8, duration: 0.6, ease: 'back.out(2)' }, 3.2)
    .from('#a-foot .foot-note', { opacity: 0, duration: 0.6 }, 3.4);

  return endsAt(tl, 6.5);
}

/* ------------------------------------------------------------------ build */

export function buildTour(world, overlays) {
  const tour = gsap.timeline({ paused: true, smoothChildTiming: true });

  const parts = [
    entranceTimeline(world, overlays),
    barTimeline(world, overlays),
    loungeTimeline(world, overlays),
    eventTimeline(world, overlays),
    galleryTimeline(world, overlays),
    exitTimeline(world, overlays)
  ];

  /* A child timeline's span inside its parent is its own duration divided by
     its timeScale, so slowing each room here is enough — the parent's
     duration, the scrubber, and every label position follow from it. */
  parts.forEach((tl, i) => {
    tl.timeScale(1 / SCREEN_TIME);
    tour.add(tl, ROOMS[i].at);
  });
  ROOMS.forEach((r) => tour.addLabel(r.id, r.at));

  return tour;
}

/* Per-frame work that cannot be expressed as a tween: placing the travelling
   light rig, deciding which rooms are worth drawing, and anything that has to
   flicker. All of it is a pure function of `t`, so it survives a seek. */

const ORDER = ['hall', 'bar', 'lounge', 'event', 'corridor', 'exit'];

export function tick(world, t) {
  world.dust.material.uniforms.uTime.value = t;

  let i = 0;
  for (let k = 0; k < ROOMS.length; k++) if (t >= ROOMS[k].at) i = k;

  /* Draw the room we are in and the one we are heading for — the doorways are
     sightlines, so hiding the next room would show a hole. Everything else is
     switched off, which is most of the building most of the time. */
  ORDER.forEach((name, k) => {
    world.rooms[name].visible = (k === i || k === i + 1 || k === i - 1);
  });

  const L = world.lights, lv = world.levels;
  const place = (light, x, y, z, colour, value) => {
    light.position.set(x, y, z);
    light.color.set(colour);
    light.intensity = value;
  };
  /* CANDLE is every practical in the building; IRIS is the cold wash the
     rooms are actually lit by; EMBER and PERSIMMON are the two hot notes;
     MOON is the night getting in at either end. */
  const CANDLE = 0xFFB98F, IRIS = 0x7B6BF2, EMBER = 0xFF5A22, PERSIMMON = 0xFF7A4D,
        MOON = 0xA79BFF;

  /* every light starts the frame dark; only the current room turns any on */
  L.key.forEach((k) => { k.intensity = 0; });
  /* penumbra is reset alongside intensity: the spots are a shared pool, and
     the event room's soft fill would otherwise follow them into the bar */
  L.spot.forEach((s) => { s.intensity = 0; s.penumbra = 0.6; });

  /* Two detuned sines beat against each other — reads as flame far better
     than random noise, and is reproducible at any timestamp. Driven by real
     seconds, so stretching the film never turns the fire into a lava lamp. */
  const flicker = 0.82 + 0.18 * Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1.2);

  if (i === 0) {
    place(L.key[0], 0, 3.4, -2, MOON, lv.hall.v);
    place(L.key[1], 0, 3.4, -12.5, MOON, lv.hall.v * 0.86);
  } else if (i === 1) {
    place(L.key[0], 4, 2.9, -28.6, IRIS, lv.wash.v);
    place(L.key[1], 15, 2.9, -28.6, IRIS, lv.wash.v * 0.87);
    [4, 9.5, 15].forEach((x, k) => {
      const s = L.spot[k];
      s.position.set(x, 3.9, -26.4);
      s.target.position.set(x, 1.1, -27.4);
      s.color.set(CANDLE);
      s.angle = Math.PI / 6;
      s.intensity = lv.spots[k].v;
    });
  } else if (i === 2) {
    place(L.key[0], 35.0, 1.1, -24, EMBER, lv.fire.v * 0.62 * flicker);
    place(L.key[1], 28.6, 2.5, -18.6, IRIS, lv.wall.v);
    place(L.key[2], 28.6, 2.3, -23, CANDLE, lv.wall.v * 0.3);
  } else if (i === 3) {
    world.easels.forEach((e, k) => {
      /* the cocktail spots come back as candles — same three fixtures */
      place(L.key[k], e.x + 0.86, 1.25, e.z + 0.62, CANDLE,
            lv.spots[k].v * (0.88 + 0.12 * Math.sin(t * (7.4 + k * 1.6) + k * 2.1)));
    });
    /* The room's own cold fill, so the candles read as warm *against*
       something. Two of them: a single wide cone loses so much to the spread
       that the far wall stays black, and a black far wall is what made this
       room grade sepia. They ride in on the candles rather than being on from
       the start, so the turns still reveal the room one easel at a time. */
    const lit = Math.max(lv.spots[0].v, lv.spots[1].v, lv.spots[2].v);
    [[23, -42], [35, -46]].forEach(([x, z], k) => {
      const up = L.spot[k];
      up.position.set(x, 4.3, z);
      up.target.position.set(x, 0, z);
      up.color.set(IRIS);
      up.angle = Math.PI / 2.6;
      up.penumbra = 1;
      up.intensity = lit * 5.5;
    });
  } else if (i === 4) {
    place(L.key[0], 29, 2.9, -58, IRIS, lv.wash.v);
    place(L.key[1], 29, 2.9, -67, IRIS, lv.wash.v * 0.8);
    const s = L.spot[0];
    /* the tracking light walks down the corridor with the camera and stops
       where it stops — the same authored window as the dolly above */
    const walk = Math.min(
      Math.max((t - ROOMS[4].at - 0.9 * SCREEN_TIME) / (1.7 * SCREEN_TIME), 0), 1);
    s.position.set(29, 3.2, -56 - walk * 12);
    s.target.position.set(29, 1.7, -71);
    s.color.set(PERSIMMON);
    s.angle = Math.PI / 9;
    s.intensity = lv.track.v;
  } else {
    place(L.key[0], 29, 2.4, -77, MOON, lv.exit.v);
    place(L.key[1], 29, 1.6, -82, PERSIMMON, lv.exit.v * 0.35);
  }
}
