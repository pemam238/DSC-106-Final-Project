/* ─────────────────────────────────────────────
   DROUGHT EVENTS  ·  drought-events.js
   Scroll-driven zoom + side panel for 5 events
───────────────────────────────────────────── */

/* ── Module state ── */
let eventsData        = [];
let eventsReady       = false;
let activeEventIndex  = -1;   // which event is currently shown (-1 = none)
let panelVisible      = false;

/* ── Panel DOM refs (set after DOMContentLoaded) ── */
let panel, panelIndex, panelTitle, panelPeriod,
    panelRegion, panelTagline, panelBody,
    panelStat, panelStatLabel, panelClose;

/* ── Projection + path refs (injected from main.js) ── */
let _projection, _path, _dotLayer, _baseScale, _baseTranslate;
let _getBaseScale, _getBaseTranslate;

/* ─────────────────────────────────────────────
   PUBLIC: inject D3 refs from main.js
───────────────────────────────────────────── */
function initEvents({ projection, path, dotLayer, getBaseScale, getBaseTranslate }) {
  _projection    = projection;
  _path          = path;
  _dotLayer      = dotLayer;
  _getBaseScale  = getBaseScale;
  _getBaseTranslate = getBaseTranslate;
}

/* ─────────────────────────────────────────────
   PUBLIC: load event data
───────────────────────────────────────────── */
async function loadEvents() {
  const res  = await fetch('drought-events.json');
  eventsData = await res.json();
  eventsReady = true;
  buildPanel();
}

/* ─────────────────────────────────────────────
   BUILD PANEL HTML (injected once)
───────────────────────────────────────────── */
function buildPanel() {
  // Panel already exists in HTML; just grab refs
  panel         = document.getElementById('event-panel');
  panelIndex    = document.getElementById('ep-index');
  panelTitle    = document.getElementById('ep-title');
  panelPeriod   = document.getElementById('ep-period');
  panelRegion   = document.getElementById('ep-region');
  panelTagline  = document.getElementById('ep-tagline');
  panelBody     = document.getElementById('ep-body');
  panelStat     = document.getElementById('ep-stat');
  panelStatLabel= document.getElementById('ep-stat-label');
  panelClose    = document.getElementById('ep-close');

  panelClose.addEventListener('click', () => dismissEvent());
}

/* ─────────────────────────────────────────────
   PUBLIC: called from scroll driver
   frac: 0–1 over the events scroll zone
───────────────────────────────────────────── */
function updateEventsByScroll(frac) {
  if (!eventsReady || eventsData.length === 0) return;

  const n = eventsData.length;

  if (frac < 0) {
    // Before events zone — dismiss
    if (activeEventIndex !== -1) dismissEvent(true);
    return;
  }

  if (frac > 1) {
    // After events zone — keep last event showing
    return;
  }

  // Which event slot are we in?  0 … n-1
  const slotSize   = 1 / n;
  const rawSlot    = Math.floor(frac / slotSize);
  const slotIndex  = Math.min(rawSlot, n - 1);

  if (slotIndex !== activeEventIndex) {
    showEvent(slotIndex);
  }
}

/* ─────────────────────────────────────────────
   SHOW EVENT
───────────────────────────────────────────── */
function showEvent(index) {
  if (!eventsReady) return;
  const ev = eventsData[index];
  if (!ev) return;

  activeEventIndex = index;

  // ── 1. Fill panel content ──
  panelIndex.textContent    = `${String(ev.index).padStart(2, '0')} / ${String(eventsData.length).padStart(2, '0')}`;
  panelTitle.textContent    = ev.title;
  panelPeriod.textContent   = ev.period;
  panelRegion.textContent   = ev.region;
  panelTagline.textContent  = ev.tagline;
  panelBody.textContent     = ev.body;
  panelStat.textContent     = ev.stat;
  panelStatLabel.textContent= ev.statLabel;

  // ── 2. Show panel ──
  panel.classList.remove('ep--hidden', 'ep--exit');
  panel.classList.add('ep--visible');
  panelVisible = true;

  // ── 3. Zoom map ──
  zoomToEvent(ev);
}

/* ─────────────────────────────────────────────
   DISMISS EVENT
───────────────────────────────────────────── */
function dismissEvent(instant = false) {
  activeEventIndex = -1;
  panelVisible     = false;

  panel.classList.remove('ep--visible');
  panel.classList.add('ep--exit');

  setTimeout(() => {
    panel.classList.add('ep--hidden');
    panel.classList.remove('ep--exit');
  }, instant ? 0 : 500);

  resetZoom(instant);
}

/* ─────────────────────────────────────────────
   ZOOM TO EVENT
───────────────────────────────────────────── */
function zoomToEvent(ev) {
  const svg = d3.select('#world-svg');
  const bs  = _getBaseScale();
  const bt  = _getBaseTranslate();
  const W   = window.innerWidth;
  const H   = window.innerHeight;

  // Reset projection to base first
  _projection.scale(bs).translate(bt);

  const normLon = ev.lon > 180 ? ev.lon - 360 : ev.lon;
  const [x, y]  = _projection([normLon, ev.lat]);

  const zf = ev.zoomFactor || 3.0;

  _projection
    .scale(bs * zf)
    .translate([
      W / 2 - (x - bt[0]) * zf,
      H / 2 - (y - bt[1]) * zf
    ]);

  // Animate map paths
  svg.selectAll('path')
    .transition()
    .duration(1400)
    .ease(d3.easeCubicInOut)
    .attr('d', _path);

  // Re-render dots at new projection after transition starts
  setTimeout(() => {
    // Remove old highlight rings
    _dotLayer.selectAll('.event-ring, .event-label').remove();

    const [nx, ny] = _projection([normLon, ev.lat]);

    // Pulsing ring
    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx)
      .attr('cy', ny)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', '#ff6b35')
      .attr('stroke-width', 1.5)
      .style('opacity', 0.9)
      .transition()
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('r', 22)
      .style('opacity', 0.6);

    // Dot center
    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx)
      .attr('cy', ny)
      .attr('r', 4)
      .attr('fill', '#ff6b35')
      .style('opacity', 0)
      .transition()
      .duration(600)
      .delay(300)
      .style('opacity', 1);

  }, 700);
}

/* ─────────────────────────────────────────────
   RESET ZOOM
───────────────────────────────────────────── */
function resetZoom(instant = false) {
  const svg = d3.select('#world-svg');
  const bs  = _getBaseScale();
  const bt  = _getBaseTranslate();

  _projection.scale(bs).translate(bt);

  _dotLayer.selectAll('.event-ring, .event-label').remove();

  if (instant) {
    svg.selectAll('path').attr('d', _path);
  } else {
    svg.selectAll('path')
      .transition()
      .duration(900)
      .ease(d3.easeCubicInOut)
      .attr('d', _path);
  }
}

/* ─────────────────────────────────────────────
   PUBLIC: resize recalc
───────────────────────────────────────────── */
function onEventsResize() {
  if (activeEventIndex >= 0 && eventsReady) {
    // Re-zoom to current event instantly after resize
    zoomToEvent(eventsData[activeEventIndex]);
  }
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.DroughtEvents = {
  init:   initEvents,
  load:   loadEvents,
  update: updateEventsByScroll,
  resize: onEventsResize,
};