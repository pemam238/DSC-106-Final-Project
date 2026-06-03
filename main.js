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


const COUNTRY_DATA = {};
async function loadCSV() {
  const csvText = await fetch('country_summary.csv').then(r => r.text());
  csvText.trim().split('\n').slice(1).forEach(line => {
    const [country, , spiBase, spiMod, temp, tempMod, spiChange, tempChange] = line.split(',');
    COUNTRY_DATA[country] = {
      temp:       parseFloat(temp),
      tempMod:    parseFloat(tempMod),
      spiBase:    parseFloat(spiBase),
      spiMod:     parseFloat(spiMod),
      spiChange:  parseFloat(spiChange),
      tempChange: parseFloat(tempChange),
    };
  });
}
const csvLoaded = loadCSV();

// world-atlas ISO 3166 name → CSV country name
const NAME_ALIASES = {
  'United States of America':                       'United States',
  'Russian Federation':                             'Russia',
  'Syrian Arab Republic':                           'Syria',
  'Iran, Islamic Republic of':                      'Iran',
  "Korea, Republic of":                             'South Korea',
  "Korea, Democratic People's Republic of":         'North Korea',
  'Congo, the Democratic Republic of the':          'DR Congo',
  'Congo':                                          'Republic of Congo',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'Tanzania, United Republic of':                   'Tanzania',
  'Bolivia, Plurinational State of':                'Bolivia',
  'Venezuela, Bolivarian Republic of':              'Venezuela',
  'Micronesia, Federated States of':                'Micronesia',
  'Moldova, Republic of':                           'Moldova',
  'North Macedonia':                                'North Macedonia',
  "Macedonia, the former Yugoslav Republic of":     'North Macedonia',
  'Viet Nam':                                       'Vietnam',
  "Lao People's Democratic Republic":               'Laos',
  'Libya':                                          'Libya',
  'Czechia':                                        'Czech Republic',
  'Czech Republic':                                 'Czech Republic',
  'Eswatini':                                       'Swaziland',
  'Palestine, State of':                            'Palestine',
  'Cabo Verde':                                     'Cape Verde',
  "Côte d'Ivoire":                                  'Ivory Coast',
  "Cote d'Ivoire":                                  'Ivory Coast',
  'Timor-Leste':                                    'East Timor',
};

