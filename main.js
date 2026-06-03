/* ── Scroll lock logic ───────────────────────── */
let buttonPressed = false;

function isOnSlide2() {
  const track = document.getElementById('slide-2-track');
  const rect = track.getBoundingClientRect();
  return rect.top <= 0 && rect.bottom > window.innerHeight;
}

document.addEventListener('wheel', (e) => {
  if (buttonPressed) return;
  if (isOnSlide2()) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (buttonPressed) return;
  if (isOnSlide2()) e.preventDefault();
}, { passive: false });

window.addEventListener('scroll', () => {
  driveMapEntrance();

  if (!buttonPressed) {
    if (isOnSlide2()) {
      const track = document.getElementById('slide-2-track');
      window.scrollTo({ top: track.offsetTop, behavior: 'instant' });
    }
    return;
  }

  drivePanels();

  if (!isOnMapTrack()) return;
  if (!mapBuilt) { buildMap(); return; }
  applyMapStep(getMapScrollStep());
});

/* ── Scroll arrow ────────────────────────────── */
document.querySelector('.scroll-arrow').addEventListener('click', () => {
  document.getElementById('slide-2-track').scrollIntoView({ behavior: 'smooth' });
});

/* ── Hot/Cold button ──────────────────────────── */
function chooseClimate() {
  document.getElementById('reveal-overlay').classList.add('visible');
  const halves = document.getElementById('hot-cold-halves');
  halves.style.opacity = '0';
  halves.style.pointerEvents = 'none';
  buttonPressed = true;
  drivePanels();
}

/* ── Panel reveal on scroll ───────────────────── */
const track  = document.getElementById('slide-2-track');
const panelL = document.getElementById('panel-left');
const panelR = document.getElementById('panel-right');

function drivePanels() {
  const trackTop    = track.getBoundingClientRect().top;
  const trackHeight = track.offsetHeight;
  const vh          = window.innerHeight;
  const progress    = Math.max(0, Math.min(1, -trackTop / (trackHeight - vh)));

  if (progress > 0.25) panelL.classList.add('visible');
  else panelL.classList.remove('visible');

  if (progress > 0.55) panelR.classList.add('visible');
  else panelR.classList.remove('visible');
}

/* ── Map entrance crossfade ────────────────────── */
function driveMapEntrance() {
  const mapTrack = document.getElementById('slide-map-track');
  const mapScene = document.getElementById('scene-map');
  const scene2   = document.getElementById('scene-question');
  if (!mapTrack || !mapScene) return;

  const rect     = mapTrack.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, -rect.top / window.innerHeight));

  mapScene.style.opacity = progress.toFixed(3);

  // Blend background from warm #f5f0e8 → ocean #c8e4f5 as map fades in
  const r = Math.round(245 + (200 - 245) * progress);
  const g = Math.round(240 + (228 - 240) * progress);
  const b = Math.round(232 + (245 - 232) * progress);
  mapScene.style.backgroundColor = `rgb(${r},${g},${b})`;

  if (scene2) {
    scene2.style.transform = `translateY(${-progress * 40}px)`;
    scene2.style.opacity   = (1 - progress * 1.4).toFixed(3);
  }
}

// Run once on load in case page starts mid-scroll
driveMapEntrance();

/* ═══════════════════════════════════════════════
   MAP SCROLLYTELLING
   ═══════════════════════════════════════════════ */

const CONTINENT_DATA = {
  "Africa":        { temp: 22.91, pr: 1.748 },
  "Asia":          { temp: 14.21, pr: 2.098 },
  "Europe":        { temp:  6.12, pr: 1.916 },
  "North America": { temp:  4.31, pr: 1.589 },
  "South America": { temp: 21.50, pr: 3.511 },
  "Oceania":       { temp: 20.04, pr: 1.021 },
  "Antarctica":    { temp:-32.49, pr: 0.590 },
};

