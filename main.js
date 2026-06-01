/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js

   FIX SUMMARY:
   - scroll-hint is hidden via style.opacity (not display)
     and is properly faded once the user scrolls even a little
   - Rewind trigger uses a small debounce so it only fires once
     even if the scroll listener fires several times near the threshold
   - Zone B entry: inEventsBlockDotRender is set correctly so the
     scroll-driven dot render doesn't fight the event zoom
   - resetProjectionToBase is cleaner and always cancels in-flight transitions
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;

/* ── Scroll zones (total: 600vh) ─────────────────
   Zone A  0.000 – 0.667  title hooks + year timeline
   Zone B  0.667 – 1.000  5 historical event panels
─────────────────────────────────────────────────── */
const EVENTS_START_FRAC = 0.667;

/* Zone A internal fracs */
const ANIM_START_FRAC = 0.05 * EVENTS_START_FRAC;   // ≈ 0.033  dots start appearing
const TEXT_HIDE_FRAC  = 0.90 * EVENTS_START_FRAC;   // ≈ 0.600  hooks fade out
const ANIM_END_FRAC   = TEXT_HIDE_FRAC;              // year reaches 2014 exactly when text hides → rewind fires

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00 * EVENTS_START_FRAC },
  { id: 'hook-word1',   scrollFrac: 0.00 * EVENTS_START_FRAC },
  { id: 'hook-word2',   scrollFrac: 0.20 * EVENTS_START_FRAC },
  { id: 'hook-word3',   scrollFrac: 0.30 * EVENTS_START_FRAC },
  { id: 'hook-sub',     scrollFrac: 0.40 * EVENTS_START_FRAC },
  { id: 'hook-byline',  scrollFrac: 0.60 * EVENTS_START_FRAC },
];

/* ── State ── */
let allData     = {};
let currentYear = YEARS_START;
let lastYear    = null;
let projection, path;
let dotLayer;
let baseScale, baseTranslate;

/* Rewind sequence fires once when the user fully scrolls Zone A */
let rewindPlaying = false;
let rewindDone    = false;

/* Events zone */
let inEventZone            = false;
let inEventsBlockDotRender = false;

const opacityScale = d3.scalePow()
  .exponent(0.5)
  .domain([-3.5, -1.0])
  .range([0.98, 0.3])
  .clamp(true);

/* ═══════════════════════════════════════════
   1. INIT MAP
═══════════════════════════════════════════ */
function initMap() {
  const svg = d3.select('#world-svg');
  const W = window.innerWidth;
  const H = window.innerHeight;

  svg.attr('viewBox', `0 0 ${W} ${H}`)
     .attr('preserveAspectRatio', 'xMidYMid slice');

  projection = d3.geoNaturalEarth1()
    .scale(W / 5.8)
    .translate([W / 2, H / 2]);

  baseScale     = projection.scale();
  baseTranslate = projection.translate().slice();

  path = d3.geoPath().projection(projection);

  svg.append('path').datum({ type: 'Sphere' }).attr('class', 'sphere').attr('d', path);
  svg.append('path').datum(d3.geoGraticule()()).attr('class', 'graticule').attr('d', path);

  dotLayer = svg.append('g').attr('class', 'dot-layer');

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r => r.json())
    .then(world => {
      svg.insert('path', '.dot-layer')
         .datum(topojson.feature(world, world.objects.countries))
         .attr('class', 'land').attr('d', path);
    });
}

function getBaseScale()     { return baseScale; }
function getBaseTranslate() { return baseTranslate.slice(); }

function resetProjectionToBase() {
  /* Cancel any in-flight map transitions before resetting */
  const svg = d3.select('#world-svg');
  svg.interrupt('zoom');
  svg.interrupt('rewind');
  svg.interrupt('year-sweep');

  projection.scale(baseScale).translate(baseTranslate);
  svg.selectAll('path')
    .transition('reset')
    .duration(900)
    .ease(d3.easeCubicInOut)
    .attr('d', path)
    .on('end', () => renderYear(currentYear));
}

/* ═══════════════════════════════════════════
   2. LOAD DATA
═══════════════════════════════════════════ */
function loadData() {
  return fetch('historical_yearly.json')
    .then(r => r.json())
    .then(json => { allData = json; });
}