function resolveCountryName(atlasName) {
  if (!atlasName) return null;
  if (COUNTRY_DATA[atlasName]) return atlasName;
  const alias = NAME_ALIASES[atlasName];
  if (alias && COUNTRY_DATA[alias]) return alias;
  const lower = atlasName.toLowerCase();
  for (const key of Object.keys(COUNTRY_DATA)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

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


function prOpacity(spi) {
  // More negative SPI = drier = stronger blue overlay
  const spiMin = -0.5, spiMax = 0.5;
  return Math.max(0.05, Math.min(0.82, (spi - spiMin) / (spiMax - spiMin) * 0.82));
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
     const data = COUNTRY_DATA[contName];
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
     const data=COUNTRY_DATA[contName];
     if (!data) return;
     const final=prOpacity(data.spiBase)*targetOpacity;
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
   await csvLoaded;
   await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
   await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');

 const [world, countryNames] = await Promise.all([
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()),
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries.tsv').then(r=>r.text())
]);

const isoToName = {};
countryNames.trim().split('\n').slice(1).forEach(line => {
  const [iso, , name] = line.split('\t');
  isoToName[iso] = name;
});

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
    const isoKey      = String(feature.id).padStart(3, '0');
    const countryName = isoToName[isoKey] || null;
    const contName    = resolveCountryName(countryName);
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
     const data = cont ? COUNTRY_DATA[cont] : null;
     if (!cont || !data) { tooltip.style.opacity='0'; return; }

  tooltip.innerHTML = [
    `<strong>${cont}</strong>`,
    `<span style="font-weight:400;opacity:0.82">Avg temp: ${data.temp>0?'+':''}${data.temp.toFixed(1)}°C</span>`,
    `<span style="font-weight:400;opacity:0.82">SPI (baseline): ${data.spiBase.toFixed(2)}</span>`,
    `<span style="font-weight:400;opacity:0.82">SPI (modern): ${data.spiMod.toFixed(2)}</span>`,
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

/* ═══════════════════════════════════════════════
   SPI RAIN DOT SCROLLYTELLING
   ═══════════════════════════════════════════════ */

   (function () {

    /* ── Step config ─────────────────────────── */
    const SPI_STEPS = [
      { spi: 0.0,  label: 'Normal rainfall',   dropRate: 1.0,  color: [70, 140, 210] },
      { spi: 0.0,  label: 'What is SPI?',      dropRate: 1.0,  color: [70, 140, 210] },
      { spi: -0.6, label: 'Mild drought',      dropRate: 0.52, color: [180, 130,  70] },
      { spi: -1.5, label: 'Severe drought',    dropRate: 0.18, color: [200,  80,  30] },
      { spi: -2.1, label: 'Extreme drought',   dropRate: 0.04, color: [160,  35,  10] },
    ];
  
    /* SPI range: -2.5 to +1.5 → needle 0%→100% */
    function spiToNeedle(spi) {
      return Math.max(0, Math.min(100, ((spi + 2.5) / 4.0) * 100));
    }
  
    function spiToColor(spi) {
      // interpolate between orange-red (dry) and blue (wet)
      const t = Math.max(0, Math.min(1, (spi + 2.5) / 4.0));
      const r = Math.round(180 + (90 - 180) * t);
      const g = Math.round(60 + (170 - 60) * t);
      const b = Math.round(20 + (255 - 20) * t);
      return `rgb(${r},${g},${b})`;
    }
  
    /* ── Canvas setup ────────────────────────── */
    const canvas = document.getElementById('spi-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
  
    let W, H;
    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', () => { resize(); drops.length = 0; });
  
    /* ── Drop pool ────────────────────────────── */
    const drops = [];
    let currentStep = 0;
    let targetDropRate = 1.0;
    let currentDropColor = [90, 160, 220];
    let targetDropColor  = [90, 160, 220];
    let animColor = [90, 160, 220];
  
    // Splash rings that fade out
    const splashes = [];
  
    function spawnDrop() {
      const step = SPI_STEPS[currentStep] || SPI_STEPS[0];
      // Color lerp toward target
      animColor = animColor.map((c, i) => c + (step.color[i] - c) * 0.05);
  
      drops.push({
        x: Math.random() * W,
        y: -8 - Math.random() * 40,
        vy: 3.5 + Math.random() * 4.5,
        r: 2.2 + Math.random() * 2.2,
        opacity: 0.55 + Math.random() * 0.4,
        color: [...animColor],
        wobble: (Math.random() - 0.5) * 0.4,
      });
    }
  
    /* ── Render loop ──────────────────────────── */
    let lastTime = 0;
    let spawnAccum = 0;
  
    function tick(now) {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
  
      ctx.clearRect(0, 0, W, H);
  
      // Subtle background gradient
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, W, H);
  
      // Ground line
      const groundY = H * 0.88;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W, groundY);
      ctx.strokeStyle = 'rgba(139,94,60,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
  
      // Spawn drops
      const step = SPI_STEPS[currentStep] || SPI_STEPS[0];
      const baseRate = 2.8; // drops per 16ms at full rate
      spawnAccum += (baseRate * step.dropRate * dt) / 16;
      while (spawnAccum >= 1) {
        spawnDrop();
        spawnAccum -= 1;
      }
  
      // Update & draw drops
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y  += d.vy;
        d.x  += d.wobble;
  
        if (d.y >= groundY) {
          // Spawn splash
          splashes.push({ x: d.x, y: groundY, r: d.r * 1.2, maxR: d.r * 7, life: 1.0, color: d.color });
          drops.splice(i, 1);
          continue;
        }
  
        const [r, g, b] = d.color;
        ctx.beginPath();
        // Elongated teardrop using ellipse
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(1, 1.6);
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.restore();
        ctx.fillStyle = `rgba(${r},${g},${b},${d.opacity})`;
        ctx.fill();
      }
  
      // Splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.life -= 0.045;
        s.r += (s.maxR - s.r) * 0.2;
        if (s.life <= 0) { splashes.splice(i, 1); continue; }
        const [r, g, b] = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${s.life * 0.35})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
  
      // Puddle at base (size reflects drought)
      const puddleAlpha = 0.07 + step.dropRate * 0.13;
      const puddleGrad = ctx.createLinearGradient(0, groundY, 0, H);
      puddleGrad.addColorStop(0, `rgba(${animColor[0]},${animColor[1]},${animColor[2]},${puddleAlpha})`);
      puddleGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = puddleGrad;
      ctx.fillRect(0, groundY, W, H - groundY);
  
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  
    /* ── Panel switching ──────────────────────── */
    function setSpiPanel(idx) {
      const panels = document.querySelectorAll('.spi-panel');
      panels.forEach((p, i) => {
        if (i === idx) {
          p.classList.remove('exit-up');
          p.classList.add('active');
        } else if (p.classList.contains('active')) {
          p.classList.remove('active');
          p.classList.add('exit-up');
          setTimeout(() => {
            if (!p.classList.contains('active')) p.classList.remove('exit-up');
          }, 600);
        }
      });
  
      // Animate meter needle + stat for the active panel
      const step = SPI_STEPS[idx];
      if (!step) return;
  
      const needleEl = document.getElementById(`spi-needle-${idx}`);
      const statEl   = document.getElementById(`spi-stat-${idx}`);
      if (!needleEl || !statEl) return;
  
      const needlePct = spiToNeedle(step.spi);
      needleEl.style.left = needlePct + '%';
      statEl.style.color  = spiToColor(step.spi);
  
      // Count-up animation on the stat
      const targetSpi = step.spi;
      const startSpi  = 0;
      const startTime = performance.now();
      const dur = 900;
      function countUp(now) {
        const t = Math.min(1, (now - startTime) / dur);
        const ease = 1 - Math.pow(1 - t, 3);
        const val = startSpi + (targetSpi - startSpi) * ease;
        statEl.textContent = `SPI = ${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
        if (t < 1) requestAnimationFrame(countUp);
      }
      requestAnimationFrame(countUp);
    }
  
    /* ── Scroll driver ────────────────────────── */
    function getSpiScrollStep() {
      const track = document.getElementById('slide-spi-track');
      if (!track) return -1;
      const rect  = track.getBoundingClientRect();
      const total = track.offsetHeight - window.innerHeight;
      const prog  = Math.max(0, Math.min(1, -rect.top / total));
      if (prog < 0.01)  return 0;
      if (prog < 0.22)  return 0;
      if (prog < 0.42)  return 1;
      if (prog < 0.62)  return 2;
      if (prog < 0.82)  return 3;
      return 4;
    }
  
    function isOnSpiTrack() {
      const t = document.getElementById('slide-spi-track');
      if (!t) return false;
      const rect = t.getBoundingClientRect();
      return rect.top <= 0 && rect.bottom > window.innerHeight;
    }
  
    let spiStepNow = -1;
  
    function driveSpi() {
      if (!isOnSpiTrack()) return;
      const step = getSpiScrollStep();
      if (step === spiStepNow) return;
      spiStepNow = step;
      currentStep = step;
      setSpiPanel(step);
    }
  
    // Hook into existing scroll listener
    window.addEventListener('scroll', driveSpi);
    // Seed panel 0 on load
    setSpiPanel(0);
  
  })();

/* ═══════════════════════════════════════════════
   CASE STUDY — Great Basin vs Death Valley
   Append this entire block to the bottom of main.js
   ═══════════════════════════════════════════════ */

   (function () {

    /* ── Constants ──────────────────────────────── */
    const GB_COLOR  = '#5B8DB8';
    const DV_COLOR  = '#C0622B';
    const GB_LIGHT  = 'rgba(91, 141, 184, 0.18)';
    const DV_LIGHT  = 'rgba(192, 98, 43, 0.18)';
  
    /* ── State ──────────────────────────────────── */
    let caseBuilt    = false;
    let caseStepNow  = -1;
    let annualData   = null;   // [{year, gb_tas, dv_tas, gb_pr, dv_pr}]
    let spiData      = null;   // [{date, gb_spi, dv_spi}]
  
    /* ── CSV loading ────────────────────────────── */
  
    /*
      Expected CSV files in the same folder as index.html:
  
      case_study_annual.csv
        year, gb_tas, dv_tas, gb_pr, dv_pr
        1950, 9.72,   14.54,  24.4,  22.5
        ...
  
      case_study_spi.csv
        date, gb_spi, dv_spi
        1950-01, 0.12, -0.33
        ...
  
      The Python script outputs these from the CMIP6 data.
      Column names must match exactly (case-sensitive).
    */
  
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      return lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj  = {};
        headers.forEach((h, i) => {
          obj[h] = isNaN(vals[i]) ? vals[i].trim() : parseFloat(vals[i]);
        });
        return obj;
      });
    }
  
    async function loadCaseData() {
      try {
        const [annualText, spiText] = await Promise.all([
          fetch('case_study_annual.csv').then(r => r.text()),
          fetch('case_study_spi.csv').then(r => r.text()),
        ]);
        annualData = parseCSV(annualText);
        spiData    = parseCSV(spiText).map(d => ({
          date:   new Date(d.date + '-01'),
          gb_spi: d.gb_spi,
          dv_spi: d.dv_spi,
        }));
      } catch (err) {
        console.warn('Case study CSVs not found:', err);
      }
    }
  
    const caseDataLoaded = loadCaseData();
  
    /* ── Track helpers ──────────────────────────── */
    function isOnCaseTrack() {
      const t = document.getElementById('slide-case-track');
      if (!t) return false;
      const r = t.getBoundingClientRect();
      return r.top <= 0 && r.bottom > window.innerHeight;
    }
  
    function getCaseScrollStep() {
      const t = document.getElementById('slide-case-track');
      if (!t) return -1;
      const rect  = t.getBoundingClientRect();
      const total = t.offsetHeight - window.innerHeight;
      const prog  = Math.max(0, Math.min(1, -rect.top / total));
      if (prog < 0.01)  return 0;
      if (prog < 0.28)  return 0;
      if (prog < 0.52)  return 1;
      if (prog < 0.76)  return 2;
      return 3;
    }
  
    /* ── Panel switcher ─────────────────────────── */
    function setCasePanel(idx) {
      const panels = document.querySelectorAll('.case-panel');
      panels.forEach((p, i) => {
        if (i === idx) {
          p.classList.remove('exit-up');
          p.classList.add('active');
        } else if (p.classList.contains('active')) {
          p.classList.remove('active');
          p.classList.add('exit-up');
          setTimeout(() => {
            if (!p.classList.contains('active')) p.classList.remove('exit-up');
          }, 600);
        }
      });
    }
  
    /* ── D3 chart helpers ───────────────────────── */
  
    /* Shared dimensions */
    function chartDims(svgEl) {
      const W = svgEl.clientWidth  || 600;
      const H = svgEl.clientHeight || 400;
      const margin = { top: 44, right: 28, bottom: 52, left: 54 };
      return {
        W, H,
        iW: W - margin.left - margin.right,
        iH: H - margin.top  - margin.bottom,
        margin,
      };
    }
  
    /* Animated bar grow: set initial height=0, transition to target */
    function animateBars(bars, yScale, innerH, dur = 800) {
      bars
        .attr('y', innerH)
        .attr('height', 0)
        .transition()
        .duration(dur)
        .ease(d3.easeCubicOut)
        .attr('y',      d => yScale(d.value))
        .attr('height', d => innerH - yScale(d.value));
    }
  
    /* Animated line draw via stroke-dasharray trick */
    function animateLine(path, dur = 1200) {
      const len = path.node().getTotalLength();
      path
        .attr('stroke-dasharray',  `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);
    }
  
    /* Shared axis style */
    function styleAxis(g) {
      g.selectAll('text').style('font-family', "'Montserrat', sans-serif")
                         .style('font-size',   '10px')
                         .style('fill',        'rgba(180,210,245,0.55)');
      g.selectAll('line, path').style('stroke', 'rgba(100,160,220,0.18)');
      return g;
    }
  
    /* ── Chart 1: Temp & Precip bar chart ──────────
       Two grouped bar clusters side-by-side:
       left cluster = Temperature (°C), right = Precip (mm/month)
       Each cluster has two bars: GB (blue) and DV (orange)
    ─────────────────────────────────────────────── */
    function drawBarChart(svgEl) {
      if (!annualData || !annualData.length) return;
  
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
  
      const { W, H, iW, iH, margin } = chartDims(svgEl);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
      /* Compute means */
      const gbTas = d3.mean(annualData, d => d.gb_tas);
      const dvTas = d3.mean(annualData, d => d.dv_tas);
      const gbPr  = d3.mean(annualData, d => d.gb_pr);
      const dvPr  = d3.mean(annualData, d => d.dv_pr);
  
      /* Two metric groups */
      const groups   = ['Temperature (°C)', 'Precip (mm/mo)'];
      const maxTemp  = Math.max(gbTas, dvTas) * 1.35;
      const maxPrecip= Math.max(gbPr,  dvPr)  * 1.35;
  
      /* X — outer band per group */
      const x0 = d3.scaleBand()
        .domain(groups)
        .range([0, iW])
        .paddingInner(0.38)
        .paddingOuter(0.18);
  
      /* X — inner band per region within group */
      const x1 = d3.scaleBand()
        .domain(['Great Basin', 'Death Valley'])
        .range([0, x0.bandwidth()])
        .paddingInner(0.12);
  
      /* Two separate Y scales (different units) */
      const yTemp   = d3.scaleLinear().domain([0, maxTemp  ]).range([iH, 0]);
      const yPrecip = d3.scaleLinear().domain([0, maxPrecip]).range([iH, 0]);
  
      const yScaleFor = name => name === 'Temperature (°C)' ? yTemp : yPrecip;
  
      /* X axis */
      styleAxis(
        g.append('g')
         .attr('class', 'case-axis')
         .attr('transform', `translate(0,${iH})`)
         .call(d3.axisBottom(x0).tickSize(0))
      ).select('.domain').remove();
      g.selectAll('.case-axis text').attr('dy', '1.4em')
        .style('font-size', '11px').style('font-weight', '700')
        .style('fill', 'rgba(220,240,255,0.65)');
  
      /* Y axis (left — temperature) */
      styleAxis(
        g.append('g')
         .attr('class', 'case-axis')
         .call(d3.axisLeft(yTemp).ticks(5).tickSize(-iW))
      );
      g.append('text').attr('class', 'case-axis-label')
        .attr('transform', `rotate(-90)`)
        .attr('x', -iH / 2).attr('y', -42).attr('text-anchor', 'middle')
        .text('Temperature °C');
  
      /* Y axis (right — precip) */
      styleAxis(
        g.append('g')
         .attr('class', 'case-axis')
         .attr('transform', `translate(${iW},0)`)
         .call(d3.axisRight(yPrecip).ticks(5).tickSize(0))
      );
      g.append('text').attr('class', 'case-axis-label')
        .attr('transform', `rotate(90)`)
        .attr('x', iH / 2).attr('y', -iW - 38).attr('text-anchor', 'middle')
        .text('Precip mm/mo');
  
      /* Gridlines */
      g.append('g').attr('class', 'case-axis').call(
        d3.axisLeft(yTemp).ticks(5).tickSize(-iW).tickFormat('')
      ).select('.domain').remove();
      g.selectAll('.case-axis line').style('stroke', 'rgba(100,160,220,0.10)');
  
      /* Data per group */
      const barData = {
        'Temperature (°C)': [
          { region: 'Great Basin',  value: gbTas, color: GB_COLOR },
          { region: 'Death Valley', value: dvTas, color: DV_COLOR },
        ],
        'Precip (mm/mo)': [
          { region: 'Great Basin',  value: gbPr,  color: GB_COLOR },
          { region: 'Death Valley', value: dvPr,  color: DV_COLOR },
        ],
      };
  
      /* Draw groups */
      const groupG = g.selectAll('.bar-group')
        .data(groups)
        .enter().append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${x0(d)},0)`);
  
      groupG.each(function (groupName) {
        const gEl   = d3.select(this);
        const yScale = yScaleFor(groupName);
        const data   = barData[groupName];
  
        const bars = gEl.selectAll('rect')
          .data(data)
          .enter().append('rect')
          .attr('x',     d => x1(d.region))
          .attr('width', x1.bandwidth())
          .attr('rx', 3)
          .attr('fill', d => d.color)
          .attr('opacity', 0.82);
  
        animateBars(bars, yScale, iH);
  
        /* Value labels */
        gEl.selectAll('.bar-val')
          .data(data)
          .enter().append('text')
          .attr('class', 'case-bar-label')
          .attr('x', d => x1(d.region) + x1.bandwidth() / 2)
          .attr('y', d => yScale(d.value) - 5)
          .text(d => groupName === 'Temperature (°C)'
            ? `${d.value.toFixed(1)}°C`
            : `${d.value.toFixed(1)}`
          )
          .attr('opacity', 0)
          .transition().delay(800).duration(300).attr('opacity', 1);
      });
  
      /* Legend */
      const leg = g.append('g').attr('transform', `translate(${iW - 160}, -30)`);
      [['Great Basin', GB_COLOR], ['Death Valley', DV_COLOR]].forEach(([name, col], i) => {
        leg.append('rect')
          .attr('x', i * 88).attr('y', 0)
          .attr('width', 12).attr('height', 12).attr('rx', 2)
          .attr('fill', col).attr('opacity', 0.85);
        leg.append('text')
          .attr('x', i * 88 + 16).attr('y', 10)
          .style('font-family', "'Montserrat', sans-serif")
          .style('font-size', '9px').style('fill', 'rgba(200,230,255,0.65)')
          .text(name);
      });
  
      /* Title */
      svg.append('text').attr('class', 'case-chart-title')
        .attr('x', W / 2).attr('y', 18)
        .text('Mean Temperature & Precipitation · 1950–2014');
    }
  
    /* ── Chart 2: SPI-12 line chart ─────────────── */
    function drawLineChart(svgEl) {
      if (!spiData || !spiData.length) return;
  
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
  
      const { W, H, iW, iH, margin } = chartDims(svgEl);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
      const x = d3.scaleTime()
        .domain(d3.extent(spiData, d => d.date))
        .range([0, iW]);
  
      const y = d3.scaleLinear()
        .domain([-3.0, 2.0])
        .range([iH, 0]);
  
      /* Gridlines */
      g.append('g').attr('class', 'case-axis').call(
        d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat('')
      ).select('.domain').remove();
  
      /* Axes */
      styleAxis(
        g.append('g').attr('class', 'case-axis')
         .attr('transform', `translate(0,${iH})`)
         .call(d3.axisBottom(x).ticks(d3.timeYear.every(10)))
      );
      styleAxis(
        g.append('g').attr('class', 'case-axis')
         .call(d3.axisLeft(y).ticks(5))
      );
  
      /* Y label */
      g.append('text').attr('class', 'case-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -iH / 2).attr('y', -42).attr('text-anchor', 'middle')
        .text('SPI-12');
  
      /* Zero line */
      g.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', y(0)).attr('y2', y(0))
        .style('stroke', 'rgba(180,210,245,0.25)')
        .style('stroke-width', 1);
  
      /* −1.0 threshold dashed */
      const th = y(-1.0);
      g.append('line').attr('class', 'case-threshold-line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', th).attr('y2', th);
      g.append('text').attr('class', 'case-threshold-label')
        .attr('x', iW - 2).attr('y', th - 4)
        .attr('text-anchor', 'end')
        .text('SPI = −1.0');
  
      /* Drought fill (below zero, GB) */
      const areaGB = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(Math.min(0, d.gb_spi)))
        .curve(d3.curveBasis);
  
      g.append('path')
        .datum(spiData)
        .attr('d', areaGB)
        .attr('fill', GB_COLOR)
        .attr('opacity', 0.12);
  
      /* Drought fill (below zero, DV) */
      const areaDV = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(Math.min(0, d.dv_spi)))
        .curve(d3.curveBasis);
  
      g.append('path')
        .datum(spiData)
        .attr('d', areaDV)
        .attr('fill', DV_COLOR)
        .attr('opacity', 0.12);
  
      /* Lines */
      const lineGB = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.gb_spi))
        .curve(d3.curveBasis);
  
      const lineDV = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.dv_spi))
        .curve(d3.curveBasis);
  
      const pathGB = g.append('path')
        .datum(spiData)
        .attr('d', lineGB)
        .attr('fill', 'none')
        .attr('stroke', GB_COLOR)
        .attr('stroke-width', 1.8)
        .attr('opacity', 0.88);
  
      const pathDV = g.append('path')
        .datum(spiData)
        .attr('d', lineDV)
        .attr('fill', 'none')
        .attr('stroke', DV_COLOR)
        .attr('stroke-width', 1.8)
        .attr('opacity', 0.88);
  
      animateLine(pathGB, 1400);
      animateLine(pathDV, 1600);
  
      /* Title */
      svg.append('text').attr('class', 'case-chart-title')
        .attr('x', W / 2).attr('y', 18)
        .text('SPI-12 Time Series · 1950–2014');
    }
  
    /* ── Chart 3: Drought frequency grouped bar ── */
    function drawFreqChart(svgEl) {
      /* Use summary stats directly if CSV unavailable,
         or compute from spiData if available */
      let freqData;
  
      if (spiData && spiData.length) {
        const gbVals = spiData.map(d => d.gb_spi).filter(v => !isNaN(v));
        const dvVals = spiData.map(d => d.dv_spi).filter(v => !isNaN(v));
  
        const pct = (arr, lo, hi = Infinity) =>
          (arr.filter(v => v < lo && (hi === Infinity || v >= hi)).length / arr.length) * 100;
  
        freqData = [
          {
            category: 'Moderate\n(SPI < −1.0)',
            gb: pct(gbVals, -1.0, -1.5),
            dv: pct(dvVals, -1.0, -1.5),
          },
          {
            category: 'Severe\n(SPI < −1.5)',
            gb: pct(gbVals, -1.5, -2.0),
            dv: pct(dvVals, -1.5, -2.0),
          },
          {
            category: 'Extreme\n(SPI < −2.0)',
            gb: pct(gbVals, -2.0),
            dv: pct(dvVals, -2.0),
          },
        ];
      } else {
        /* Fallback to known summary stats from the Python script output */
        freqData = [
          { category: 'Moderate\n(SPI < −1.0)', gb: 14.8, dv: 14.8 },
          { category: 'Severe\n(SPI < −1.5)',   gb: 3.0,  dv: 3.0  },
          { category: 'Extreme\n(SPI < −2.0)',  gb: 3.0,  dv: 3.0  },
        ];
      }
  
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
  
      const { W, H, iW, iH, margin } = chartDims(svgEl);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
      const cats = freqData.map(d => d.category);
  
      const x0 = d3.scaleBand()
        .domain(cats)
        .range([0, iW])
        .paddingInner(0.38)
        .paddingOuter(0.18);
  
      const x1 = d3.scaleBand()
        .domain(['gb', 'dv'])
        .range([0, x0.bandwidth()])
        .paddingInner(0.1);
  
      const maxVal = Math.max(
        d3.max(freqData, d => d.gb),
        d3.max(freqData, d => d.dv)
      );
      const y = d3.scaleLinear()
        .domain([0, Math.max(maxVal * 1.3, 5)])
        .range([iH, 0]);
  
      /* Gridlines */
      g.append('g').attr('class', 'case-axis').call(
        d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat('')
      ).select('.domain').remove();
  
      /* Axes */
      const xAxisG = g.append('g').attr('class', 'case-axis')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(x0).tickSize(0));
      xAxisG.select('.domain').remove();
  
      /* Multi-line tick labels */
      xAxisG.selectAll('.tick text')
        .each(function (d) {
          const el   = d3.select(this);
          const parts = d.split('\n');
          el.text('');
          parts.forEach((p, i) => {
            el.append('tspan')
              .attr('x', 0)
              .attr('dy', i === 0 ? '1.2em' : '1.2em')
              .text(p);
          });
        })
        .style('font-family', "'Montserrat', sans-serif")
        .style('font-size', '9.5px')
        .style('font-weight', '700')
        .style('fill', 'rgba(210,235,255,0.6)');
  
      styleAxis(
        g.append('g').attr('class', 'case-axis')
         .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'))
      );
  
      /* 5% reference line */
      const refY = y(5);
      g.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', refY).attr('y2', refY)
        .style('stroke', 'rgba(255,190,80,0.4)')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '4 3');
      g.append('text').attr('class', 'case-threshold-label')
        .attr('x', iW - 2).attr('y', refY - 4)
        .attr('text-anchor', 'end')
        .text('5% expected under normal climate');
  
      /* Y label */
      g.append('text').attr('class', 'case-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -iH / 2).attr('y', -42).attr('text-anchor', 'middle')
        .text('% of months');
  
      /* Bars */
      const groupG = g.selectAll('.freq-group')
        .data(freqData)
        .enter().append('g')
        .attr('class', 'freq-group')
        .attr('transform', d => `translate(${x0(d.category)},0)`);
  
      groupG.each(function (d) {
        const gEl = d3.select(this);
  
        const barDat = [
          { key: 'gb', value: d.gb, color: GB_COLOR, label: `${d.gb.toFixed(1)}%` },
          { key: 'dv', value: d.dv, color: DV_COLOR, label: `${d.dv.toFixed(1)}%` },
        ];
  
        const bars = gEl.selectAll('rect')
          .data(barDat)
          .enter().append('rect')
          .attr('x',     b => x1(b.key))
          .attr('width', x1.bandwidth())
          .attr('rx', 3)
          .attr('fill',    b => b.color)
          .attr('opacity', 0.82);
  
        animateBars(bars, y, iH, 900);
  
        gEl.selectAll('.freq-val')
          .data(barDat)
          .enter().append('text')
          .attr('class', 'case-bar-label')
          .attr('x', b => x1(b.key) + x1.bandwidth() / 2)
          .attr('y', b => y(b.value) - 4)
          .text(b => b.label)
          .attr('opacity', 0)
          .transition().delay(900).duration(300).attr('opacity', 1);
      });
  
      /* Legend */
      const leg = g.append('g').attr('transform', `translate(${iW - 160}, -30)`);
      [['Great Basin', GB_COLOR], ['Death Valley', DV_COLOR]].forEach(([name, col], i) => {
        leg.append('rect')
          .attr('x', i * 88).attr('y', 0)
          .attr('width', 12).attr('height', 12).attr('rx', 2)
          .attr('fill', col).attr('opacity', 0.85);
        leg.append('text')
          .attr('x', i * 88 + 16).attr('y', 10)
          .style('font-family', "'Montserrat', sans-serif")
          .style('font-size', '9px').style('fill', 'rgba(200,230,255,0.65)')
          .text(name);
      });
  
      /* Title */
      svg.append('text').attr('class', 'case-chart-title')
        .attr('x', W / 2).attr('y', 18)
        .text('Drought Category Frequency · SPI-12 · 1950–2014');
    }
  
    /* ── Apply step ──────────────────────────────── */
    async function applyCaseStep(step) {
      if (step === caseStepNow) return;
      caseStepNow = step;
      setCasePanel(step);
  
      /* Ensure D3 and data are available before drawing */
      if (typeof d3 === 'undefined') return;
      await caseDataLoaded;
  
      const svgEl = document.getElementById('case-chart-svg');
      if (!svgEl) return;
  
      if (step === 0) {
        /* Intro — clear chart */
        d3.select(svgEl).selectAll('*').remove();
      } else if (step === 1) {
        drawBarChart(svgEl);
      } else if (step === 2) {
        drawLineChart(svgEl);
      } else if (step === 3) {
        drawFreqChart(svgEl);
      }
    }
  
    /* ── Build (first entry) ────────────────────── */
    async function buildCase() {
      if (caseBuilt) return;
      caseBuilt = true;
      await caseDataLoaded;
      const s = getCaseScrollStep();
      if (s >= 0) applyCaseStep(s);
    }
  
    /* ── Scroll driver ──────────────────────────── */
    function driveCase() {
      if (!isOnCaseTrack()) return;
      if (!caseBuilt) { buildCase(); return; }
      applyCaseStep(getCaseScrollStep());
    }
  
    window.addEventListener('scroll', driveCase);
    setCasePanel(0); /* seed panel 0 on load */
  
    /* ── Resize: redraw active chart ────────────── */
    window.addEventListener('resize', () => {
      if (!caseBuilt || !isOnCaseTrack()) return;
      const svgEl = document.getElementById('case-chart-svg');
      if (!svgEl) return;
      if (caseStepNow === 1) drawBarChart(svgEl);
      else if (caseStepNow === 2) drawLineChart(svgEl);
      else if (caseStepNow === 3) drawFreqChart(svgEl);
    });
  
  })();