const ISO_TO_CONT = (() => {
  const m = {};
  [12,24,72,108,120,132,140,174,175,178,180,204,231,232,266,270,288,
   324,384,404,426,430,434,450,454,466,478,504,508,516,562,566,624,
   638,646,678,686,694,706,710,716,728,729,748,768,788,800,818,834,854,894
  ].forEach(id => { m[id] = "Africa"; });
  [8,20,40,56,70,100,112,191,196,203,208,233,246,250,276,300,336,348,
   352,372,380,388,398,428,438,440,442,470,492,496,499,528,578,616,
   620,642,643,674,688,703,705,724,752,756,804,807,826
  ].forEach(id => { m[id] = "Europe"; });
  [4,31,48,50,51,64,96,104,116,144,156,268,356,360,364,368,376,392,
   400,408,410,414,418,422,458,462,512,524,586,608,634,682,702,704,
   762,764,792,795,860,887,760,275
  ].forEach(id => { m[id] = "Asia"; });
  [28,44,52,84,124,188,192,214,222,320,332,340,388,484,558,591,630,840
  ].forEach(id => { m[id] = "North America"; });
  [32,68,76,152,170,218,328,600,604,740,858,862
  ].forEach(id => { m[id] = "South America"; });
  [36,90,242,296,520,540,548,554,583,584,585,776,798,882
  ].forEach(id => { m[id] = "Oceania"; });
  [10].forEach(id => { m[id] = "Antarctica"; });
  return m;
})();

/* ── Color helpers ──────────────────────────────── */
function tempColor(t) {
  const tMin = -32.5, tMax = 23.5;
  const n = Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin)));
  if (n < 0.35) {
    const v = n / 0.35;
    return `rgb(${Math.round(245+v*(250-245))},${Math.round(240+v*(220-240))},${Math.round(232+v*(185-232))})`;
  } else if (n < 0.65) {
    const v = (n-0.35)/0.30;
    return `rgb(${Math.round(250+v*(232-250))},${Math.round(220+v*(100-220))},${Math.round(185+v*(48-185))})`;
  } else {
    const v = (n-0.65)/0.35;
    return `rgb(${Math.round(232+v*(123-232))},${Math.round(100+v*(26-100))},${Math.round(48+v*(10-48))})`;
  }
}

function prOpacity(pr) {
  const prMin = 0.5, prMax = 3.6;
  return Math.max(0.05, Math.min(0.82, (pr-prMin)/(prMax-prMin)*0.82));
}

function rgbParse(rgb) {
  const m = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/);
  return m ? [+m[1],+m[2],+m[3]] : [245,242,236];
}

/* ── State ──────────────────────────────────────── */
let mapBuilt   = false;
let mapStepNow = -1;
const countryPaths   = [];
const precipOverlays = [];

