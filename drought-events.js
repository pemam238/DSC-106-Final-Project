/* ─────────────────────────────────────────────
   DROUGHT EVENTS  ·  drought-events.js
   
   FIX SUMMARY:
   - firstSweepYear() no longer relies on a missing "sweepToYear" field;
     it derives the year from ev.period (e.g. "1875 – 1878" → 1875)
   - Panel show/hide no longer uses keyframe animation class toggling,
     which caused flickers; it uses only the transition-based state classes
     (ep--hidden / ep--visible / ep--exit)
   - zoomToEvent correctly resets projection before computing pixel coords
   - dismissAll properly resets activeEventIndex before touching DOM
   - The "close" button now just hides the panel without resetting zoom
───────────────────────────────────────────── */

let eventsData       = [];
let eventsReady      = false;
let activeEventIndex = -1;

let panel, panelIndex, panelTitle, panelPeriod,
    panelRegion, panelTagline, panelBody,
    panelStat, panelStatLabel, panelClose;

let _projection, _path, _dotLayer;
let _getBaseScale, _getBaseTranslate, _renderYear, _renderYearSweep;

/* ─────────────────────────────────────────────
   PUBLIC: init
───────────────────────────────────────────── */
function initEvents({ projection, path, dotLayer,
                      getBaseScale, getBaseTranslate,
                      renderYear, renderYearSweep }) {
  _projection       = projection;
  _path             = path;
  _dotLayer         = dotLayer;
  _getBaseScale     = getBaseScale;
  _getBaseTranslate = getBaseTranslate;
  _renderYear       = renderYear;
  _renderYearSweep  = renderYearSweep;
}

/* ─────────────────────────────────────────────
   PUBLIC: load
───────────────────────────────────────────── */
async function loadEvents() {
  const res  = await fetch('drought-events.json');
  eventsData = await res.json();
  eventsReady = true;

  panel          = document.getElementById('event-panel');
  panelIndex     = document.getElementById('ep-index');
  panelTitle     = document.getElementById('ep-title');
  panelPeriod    = document.getElementById('ep-period');
  panelRegion    = document.getElementById('ep-region');
  panelTagline   = document.getElementById('ep-tagline');
  panelBody      = document.getElementById('ep-body');
  panelStat      = document.getElementById('ep-stat');
  panelStatLabel = document.getElementById('ep-stat-label');
  panelClose     = document.getElementById('ep-close');

  /* Close button just hides the panel visually; scroll still works */
  panelClose.addEventListener('click', () => {
    hidePanel();
  });
}

/* ─────────────────────────────────────────────
   PUBLIC: firstSweepYear
   Derives the start year from ev.period string, e.g. "1875 – 1878" → 1875.
   Falls back to 1875 if parsing fails.
───────────────────────────────────────────── */
function firstSweepYear() {
  if (!eventsReady || eventsData.length === 0) return 1875;
  /* Try explicit field first, then parse from period string */
  const ev = eventsData[0];
  if (ev.sweepToYear) return ev.sweepToYear;
  const match = (ev.period || '').match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 1875;
}

