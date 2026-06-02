/* ── Scroll lock logic ───────────────────────── */
let buttonPressed = false;

function isOnSlide2() {
  const track = document.getElementById('slide-2-track');
  if (!track) return false;
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
  if (!globeBuilt && !globeBuilding) {
    buildGlobe();
    return;
  }

  if (window._globeReady) {
    window._applyGlobeStep(window._getGlobeStep());
  }
});

/* ── Scroll arrow ────────────────────────────── */
document.querySelector('.scroll-arrow').addEventListener('click', () => {
  document.getElementById('slide-2-track').scrollIntoView({ behavior: 'smooth' });
});

window.addEventListener('load', () => {
  const start = () => buildGlobe();
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1000 });
  else setTimeout(start, 250);
});

/* ── Hot/Cold button ─────────────────────────── */
function chooseClimate() {
  document.getElementById('reveal-overlay').classList.add('visible');

  const halves = document.getElementById('hot-cold-halves');
  halves.style.opacity = '0';
  halves.style.pointerEvents = 'none';

  buttonPressed = true;
  drivePanels();
}

/* ── Panel reveal on scroll ──────────────────── */
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

/* ── Map entrance ────────────────────────────── */
function driveMapEntrance() {
  const scene2 = document.getElementById('scene-question');
  if (!scene2) return;

  const rect = scene2.getBoundingClientRect();
  const prog = Math.max(0, Math.min(1, -rect.top / (window.innerHeight * 0.4)));

  scene2.style.opacity = (1 - prog).toFixed(3);
  scene2.style.transform = `translateY(${-prog * 30}px)`;
}

/* ═══════════════════════════════════════════════
   D3 ORTHOGRAPHIC GLOBE — no Three.js rotation
   Each step directly centers the map projection.
   ═══════════════════════════════════════════════ */

let globeBuilt = false;
let globeBuilding = false;
let globeStepNow = -1;

const BG_COLOR = '#f0ede6';
const OCEAN_COLOR = '#c8dff0';
const LAND_LOW = '#ede8df';
const LAND_MED = '#f5d4a0';
const LAND_HIGH = '#f0a050';
const BORDER_COLOR = 'rgba(255,255,255,0.75)';

const GLOBE_STOPS = [
  { lon:  25, lat:  -5 },  // Africa
  { lon: -60, lat: -15 },  // South America
  { lon:  85, lat:  25 },  // Asia
  { lon:  15, lat:  48 },  // Europe
];

const globeState = {
  canvas: null,
  ctx: null,
  world: null,
  countries: null,
  borders: null,
  csvData: {},
  mode: 'drought',
  ready: false
};

const DROUGHT_HIGH = new Set([
  12,24,72,204,262,270,288,324,384,404,426,430,434,450,454,466,478,
  496,504,508,516,562,566,624,638,646,678,686,694,706,710,716,728,
  729,740,748,768,788,800,818,834,854,894,
  36,90,598,520
]);

const DROUGHT_MED = new Set([
  4,50,64,104,144,356,360,364,368,398,408,410,414,418,422,458,462,
  524,586,608,634,682,702,704,760,762,764,792,795,860,887,
  124,484,558,591,630,840,
  32,68,152,170,218,600,604,858,862,
  12,203,300,380,620,703,724,807,
  156,496
]);

const CONT_DATA = {
  "Africa":        { temp: 22.91, pr: 1.748 },
  "Asia":          { temp: 14.21, pr: 2.098 },
  "Europe":        { temp:  6.12, pr: 1.916 },
  "North America": { temp:  4.31, pr: 1.589 },
  "South America": { temp: 21.50, pr: 3.511 },
  "Oceania":       { temp: 20.04, pr: 1.021 },
  "Antarctica":    { temp:-32.49, pr: 0.590 },
};

