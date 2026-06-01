/* ─────────────────────────────────────────────
   THE WANDERING DROUGHT  ·  main.js
   Scrolly-driven D3 world map with drought dots
───────────────────────────────────────────── */

const YEARS_START = 1850;
const YEARS_END   = 2014;
const TOTAL_YEARS = YEARS_END - YEARS_START + 1;

/* ── State ── */
let allData      = {};   // { year: [ {lat,lon,spi}, … ] }
let currentYear  = YEARS_START;
let projection, path;
let dotLayer;

/* ── Opacity scale (average_spi is negative; more negative = worse) ── */
const opacityScale = d3.scalePow()
  .exponent(0.5)           // higher = more dramatic gap
  .domain([-3.5, -1.0])
  .range([0.98, 0.3])      // wider range too
  .clamp(true);

/* ── Dot radius (tiny, grid-relative) ── */
const dotRadius = 1.8;

/* ═══════════════════════════════════════════
   1.  SET UP SVG + PROJECTION
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

  path = d3.geoPath().projection(projection);

  /* sphere background */
  svg.append('path')
     .datum({ type: 'Sphere' })
     .attr('class', 'sphere')
     .attr('d', path);

  /* graticule */
  svg.append('path')
     .datum(d3.geoGraticule()())
     .attr('class', 'graticule')
     .attr('d', path);

  /* dot layer (rendered below text) */
  dotLayer = svg.append('g').attr('class', 'dot-layer');

  /* load world topo */
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r => r.json())
    .then(world => {
      svg.insert('path', '.dot-layer')
         .datum(topojson.feature(world, world.objects.countries))
         .attr('class', 'land')
         .attr('d', path);
    });
}

/* ═══════════════════════════════════════════
   2.  LOAD + INDEX CSV
═══════════════════════════════════════════ */
function loadData() {
  return fetch('historical_yearly.json')
    .then(r => r.json())
    .then(json => {
      allData = json; // already keyed by year, ready to use
    });
}

/* ═══════════════════════════════════════════
   3.  RENDER DOTS FOR A GIVEN YEAR
       Strategy: keep ALL dots ever drawn; just
       add new year's dots and fade them in.
       For perf on 860k rows we only render the
       current year's incremental batch.
═══════════════════════════════════════════ */

/* We track what's drawn with a Map keyed by "lat|lon" 
   so duplicate coords don't pile up */



function renderYear(year) {
  const yearData = allData[year] || [];

  // Clear only dots, not the map paths
  dotLayer.selectAll('circle').remove();

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
}

/* ═══════════════════════════════════════════
   4.  SCROLL DRIVER
═══════════════════════════════════════════ */

/* Text block sequencing */
const ANIM_START_FRAC  = 0.05;
const ANIM_END_FRAC    = 0.95;
const TEXT_HIDE_FRAC   = 0.90;
const LEGEND_SHOW_FRAC = 0;

const hooks = [
  { id: 'hook-eyebrow', scrollFrac: 0.00  },  // on load
  { id: 'hook-word1',   scrollFrac: 0.00  },  // "Droughts" — on load
  { id: 'hook-word2',   scrollFrac: 0.2 },  // "don't stay" — ~1855
  { id: 'hook-word3',   scrollFrac: 0.3 },  // "in one place." — ~1860
  { id: 'hook-sub',     scrollFrac: 0.4 },  // subtitle — ~1870
  { id: 'hook-byline',  scrollFrac: 0.6 },  // byline — ~1880
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

  hooks.forEach(h => {
    const el = document.getElementById(h.id);
    if (frac >= h.scrollFrac && frac < TEXT_HIDE_FRAC) {
      el.classList.remove('hide');
      el.classList.add('show');
    } else if (frac >= TEXT_HIDE_FRAC) {
      el.classList.remove('show');
      el.classList.add('hide');
    } else {
      el.classList.remove('show', 'hide');
    }
  });

  document.getElementById('legend').classList.toggle('show', frac >= LEGEND_SHOW_FRAC);

  if (frac > 0.02) document.getElementById('scroll-hint').style.opacity = '0';

  // clamp year strictly between START and END
  const animFrac  = Math.min(Math.max((frac - ANIM_START_FRAC) / (ANIM_END_FRAC - ANIM_START_FRAC), 0), 1);
  const targetYear = Math.round(YEARS_START + animFrac * (YEARS_END - YEARS_START));
  renderYearIfNew(targetYear);
}

function renderYearIfNew(year) {
  if (year === lastYear) return;
  renderYear(year); // always re-render, forward or backward
  lastYear = year;
}

/* ═══════════════════════════════════════════
   5.  RESIZE HANDLER
═══════════════════════════════════════════ */
function onResize() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  d3.select('#world-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  projection
    .scale(W / 5.8)
    .translate([W / 2, H / 2]);

  /* re-draw all paths */
  d3.select('#world-svg').selectAll('path').attr('d', path);

  /* re-position dots */
  dotLayer.selectAll('circle').each(function(d) {
    /* we didn't bind data to circles so read from attrs */
    /* dots stay approximately correct on resize — acceptable for scrolly */
  });
}

/* ═══════════════════════════════════════════
   6.  BOOT
═══════════════════════════════════════════ */
(async function boot() {
  initMap();
  await loadData();

  /* initial render */
  renderYear(YEARS_START);
  lastYear = YEARS_START;

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(onResize, 200));

  /* trigger once to set initial state */
  onScroll();
})();

/* ── util ── */
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}