/* ─────────────────────────────────────────────
   PUBLIC: zoomAndShowFirst
   Called by main.js after the rewind sweep finishes.
───────────────────────────────────────────── */
function zoomAndShowFirst(onComplete) {
  if (!eventsReady || eventsData.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  activeEventIndex = 0;
  _showEventPanel(0, onComplete);
}

/* ─────────────────────────────────────────────
   PUBLIC: update  (frac 0–1 within Zone B)
───────────────────────────────────────────── */
function updateEventsByScroll(frac) {
  if (!eventsReady || eventsData.length === 0) return;

  const n       = eventsData.length;
  const rawSlot = Math.floor(frac * n);
  const slotIdx = Math.min(rawSlot, n - 1);

  if (slotIdx !== activeEventIndex) {
    activeEventIndex = slotIdx;
    _showEventPanel(slotIdx, null);
  }
}

/* ─────────────────────────────────────────────
   PUBLIC: dismissAll  — resets to no event selected
───────────────────────────────────────────── */
function dismissAll() {
  activeEventIndex = -1;
  hidePanel();
  if (_dotLayer) _dotLayer.selectAll('.event-ring').remove();
}

/* ─────────────────────────────────────────────
   PUBLIC: activeIndex
───────────────────────────────────────────── */
function getActiveIndex() { return activeEventIndex; }

/* ─────────────────────────────────────────────
   PUBLIC: resize
───────────────────────────────────────────── */
function onEventsResize() {
  if (activeEventIndex >= 0 && eventsReady) {
    zoomToEvent(eventsData[activeEventIndex], null);
  }
}

/* ─────────────────────────────────────────────
   INTERNAL: hide panel (transition to ep--hidden)
───────────────────────────────────────────── */
function hidePanel() {
  if (!panel) return;
  panel.classList.remove('ep--visible', 'ep--exit');
  panel.classList.add('ep--hidden');
}

/* ─────────────────────────────────────────────
   INTERNAL: show panel (transition to ep--visible)
───────────────────────────────────────────── */
function showPanel() {
  if (!panel) return;
  panel.classList.remove('ep--hidden', 'ep--exit');
  /* Force reflow so the CSS transition fires even if class was already removed */
  void panel.offsetWidth;
  panel.classList.add('ep--visible');
}

/* ─────────────────────────────────────────────
   INTERNAL: fill panel DOM with event data
───────────────────────────────────────────── */
function fillPanel(ev) {
  panelIndex.textContent     = `${String(ev.index).padStart(2,'0')} / ${String(eventsData.length).padStart(2,'0')}`;
  panelTitle.textContent     = ev.title;
  panelPeriod.textContent    = ev.period;
  panelRegion.textContent    = ev.region;
  panelTagline.textContent   = ev.tagline;
  panelBody.textContent      = ev.body;
  panelStat.textContent      = ev.stat;
  panelStatLabel.textContent = ev.statLabel;
}

/* ─────────────────────────────────────────────
   INTERNAL: _showEventPanel(index, onComplete)
   1. Hides panel
   2. Fills content
   3. Zooms map
   4. Shows panel + calls onComplete
───────────────────────────────────────────── */
function _showEventPanel(index, onComplete) {
  if (!eventsReady) return;
  const ev = eventsData[index];
  if (!ev) return;

  /* 1. Hide panel while zooming */
  hidePanel();

  /* 2. Fill content so it's ready before reveal */
  fillPanel(ev);

  /* 3. Zoom, then show */
  zoomToEvent(ev, () => {
    showPanel();
    if (onComplete) onComplete();
  });
}

/* ─────────────────────────────────────────────
   INTERNAL: zoomToEvent
   FIX: Always resets projection to base FIRST before computing
   pixel coords, so repeated calls don't compound transforms.
───────────────────────────────────────────── */
function zoomToEvent(ev, onComplete) {
  const svg = d3.select('#world-svg');
  const bs  = _getBaseScale();
  const bt  = _getBaseTranslate();
  const W   = window.innerWidth;
  const H   = window.innerHeight;
  const zf  = ev.zoomFactor || 3.0;

  /* Normalise longitude to [-180, 180] */
  const normLon = ev.lon > 180 ? ev.lon - 360 : ev.lon;

  /* Step 1: Reset to base so pixel lookup is correct */
  _projection.scale(bs).translate(bt);
  const [x, y] = _projection([normLon, ev.lat]);

  /* Step 2: Apply zoomed transform */
  _projection
    .scale(bs * zf)
    .translate([
      W / 2 - zf * (x - bt[0]),
      H / 2 - zf * (y - bt[1]),
    ]);

  /* Step 3: Remove old ring, re-render dots at new projection */
  _dotLayer.selectAll('.event-ring').remove();
  _renderYear(null);

  /* Step 4: Transition all map paths to new projection */
  const ZOOM_MS = 1300;
  svg.selectAll('path')
    .transition('zoom')
    .duration(ZOOM_MS)
    .ease(d3.easeCubicInOut)
    .attr('d', _path);

  /* Step 5: After zoom settles, draw the ring + centre dot */
  const capturedIndex = activeEventIndex;

  setTimeout(() => {
    /* Guard: abort if user scrolled to a different event */
    if (activeEventIndex !== capturedIndex) return;

    /* Re-project the event location (projection has changed) */
    const [nx, ny] = _projection([normLon, ev.lat]);

    _dotLayer.selectAll('.event-ring').remove();

    /* Expanding ring */
    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx).attr('cy', ny).attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', '#ff6b35')
      .attr('stroke-width', 1.5)
      .style('opacity', 0.85)
      .transition().duration(900).ease(d3.easeCubicOut)
      .attr('r', 24).style('opacity', 0.5);

    /* Centre dot — reveal triggers onComplete */
    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx).attr('cy', ny).attr('r', 5)
      .attr('fill', '#ff6b35')
      .style('opacity', 0)
      .transition().duration(600).delay(250)
      .style('opacity', 1)
      .on('end', () => {
        if (onComplete) onComplete();
      });

  }, ZOOM_MS + 50);
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.DroughtEvents = {
  init:             initEvents,
  load:             loadEvents,
  update:           updateEventsByScroll,
  dismissAll:       dismissAll,
  activeIndex:      getActiveIndex,
  resize:           onEventsResize,
  firstSweepYear:   firstSweepYear,
  zoomAndShowFirst: zoomAndShowFirst,
};