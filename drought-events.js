/* ─────────────────────────────────────────────
   DROUGHT EVENTS  ·  drought-events.js
───────────────────────────────────────────── */

let eventsData  = [];
let eventsReady = false;
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

  panelClose.addEventListener('click', () => dismissAll());
}

/* ─────────────────────────────────────────────
   PUBLIC: firstSweepYear
   The year the rewind sweeps back to (from event 0's data).
───────────────────────────────────────────── */
function firstSweepYear() {
  if (!eventsReady || eventsData.length === 0) return 1878;
  return eventsData[0].sweepToYear || 1878;
}

/* ─────────────────────────────────────────────
   PUBLIC: zoomAndShowFirst
   Called by main.js after the rewind sweep finishes.
   Zooms to event 0's location, shows the panel, then calls onComplete.
───────────────────────────────────────────── */
function zoomAndShowFirst(onComplete) {
  if (!eventsReady || eventsData.length === 0) { if (onComplete) onComplete(); return; }

  const ev = eventsData[0];
  activeEventIndex = 0;

  /* Fill panel content */
  fillPanel(ev);

  /* Keep panel hidden until zoom settles */
  panel.classList.remove('ep--visible', 'ep--exit');
  panel.classList.add('ep--hidden');

  zoomToEvent(ev, () => {
    /* Slide panel in */
    panel.classList.remove('ep--hidden', 'ep--exit');
    void panel.offsetWidth;
    panel.classList.add('ep--visible');
    if (onComplete) onComplete();
  });
}

/* ─────────────────────────────────────────────
   PUBLIC: scroll update  (frac 0–1 within Zone B)
───────────────────────────────────────────── */
function updateEventsByScroll(frac) {
  if (!eventsReady || eventsData.length === 0) return;

  const n       = eventsData.length;
  const rawSlot = Math.floor(frac / (1 / n));
  const slotIdx = Math.min(rawSlot, n - 1);

  if (slotIdx !== activeEventIndex) {
    showEvent(slotIdx);
  }
}

/* ─────────────────────────────────────────────
   PUBLIC: dismiss
───────────────────────────────────────────── */
function dismissAll() {
  if (activeEventIndex === -1) return;
  activeEventIndex = -1;

  if (panel) {
    panel.classList.remove('ep--visible', 'ep--exit');
    panel.classList.add('ep--hidden');
  }
  _dotLayer.selectAll('.event-ring').remove();
}

/* ─────────────────────────────────────────────
   PUBLIC: activeIndex
───────────────────────────────────────────── */
function getActiveIndex() { return activeEventIndex; }

/* ─────────────────────────────────────────────
   FILL PANEL CONTENT
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
   SHOW EVENT (scroll-driven, events 0-N)
───────────────────────────────────────────── */
function showEvent(index) {
  if (!eventsReady) return;
  const ev = eventsData[index];
  if (!ev) return;

  activeEventIndex = index;
  fillPanel(ev);

  /* Hide panel → zoom → show panel */
  panel.classList.remove('ep--visible', 'ep--exit');
  panel.classList.add('ep--hidden');

  zoomToEvent(ev, () => {
    panel.classList.remove('ep--hidden', 'ep--exit');
    void panel.offsetWidth;
    panel.classList.add('ep--visible');
  });
}

/* ─────────────────────────────────────────────
   ZOOM TO EVENT
───────────────────────────────────────────── */
function zoomToEvent(ev, onComplete) {
  const svg = d3.select('#world-svg');
  const bs  = _getBaseScale();
  const bt  = _getBaseTranslate();
  const W   = window.innerWidth;
  const H   = window.innerHeight;
  const zf  = ev.zoomFactor || 3.0;

  const normLon = ev.lon > 180 ? ev.lon - 360 : ev.lon;

  _projection.scale(bs).translate(bt);
  const [x, y] = _projection([normLon, ev.lat]);

  _projection
    .scale(bs * zf)
    .translate([
      W / 2 - zf * (x - bt[0]),
      H / 2 - zf * (y - bt[1]),
    ]);

  _dotLayer.selectAll('.event-ring').remove();
  _renderYear(null);

  svg.selectAll('path')
    .transition().duration(1300).ease(d3.easeCubicInOut)
    .attr('d', _path);

  const [nx, ny]      = _projection([normLon, ev.lat]);
  const capturedIndex = activeEventIndex;

  setTimeout(() => {
    if (activeEventIndex !== capturedIndex) return;

    _dotLayer.selectAll('.event-ring').remove();

    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx).attr('cy', ny).attr('r', 0)
      .attr('fill', 'none').attr('stroke', '#ff6b35').attr('stroke-width', 1.5)
      .style('opacity', 0.85)
      .transition().duration(900).ease(d3.easeCubicOut)
      .attr('r', 24).style('opacity', 0.5);

    _dotLayer.append('circle')
      .attr('class', 'event-ring')
      .attr('cx', nx).attr('cy', ny).attr('r', 5)
      .attr('fill', '#ff6b35').style('opacity', 0)
      .transition().duration(600).delay(250).style('opacity', 1)
      .on('end', () => { if (onComplete) onComplete(); });

  }, 1350);
}

/* ─────────────────────────────────────────────
   PUBLIC: resize
───────────────────────────────────────────── */
function onEventsResize() {
  if (activeEventIndex >= 0 && eventsReady) {
    zoomToEvent(eventsData[activeEventIndex], null);
  }
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.DroughtEvents = {
  init:            initEvents,
  load:            loadEvents,
  update:          updateEventsByScroll,
  dismissAll:      dismissAll,
  activeIndex:     getActiveIndex,
  resize:          onEventsResize,
  firstSweepYear:  firstSweepYear,
  zoomAndShowFirst: zoomAndShowFirst,
};