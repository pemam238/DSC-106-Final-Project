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
  if (!globeBuilt) { buildGlobe(); return; }
  if (window._globeReady) window._applyGlobeStep(window._getGlobeStep());
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

/* ── Map entrance: fade previous out, globe fades in, bg always warm ── */
function driveMapEntrance() {
  const scene2 = document.getElementById('scene-question');
  if (!scene2) return;
  const rect = scene2.getBoundingClientRect();
  // Fade scene-question out as it scrolls up off screen
  const prog = Math.max(0, Math.min(1, -rect.top / (window.innerHeight * 0.4)));
  scene2.style.opacity   = (1 - prog).toFixed(3);
  scene2.style.transform = `translateY(${-prog * 30}px)`;
}

/* ═══════════════════════════════════════════════
   GLOBE SCROLLYTELLING — Three.js
   ═══════════════════════════════════════════════ */

let globeBuilt   = false;
let globeStepNow = -1;

const GLOBE_STOPS = [
  { lon:  18, lat:  -8 },  // Africa
  { lon: -58, lat: -15 },  // South America
  { lon:  85, lat:  25 },  // Asia
  { lon:  12, lat:  50 },  // Europe
];

// Same continent color logic as the old flat map
// warm gray base → amber → orange, matching #f5f0e8 palette
const DROUGHT_HIGH = new Set([
  // Africa — Sahara, Sahel, Horn, Southern Africa dry zones
  12,24,72,204,262,270,288,324,384,404,426,430,434,450,454,466,478,
  496,504,508,516,562,566,624,638,646,678,686,694,706,710,716,728,
  729,740,748,768,788,800,818,834,854,894,
  // Australia + Pacific dry
  36,90,598,520
]);

const DROUGHT_MED = new Set([
  // South/SE/Central Asia
  4,50,64,104,144,356,360,364,368,398,408,410,414,418,422,458,462,
  524,586,608,634,682,702,704,760,762,764,792,795,860,887,
  // North America dry belt
  124,484,558,591,630,840,
  // South America dry belt
  32,68,152,170,218,600,604,858,862,
  // Southern Europe / Mediterranean
  12,203,300,380,620,703,724,807,
  // China interior + Mongolia
  156,496
]);

// Palette matching your original diverging scale:
// low  = soft warm gray (like the old neutral land)
// med  = pale amber (like the old mid-temperature fill)
// high = soft orange (like the old hot-end fill)
const COL_LOW    = 0xede8df;  // #ede8df — warm gray
const COL_MED    = 0xf5d4a0;  // #f5d4a0 — pale amber
const COL_HIGH   = 0xf0a050;  // #f0a050 — soft orange
const COL_OCEAN  = 0xc8dff0;  // #c8dff0 — your original soft blue
const COL_BORDER = 0xffffff;
const BG_COLOR   = 0xf0ede6;  // #f0ede6 — matches slide 2 warm background