const ISO_CONT = {};
[
  12,24,72,108,120,132,140,174,175,178,180,204,231,232,262,266,270,288,
  324,384,404,426,430,434,450,454,466,478,504,508,516,562,566,624,638,
  646,678,686,694,706,710,716,728,729,748,768,788,800,818,834,854,894
].forEach(id => { ISO_CONT[id] = "Africa"; });

[
  8,20,40,56,70,100,112,191,196,203,208,233,246,250,276,300,336,348,
  352,372,380,388,398,428,438,440,442,470,492,496,499,528,578,616,620,
  642,643,674,688,703,705,724,752,756,804,807,826
].forEach(id => { ISO_CONT[id] = "Europe"; });

[
  4,31,48,50,51,64,96,104,116,144,156,268,356,360,364,368,376,392,400,
  408,410,414,418,422,458,462,512,524,586,608,634,682,702,704,760,762,
  764,792,795,860,887
].forEach(id => { ISO_CONT[id] = "Asia"; });

[
  28,44,52,84,124,188,192,214,222,320,332,340,388,484,558,591,630,840
].forEach(id => { ISO_CONT[id] = "North America"; });

[
  32,68,76,152,170,218,328,600,604,740,858,862
].forEach(id => { ISO_CONT[id] = "South America"; });

[
  36,90,242,296,520,540,548,554,583,584,585,776,798,882
].forEach(id => { ISO_CONT[id] = "Oceania"; });

[10].forEach(id => { ISO_CONT[id] = "Antarctica"; });

const ISO_NAME = {
  4:'Afghanistan',12:'Algeria',24:'Angola',32:'Argentina',36:'Australia',
  50:'Bangladesh',56:'Belgium',64:'Bhutan',68:'Bolivia',76:'Brazil',
  84:'Belize',100:'Bulgaria',104:'Myanmar',116:'Cambodia',120:'Cameroon',
  124:'Canada',144:'Sri Lanka',152:'Chile',156:'China',170:'Colombia',
  188:'Costa Rica',191:'Croatia',196:'Cyprus',203:'Czechia',
  208:'Denmark',214:'Dominican Republic',218:'Ecuador',818:'Egypt',
  222:'El Salvador',231:'Ethiopia',246:'Finland',250:'France',
  276:'Germany',288:'Ghana',300:'Greece',320:'Guatemala',
  324:'Guinea',332:'Haiti',340:'Honduras',348:'Hungary',
  356:'India',360:'Indonesia',364:'Iran',368:'Iraq',
  372:'Ireland',376:'Israel',380:'Italy',388:'Jamaica',
  392:'Japan',400:'Jordan',398:'Kazakhstan',404:'Kenya',
  408:'North Korea',410:'South Korea',414:'Kuwait',418:'Laos',
  422:'Lebanon',434:'Libya',440:'Lithuania',442:'Luxembourg',
  458:'Malaysia',466:'Mali',484:'Mexico',496:'Mongolia',
  504:'Morocco',508:'Mozambique',516:'Namibia',524:'Nepal',
  528:'Netherlands',554:'New Zealand',558:'Nicaragua',562:'Niger',
  566:'Nigeria',578:'Norway',512:'Oman',586:'Pakistan',
  591:'Panama',600:'Paraguay',604:'Peru',608:'Philippines',
  616:'Poland',620:'Portugal',630:'Puerto Rico',
  634:'Qatar',642:'Romania',643:'Russia',682:'Saudi Arabia',
  686:'Senegal',694:'Sierra Leone',703:'Slovakia',705:'Slovenia',
  706:'Somalia',710:'South Africa',724:'Spain',729:'Sudan',
  752:'Sweden',756:'Switzerland',760:'Syria',764:'Thailand',
  788:'Tunisia',792:'Turkey',800:'Uganda',804:'Ukraine',
  784:'United Arab Emirates',826:'United Kingdom',840:'United States',
  858:'Uruguay',860:'Uzbekistan',862:'Venezuela',704:'Vietnam',
  887:'Yemen',894:'Zambia',716:'Zimbabwe'
};