/* ═══════════════════════════════════════════
   3. RENDER YEAR
   Pass null to reposition dots without changing the year label.
═══════════════════════════════════════════ */
function renderYear(year) {
  const useYear  = (year !== null && year !== undefined) ? year : currentYear;
  const yearData = allData[useYear] || [];

  dotLayer.selectAll('circle.drought-dot').remove();

  yearData.forEach(d => {
    const normLon = d.lon > 180 ? d.lon - 360 : d.lon;
    const coords  = projection([normLon, d.lat]);
    if (!coords) return;
    dotLayer.append('circle')
      .attr('class', 'drought-dot')
      .attr('cx', coords[0]).attr('cy', coords[1])
      .attr('r', 1.2).attr('fill', '#ff4422')
      .style('opacity', opacityScale(d.spi));
  });

  if (year !== null && year !== undefined) {
    document.getElementById('year-display').textContent = year;
    currentYear = year;
  }
}

function renderYearIfNew(year) {
  if (inEventsBlockDotRender) return;
  if (year === lastYear) return;
  renderYear(year);
  lastYear = year;
}

/* ═══════════════════════════════════════════
   4. REWIND + ZOOM SEQUENCE
   1. If not at 2014 yet, sweep forward to 2014 (proportional speed).
   2. Sweep backward from 2014 → firstEventYear (3.5 s).
   3. Zoom to event 0, show panel, scroll into Zone B.
═══════════════════════════════════════════ */
function playRewindSequence() {
  if (rewindPlaying || rewindDone) return;
  rewindPlaying = true;
  inEventsBlockDotRender = true;

  const sweepTo = DroughtEvents.firstSweepYear();

  function doRewind() {
    /* ── Step 2: sweep 2014 → firstEventYear ── */
    const REWIND_MS = 3500;
    d3.select('#world-svg')
      .transition('rewind')
      .duration(REWIND_MS)
      .ease(d3.easeCubicInOut)
      .tween('rewind-year', () => {
        const interp = d3.interpolateNumber(YEARS_END, sweepTo);
        return t => {
          const y = Math.round(interp(t));
          if (y !== lastYear) { renderYear(y); lastYear = y; }
        };
      })
      .on('end', () => {
        /* ── Step 3: zoom to event 0 ── */
        DroughtEvents.zoomAndShowFirst(() => {
          rewindDone    = true;
          rewindPlaying = false;
          scrollIntoZoneB();
        });
      });
  }

  if (currentYear < YEARS_END) {
    /* ── Step 1: sweep forward to 2014 first ── */
    const remaining = (YEARS_END - currentYear) / (YEARS_END - YEARS_START);
    const FORWARD_MS = Math.round(remaining * 2000); // proportional, max ~2 s
    d3.select('#world-svg')
      .transition('rewind')
      .duration(FORWARD_MS)
      .ease(d3.easeCubicInOut)
      .tween('forward-year', () => {
        const from = currentYear;
        const interp = d3.interpolateNumber(from, YEARS_END);
        return t => {
          const y = Math.round(interp(t));
          if (y !== lastYear) { renderYear(y); lastYear = y; }
        };
      })
      .on('end', doRewind);
  } else {
    doRewind();
  }
}

/* Programmatically scrolls so frac ≈ EVENTS_START_FRAC + small offset,
   landing right at the start of Zone B (event 0). */