/* ── Animations ──────────────────────────────────── */
function animateTempFill() {
  const start = performance.now(), DUR = 1400;
  function frame(now) {
    const t    = Math.min(1,(now-start)/DUR);
    const ease = 1-Math.pow(1-t,3);
    countryPaths.forEach(({path,contName}) => {
      const data = CONTINENT_DATA[contName];
      if (!data) { path.style.fill='#e8dfd2'; return; }
      const rgb = rgbParse(tempColor(data.temp));
      path.style.fill = `rgb(${Math.round(245+(rgb[0]-245)*ease)},${Math.round(242+(rgb[1]-242)*ease)},${Math.round(236+(rgb[2]-236)*ease)})`;
    });
    if (t<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function animatePrOverlay(targetStep) {
  const targetOpacity = targetStep===1 ? 0.5 : 1.0;
  const start=performance.now(), DUR=900;
  const starts = precipOverlays.map(({path})=>parseFloat(path.getAttribute('opacity')||'0'));
  function frame(now) {
    const t=Math.min(1,(now-start)/DUR), ease=1-Math.pow(1-t,2);
    precipOverlays.forEach(({path,contName},i)=>{
      const data=CONTINENT_DATA[contName];
      if (!data) return;
      const final=prOpacity(data.pr)*targetOpacity;
      path.setAttribute('opacity',(starts[i]+(final-starts[i])*ease).toFixed(3));
    });
    if (t<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function hidePrOverlay() {
  const start=performance.now();
  const starts=precipOverlays.map(({path})=>parseFloat(path.getAttribute('opacity')||'0'));
  function frame(now) {
    const t=Math.min(1,(now-start)/400), e=1-Math.pow(1-t,2);
    precipOverlays.forEach(({path},i)=>path.setAttribute('opacity',(starts[i]*(1-e)).toFixed(3)));
    if (t<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ── Panel switching with enter/exit-up transitions ── */
function setMapPanel(idx) {
  const panels = document.querySelectorAll('.map-panel');
  panels.forEach((p, i) => {
    if (i === idx) {
      p.classList.remove('exit-up');
      p.classList.add('active');
    } else if (p.classList.contains('active')) {
      p.classList.remove('active');
      p.classList.add('exit-up');
      setTimeout(() => {
        if (!p.classList.contains('active')) {
          p.classList.remove('exit-up');
        }
      }, 600);
    }
  });
}

function getMapScrollStep() {
  const t = document.getElementById('slide-map-track');
  if (!t) return -1;
  const rect  = t.getBoundingClientRect();
  const total = t.offsetHeight - window.innerHeight;
  const prog  = Math.max(0, Math.min(1, -rect.top / total));
  if (prog < 0.01) return -1;
  if (prog < 0.35) return 0;
  if (prog < 0.65) return 1;
  return 2;
}

function isOnMapTrack() {
  const t = document.getElementById('slide-map-track');
  if (!t) return false;
  const rect = t.getBoundingClientRect();
  return rect.top <= 0 && rect.bottom > window.innerHeight;
}

function applyMapStep(step) {
  if (step === mapStepNow) return;
  const prev = mapStepNow;
  mapStepNow = step;

  if (step === 0 && prev < 0) {
    animateTempFill();
    document.getElementById('map-legend').classList.add('show');
    document.getElementById('legend-temp').classList.remove('hidden');
    document.getElementById('legend-pr').classList.add('hidden');
    setMapPanel(0);
  }
  if (step === 1) {
    animatePrOverlay(1);
    document.getElementById('legend-pr').classList.remove('hidden');
    setMapPanel(1);
  }
  if (step === 2) {
    animatePrOverlay(2);
    setMapPanel(2);
  }
  if (step === 0 && prev > 0) {
    hidePrOverlay();
    document.getElementById('legend-pr').classList.add('hidden');
    setMapPanel(0);
  }
}

/* ── Build map ─────────────────────────────────── */
async function buildMap() {
  if (mapBuilt) return;
  mapBuilt = true;

  const svgEl = document.getElementById('world-map');
  if (!svgEl) return;

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');

    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json());

    const countries = topojson.feature(world, world.objects.countries);
    const ns = 'http://www.w3.org/2000/svg';

    const W = svgEl.clientWidth  || window.innerWidth;
    const H = svgEl.clientHeight || window.innerHeight;
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const projection = d3.geoNaturalEarth1()
      .fitSize([W, H], { type: 'Sphere' });
    const pathGen = d3.geoPath().projection(projection);

    const sphere = document.createElementNS(ns,'path');
    sphere.setAttribute('d', pathGen({type:'Sphere'}));
    sphere.setAttribute('class','sphere');
    svgEl.appendChild(sphere);

    const grat = document.createElementNS(ns,'path');
    grat.setAttribute('d', pathGen(d3.geoGraticule()()));
    grat.setAttribute('class','graticule');
    svgEl.appendChild(grat);

    const tempGroup = document.createElementNS(ns,'g');
    tempGroup.setAttribute('id','temp-layer');
    svgEl.appendChild(tempGroup);

    const prGroup = document.createElementNS(ns,'g');
    prGroup.setAttribute('id','pr-layer');
    svgEl.appendChild(prGroup);

    countries.features.forEach(feature => {
      const id       = parseInt(feature.id, 10);
      const contName = ISO_TO_CONT[id] || null;
      const d        = pathGen(feature);
      if (!d) return;

      const tp = document.createElementNS(ns,'path');
      tp.setAttribute('d', d);
      tp.setAttribute('class','country');
      tp.style.fill = '#f5f0e8';
      tempGroup.appendChild(tp);
      countryPaths.push({path:tp, contName});

      const pp = document.createElementNS(ns,'path');
      pp.setAttribute('d', d);
      pp.setAttribute('class','country');
      pp.style.fill   = '#1a6fba';
      pp.style.stroke = 'none';
      pp.setAttribute('opacity','0');
      prGroup.appendChild(pp);
      precipOverlays.push({path:pp, contName});
    });

    const tooltip = document.getElementById('map-tooltip');
    const wrapper  = document.getElementById('map-wrapper');

    svgEl.addEventListener('mousemove', e => {
      const target = e.target.closest('.country');
      if (!target || !tooltip) return;
      const entry = countryPaths.find(c=>c.path===target) || precipOverlays.find(c=>c.path===target);
      if (!entry) return;
      const cont = entry.contName;
      const data = cont ? CONTINENT_DATA[cont] : null;
      if (!cont || !data) { tooltip.style.opacity='0'; return; }

      tooltip.innerHTML = [
        `<strong>${cont}</strong>`,
        `<span style="font-weight:400;opacity:0.82">Avg temp: ${data.temp>0?'+':''}${data.temp}°C</span>`,
        `<span style="font-weight:400;opacity:0.82">Precip: ${data.pr} mm/day</span>`,
      ].join('<br>');
      tooltip.style.opacity = '1';
      const r = wrapper.getBoundingClientRect();
      tooltip.style.left = Math.min(e.clientX-r.left+14, r.width-160)+'px';
      tooltip.style.top  = Math.max(e.clientY-r.top-14, 4)+'px';
    });

    svgEl.addEventListener('mouseleave', () => { if(tooltip) tooltip.style.opacity='0'; });

    const s = getMapScrollStep();
    if (s >= 0) applyMapStep(s);

  } catch(err) {
    console.error('Map build failed:', err);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src=src; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}

/* ── Build Your Own Climate slider ───────────── */
(function () {
  const tempSlider   = document.getElementById('temp-slider');
  const prSlider     = document.getElementById('pr-slider');
  const tempVal      = document.getElementById('temp-val');
  const prVal        = document.getElementById('pr-val');
  const meterVerdict = document.getElementById('meter-verdict');
  const meterExample = document.getElementById('meter-example');
  const dialFill     = document.getElementById('dial-fill');
  const dialTrack    = document.getElementById('dial-track');
  const dialNeedle   = document.getElementById('dial-needle-g');

  if (!tempSlider || !dialFill) return;
let COUNTRY_CLIMATES = [];

const similarName = document.getElementById('similar-name');
const similarDesc = document.getElementById('similar-desc');
  /* ── Dial geometry ─────────────────────────── */
 const CX = 130, CY = 130, R = 80;
 const START_DEG = 270, TOTAL_SWEEP = 180;

  function polarToXY(deg) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  function arcPath(fromDeg, toDeg) {
    const s = polarToXY(fromDeg);
    const e = polarToXY(toDeg);
    const sweep = ((toDeg - fromDeg + 360) % 360);
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  // Set static track
  dialTrack.setAttribute('d', arcPath(START_DEG, START_DEG + TOTAL_SWEEP));

  // Compute arc length for dasharray trick
  const ARC_LEN = (TOTAL_SWEEP / 360) * 2 * Math.PI * R;
  dialFill.setAttribute('d', arcPath(START_DEG, START_DEG + TOTAL_SWEEP));
  dialFill.style.strokeDasharray  = ARC_LEN.toFixed(2);
  dialFill.style.strokeDashoffset = ARC_LEN.toFixed(2); // starts empty

  /* ── Labels & data ─────────────────────────── */
  const TEMP_LABELS = ['Cold', 'Cool', 'Moderate', 'Warm', 'Hot'];
  const PR_LABELS   = ['Very Dry', 'Dry', 'Moderate', 'Wet', 'Very Wet'];

  const LEVELS = [
    { max: 0.22, label: 'Low',       color: '#5a8a3c', example: 'Mild conditions — water supply stable.' },
    { max: 0.48, label: 'Moderate',  color: '#8B5E3C', example: 'Some stress — seasonal dryness possible.' },
    { max: 0.72, label: 'High',      color: '#c84b1a', example: 'Vegetation stress; water restrictions likely.' },
    { max: 1.01, label: 'Very High', color: '#8B0000', example: 'Severe drought conditions expected.' },
  ];

  function labelFor(val, labels) {
    const idx = Math.round((val / 100) * (labels.length - 1));
    return labels[idx];
  }

  function computeRisk(temp, pr) {
    return Math.max(0, Math.min(1, (temp / 100) * 0.45 + (1 - pr / 100) * 0.55));
  }

async function loadCountryClimateData() {
  try {
    const response = await fetch("climate_agg_country.csv");

    if (!response.ok) throw new Error("Could not find climate_agg_country.csv");

    const text = await response.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());

    const countries = {};

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim(); });

      const country = row.country;
      if (!country) continue;

      if (!countries[country]) {
        countries[country] = {
          country,
          continent: row.continent,
          climate_zone: row.climate_zone,
          tempSum: 0, prSum: 0, spiSum: 0, count: 0
        };
      }

      countries[country].tempSum += Number(row.mean_temp_C);
      countries[country].prSum   += Number(row.mean_pr_mm_day);
      countries[country].spiSum  += Number(row.mean_spi);
      countries[country].count   += 1;
    }

    COUNTRY_CLIMATES = Object.values(countries).map(d => ({
      country:      d.country,
      continent:    d.continent,
      climate_zone: d.climate_zone,
      temp:         d.tempSum / d.count,
      pr:           d.prSum   / d.count,
      spi:          d.spiSum  / d.count
    }));

    console.log("Loaded climates:", COUNTRY_CLIMATES.length);
    update();

  } catch(err) {
    console.error("Failed to load climate_agg_country.csv:", err);
    if (similarName) similarName.textContent = "Climate data not found";
    if (similarDesc) similarDesc.textContent = "Make sure climate_agg_country.csv is in the same folder as index.html.";
  }
}

function normalizeTemp(temp) {
  const minTemp = -35;
  const maxTemp = 30;

  return Math.max(
    0,
    Math.min(
      100,
      ((temp - minTemp) / (maxTemp - minTemp)) * 100
    )
  );
}

function normalizePrecip(pr) {
  const minPr = 0;
  const maxPr = 12;

  return Math.max(
    0,
    Math.min(
      100,
      ((pr - minPr) / (maxPr - minPr)) * 100
    )
  );
}

function findMostSimilarClimates(userTemp, userPr, count = 3) {

  if (!COUNTRY_CLIMATES.length) return [];

  return COUNTRY_CLIMATES
    .map(country => {

      const tempNorm = normalizeTemp(country.temp);
      const prNorm = normalizePrecip(country.pr);

      const distance = Math.sqrt(
        Math.pow(userTemp - tempNorm, 2) +
        Math.pow(userPr - prNorm, 2)
      );

      return {
        ...country,
        distance
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}
  function update() {
    const t = +tempSlider.value;
    const p = +prSlider.value;

    tempVal.textContent = labelFor(t, TEMP_LABELS);
    prVal.textContent   = labelFor(p, PR_LABELS);

    const risk  = computeRisk(t, p);
    const level = LEVELS.find(l => risk < l.max);

    // Dial fill via dashoffset
    const offset = ARC_LEN * (1 - risk);
    dialFill.style.strokeDashoffset = offset.toFixed(2);
    dialFill.style.stroke = level.color;

    // Needle rotation: START_DEG + risk * TOTAL_SWEEP, offset -90 for SVG

// NEW — use SVG transform attribute so origin is guaranteed at pivot point (130,130)
const needleDeg = (risk * 180) - 90;
dialNeedle.setAttribute('transform', `rotate(${needleDeg}, 130, 130)`);
    // Text
    meterVerdict.textContent = level.label;
    meterVerdict.style.color = level.color;
    meterExample.textContent = level.example;
    const matches = findMostSimilarClimates(t, p);

if (matches.length && similarName && similarDesc) {

  similarName.textContent = matches[0].country;

  similarDesc.innerHTML = matches
    .map((m, i) =>
      `${i + 1}. ${m.country} (${m.continent})`
    )
    .join("<br>");
}
  }

  tempSlider.addEventListener('input', update);
  prSlider.addEventListener('input', update);
loadCountryClimateData();
update();
})();