# The Cipher Room

**Live — [ciper-room.netlify.app](https://ciper-room.netlify.app)**

A landing page for a speakeasy that is not a page. There is no scroll: the site is one continuous
camera walk through a six-room 3D building, and every "section" is a room the camera stops in. The
copy is real, selectable HTML — projected onto points in the scene each frame so it behaves like
lettering standing in the room rather than like a HUD.

Three.js + GSAP. No build step, no dependencies to install, no framework.

## Run it

The deployed site is above. To run it locally, any static server from this directory:

```bash
python -m http.server 4323
```

Then open `http://localhost:4323`. The film runs 180 seconds and autoplays; the console at the bottom
scrubs, pauses and jumps between rooms. Space or `k` toggles, `←`/`→` step rooms, `1`–`6` jump,
`Home` restarts.

## How it is put together

Five modules, each with one job:

| File | Owns |
| --- | --- |
| `src/world.js` | The building. Geometry, materials, fittings, the light pool. Animates nothing. |
| `src/tour.js` | The film. One paused GSAP timeline, plus the per-frame work that cannot be a tween. |
| `src/overlays.js` | Pinning HTML to 3D points. |
| `src/post.js` | Bloom, then grain and vignette. |
| `src/controls.js` | The playback console. A thin view over `tour.progress()`. |

Four ideas carry the whole thing:

**Time is the only input.** Nothing reads the wall clock. Every flicker, mote, camera position and
grain frame is a pure function of `tour.time()`, so pausing is a true freeze, scrubbing is a true
seek, and the same timestamp always produces the same pixels. That is also what makes the page
exportable as video rather than only screen-recordable.

**The camera is never tweened.** Two proxy vectors are — where the camera stands (`rig.eye`) and what
it looks at (`rig.focus`) — and each frame does `position.copy(eye); lookAt(focus)`. Authoring a 90°
orbit becomes a matter of moving a point around a room, which cannot gimbal-lock halfway through a
turn.

**Move, settle, hold.** Each room is a camera move that finishes *before* its copy arrives, then a
hold with the rig completely at rest for as long as the copy takes to read. Overlays are projected
through the camera, so anything on screen during a move slides and scales and cannot actually be
read. Every hold in the film is pixel-static.

**One travelling light rig.** Seven lights total — three points, three spots, an ambient — that
`tick()` re-places into whichever room the camera is standing in, with the other rooms' groups
switched invisible. Three.js evaluates every scene light for every lit fragment with no per-object
culling, so a fixture list per room would multiply cost across a building the camera can only ever be
in one part of.

## Retiming

`SCREEN_TIME` in `src/tour.js` is seconds of screen time per second of authored time. Room timelines
are written in compact units — a dolly is "2.4 seconds" — and each is played back at that scale, so
changing one number stretches every move *and every hold* by the same factor without disturbing any
beat's relationship to its neighbours.

`ROOMS[].at` holds the real-second offsets. **Retime there and nowhere else** — the scrubber, its
ticks, its labels and the skip buttons all derive from it. Each room's slot is closed by
`endsAt(tl, t)`, a zero-duration marker: a GSAP timeline otherwise ends at its last beat, and the
trailing hold would silently not exist.

Beats that are real-world intervals rather than camera moves — the caret blink, the ring breathing in
the doorway — are written as `real(seconds)` so they keep their rate when the film is retimed.

## Capture mode

`?capture` hides the console, pauses at frame zero and exposes a frame-accurate handle:

```js
await window.film.seek(97.2);   // resolves after the frame has been drawn
window.film.duration;           // 180
```

Because no frame depends on wall time, stepping `seek()` across the duration and grabbing each frame
produces a deterministic render.

## Art direction

Iris and nickel on ink-violet. The building is lit **cold** — an electric indigo wash on violet
plaster, cold nickel where a bar of this vintage would use brass — and every practical source in it
burns warm against that. One hot colour in a cold room; inverting that temperature relationship is
what makes it grade sepia.

| | |
| --- | --- |
| Ink | `#0A0713` |
| Iris | `#7B6BF2` |
| Nickel | `#AEB6C9` / `#DCE2EE` |
| Persimmon | `#FF7A4D` |
| Porcelain | `#F2EFF7` |

Syne for anything set as a poster, Manrope for anything read at length, DM Mono for anything that
behaves like a number or a label. The recurring motif is the combination dial: a nickel ring with a
single mark on it, on the door, in the favicon, and as the replay control.

Free-standing copy over a lit room carries an edgeless radial scrim rather than a card — a hard panel
breaks the illusion that the lettering is standing in the room. Copy over a bloom-lit surface carries
a text-shadow instead.

## Deploying

Deployed on Netlify at [ciper-room.netlify.app](https://ciper-room.netlify.app), connected to this
repository — every push to `main` redeploys, and branches get their own preview URL.

There is nothing to configure in the dashboard: `netlify.toml` declares the publish directory and an
empty build command, which is what stops framework detection from inventing a build step for a site
that has none. It also gives `vendor/` a week of caching, since that directory is 1.4MB of pinned
third-party code and the bulk of a cold visit. Deliberately not `immutable` — those filenames carry
no content hash, so upgrading three.js or GSAP reuses the same path, and a year of immutable caching
would strand returning visitors on the old copy.

Any other static host works the same way. The whole site is files; nothing is generated.

## Third-party

Vendored in `vendor/` so the page has no install step and no network dependency at runtime:

- **three.js r169** and its `examples/jsm` postprocessing passes — MIT.
- **GSAP 3.12.5**, with the Draggable and Text plugins — © GreenSock, used under the
  [GSAP standard license](https://gsap.com/standard-license). Not MIT; check the terms against your
  own use.

Fonts are loaded from Google Fonts at runtime.

## Notes

- WebGL with a full postprocessing chain — a discrete GPU or a recent integrated one is assumed.
- The tour boots from `requestAnimationFrame`, so it does not start in a backgrounded tab. It picks up
  when the tab is fronted.
- `prefers-reduced-motion` runs the film at 1.5× rather than disabling it.