function getGlobeStep() {
  const t = document.getElementById('slide-map-track');
  if (!t) return -1;
  const rect  = t.getBoundingClientRect();
  const total = t.offsetHeight - window.innerHeight;
  const prog  = Math.max(0, Math.min(1, -rect.top / total));
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

function isOnMapTrack() {
  const t = document.getElementById('slide-map-track');
  if (!t) return false;
  const rect = t.getBoundingClientRect();
  return rect.top <= 0 && rect.bottom > window.innerHeight;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function buildGlobe() {
  if (globeBuilt) return;
  globeBuilt = true;

  await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
  await new Promise(r => setTimeout(r, 50));

  const canvas = document.getElementById('globe-canvas');
  if (!canvas || typeof THREE === 'undefined') { globeBuilt = false; return; }

  const W = canvas.clientWidth  || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(BG_COLOR, 1);
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0, 2.8);
  camera.lookAt(0.5, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const sun = new THREE.DirectionalLight(0xfff4e8, 0.45);
  sun.position.set(4, 2, 3);
  scene.add(sun);

  const TEX_W = 4096, TEX_H = 2048;
  const offscreen = document.createElement('canvas');
  offscreen.width  = TEX_W;
  offscreen.height = TEX_H;
  const ctx = offscreen.getContext('2d');

  const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
  const countries = topojson.feature(world, world.objects.countries);

  const projection = d3.geoEquirectangular()
    .scale(TEX_W / (2 * Math.PI))
    .translate([TEX_W / 2, TEX_H / 2]);
  const pathGen = d3.geoPath().projection(projection).context(ctx);

  // ── Three texture modes ──────────────────────────────────────────
  // Continent-level data for temp/precip modes
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
  [12,24,72,108,120,132,140,174,175,178,180,204,231,232,262,266,270,288,
   324,384,404,426,430,434,450,454,466,478,504,508,516,562,566,624,638,
   646,678,686,694,706,710,716,728,729,748,768,788,800,818,834,854,894
  ].forEach(id => { ISO_CONT[id] = "Africa"; });
  [8,20,40,56,70,100,112,191,196,203,208,233,246,250,276,300,336,348,
   352,372,380,388,398,428,438,440,442,470,492,496,499,528,578,616,620,
   642,643,674,688,703,705,724,752,756,804,807,826
  ].forEach(id => { ISO_CONT[id] = "Europe"; });
  [4,31,48,50,51,64,96,104,116,144,156,268,356,360,364,368,376,392,400,
   408,410,414,418,422,458,462,512,524,586,608,634,682,702,704,760,762,
   764,792,795,860,887
  ].forEach(id => { ISO_CONT[id] = "Asia"; });
  [28,44,52,84,124,188,192,214,222,320,332,340,388,484,558,591,630,840
  ].forEach(id => { ISO_CONT[id] = "North America"; });
  [32,68,76,152,170,218,328,600,604,740,858,862
  ].forEach(id => { ISO_CONT[id] = "South America"; });
  [36,90,242,296,520,540,548,554,583,584,585,776,798,882
  ].forEach(id => { ISO_CONT[id] = "Oceania"; });
  [10].forEach(id => { ISO_CONT[id] = "Antarctica"; });

  // Load country-level CSV data
  let csvData = {};
  try {
    const csvText = await fetch('dataframes/climate_agg_country.csv').then(r => r.text());
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    const yearIdx  = headers.indexOf('year');
    const countryIdx = headers.indexOf('country');
    const tempIdx  = headers.indexOf('mean_temp_C');
    const prIdx    = headers.indexOf('mean_pr_mm_day');
    // Use most recent year available per country
    lines.slice(1).forEach(line => {
      const cols = line.split(',');
      const year = parseInt(cols[yearIdx]);
      const country = cols[countryIdx];
      const temp = parseFloat(cols[tempIdx]);
      const pr   = parseFloat(cols[prIdx]);
      if (!csvData[country] || year > csvData[country].year) {
        csvData[country] = { year, temp, pr };
      }
    });
  } catch(e) {
    console.warn('CSV load failed, using fallback continent data', e);
  }

  // ISO numeric → country name mapping (subset for key countries)
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
    887:'Yemen',894:'Zambia',716:'Zimbabwe',
  };
  
  function tempToColor(t) {
    const n = Math.max(0, Math.min(1, (t - (-35)) / (25 - (-35))));
    // cool blue → warm orange diverging
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
    // dry orange → wet blue
    const r = Math.round(240 + n * (60  - 240));
    const g = Math.round(180 + n * (140 - 180));
    const b = Math.round(100 + n * (220 - 100));
    return `rgb(${r},${g},${b})`;
  }

  let currentMode = 'drought';

  function drawTexture(mode) {
    currentMode = mode;
    ctx.fillStyle = '#c8dff0';
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    countries.features.forEach(feature => {
      const id   = parseInt(feature.id, 10);
      const cont = ISO_CONT[id];
      const data = cont ? CONT_DATA[cont] : null;
      ctx.beginPath();
      pathGen(feature);

      const countryName = ISO_NAME[id];
      const csvRow = countryName ? csvData[countryName] : null;

      if (mode === 'drought') {
        ctx.fillStyle = isNaN(id) ? '#ede8df'
          : DROUGHT_HIGH.has(id) ? '#f0a050'
          : DROUGHT_MED.has(id)  ? '#f5d4a0'
          : '#ede8df';
      } else if (mode === 'temp') {
        const t = csvRow ? csvRow.temp : (data ? data.temp : null);
        ctx.fillStyle = t != null ? tempToColor(t) : '#ede8df';
      } else {
        const p = csvRow ? csvRow.pr : (data ? data.pr : null);
        ctx.fillStyle = p != null ? prToColor(p) : '#ede8df';
      }

      ctx.fill();
    });

    // Borders
    ctx.beginPath();
    pathGen(topojson.mesh(world, world.objects.countries, (a, b) => a !== b));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    pathGen(topojson.mesh(world, world.objects.countries, (a, b) => a === b));
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  drawTexture('drought');
  const texture = new THREE.CanvasTexture(offscreen);

  // Expose mode switcher globally so buttons can call it
  window._setGlobeMode = (mode) => {
    drawTexture(mode);
    texture.needsUpdate = true;
    // Update legend
    document.querySelectorAll('.globe-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    const legendDrought = document.getElementById('legend-drought');
    const legendTemp    = document.getElementById('legend-temp-globe');
    const legendPr      = document.getElementById('legend-pr-globe');
    if (legendDrought) legendDrought.style.display = mode === 'drought' ? 'flex' : 'none';
    if (legendTemp)    legendTemp.style.display    = mode === 'temp'    ? 'flex' : 'none';
    if (legendPr)      legendPr.style.display      = mode === 'precip'  ? 'flex' : 'none';
  };

  const RADIUS = 1;
  const globeGroup = new THREE.Group();
  globeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 64, 64),
    new THREE.MeshLambertMaterial({ map: texture })
  ));
  scene.add(globeGroup);

  // ── Rotation: Three.js equirectangular wraps so that
  //    rotY=0 puts lon=0 (Greenwich) facing +Z (camera).
  //    To face longitude L: rotY = L * PI/180
  function stopToRot(stop) {
    return {
      y: -stop.lon * Math.PI / 180,
      x: -stop.lat * Math.PI / 180 * 0.55
    };
  }

  let targetRotY = 0, targetRotX = 0;
  let currentRotY = 0, currentRotX = 0;

  function applyGlobeStep(step) {
    if (step === globeStepNow) return;
    globeStepNow = step;
    if (step < 0) return;
    setGlobePanel(step);
    const rot = stopToRot(GLOBE_STOPS[step]);
    targetRotY = rot.y;
    targetRotX = rot.x;
  }

  const initRot = stopToRot(GLOBE_STOPS[0]);
  currentRotY = initRot.y;
  currentRotX = initRot.x;
  targetRotY  = initRot.y;
  targetRotX  = initRot.x;

  (function animate() {
    requestAnimationFrame(animate);
    currentRotY += (targetRotY - currentRotY) * 0.045;
    currentRotX += (targetRotX - currentRotX) * 0.045;
    globeGroup.rotation.y = currentRotY;
    globeGroup.rotation.x = currentRotX;
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  const s = getGlobeStep();
  if (s >= 0) applyGlobeStep(s);

  window._globeReady     = true;
  window._applyGlobeStep = applyGlobeStep;
  window._getGlobeStep   = getGlobeStep;
}