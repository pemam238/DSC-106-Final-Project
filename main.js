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

/* ── Map entrance: clean fade ───────────────────── */
function driveMapEntrance() {
  const mapTrack = document.getElementById('slide-map-track');
  const mapScene = document.getElementById('scene-map');
  const scene2   = document.getElementById('scene-question');
  if (!mapTrack || !mapScene) return;

  const rect     = mapTrack.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, -rect.top / window.innerHeight));

  if (scene2) {
    const exitProg = Math.min(1, progress * 2.2);
    scene2.style.transform = `translateY(${-exitProg * 60}px)`;
    scene2.style.opacity   = (1 - exitProg).toFixed(3);
  }

  const mapFade = Math.max(0, Math.min(1, (progress - 0.35) / 0.5));
  mapScene.style.opacity = mapFade.toFixed(3);

  // Blend warm #f5f0e8 → globe background #f0ede6 (stays in same warm family)
  const r = Math.round(245 + (240 - 245) * mapFade);
  const g = Math.round(240 + (237 - 240) * mapFade);
  const b = Math.round(232 + (230 - 232) * mapFade);
  mapScene.style.backgroundColor = `rgb(${r},${g},${b})`;
}

driveMapEntrance();

/* ═══════════════════════════════════════════════
   GLOBE SCROLLYTELLING — Three.js
   ═══════════════════════════════════════════════ */

let globeBuilt   = false;
let globeStepNow = -1;

const GLOBE_STOPS = [
  { lon:  20, lat: -10 },  // Africa
  { lon: -55, lat: -15 },  // South America
  { lon:  90, lat:  35 },  // Asia
  { lon:  15, lat:  50 },  // Europe
];

// Same continent color logic as the old flat map
// warm gray base → amber → orange, matching #f5f0e8 palette
const DROUGHT_HIGH = new Set([
  12,24,72,204,270,288,324,384,426,430,434,466,478,504,516,562,566,
  624,686,706,710,716,729,748,768,788,854, // Africa
  36,90,598                                 // Australia + Pacific
]);
const DROUGHT_MED = new Set([
  50,104,356,364,368,586,608,634,682,702,704,764,792, // S/SE Asia
  484,558,591,840,                                     // Mexico, C.Am, USA
  152,170,218,600,604                                  // S. America dry belt
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

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
  camera.position.z = 2.2;

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const sun = new THREE.DirectionalLight(0xfff8f0, 0.4);
  sun.position.set(3, 2, 4);
  scene.add(sun);

  // ── Draw world onto an offscreen canvas texture ──────────────────
  const TEX_W = 4096, TEX_H = 2048;
  const offscreen = document.createElement('canvas');
  offscreen.width  = TEX_W;
  offscreen.height = TEX_H;
  const ctx = offscreen.getContext('2d');

  const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
  const countries = topojson.feature(world, world.objects.countries);

  // Equirectangular projection fills the texture exactly
  const projection = d3.geoEquirectangular()
    .scale(TEX_W / (2 * Math.PI))
    .translate([TEX_W / 2, TEX_H / 2]);
  const pathGen = d3.geoPath().projection(projection).context(ctx);

  // Ocean background
  ctx.fillStyle = '#c8dff0';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Country fills
  countries.features.forEach(feature => {
    const id  = parseInt(feature.id, 10);
    ctx.beginPath();
    pathGen(feature);
    ctx.fillStyle = DROUGHT_HIGH.has(id) ? '#f0a050'
                  : DROUGHT_MED.has(id)  ? '#f5d4a0'
                  : '#ede8df';
    ctx.fill();
  });

  // Country borders
  ctx.beginPath();
  pathGen(topojson.mesh(world, world.objects.countries, (a, b) => a !== b));
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Outer border (coastlines)
  ctx.beginPath();
  pathGen(topojson.mesh(world, world.objects.countries, (a, b) => a === b));
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.0;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(offscreen);

  // ── Sphere with texture ──────────────────────────────────────────
  const RADIUS = 1;
  const globeGroup = new THREE.Group();

  const sphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 64, 64),
    new THREE.MeshPhongMaterial({
      map: texture,
      shininess: 8,
      specular: new THREE.Color(0xaaaaaa),
    })
  );
  globeGroup.add(sphereMesh);

  // Thin atmosphere rim
  const atmosMesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.005, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0xc8dff0,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide
    })
  );
  globeGroup.add(atmosMesh);

  scene.add(globeGroup);

  let targetRotY = 0, targetRotX = 0;
  let currentRotY = 0, currentRotX = 0;

  // Three.js equirectangular mapping: lon 0 faces +X axis at rotY=0
  // We want lon 0 to face the camera (+Z), so offset by -PI/2
  function stopToRot(stop) {
    return {
      y: -(stop.lon * Math.PI / 180) - Math.PI / 2,
      x: -(stop.lat * Math.PI / 180) * 0.5
    };
  }

  function applyGlobeStep(step) {
    if (step === globeStepNow) return;
    globeStepNow = step;
    if (step < 0) return;
    setGlobePanel(step);
    const rot = stopToRot(GLOBE_STOPS[step]);
    targetRotY = rot.y;
    targetRotX = rot.x;
  }

  // Set initial rotation so Africa faces front on load
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