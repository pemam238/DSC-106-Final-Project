/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;

/* ── Scroll zones (total: 600vh) ──────────────
   0.000 – 0.38   → title hooks visible
   0.38  – 0.45   → hooks fading out, blank buffer (clean map, no dots)
   0.45  – 0.62   → timeline animation 1850 → 2014
   0.62  – 0.667  → timeline done, brief pause
   0.667 – 1.000  → 5 historical event panels
──────────────────────────────────────────────── */
const TEXT_HIDE_FRAC    = 0.38;
const ANIM_START_FRAC   = 0.45;
const ANIM_END_FRAC     = 0.62;
const EVENTS_START_FRAC = 0.667;

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00 },
  { id: 'hook-word1',   scrollFrac: 0.00 },
  { id: 'hook-word2',   scrollFrac: 0.06 },
  { id: 'hook-word3',   scrollFrac: 0.12 },
  { id: 'hook-sub',     scrollFrac: 0.20 },
  { id: 'hook-byline',  scrollFrac: 0.28 },
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
  if (animate) {
    sel.transition().duration(900).ease(d3.easeCubicInOut).attr('d', path)
      .on('end', () => renderYear(currentYear));
  } else {
    sel.attr('d', path);
    renderYear(currentYear);
  }
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
   year=null → reposition existing dots at current projection, no label change
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
   4. YEAR SWEEP
   Animates year counter + dots from `from` → `to`, then calls done().
   Used by event 0's intro sweep.
═══════════════════════════════════════════ */
function renderYearSweep(from, to, done) {
  inEventsBlockDotRender = false;

  /* Interrupt any prior sweep transition */
  d3.select('#world-svg').interrupt('year-sweep');

  d3.select('#world-svg')
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
      inEventsBlockDotRender = true;
      if (done) done();
    })
    .on('interrupt', () => {
      /* If scrolled away mid-sweep, restore block flag */
      inEventsBlockDotRender = true;
    });
}

/* ═══════════════════════════════════════════
   5. SCROLL DRIVER
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

  /* Legend: show only during/after timeline animation, not during events 1-4 */
  const inLaterEvents = frac >= EVENTS_START_FRAC && DroughtEvents.activeIndex() > 0;
  document.getElementById('legend').classList.toggle('show', frac >= ANIM_START_FRAC && !inLaterEvents);

  if (frac > 0.02) document.getElementById('scroll-hint').style.opacity = '0';

  /* Year counter: show only during animation and event 0's sweep; hide otherwise */
  const yearDisplay = document.getElementById('year-display');
  const showYear = frac >= ANIM_START_FRAC && !inLaterEvents;
  yearDisplay.style.opacity = showYear ? '' : '0';

  /* ══════════════════════════════════════
     ZONE ROUTING
  ══════════════════════════════════════ */

  if (frac < EVENTS_START_FRAC) {
    /* ── Zone A: title hooks + timeline ── */
    if (inEventZone) {
      inEventZone            = false;
      inEventsBlockDotRender = false;
      d3.select('#world-svg').interrupt('year-sweep');
      DroughtEvents.dismissAll();
      resetProjectionToBase(true);
    }

    if (frac < ANIM_START_FRAC) {
      /* Title card zone: show 1850 dots but no year label yet */
      if (lastYear !== YEARS_START) {
        renderYear(YEARS_START);
        lastYear = YEARS_START;
      }
    } else {
      /* Timeline animation zone: scrub year with scroll */
      const animFrac   = Math.min(
        Math.max((frac - ANIM_START_FRAC) / (ANIM_END_FRAC - ANIM_START_FRAC), 0), 1
      );
      const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));
      renderYearIfNew(targetYear);
    }

  } else {
    /* ── Zone B: historical events (0.667 → 1.0) ── */
    if (!inEventZone) {
      inEventZone            = true;
      inEventsBlockDotRender = true;
    }
    const eventsFrac = (frac - EVENTS_START_FRAC) / (1.0 - EVENTS_START_FRAC);
    DroughtEvents.update(eventsFrac);
  }
}

/* ═══════════════════════════════════════════
   6. RESIZE
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
   7. BOOT
═══════════════════════════════════════════ */
(async function boot() {
  initMap();
  await loadData();

  /* Render 1850 immediately so dots are visible on the title page */
  renderYear(YEARS_START);
  lastYear = YEARS_START;
  document.getElementById('year-display').textContent = '';

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

/* ── util ── */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}