function isOnMapTrack() {
  const t = document.getElementById('slide-map-track');
  if (!t) return false;

  const rect = t.getBoundingClientRect();
  return rect.top <= 0 && rect.bottom > window.innerHeight;
}

function getGlobeStep() {
  const t = document.getElementById('slide-map-track');
  if (!t) return -1;

  const rect = t.getBoundingClientRect();
  const total = t.offsetHeight - window.innerHeight;
  const prog = Math.max(0, Math.min(1, -rect.top / total));

  if (prog < 0.05) return -1;
  if (prog < 0.28) return 0;
  if (prog < 0.52) return 1;
  if (prog < 0.76) return 2;
  return 3;
}

function setGlobePanel(idx) {
  document.querySelectorAll('.globe-panel').forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });

  document.querySelectorAll('.gp-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

function loadScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      setTimeout(() => {
        if (!globalName || window[globalName]) resolve();
      }, 0);
      return;
    }

    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadClimateCSV() {
  const csvPaths = [
    'dataframes/climate_agg_country.csv',
    'notebooks/dataframes/climate_agg_country.csv',
    './dataframes/climate_agg_country.csv',
    './notebooks/dataframes/climate_agg_country.csv'
  ];

  try {
    let csvText = null;

    for (const path of csvPaths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          csvText = await res.text();
          console.log(`Loaded climate CSV from: ${path}`);
          break;
        }
      } catch (_) {}
    }

    if (!csvText) throw new Error('CSV not found');

    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');

    const yearIdx = headers.indexOf('year');
    const countryIdx = headers.indexOf('country');
    const tempIdx = headers.indexOf('mean_temp_C');
    const prIdx = headers.indexOf('mean_pr_mm_day');

    const data = {};

    lines.slice(1).forEach(line => {
      const cols = line.split(',');

      const year = parseInt(cols[yearIdx]);
      const country = cols[countryIdx];
      const temp = parseFloat(cols[tempIdx]);
      const pr = parseFloat(cols[prIdx]);

      if (!data[country] || year > data[country].year) {
        data[country] = { year, temp, pr };
      }
    });

    return data;
  } catch (e) {
    console.warn('CSV load failed, using fallback continent data:', e);
    return {};
  }
}

function tempToColor(t) {
  const n = Math.max(0, Math.min(1, (t - (-35)) / (25 - (-35))));

  if (n < 0.5) {
    const v = n / 0.5;
    const r = Math.round(180 + v * (245 - 180));
    const g = Math.round(210 + v * (220 - 210));
    const b = Math.round(240 + v * (185 - 240));
    return `rgb(${r},${g},${b})`;
  } else {
    const v = (n - 0.5) / 0.5;
    const r = Math.round(245 + v * (200 - 245));
    const g = Math.round(220 + v * (80  - 220));
    const b = Math.round(185 + v * (30  - 185));
    return `rgb(${r},${g},${b})`;
  }
}

function prToColor(pr) {
  const n = Math.max(0, Math.min(1, (pr - 0.4) / (3.8 - 0.4)));

  const r = Math.round(240 + n * (60  - 240));
  const g = Math.round(180 + n * (140 - 180));
  const b = Math.round(100 + n * (220 - 100));

  return `rgb(${r},${g},${b})`;
}

function countryFillColor(feature) {
  const id = parseInt(feature.id, 10);

  if (globeState.mode === 'drought') {
    if (Number.isNaN(id)) return LAND_LOW;
    if (DROUGHT_HIGH.has(id)) return LAND_HIGH;
    if (DROUGHT_MED.has(id)) return LAND_MED;
    return LAND_LOW;
  }

  const countryName = ISO_NAME[id];
  const csvRow = countryName ? globeState.csvData[countryName] : null;
  const cont = ISO_CONT[id];
  const fallback = cont ? CONT_DATA[cont] : null;

  if (globeState.mode === 'temp') {
    const t = csvRow ? csvRow.temp : fallback ? fallback.temp : null;
    return t != null ? tempToColor(t) : LAND_LOW;
  }

  if (globeState.mode === 'precip') {
    const p = csvRow ? csvRow.pr : fallback ? fallback.pr : null;
    return p != null ? prToColor(p) : LAND_LOW;
  }

  return LAND_LOW;
}

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();

  const displayWidth = Math.max(1, Math.floor(rect.width));
  const displayHeight = Math.max(1, Math.floor(rect.height));

  const width = Math.floor(displayWidth * dpr);
  const height = Math.floor(displayHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height, dpr };
}