function scrollIntoZoneB() {
  const sceneTop = document.getElementById('scrolly').offsetTop;
  const sceneH   = document.getElementById('scroll-space').offsetHeight;
  const targetY  = sceneTop + (EVENTS_START_FRAC + 0.005) * sceneH;
  window.scrollTo({ top: targetY, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════
   5. YEAR SWEEP — used between event panels
═══════════════════════════════════════════ */
function renderYearSweep(from, to, done) {
  inEventsBlockDotRender = false;
  d3.select('#world-svg').interrupt('year-sweep');

  d3.select('#world-svg')
    .transition('year-sweep')
    .duration(2800)
    .ease(d3.easeCubicInOut)
    .tween('sweep', () => {
      const interp = d3.interpolateNumber(from, to);
      return t => {
        const y = Math.round(interp(t));
        if (y !== lastYear) { renderYear(y); lastYear = y; }
      };
    })
    .on('end', () => {
      inEventsBlockDotRender = true;
      if (done) done();
    })
    .on('interrupt', () => { inEventsBlockDotRender = true; });
}

/* ═══════════════════════════════════════════
   6. SCROLL DRIVER
═══════════════════════════════════════════ */
function getScrollFrac() {
  const scrollTop = window.scrollY;
  const sceneTop  = document.getElementById('scrolly').offsetTop;
  const sceneH    = document.getElementById('scroll-space').offsetHeight;
  return Math.min(Math.max((scrollTop - sceneTop) / sceneH, 0), 1);
}

/* Rewind triggers exactly when the title text finishes hiding */
const REWIND_TRIGGER_FRAC = TEXT_HIDE_FRAC;

function onScroll() {
  const frac = getScrollFrac();

  /* Progress bar */
  document.getElementById('progress-bar').style.width = (frac * 100) + '%';

  /* Scroll hint: hide as soon as user scrolls at all */
  const scrollHint = document.getElementById('scroll-hint');
  if (frac > 0.01) {
    scrollHint.style.opacity = '0';
  }

  /* Hook text visibility */
  hooks.forEach(h => {
    const el = document.getElementById(h.id);
    if (!el) return;
    if (frac >= h.scrollFrac && frac < TEXT_HIDE_FRAC) {
      el.classList.remove('hide'); el.classList.add('show');
    } else if (frac >= TEXT_HIDE_FRAC) {
      el.classList.remove('show'); el.classList.add('hide');
    } else {
      el.classList.remove('show', 'hide');
    }
  });

  /* Legend */
  document.getElementById('legend').classList.toggle('show', frac >= ANIM_START_FRAC);

  /* Year display: hide once we're in Zone B past the first event */
  const inLaterEvents = frac >= EVENTS_START_FRAC && DroughtEvents.activeIndex() > 0;
  document.getElementById('year-display').style.opacity = inLaterEvents ? '0' : '';

  /* ══ ZONE ROUTING ══ */

  if (frac < EVENTS_START_FRAC) {
    /* ── Zone A ── */

    if (inEventZone) {
      /* User scrolled back from Zone B — reset everything */
      inEventZone            = false;
      inEventsBlockDotRender = false;
      rewindDone             = false;
      rewindPlaying          = false;
      d3.select('#world-svg').interrupt('rewind');
      d3.select('#world-svg').interrupt('year-sweep');
      DroughtEvents.dismissAll();
      resetProjectionToBase();
    }

    /* Normal scroll-driven year animation (only when rewind isn't active) */
    if (!rewindPlaying && !rewindDone) {
      const animFrac = Math.min(
        Math.max((frac - ANIM_START_FRAC) / (ANIM_END_FRAC - ANIM_START_FRAC), 0), 1
      );
      const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));
      renderYearIfNew(targetYear);
    }

    /* Trigger rewind once when near the Zone A/B boundary */
    if (frac >= REWIND_TRIGGER_FRAC && !rewindPlaying && !rewindDone) {
      playRewindSequence();
    }

  } else {
    /* ── Zone B ── */

    if (!inEventZone) {
      inEventZone            = true;
      inEventsBlockDotRender = true;
    }

    const eventsFrac = (frac - EVENTS_START_FRAC) / (1.0 - EVENTS_START_FRAC);
    DroughtEvents.update(eventsFrac);
  }
}

/* ═══════════════════════════════════════════
   7. RESIZE
═══════════════════════════════════════════ */
function onResize() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  d3.select('#world-svg').attr('viewBox', `0 0 ${W} ${H}`);
  projection.scale(W / 5.8).translate([W / 2, H / 2]);
  baseScale     = projection.scale();
  baseTranslate = projection.translate().slice();

  d3.select('#world-svg').selectAll('path').attr('d', path);
  renderYear(currentYear);
  DroughtEvents.resize();
}

/* ═══════════════════════════════════════════
   8. BOOT
═══════════════════════════════════════════ */
(async function boot() {
  initMap();
  await loadData();

  renderYear(YEARS_START);
  lastYear = YEARS_START;

  DroughtEvents.init({
    projection,
    path,
    dotLayer,
    getBaseScale,
    getBaseTranslate,
    renderYear,
    renderYearSweep,
  });

  await DroughtEvents.load();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(onResize, 200));
  onScroll();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}