/* =========================================================================
   The playback console.

   A thin view over the tour: everything here reads or writes tour.progress()
   and tour.time(). The bar keeps no state of its own, so autoplay, scrubbing
   and the room-skip buttons can never disagree about where in the building
   the camera currently is.
   ========================================================================= */

const ICON_PLAY   = 'M8 5v14l11-7z';
const ICON_PAUSE  = 'M6 4h4v16H6zM14 4h4v16h-4z';
const ICON_REPLAY = 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z';

const $ = (s) => document.querySelector(s);

const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
};

export function initControls(tour, ROOMS) {
  const el = {
    play:   $('#btn-play'),
    icon:   $('#icon-play'),
    idx:    $('#now-idx'),
    name:   $('#now-name'),
    scrub:  $('#scrub'),
    fill:   $('#scrub-fill'),
    handle: $('#scrub-handle'),
    ticks:  $('#scrub-ticks'),
    labels: $('#scrub-labels'),
    time:   $('#time'),
    skips:  $('#skips')
  };

  const dur = tour.duration();
  const total = ('0' + ROOMS.length).slice(-2);

  /* ------------------------------------------------- ticks, labels, skips */

  const labelEls = ROOMS.map((r, i) => {
    const pct = (r.at / dur) * 100;

    const tick = document.createElement('i');
    tick.style.left = pct + '%';
    el.ticks.appendChild(tick);

    const lab = document.createElement('span');
    lab.style.left = pct + '%';
    lab.textContent = r.label;
    el.labels.appendChild(lab);

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'skip';
    skip.textContent = ('0' + (i + 1)).slice(-2);
    skip.title = 'Go to ' + r.name;
    skip.setAttribute('aria-label', 'Go to ' + r.name);
    skip.addEventListener('click', () => goto(i));
    el.skips.appendChild(skip);

    return { lab, skip };
  });

  /* ------------------------------------------------------------ read-out */

  let lastIdx = -1;

  function sync() {
    const p = tour.progress();
    const w = el.scrub.clientWidth;

    gsap.set(el.handle, { x: p * w });
    el.fill.style.width = (p * w) + 'px';
    el.time.textContent = fmt(tour.time()) + ' / ' + fmt(dur);
    el.scrub.setAttribute('aria-valuenow', Math.round(p * 100));

    let i = 0;
    for (let k = 0; k < ROOMS.length; k++) if (tour.time() >= ROOMS[k].at) i = k;
    if (i !== lastIdx) {
      el.idx.textContent = 'Room ' + ('0' + (i + 1)).slice(-2) + ' / ' + total;
      el.name.textContent = ROOMS[i].name;
      el.scrub.setAttribute('aria-valuetext', ROOMS[i].name);
      labelEls.forEach((n, k) => {
        n.lab.classList.toggle('on', k === i);
        n.skip.classList.toggle('on', k === i);
      });
      lastIdx = i;
    }

    const done = tour.progress() >= 1;
    el.icon.setAttribute('d', done ? ICON_REPLAY : tour.paused() ? ICON_PLAY : ICON_PAUSE);
  }

  /* ------------------------------------------------------------ commands */

  function play() {
    if (tour.progress() >= 1) tour.restart();
    else tour.play();
    el.play.setAttribute('aria-label', 'Pause');
    sync();
  }
  function pause() {
    tour.pause();
    el.play.setAttribute('aria-label', tour.progress() >= 1 ? 'Replay' : 'Play');
    sync();
  }
  const toggle = () => (tour.paused() ? play() : pause());

  function seekTo(progress, keepPlaying) {
    tour.progress(Math.min(Math.max(progress, 0), 1));
    if (!keepPlaying) pause();
    sync();
  }

  function goto(i) {
    const wasPlaying = !tour.paused();
    tour.seek(ROOMS[Math.min(Math.max(i, 0), ROOMS.length - 1)].at);
    if (!wasPlaying) tour.pause();
    sync();
  }

  function step(dir) {
    const t = tour.time();
    let i = 0;
    for (let k = 0; k < ROOMS.length; k++) if (t >= ROOMS[k].at) i = k;
    // nudging back inside a room rewinds to that room's own start first
    goto(dir > 0 ? i + 1 : (t - ROOMS[i].at > 0.7 ? i : i - 1));
  }

  el.play.addEventListener('click', toggle);

  /* the hero's buttons and the footer's replay are tour commands, not links */
  document.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-goto]');
    if (jump) {
      const i = ROOMS.findIndex((r) => r.id === jump.dataset.goto);
      if (i >= 0) { goto(i); play(); }
      return;
    }
    if (e.target.closest('[data-restart]')) { tour.restart(); sync(); }
  });

  /* ------------------------------------------------------------ scrubber */

  const bounds = () => ({ minX: 0, maxX: el.scrub.clientWidth });

  const [drag] = Draggable.create(el.handle, {
    type: 'x',
    cursor: 'grab',
    activeCursor: 'grabbing',
    bounds: bounds(),
    onPressInit() { tour.pause(); },
    onDrag() { seekTo(this.x / el.scrub.clientWidth, false); },
    onThrowUpdate() { seekTo(this.x / el.scrub.clientWidth, false); }
  });

  let scrubbing = false;
  const fromClientX = (x) => {
    const r = el.scrub.getBoundingClientRect();
    seekTo((x - r.left) / r.width, false);
  };

  el.scrub.addEventListener('pointerdown', (e) => {
    if (e.target === el.handle) return;           // Draggable owns the handle
    scrubbing = true;
    try { el.scrub.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    fromClientX(e.clientX);
  });
  el.scrub.addEventListener('pointermove', (e) => { if (scrubbing) fromClientX(e.clientX); });
  el.scrub.addEventListener('pointerup', (e) => {
    scrubbing = false;
    try { el.scrub.releasePointerCapture(e.pointerId); } catch (err) { /* not held */ }
  });

  el.scrub.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      seekTo(tour.progress() + (e.key === 'ArrowRight' ? 0.02 : -0.02), !tour.paused());
    }
  });

  /* -------------------------------------------------------------- global */

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable], #scrub')) return;
    if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    else if (e.key === 'Home')       { e.preventDefault(); tour.restart(); sync(); }
    else if (/^[1-6]$/.test(e.key))  { e.preventDefault(); goto(Number(e.key) - 1); }
  });

  window.addEventListener('resize', () => { drag.applyBounds(bounds()); sync(); });
  tour.eventCallback('onComplete', sync);

  return { sync, play, pause, goto };
}
