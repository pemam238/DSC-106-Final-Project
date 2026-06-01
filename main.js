/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;

/* ── Scroll zones (total: 600vh)
   0.000 – 0.667  → title hooks + year timeline (same feel as original 400vh page)
   0.667 – 1.000  → 5 historical event panels
── */
const EVENTS_START_FRAC = 0.667;

/* Timeline fracs are expressed within the 0–0.667 zone,
   scaled so the experience feels identical to the original 400vh page. */
const ZONE_A_END       = EVENTS_START_FRAC;          // 0.667
const ANIM_START_FRAC  = 0.05  * ZONE_A_END;         // ≈ 0.033
const ANIM_END_FRAC    = 0.985 * ZONE_A_END;         // ≈ 0.655  (rewind triggers here)
const TEXT_HIDE_FRAC   = 0.90  * ZONE_A_END;         // ≈ 0.600

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00  * ZONE_A_END },
  { id: 'hook-word1',   scrollFrac: 0.00  * ZONE_A_END },
  { id: 'hook-word2',   scrollFrac: 0.20  * ZONE_A_END },
  { id: 'hook-word3',   scrollFrac: 0.30  * ZONE_A_END },
  { id: 'hook-sub',     scrollFrac: 0.40  * ZONE_A_END },
  { id: 'hook-byline',  scrollFrac: 0.60  * ZONE_A_END },
];

/* ── State ── */
let allData     = {};
let currentYear = YEARS_START;
let lastYear    = null;
let projection, path;
let dotLayer;

let baseScale;
let baseTranslate;

/* rewind = the 2014→earliest-drought sweep that plays at end of Zone A */
let rewindHasPlayed = false;

/* events zone flag */
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
  const W   = window.innerWidth;
  const H   = window.innerHeight;

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
  projection.scale(baseScale).translate(baseTranslate);
  d3.select('#world-svg').selectAll('path')
    .transition().duration(900).ease(d3.easeCubicInOut)
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
   Pass null to reposition dots at currentYear without updating the label.
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
   4. REWIND (end of Zone A) — identical to original
═══════════════════════════════════════════ */
function playRewindToFirstEvent() {
  if (rewindHasPlayed) return;
  rewindHasPlayed = true;

  /* Sweep from 2014 back to the first event's year (event 0 in drought-events.json).
     DroughtEvents.firstYear() returns that value once data is loaded. */
  const sweepTo   = DroughtEvents.firstSweepYear();
  const startYear = currentYear;

  d3.select('#world-svg')
    .transition('rewind')
    .duration(3500)
    .ease(d3.easeCubicInOut)
    .tween('rewind-year', () => {
      const interp = d3.interpolateNumber(startYear, sweepTo);
      return t => {
        const y = Math.round(interp(t));
        if (y !== lastYear) { renderYear(y); lastYear = y; }
      };
    })
    .on('end', () => {
      /* Rewind done — scroll will now enter Zone B naturally */
    });
}

/* ═══════════════════════════════════════════
   5. YEAR SWEEP (used by DroughtEvents for event 0)
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
    .on('interrupt', () => {
      inEventsBlockDotRender = true;
    });
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

function onScroll() {
  const frac = getScrollFrac();

  document.getElementById('progress-bar').style.width = (frac * 100) + '%';

  /* ── Hook text (only active in Zone A) ── */
  hooks.forEach(h => {
    const el = document.getElementById(h.id);
    if (frac >= h.scrollFrac && frac < TEXT_HIDE_FRAC) {
      el.classList.remove('hide'); el.classList.add('show');
    } else if (frac >= TEXT_HIDE_FRAC) {
      el.classList.remove('show'); el.classList.add('hide');
    } else {
      el.classList.remove('show', 'hide');
    }
  });

  document.getElementById('legend').classList.toggle('show', frac >= ANIM_START_FRAC);
  if (frac > 0.02) document.getElementById('scroll-hint').style.opacity = '0';

  /* Year display: hide during events 1-4 only */
  const inLaterEvents = frac >= EVENTS_START_FRAC && DroughtEvents.activeIndex() > 0;
  document.getElementById('year-display').style.opacity = inLaterEvents ? '0' : '';

  /* ══ ZONE ROUTING ══ */

  if (frac < EVENTS_START_FRAC) {
    /* ── Zone A: title + timeline ── */

    /* Coming back from Zone B: reset */
    if (inEventZone) {
      inEventZone            = false;
      inEventsBlockDotRender = false;
      d3.select('#world-svg').interrupt('year-sweep');
      DroughtEvents.dismissAll();
      resetProjectionToBase();
      rewindHasPlayed = false;   /* allow rewind to replay if user scrolls back */
    }

    const animFrac = Math.min(
      Math.max((frac - ANIM_START_FRAC) / (ANIM_END_FRAC - ANIM_START_FRAC), 0), 1
    );
    const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));

    if (!rewindHasPlayed) {
      renderYearIfNew(targetYear);
    }

    /* Trigger rewind when scroll reaches end of Zone A */
    if (frac >= ANIM_END_FRAC) {
      playRewindToFirstEvent();
    }

  } else {
    /* ── Zone B: events ── */
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