function drawGlobe(step) {
  if (!globeState.ready || step < 0) return;

  const canvas = globeState.canvas;
  const ctx = globeState.ctx;
  const { width, height } = resizeCanvasToDisplaySize(canvas);

  const stop = GLOBE_STOPS[step];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const radius = Math.min(width, height) * 0.43;

  const projection = d3.geoOrthographic()
    .translate([width / 2, height / 2])
    .scale(radius)
    .rotate([-stop.lon, -stop.lat])
    .clipAngle(90)
    .precision(0.5);

  const path = d3.geoPath(projection, ctx);

  ctx.save();

  ctx.beginPath();
  path({ type: 'Sphere' });
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fill();

  globeState.countries.features.forEach(feature => {
    ctx.beginPath();
    path(feature);
    ctx.fillStyle = countryFillColor(feature);
    ctx.fill();
  });

  ctx.beginPath();
  path(globeState.borders);
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = Math.max(1, width / 900);
  ctx.stroke();

  ctx.beginPath();
  path({ type: 'Sphere' });
  ctx.strokeStyle = 'rgba(139,94,60,0.18)';
  ctx.lineWidth = Math.max(1.2, width / 650);
  ctx.stroke();

  ctx.restore();
}

function applyGlobeStep(step) {
  if (step === globeStepNow) return;

  globeStepNow = step;

  if (step < 0) return;

  setGlobePanel(step);
  drawGlobe(step);
}

window._setGlobeMode = function(mode) {
  globeState.mode = mode;

  document.querySelectorAll('.globe-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const legendDrought = document.getElementById('legend-drought');
  const legendTemp = document.getElementById('legend-temp-globe');
  const legendPr = document.getElementById('legend-pr-globe');

  if (legendDrought) legendDrought.style.display = mode === 'drought' ? 'flex' : 'none';
  if (legendTemp) legendTemp.style.display = mode === 'temp' ? 'flex' : 'none';
  if (legendPr) legendPr.style.display = mode === 'precip' ? 'flex' : 'none';

  const step = globeStepNow >= 0 ? globeStepNow : 0;
  drawGlobe(step);
};

async function buildGlobe() {
  if (globeBuilt || globeBuilding) return;

  globeBuilding = true;

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', 'd3');
    await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js', 'topojson');

    const canvas = document.getElementById('globe-canvas');
    if (!canvas || typeof d3 === 'undefined' || typeof topojson === 'undefined') {
      globeBuilding = false;
      return;
    }

    globeState.canvas = canvas;
    globeState.ctx = canvas.getContext('2d');

    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json());

    globeState.world = world;
    globeState.countries = topojson.feature(world, world.objects.countries);
    globeState.borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
    globeState.csvData = await loadClimateCSV();
    globeState.ready = true;

    globeBuilt = true;
    globeBuilding = false;

    canvas.classList.add('ready');

    window._globeReady = true;
    window._applyGlobeStep = applyGlobeStep;
    window._getGlobeStep = getGlobeStep;

    const initialStep = getGlobeStep();
    applyGlobeStep(initialStep >= 0 ? initialStep : 0);

  } catch (err) {
    console.error('Globe failed to build:', err);
    globeBuilding = false;
    globeBuilt = false;
  }
}

window.addEventListener('resize', () => {
  if (!globeState.ready) return;
  const step = globeStepNow >= 0 ? globeStepNow : 0;
  drawGlobe(step);
});