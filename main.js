/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;

/* ── Scroll zones ──────────────────────────────
   Total scroll space: 600vh

   The original story (title + timeline) ran over 400vh.
   Scale all its fracs by 400/600 so it feels identical.

   0.000 – 0.633  → title hooks + year timeline (1850→2014)
   0.667 – 1.000  → 5 historical event zoom panels
──────────────────────────────────────────────── */
const SCALE             = 400 / 600;

const ANIM_START_FRAC   = 0.05 * SCALE;   // ≈ 0.033
const ANIM_END_FRAC     = 0.95 * SCALE;   // ≈ 0.633
const TEXT_HIDE_FRAC    = 0.90 * SCALE;   // ≈ 0.600

const EVENTS_START_FRAC = 0.667;          // events zone starts here, runs to 1.0

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00 * SCALE },
  { id: 'hook-word1',   scrollFrac: 0.00 * SCALE },
  { id: 'hook-word2',   scrollFrac: 0.20 * SCALE },
  { id: 'hook-word3',   scrollFrac: 0.30 * SCALE },
  { id: 'hook-sub',     scrollFrac: 0.40 * SCALE },
  { id: 'hook-byline',  scrollFrac: 0.60 * SCALE },
];

/* ── State ── */
let allData     = {};
let currentYear = YEARS_START;
let lastYear    = null;
let projection, path;
let dotLayer;

let baseScale;
let baseTranslate;
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

function resetProjectionToBase(animate = true) {
  projection.scale(baseScale).translate(baseTranslate);
  const sel = d3.select('#world-svg').selectAll('path');
  if (animate) sel.transition().duration(900).ease(d3.easeCubicInOut).attr('d', path);
  else         sel.attr('d', path);
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
   null → reposition dots only, no label change
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
   4. SCROLL DRIVER
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

  /* ── Hook text ── */
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

  document.getElementById('legend').classList.toggle('show', frac > 0.02);
  if (frac > 0.02) document.getElementById('scroll-hint').style.opacity = '0';

  /* ── Year counter: hide only during events 1-4 (not event 0 — it has the sweep) ── */
  const yearDisplay = document.getElementById('year-display');
  yearDisplay.style.opacity = (frac >= EVENTS_START_FRAC && DroughtEvents.activeIndex() > 0) ? '0' : '';

  /* ══════════════════════════════════════
     ZONE ROUTING
  ══════════════════════════════════════ */

  if (frac < EVENTS_START_FRAC) {
    /* ── Zone A: title hooks + timeline ── */
    if (inEventZone) {
      inEventZone            = false;
      inEventsBlockDotRender = false;
      DroughtEvents.dismissAll();
      resetProjectionToBase(true);
    }

    const animFrac = Math.min(
      Math.max((frac - ANIM_START_FRAC) / (ANIM_END_FRAC - ANIM_START_FRAC), 0), 1
    );
    const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));
    renderYearIfNew(targetYear);

  } else {
    /* ── Zone B: historical events (0.667 → 1.0) ── */
    inEventZone            = true;
    inEventsBlockDotRender = true;

    const eventsFrac = (frac - EVENTS_START_FRAC) / (1.0 - EVENTS_START_FRAC);
    DroughtEvents.update(eventsFrac);
  }
}

/* ═══════════════════════════════════════════
   5. RESIZE
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
   6. BOOT
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
    renderYearSweep,   // for event 0's intro sweep
  });

  await DroughtEvents.load();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(onResize, 200));
  onScroll();
})();

/* ── renderYearSweep: animates the year counter from `from` to `to`
   then calls `done()`. Used by event 0's intro. ── */
function renderYearSweep(from, to, done) {
  inEventsBlockDotRender = false; // sweep needs to render dots
  d3.select('#world-svg') // dummy selection to hang transition on
    .transition('year-sweep')
    .duration(2800)
    .ease(d3.easeCubicInOut)
    .tween('sweep', () => {
      const interp = d3.interpolateNumber(from, to);
      return t => {
        const y = Math.round(interp(t));
        if (y !== lastYear) {
          renderYear(y);
          lastYear = y;
        }
      };
    })
    .on('end', () => {
      inEventsBlockDotRender = true; // hand control back to events zone
      if (done) done();
    });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}