/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js
   Scrolly-driven D3 world map with drought dots
   + historical event zoom panels
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;

/* ── Scroll zones (fractions of total scroll height) ──
   0.00 – 0.72  → timeline animation (years 1850-2014)
   0.72 – 0.97  → 5 historical event zooms
   0.97 – 1.00  → rewind / final beat
*/
const TIMELINE_END_FRAC   = 0.72;
const EVENTS_START_FRAC   = 0.74;
const EVENTS_END_FRAC     = 0.96;
const REWIND_FRAC         = 0.97;

/* ── State ── */
let allData      = {};
let currentYear  = YEARS_START;
let lastYear     = null;
let projection, path;
let dotLayer;

let baseScale;
let baseTranslate;
let rewindHasPlayed = false;
let inEventZone = false;

/* ── Opacity scale ── */
const opacityScale = d3.scalePow()
  .exponent(0.5)
  .domain([-3.5, -1.0])
  .range([0.98, 0.3])
  .clamp(true);

/* ═══════════════════════════════════════════
   1. SET UP SVG + PROJECTION
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
  baseTranslate = projection.translate();

  path = d3.geoPath().projection(projection);

  svg.append('path')
     .datum({ type: 'Sphere' })
     .attr('class', 'sphere')
     .attr('d', path);

  svg.append('path')
     .datum(d3.geoGraticule()())
     .attr('class', 'graticule')
     .attr('d', path);

  dotLayer = svg.append('g').attr('class', 'dot-layer');

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r => r.json())
    .then(world => {
      svg.insert('path', '.dot-layer')
         .datum(topojson.feature(world, world.objects.countries))
         .attr('class', 'land')
         .attr('d', path);
    });
}

/* ── Getters for base projection (used by drought-events.js) ── */
function getBaseScale()     { return baseScale; }
function getBaseTranslate() { return baseTranslate; }

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
═══════════════════════════════════════════ */
function renderYear(year) {
  const yearData = allData[year] || [];

  dotLayer.selectAll('circle.drought-dot').remove();

  yearData.forEach(d => {
    const normLon = d.lon > 180 ? d.lon - 360 : d.lon;
    const coords = projection([normLon, d.lat]);
    if (!coords) return;

    dotLayer.append('circle')
      .attr('class', 'drought-dot')
      .attr('cx', coords[0])
      .attr('cy', coords[1])
      .attr('r', 1.2)
      .attr('fill', '#ff4422')
      .style('opacity', opacityScale(d.spi));
  });

  document.getElementById('year-display').textContent = year;
  currentYear = year;
}

function renderYearIfNew(year) {
  if (year === lastYear) return;
  renderYear(year);
  lastYear = year;
}

/* ═══════════════════════════════════════════
   4. FIND EARLIEST SEVERE DROUGHT
═══════════════════════════════════════════ */
function findEarliestSevereDrought(threshold = -1.5) {
  for (let year = YEARS_START; year <= YEARS_END; year++) {
    const yearData = allData[year] || [];
    const severe = yearData
      .filter(d => d.spi <= threshold)
      .sort((a, b) => a.spi - b.spi)[0];
    if (severe) return { year, ...severe };
  }
  return null;
}

/* ═══════════════════════════════════════════
   5. REWIND + ZOOM  (end-of-scroll beat)
═══════════════════════════════════════════ */
function playRewindToFirstSevereDrought() {
  if (rewindHasPlayed) return;
  rewindHasPlayed = true;

  const first     = findEarliestSevereDrought(-1.5);
  if (!first) return;

  const startYear = currentYear;
  const endYear   = first.year;

  d3.select({ year: startYear })
    .transition()
    .duration(3500)
    .ease(d3.easeCubicInOut)
    .tween('rewind-year', () => {
      const interp = d3.interpolateNumber(startYear, endYear);
      return t => renderYearIfNew(Math.round(interp(t)));
    })
    .on('end', () => zoomToDrought(first));
}

