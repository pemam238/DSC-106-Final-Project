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
      { spi: 0.0,  label: 'Normal rainfall',   dropRate: 1.0,  color: [120, 190, 255] },
      { spi: 0.0,  label: 'What is SPI?',      dropRate: 1.0,  color: [120, 190, 255] },
      { spi: -0.6, label: 'Mild drought',      dropRate: 0.52, color: [200, 160, 100] },
      { spi: -1.5, label: 'Severe drought',    dropRate: 0.18, color: [210, 100,  50] },
      { spi: -2.1, label: 'Extreme drought',   dropRate: 0.04, color: [180,  50,  20] },
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
    let currentDropColor = [120, 190, 255];
    let targetDropColor  = [120, 190, 255];
    let animColor = [120, 190, 255];
  
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
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0d1a2a');
      bg.addColorStop(1, '#060e18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
  
      // Ground line
      const groundY = H * 0.88;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W, groundY);
      ctx.strokeStyle = 'rgba(100,160,220,0.15)';
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

