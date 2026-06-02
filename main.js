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

  // Scene 2 fades and lifts out first
  if (scene2) {
    const exitProg = Math.min(1, progress * 2.2);
    scene2.style.transform = `translateY(${-exitProg * 60}px)`;
    scene2.style.opacity   = (1 - exitProg).toFixed(3);
  }

  // Map fades in after scene 2 is mostly gone
  const mapFade = Math.max(0, Math.min(1, (progress - 0.35) / 0.5));
  mapScene.style.opacity = mapFade.toFixed(3);

  // Background color blends warm → ocean blue as map comes in
  const r = Math.round(245 + (200 - 245) * mapFade);
  const g = Math.round(240 + (228 - 240) * mapFade);
  const b = Math.round(232 + (245 - 232) * mapFade);
  mapScene.style.backgroundColor = `rgb(${r},${g},${b})`;
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

/* ═══════════════════════════════════════════════
   GLOBE SCROLLYTELLING — Three.js
   ═══════════════════════════════════════════════ */

   let globeBuilt   = false;
   let globeStepNow = -1;
   
   const GLOBE_STOPS = [
     { lon:  20, lat: -10 },
     { lon: -55, lat: -15 },
     { lon:  90, lat:  35 },
     { lon:  15, lat:  50 },
   ];
   
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
   
   async function buildGlobe() {
     if (globeBuilt) return;
     globeBuilt = true;
   
     await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
     await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
     await new Promise(r => setTimeout(r, 50));
   
     const canvas = document.getElementById('globe-canvas');
     if (!canvas || typeof THREE === 'undefined') { globeBuilt = false; return; }
   
     const W = canvas.clientWidth  || window.innerWidth;
     const H = canvas.clientHeight || window.innerHeight;
   
     const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
     renderer.setClearColor(0xf0ede6, 1);
     renderer.setSize(W, H);
     renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
   
     const scene  = new THREE.Scene();
     scene.background = new THREE.Color(0xf0ede6);
   
     const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
     camera.position.z = 2.8;
   
     scene.add(new THREE.AmbientLight(0xffffff, 0.7));
     const sun = new THREE.DirectionalLight(0xfff8f0, 0.9);
     sun.position.set(3, 2, 4);
     scene.add(sun);
     const fill = new THREE.DirectionalLight(0xe8f0f8, 0.3);
     fill.position.set(-3, -1, -2);
     scene.add(fill);
   
     const RADIUS = 1;
     const oceanGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
     const oceanMat = new THREE.MeshPhongMaterial({ color: 0xc8dff0, shininess: 20, specular: 0xaaccee });
   
     const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
     const countries = topojson.feature(world, world.objects.countries);
   
     const HIGH_RISK = new Set([
       12,24,72,204,270,288,324,384,426,430,434,466,478,504,516,562,566,
       624,686,706,710,716,729,748,768,788,854,36,90,598
     ]);
     const MED_RISK = new Set([
       50,104,356,364,368,586,608,634,682,702,704,764,792,
       484,558,591,840,152,170,218,600,604
     ]);
   
     function lonLatToVec3(lon, lat, r) {
       const phi   = (90 - lat)  * (Math.PI / 180);
       const theta = (lon + 180) * (Math.PI / 180);
       return new THREE.Vector3(
         -r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
       );
     }
   
     const globeGroup = new THREE.Group();
     globeGroup.add(new THREE.Mesh(oceanGeo, oceanMat));
   
     countries.features.forEach(feature => {
       const id  = parseInt(feature.id, 10);
       const col = HIGH_RISK.has(id) ? 0xf0a050
                 : MED_RISK.has(id)  ? 0xf5d4a0
                 : 0xe8e2d9;
   
       const landMat   = new THREE.MeshPhongMaterial({ color: col, shininess: 8 });
       const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
   
       const polys = feature.geometry.type === 'Polygon'
         ? [feature.geometry.coordinates]
         : feature.geometry.coordinates;
   
       polys.forEach(poly => {
         const ring = poly[0];
         if (!ring || ring.length < 4) return;
   
         const pts = ring.map(([ln, lt]) => lonLatToVec3(ln, lt, RADIUS + 0.003));
         globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
   
         let cx = 0, cy = 0, cz = 0;
         pts.forEach(p => { cx += p.x; cy += p.y; cz += p.z; });
         cx /= pts.length; cy /= pts.length; cz /= pts.length;
         const cLen = Math.sqrt(cx*cx + cy*cy + cz*cz);
         const centre = new THREE.Vector3(
           cx/cLen*(RADIUS+0.001), cy/cLen*(RADIUS+0.001), cz/cLen*(RADIUS+0.001)
         );
   
         const verts = [];
         for (let i = 0; i < pts.length - 1; i++) {
           verts.push(centre.x, centre.y, centre.z);
           verts.push(pts[i].x,   pts[i].y,   pts[i].z);
           verts.push(pts[i+1].x, pts[i+1].y, pts[i+1].z);
         }
         const fillGeo = new THREE.BufferGeometry();
         fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
         fillGeo.computeVertexNormals();
         globeGroup.add(new THREE.Mesh(fillGeo, landMat));
       });
     });
   
     scene.add(globeGroup);
   
     let targetRotY = 0, targetRotX = 0;
     let currentRotY = 0, currentRotX = 0;
   
     function applyGlobeStep(step) {
       if (step === globeStepNow) return;
       globeStepNow = step;
       if (step < 0) return;
       setGlobePanel(step);
       const stop = GLOBE_STOPS[step];
       targetRotY = -(stop.lon * Math.PI / 180);
       targetRotX = -(stop.lat * Math.PI / 180) * 0.45;
     }
   
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