function zoomToDrought(d) {
  const svg      = d3.select('#world-svg');
  const normLon  = d.lon > 180 ? d.lon - 360 : d.lon;
  const W = window.innerWidth;
  const H = window.innerHeight;

  projection.scale(baseScale).translate(baseTranslate);
  const [x, y] = projection([normLon, d.lat]);
  const zf = 3.2;

  projection
    .scale(baseScale * zf)
    .translate([
      W / 2 - (x - baseTranslate[0]) * zf,
      H / 2 - (y - baseTranslate[1]) * zf
    ]);

  svg.selectAll('path')
    .transition().duration(1800).ease(d3.easeCubicInOut)
    .attr('d', path);

  setTimeout(() => {
    renderYear(d.year);
    lastYear = d.year;

    const [newX, newY] = projection([normLon, d.lat]);

    dotLayer.append('circle')
      .attr('class', 'first-severe-drought-highlight')
      .attr('cx', newX).attr('cy', newY).attr('r', 0)
      .attr('fill', 'none').attr('stroke', '#ffffff')
      .attr('stroke-width', 2).style('opacity', 1)
      .transition().duration(1200).attr('r', 16);

    dotLayer.append('text')
      .attr('class', 'first-severe-drought-label')
      .attr('x', newX + 20).attr('y', newY - 14)
      .attr('fill', '#ffffff').attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(`Earliest severe drought: ${d.year}, SPI ${d.spi.toFixed(2)}`);
  }, 1850);
}

/* ═══════════════════════════════════════════
   6. SCROLL DRIVER
═══════════════════════════════════════════ */
const ANIM_START_FRAC  = 0.05;
const TEXT_HIDE_FRAC   = 0.68;

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00 },
  { id: 'hook-word1',   scrollFrac: 0.00 },
  { id: 'hook-word2',   scrollFrac: 0.20 },
  { id: 'hook-word3',   scrollFrac: 0.30 },
  { id: 'hook-sub',     scrollFrac: 0.40 },
  { id: 'hook-byline',  scrollFrac: 0.60 },
];

function getScrollFrac() {
  const scrollTop = window.scrollY;
  const sceneTop  = document.getElementById('scrolly').offsetTop;
  const sceneH    = document.getElementById('scroll-space').offsetHeight;
  return Math.min(Math.max((scrollTop - sceneTop) / sceneH, 0), 1);
}

function onScroll() {
  const frac = getScrollFrac();

  document.getElementById('progress-bar').style.width = (frac * 100) + '%';

  /* ── Hook text visibility ── */
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

  document.getElementById('legend').classList.toggle('show', frac >= 0);

  if (frac > 0.02) {
    document.getElementById('scroll-hint').style.opacity = '0';
  }

  /* ── Year display visibility ── */
  const yearDisplay = document.getElementById('year-display');
  if (frac >= EVENTS_START_FRAC && frac < REWIND_FRAC) {
    yearDisplay.style.opacity = '0';
  } else {
    yearDisplay.style.opacity = '';
  }

  /* ── Zone routing ── */
  if (frac < EVENTS_START_FRAC) {
    // ── Timeline zone ──
    if (inEventZone) {
      inEventZone = false;
      // Reset zoom when leaving events zone scrolling back
      DroughtEvents.update(-1);
    }

    const animFrac = Math.min(
      Math.max((frac - ANIM_START_FRAC) / (TIMELINE_END_FRAC - ANIM_START_FRAC), 0),
      1
    );
    const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));

    if (!rewindHasPlayed) renderYearIfNew(targetYear);

  } else if (frac >= EVENTS_START_FRAC && frac < REWIND_FRAC) {
    // ── Events zone ──
    inEventZone = true;

    const eventsFrac = (frac - EVENTS_START_FRAC) / (REWIND_FRAC - EVENTS_START_FRAC);
    DroughtEvents.update(eventsFrac);

  } else if (frac >= REWIND_FRAC) {
    // ── Rewind beat ──
    if (inEventZone) {
      inEventZone = false;
      DroughtEvents.update(-1);
    }
    playRewindToFirstSevereDrought();
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
  baseTranslate = projection.translate();

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

  /* Inject D3 context into events module */
  DroughtEvents.init({
    projection,
    path,
    dotLayer,
    getBaseScale,
    getBaseTranslate,
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