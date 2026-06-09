function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ───────────────────────────────────────────────
   SCROLL PROGRESS + CHAPTER NAV + PANEL LOGIC
   ─────────────────────────────────────────────── */
let buttonPressed = false;
const progressBar = document.getElementById('story-progress-bar');
function updateProgress() {
  const scrolled = window.scrollY;
  const total = document.body.scrollHeight - window.innerHeight;
  const pct = total > 0 ? (scrolled / total) * 100 : 0;
  if (progressBar) progressBar.style.width = pct + '%';
}

const chapterNav   = document.getElementById('chapter-nav');
const chapterLabel = document.getElementById('chapter-label');
const chapterDots  = document.querySelectorAll('.chapter-dot');
const CHAPTERS = [
  { id: 'slide-1',           label: 'Intro' },
  { id: 'slide-2-track',     label: 'Hot or Cold?' },
  { id: 'slide-case-track',  label: 'Two Deserts' },
  { id: 'slide-spi-track',   label: 'Measuring Drought' },
  { id: 'slide-3-track',     label: 'The World' },
  { id: 'slide-climate',     label: 'Build a Climate' },
  { id: 'slide-lookup',      label: 'Country Lookup' },
];

chapterDots.forEach(dot => {
  dot.addEventListener('click', () => {
    const target = document.getElementById(dot.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

function updateChapterNav() {
  const scrollMid = window.scrollY + window.innerHeight * 0.4;
  let activeIdx = 0;
  CHAPTERS.forEach((ch, i) => {
    const el = document.getElementById(ch.id);
    if (el && el.offsetTop <= scrollMid) activeIdx = i;
  });
  chapterDots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
  if (chapterLabel) chapterLabel.textContent = CHAPTERS[activeIdx]?.label || '';
  if (chapterNav) {
    chapterNav.classList.toggle('visible', window.scrollY > window.innerHeight * 0.5);
  }
}

const revealEls = document.querySelectorAll('.section-reveal');
function updateReveals() {
  revealEls.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.88) el.classList.add('revealed');
  });
}

const slide2Track = document.getElementById('slide-2-track');
const panelL = document.getElementById('panel-left');
const panelR = document.getElementById('panel-right');
function drivePanels() {
  if (!slide2Track) return;
  const trackTop    = slide2Track.getBoundingClientRect().top;
  const trackHeight = slide2Track.offsetHeight;
  const vh          = window.innerHeight;
  const progress    = Math.max(0, Math.min(1, -trackTop / (trackHeight - vh)));
  panelL.classList.toggle('visible', progress > 0.25);
  panelR.classList.toggle('visible', progress > 0.55);
}

function driveMap() {}
function driveSpi() {}

window.addEventListener('scroll', () => {
  updateProgress();
  updateChapterNav();
  updateReveals();
  drivePanels();
  driveMap();
  driveSpi();
}, { passive: true });

updateProgress();
updateChapterNav();
updateReveals();

document.querySelector('.scroll-arrow')?.addEventListener('click', () => {
  document.getElementById('slide-2-track').scrollIntoView({ behavior: 'smooth' });
});

function chooseClimate(choice) {
  document.getElementById('reveal-overlay').classList.add('visible');
  const halves = document.getElementById('hot-cold-halves');
  halves.style.opacity = '0';
  halves.style.pointerEvents = 'none';
  buttonPressed = true;
  drivePanels();
}

document.querySelectorAll('.half').forEach(half => {
  half.addEventListener('click', () => {
    if (buttonPressed) return;
    chooseClimate(half.getAttribute('data-choice'));
  });
});

/* ══════════════════════════════════════════════
   SLIDE 3 — WORLD MAP SCROLLYTELLING
   ══════════════════════════════════════════════ */
const MAP_STEPS = [0, 0.18, 0.36, 0.54, 0.72, 0.88];

const STEP_LABELS = [
  `<strong style="color:#6b0a0a">WHERE YOU'D EXPECT DROUGHT</strong><br><span>Temperature across every country — the obvious suspects. Hot places. The Sahara, the Arabian Peninsula, the Horn of Africa. This is where most people picture drought.</span>`,
  `<strong style="color:#6b0a0a">WHERE YOU'D EXPECT DROUGHT</strong><br><span>Temperature across every country — the obvious suspects. Hot places. The Sahara, the Arabian Peninsula, the Horn of Africa. This is where most people picture drought.</span>`,
  `<strong style="color:#0a2a4a">BUT THE DATA TELLS A DIFFERENT STORY</strong><br><span>Now colored by SPI — the actual measure of drought deficit. Hot deserts stay red. But cold and temperate regions are lighting up too. Click any glowing country to explore.</span>`,
  `<strong style="color:#0a2a4a">DROUGHT IS GETTING WORSE — IN THE COLD</strong><br><span>SPI change from baseline to modern period. Dark red means drought is intensifying. Many of the sharpest declines are in places you wouldn't expect — cold steppes, mountain valleys, temperate plains.</span>`,
  `<strong style="color:#0a2a4a">DROUGHT IS GETTING WORSE — IN THE COLD</strong><br><span>SPI change from baseline to modern period. Dark red means drought is intensifying. Many of the sharpest declines are in places you wouldn't expect — cold steppes, mountain valleys, temperate plains.</span>`,
  `<strong>THE THERMOMETER NEVER TELLS THE WHOLE STORY</strong><br><span>From scorching deserts to cold steppes — drought hides wherever precipitation falls short of expectation, regardless of temperature. And it's spreading.</span>`,
];

const COLD_DROUGHT_INFO = {
  "Kazakhstan": { label:"Cold Steppe Drought", body:"Central Asia's vast steppe receives far less precipitation than its grasslands need. Despite harsh winters, Kazakhstan experiences chronic drought — invisible to anyone expecting drought to look like a desert." },
  "Argentina":  { label:"Patagonian Drought",  body:"Patagonia sits in a rain shadow east of the Andes. Cold, windswept, and persistently dry — it records some of South America's most severe SPI deficits despite temperatures rarely exceeding 15°C." },
  "Mongolia":   { label:"Continental Drought", body:"One of the coldest countries on Earth, Mongolia averages below freezing annually. Yet its grasslands — critical for nomadic herders — are among the most drought-stressed in the dataset." },
  "United States":{ label:"The Great Basin",   body:"The Great Basin is cold desert — average temperature under 10°C — yet its SPI record is identical to Death Valley's. Cold doesn't mean wet." },
  "Russia":     { label:"Siberian Drought",    body:"Russia spans 11 time zones. Much of Siberia experiences continental drought — extreme cold winters with far less snowfall than the ecosystem requires. Permafrost is drying out, not just thawing." },
};

const COLD_DROUGHT_COUNTRIES = Object.keys(COLD_DROUGHT_INFO);
const HOT_DROUGHT_COUNTRIES  = ["Mali","Egypt","Saudi Arabia","Libya","Mauritania","Algeria"];

function spiColor(spi) {
  if (spi === undefined || isNaN(spi)) return "#c8bfad";
  const t = Math.max(0, Math.min(1, (spi + 1.5) / 3.0));
  return `rgb(${Math.round(180-t*130)},${Math.round(50+t*90)},${Math.round(20+t*190)})`;
}
function spiChangeColor(change) {
  if (change === undefined || isNaN(change)) return "#c8bfad";
  const t = Math.max(0, Math.min(1, (change + 1.0) / 2.0));
  return `rgb(${Math.round(180-t*150)},${Math.round(40+t*80)},${Math.round(20+t*180)})`;
}
function tempColor(tempC) {
  if (tempC === undefined || isNaN(tempC)) return "#c8bfad";
  const t = Math.max(0, Math.min(1, (tempC + 30) / 62));
  return `rgb(${Math.round(245-t*92)},${Math.round(235-t*220)},${Math.round(230-t*228)})`;
}

let mapLoaded = false, mapStep = -1, countryMeta = {}, clickListenersAttached = false;

async function initMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  const [topoRes, csvRes] = await Promise.all([
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    fetch("country_summary.csv"),
  ]);
  const topo    = await topoRes.json();
  const csvText = await csvRes.text();
  const lines   = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",");
    const row  = {};
    headers.forEach((h, idx) => { row[h] = vals[idx]?.trim(); });
    if (!row.country) continue;
    countryMeta[row.country] = {
      continent:   row.continent,
      spi_base:    parseFloat(row.mean_spi_base),
      spi_mod:     parseFloat(row.mean_spi_mod),
      temp_base:   parseFloat(row.mean_temp_C_base),
      temp_mod:    parseFloat(row.mean_temp_C_mod),
      spi_change:  parseFloat(row.spi_change),
      temp_change: parseFloat(row.temp_change_C),
    };
  }
  const countries = topojson.feature(topo, topo.objects.countries).features;
  const idToName = {
    4:"Afghanistan",8:"Albania",12:"Algeria",24:"Angola",32:"Argentina",36:"Australia",40:"Austria",31:"Azerbaijan",50:"Bangladesh",56:"Belgium",64:"Bhutan",68:"Bolivia",70:"Bosnia and Herzegovina",72:"Botswana",76:"Brazil",84:"Belize",100:"Bulgaria",104:"Myanmar",108:"Burundi",112:"Belarus",116:"Cambodia",120:"Cameroon",124:"Canada",132:"Cape Verde",140:"Central African Republic",144:"Sri Lanka",148:"Chad",152:"Chile",156:"China",170:"Colombia",178:"Republic of the Congo",180:"DR Congo",188:"Costa Rica",191:"Croatia",192:"Cuba",196:"Cyprus",203:"Czechia",204:"Benin",208:"Denmark",214:"Dominican Republic",218:"Ecuador",222:"El Salvador",231:"Ethiopia",232:"Eritrea",233:"Estonia",246:"Finland",250:"France",262:"Djibouti",266:"Gabon",268:"Georgia",276:"Germany",288:"Ghana",300:"Greece",308:"Grenada",320:"Guatemala",324:"Guinea",328:"Guyana",332:"Haiti",340:"Honduras",348:"Hungary",356:"India",360:"Indonesia",364:"Iran",368:"Iraq",372:"Ireland",376:"Israel",380:"Italy",384:"Ivory Coast",388:"Jamaica",392:"Japan",398:"Kazakhstan",400:"Jordan",404:"Kenya",408:"North Korea",410:"South Korea",414:"Kuwait",417:"Kyrgyzstan",418:"Laos",422:"Lebanon",426:"Lesotho",428:"Latvia",430:"Liberia",434:"Libya",440:"Lithuania",450:"Madagascar",454:"Malawi",458:"Malaysia",466:"Mali",478:"Mauritania",480:"Mauritius",484:"Mexico",496:"Mongolia",498:"Moldova",499:"Montenegro",504:"Morocco",508:"Mozambique",512:"Oman",516:"Namibia",524:"Nepal",528:"Netherlands",540:"New Caledonia",554:"New Zealand",558:"Nicaragua",562:"Niger",566:"Nigeria",578:"Norway",586:"Pakistan",591:"Panama",598:"Papua New Guinea",600:"Paraguay",604:"Peru",608:"Philippines",616:"Poland",620:"Portugal",624:"Guinea-Bissau",626:"Timor-Leste",634:"Qatar",642:"Romania",643:"Russia",646:"Rwanda",678:"Sao Tome and Principe",682:"Saudi Arabia",686:"Senegal",688:"Serbia",694:"Sierra Leone",703:"Slovakia",704:"Vietnam",705:"Slovenia",706:"Somalia",710:"South Africa",716:"Zimbabwe",724:"Spain",728:"South Sudan",729:"Sudan",740:"Suriname",748:"Eswatini",752:"Sweden",756:"Switzerland",760:"Syria",762:"Tajikistan",764:"Thailand",768:"Togo",776:"Tonga",780:"Trinidad and Tobago",784:"United Arab Emirates",788:"Tunisia",792:"Turkey",800:"Uganda",804:"Ukraine",807:"North Macedonia",818:"Egypt",826:"United Kingdom",834:"Tanzania",840:"United States",854:"Burkina Faso",858:"Uruguay",860:"Uzbekistan",862:"Venezuela",887:"Yemen",894:"Zambia",51:"Armenia",10:"Antarctica",90:"Solomon Islands",275:"Palestine",548:"Vanuatu",
  };
  const nameMap = {
    "United States of America":"United States","Russian Federation":"Russia","Iran (Islamic Republic of)":"Iran","Venezuela (Bolivarian Republic of)":"Venezuela","Bolivia (Plurinational State of)":"Bolivia","United Republic of Tanzania":"Tanzania","Korea, Republic of":"South Korea","Korea, Democratic People's Republic of":"North Korea","Viet Nam":"Vietnam","Syrian Arab Republic":"Syria","Lao People's Democratic Republic":"Laos","Congo, Democratic Republic of the":"DR Congo","Congo":"Republic of the Congo","Cote d'Ivoire":"Ivory Coast","Burma":"Myanmar","Czech Republic":"Czechia","Macedonia, the former Yugoslav Republic of":"North Macedonia","Republic of Moldova":"Moldova","Swaziland":"Eswatini","Sao Tome and Principe":"Sao Tome and Principe","Brunei Darussalam":"Brunei","Palestine, State of":"Palestine","Taiwan, Province of China":"Taiwan","Tanzania, United Republic of":"Tanzania","Micronesia (Federated States of)":"Micronesia","Dominican Rep.":"Dominican Republic",
  };
  function normalizeName(n) { return nameMap[n] || n; }
  function project([lon, lat]) {
    return [(lon+180)/360*960, (90-lat)/180*500];
  }
  function coordsToPath(geometry) {
    function ringToD(ring) {
      const segs = []; let cur = [];
      for (let i = 0; i < ring.length; i++) {
        if (i>0 && Math.abs(ring[i][0]-ring[i-1][0])>180) { if (cur.length>1) segs.push(cur); cur=[]; }
        cur.push(ring[i]);
      }
      if (cur.length>1) segs.push(cur);
      return segs.map(seg=>seg.map((pt,i)=>{const[x,y]=project(pt);return(i===0?`M${x.toFixed(2)},${y.toFixed(2)}`:`L${x.toFixed(2)},${y.toFixed(2)}`);}).join(" ")+" Z").join(" ");
    }
    if (geometry.type==="Polygon") return geometry.coordinates.map(ringToD).join(" ");
    if (geometry.type==="MultiPolygon") return geometry.coordinates.map(poly=>poly.map(ringToD).join(" ")).join(" ");
    return "";
  }
  const svg = document.getElementById("world-map");
  svg.innerHTML = "";
  for (const feature of countries) {
    const id=parseInt(feature.id,10), rawName=idToName[id]||"", csvName=normalizeName(rawName);
    const meta=countryMeta[csvName]||countryMeta[rawName]||null;
    const d=coordsToPath(feature.geometry);
    if (!d) continue;
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d",d); path.setAttribute("data-name",csvName); path.setAttribute("fill","#c8bfad");
    svg.appendChild(path);
    if (meta) { if (!countryMeta[csvName]) countryMeta[csvName]={}; Object.assign(countryMeta[csvName],meta); countryMeta[csvName].el=path; }
    if (rawName && !countryMeta[rawName]) countryMeta[rawName]={el:path};
    else if (rawName && countryMeta[rawName]) countryMeta[rawName].el=path;
  }
  svg.querySelectorAll("path[data-name]").forEach(p=>{ const n=p.getAttribute("data-name"); if(!countryMeta[n])countryMeta[n]={}; countryMeta[n].el=p; });
  const tooltip=document.getElementById("map-tooltip");
  svg.addEventListener("mousemove",(e)=>{
    const path=e.target.closest("path"); if(!path){tooltip.classList.remove("visible");return;}
    const name=path.getAttribute("data-name"), meta=countryMeta[name];
    if(!meta||meta.temp_base===undefined){tooltip.classList.remove("visible");return;}
    const isCold=COLD_DROUGHT_COUNTRIES.includes(name);
    let valHtml=`<div class="tt-val">🌡 ${meta.temp_base.toFixed(1)}°C</div>`;
    if(mapStep>=2&&mapStep<=4) valHtml+=`<div class="tt-val">SPI ${meta.spi_base.toFixed(2)}</div>`;
    if(mapStep>=3&&mapStep<=4) valHtml+=`<div class="tt-val">SPI change: ${meta.spi_change>=0?'+':''}${meta.spi_change.toFixed(2)}</div>`;
    if(mapStep>=2&&isCold) valHtml+=`<div class="tt-val" style="color:#8B5E3C;font-weight:700">Click to explore</div>`;
    tooltip.innerHTML=`<div class="tt-name">${name}</div>${valHtml}`;
    tooltip.style.left=(e.clientX+14)+"px"; tooltip.style.top=(e.clientY-10)+"px";
    tooltip.classList.add("visible");
  });
  svg.addEventListener("mouseleave",()=>tooltip.classList.remove("visible"));
  mapStep=-1; applyMapStep(0);
}

function updateLegend(mode) {
  const legend=document.getElementById("map-legend"),bar=document.getElementById("legend-bar"),label=document.getElementById("legend-label"),minEl=document.getElementById("legend-min"),maxEl=document.getElementById("legend-max");
  legend.classList.add("visible");
  if(mode==="temp"){label.textContent="Mean Temperature";bar.style.background=`linear-gradient(to right,${tempColor(-30)},${tempColor(0)},${tempColor(30)})`;minEl.textContent="30C";maxEl.textContent="30C";}
  else if(mode==="spi"){label.textContent="SPI Drought Deficit";bar.style.background=`linear-gradient(to right,${spiColor(-1.5)},${spiColor(0)},${spiColor(1.5)})`;minEl.textContent="-1.5 Severe drought";maxEl.textContent="+1.5 Wet";}
  else if(mode==="spi_change"){label.textContent="SPI Change (baseline to modern)";bar.style.background=`linear-gradient(to right,${spiChangeColor(-1)},${spiChangeColor(0)},${spiChangeColor(1)})`;minEl.textContent="Worsening drought";maxEl.textContent="Improving";}
}

function attachColdDroughtClicks() {
  if (clickListenersAttached) return; clickListenersAttached=true;
  COLD_DROUGHT_COUNTRIES.forEach(name=>{
    const meta=countryMeta[name]; if(!meta?.el) return;
    meta.el.addEventListener("click",()=>{ if(mapStep<2)return; showColdDroughtInfo(name); });
  });
}

function showColdDroughtInfo(name) {
  const info=COLD_DROUGHT_INFO[name], meta=countryMeta[name]; if(!info)return;
  const spiVal=meta?.spi_base!==undefined?`SPI ${meta.spi_base.toFixed(2)}`:info.spi;
  const tempVal=meta?.temp_base!==undefined?`Mean temp: ${meta.temp_base.toFixed(1)}C`:info.temp;
  const changeVal=meta?.spi_change!==undefined?(meta.spi_change<0?`Worsening (${meta.spi_change.toFixed(2)})`:`Improving (+${meta.spi_change.toFixed(2)})`):info.spiChange;
  const box=document.getElementById("country-info-box");
  const doEnter=()=>{
    box.classList.remove("exit"); box.style.transition="none"; box.style.transform="translateY(calc(-50% + 80px))"; box.style.opacity="0";
    box.innerHTML=`<div class="cib-label">${info.label}</div><div class="cib-name">${name}</div><div class="cib-stat" style="color:#3b8bd4">${spiVal}</div><div class="cib-unit">${tempVal} Trend: ${changeVal}</div><div class="cib-divider"></div><div class="cib-body">${info.body}</div>`;
    void box.offsetWidth; box.style.transition=""; box.style.transform=""; box.style.opacity=""; box.classList.add("visible");
  };
  if(box.classList.contains("visible")){box.classList.add("exit");box.classList.remove("visible");setTimeout(doEnter,340);}else doEnter();
}

function setInfoBox(html) {
  const box=document.getElementById("country-info-box");
  const doEnter=()=>{
    box.classList.remove("exit"); box.style.transition="none"; box.style.transform="translateY(calc(-50% + 80px))"; box.style.opacity="0";
    box.innerHTML=html; void box.offsetWidth; box.style.transition=""; box.style.transform=""; box.style.opacity="";
    if(html) box.classList.add("visible");
  };
  if(box.classList.contains("visible")){box.classList.add("exit");box.classList.remove("visible");setTimeout(doEnter,340);}else doEnter();
}

function applyMapStep(step) {
  if(step===mapStep)return; if(Object.keys(countryMeta).length===0)return; mapStep=step;
  const labelEl=document.getElementById("map-label-text");
  labelEl.style.opacity="0";
  setTimeout(()=>{labelEl.innerHTML=STEP_LABELS[step]||"";labelEl.style.opacity="1";},300);
  if(step<=1){
    updateLegend("temp");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue; meta.el.setAttribute("fill",tempColor(meta.temp_base??15)); meta.el.style.cursor="default";
      const isHot=HOT_DROUGHT_COUNTRIES.includes(name);
      if(isHot){meta.el.style.opacity="1";meta.el.setAttribute("stroke",tempColor(meta.temp_base??25));meta.el.setAttribute("stroke-width","2");meta.el.style.filter="drop-shadow(0 0 8px rgba(200,60,20,0.7))";}
      else{meta.el.style.opacity="0.18";meta.el.setAttribute("stroke","rgba(255,255,255,0.05)");meta.el.setAttribute("stroke-width","0.3");meta.el.style.filter="";}
    }
    setInfoBox(`<div class="cib-label">Where drought is expected</div><div class="cib-name">Hot & Dry</div><div class="cib-divider"></div><div class="cib-body">Mali, Egypt, Saudi Arabia, Libya, Mauritania — all hot, all dry, all obvious candidates for drought.<br><br>Temperatures above <strong>25C</strong>. Precipitation near zero. This is the picture most people have.<br><br><em style="color:#8B5E3C">Scroll on — the map is about to change.</em></div>`);
  } else if(step<=3){
    updateLegend(step<=2?"spi":"spi_change");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue;
      const col=step<=2?spiColor(meta.spi_base):spiChangeColor(meta.spi_change);
      meta.el.setAttribute("fill",col);
      const isCold=COLD_DROUGHT_COUNTRIES.includes(name), isHot=HOT_DROUGHT_COUNTRIES.includes(name);
      if(isCold||isHot){meta.el.style.opacity="1";meta.el.setAttribute("stroke",col);meta.el.setAttribute("stroke-width","2");meta.el.style.filter=`drop-shadow(0 0 8px ${col})`;meta.el.style.cursor=isCold?"pointer":"default";}
      else{meta.el.style.opacity="0.3";meta.el.setAttribute("stroke","rgba(255,255,255,0.08)");meta.el.setAttribute("stroke-width","0.3");meta.el.style.filter="";meta.el.style.cursor="default";}
    }
    attachColdDroughtClicks();
    if(step===2) setInfoBox(`<div class="cib-label">Now look at SPI</div><div class="cib-name">Cold Drought</div><div class="cib-divider"></div><div class="cib-body">The hot deserts are still red. But now cold and temperate regions are glowing too.<br><br>Kazakhstan. Mongolia. Russia. Argentina. The United States Great Basin.<br><br><em style="color:#8B5E3C">Click any highlighted country to explore its drought story.</em></div>`);
    else setInfoBox(`<div class="cib-label">SPI is changing</div><div class="cib-name">Drought Trends</div><div class="cib-divider"></div><div class="cib-body">Red means drought is intensifying — SPI is falling further below normal.<br><br>Some of the sharpest declines are in cold or temperate regions that were never thought of as drought-prone.<br><br><em style="color:#8B5E3C">Click any highlighted country to explore.</em></div>`);
  } else {
    updateLegend("spi");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue; meta.el.setAttribute("fill",spiColor(meta.spi_base)); meta.el.style.opacity="1"; meta.el.setAttribute("stroke","rgba(255,255,255,0.15)"); meta.el.setAttribute("stroke-width","0.3"); meta.el.style.filter=""; meta.el.style.cursor="default";
    }
    setInfoBox(`<div class="cib-label">The Full Picture</div><div class="cib-name">SPI Worldwide</div><div class="cib-divider"></div><div class="cib-body">Every country colored by SPI — the true measure of drought. Red means persistent deficit. Blue means surplus.<br><br>Drought-red appears across cold Central Asia, Patagonia, and the American West — not just the Sahara.<br><br><em style="color:#8B5E3C">The thermometer never tells the whole story.</em></div>`);
  }
}

driveMap = function() {
  const t=document.getElementById("slide-3-track"); if(!t)return;
  const rect=t.getBoundingClientRect(), trackHeight=t.offsetHeight, vh=window.innerHeight;
  if(rect.top>vh||rect.bottom<0)return;
  const progress=Math.max(0,Math.min(1,-rect.top/(trackHeight-vh)));
  let currentStep=0;
  for(let i=MAP_STEPS.length-1;i>=0;i--){if(progress>=MAP_STEPS[i]){currentStep=i;break;}}
  applyMapStep(currentStep);
};

let topojsonLoaded=false;
function loadTopojsonAndMap(){
  if(topojsonLoaded)return;
  const rect=document.getElementById("slide-3-track")?.getBoundingClientRect();
  if(rect&&rect.top<window.innerHeight*1.5){
    if(!window.topojson){const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";s.onload=()=>{topojsonLoaded=true;initMap();};document.head.appendChild(s);}
    else{topojsonLoaded=true;initMap();}
  }
}
window.addEventListener("scroll",loadTopojsonAndMap);
loadTopojsonAndMap();

/* ══════════════════════════════════════════════
   SPI RAIN DOT SCROLLYTELLING
   ══════════════════════════════════════════════ */
(function(){
  const SPI_STEPS=[
    {spi:0.0,  dropRate:1.0,  color:[70,140,210]},
    {spi:1.5,  dropRate:1.8,  color:[30,100,200]},
    {spi:-0.6, dropRate:0.52, color:[180,130,70]},
    {spi:-1.5, dropRate:0.18, color:[200,80,30]},
    {spi:-2.1, dropRate:0.04, color:[160,35,10]},
  ];
  function spiToNeedle(spi){return Math.max(0,Math.min(100,((spi+2.5)/5.0)*100));}
  function spiToColor(spi){const t=Math.max(0,Math.min(1,(spi+2.5)/5.0));return `rgb(${Math.round(180+(90-180)*t)},${Math.round(60+(170-60)*t)},${Math.round(20+(255-20)*t)})`;}
  const canvas=document.getElementById('spi-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d'); let W,H;
  function resize(){W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;}
  resize(); window.addEventListener('resize',()=>{resize();drops.length=0;});
  const drops=[],splashes=[]; let currentStep=0,animColor=[90,160,220],lastTime=0,spawnAccum=0;
  function spawnDrop(){
    const step=SPI_STEPS[currentStep]||SPI_STEPS[0];
    animColor=animColor.map((c,i)=>c+(step.color[i]-c)*0.05);
    drops.push({x:Math.random()*W,y:-8-Math.random()*40,vy:3.5+Math.random()*4.5,r:2.2+Math.random()*2.2,opacity:0.55+Math.random()*0.4,color:[...animColor],wobble:(Math.random()-0.5)*0.4});
  }
  function tick(now){
    const dt=Math.min(now-lastTime,50); lastTime=now;
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#0a0f1a'); bg.addColorStop(1,'#0d2040');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    const groundY=H*0.88;
    ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(W,groundY);ctx.strokeStyle='rgba(210,160,80,0.6)';ctx.lineWidth=2;ctx.stroke();
    const step=SPI_STEPS[currentStep]||SPI_STEPS[0];
    spawnAccum+=(2.8*step.dropRate*dt)/16;
    while(spawnAccum>=1){spawnDrop();spawnAccum-=1;}
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i]; d.y+=d.vy; d.x+=d.wobble;
      if(d.y>=groundY){splashes.push({x:d.x,y:groundY,r:d.r*1.2,maxR:d.r*7,life:1.0,color:d.color});drops.splice(i,1);continue;}
      const[r,g,b]=d.color; ctx.beginPath();ctx.save();ctx.translate(d.x,d.y);ctx.scale(1,1.6);ctx.arc(0,0,d.r,0,Math.PI*2);ctx.restore();ctx.fillStyle=`rgba(${r},${g},${b},${d.opacity})`;ctx.fill();
    }
    for(let i=splashes.length-1;i>=0;i--){
      const s=splashes[i]; s.life-=0.045; s.r+=(s.maxR-s.r)*0.2;
      if(s.life<=0){splashes.splice(i,1);continue;}
      const[r,g,b]=s.color; ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.strokeStyle=`rgba(${r},${g},${b},${s.life*0.35})`;ctx.stroke();
    }
    const puddleAlpha=0.2+step.dropRate*0.25;
    const pg=ctx.createLinearGradient(0,groundY,0,H); pg.addColorStop(0,`rgba(180,120,40,${puddleAlpha})`); pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=pg; ctx.fillRect(0,groundY,W,H-groundY);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function setSpiPanel(idx){
    document.querySelectorAll('.spi-panel').forEach((p,i)=>{
      p.classList.toggle('active',i===idx); p.classList.toggle('exit-up',i!==idx);
    });
    const step=SPI_STEPS[idx]; if(!step)return;
    const needleEl=document.getElementById(`spi-needle-${idx}`), statEl=document.getElementById(`spi-stat-${idx}`);
    if(!needleEl||!statEl)return;
    needleEl.style.left=spiToNeedle(step.spi)+'%'; statEl.style.color=spiToColor(step.spi);
    const target=step.spi, startTime=performance.now(), dur=900;
    function countUp(now){
      const t=Math.min(1,(now-startTime)/dur), ease=1-Math.pow(1-t,3), val=target*ease;
      statEl.textContent=`SPI = ${val>=0?'+':''}${val.toFixed(2)}`;
      if(t<1)requestAnimationFrame(countUp);
    }
    requestAnimationFrame(countUp);
  }

  function isOnSpiTrack(){
    const t=document.getElementById('slide-spi-track'); if(!t)return false;
    const r=t.getBoundingClientRect(); return r.top<=0&&r.bottom>window.innerHeight;
  }
  function getSpiScrollStep(){
    const t=document.getElementById('slide-spi-track'); if(!t)return-1;
    const r=t.getBoundingClientRect(), total=t.offsetHeight-window.innerHeight;
    const prog=Math.max(0,Math.min(1,-r.top/total));
    if(prog<0.22)return 0; if(prog<0.42)return 1; if(prog<0.62)return 2; if(prog<0.82)return 3; return 4;
  }

  let spiStepNow=-1;
  driveSpi=function(){
    if(!isOnSpiTrack())return;
    const step=getSpiScrollStep(); if(step===spiStepNow)return;
    spiStepNow=step; currentStep=step; setSpiPanel(step);
  };
  setSpiPanel(0);
})();

/* ══════════════════════════════════════════════
   CASE STUDY (slideshow)
   ══════════════════════════════════════════════ */
(function(){
  const GB_COLOR='#5B8DB8',DV_COLOR='#C0622B',AXIS_COLOR='rgba(139,94,60,0.18)',TEXT_COLOR='#7a6248';
  let currentSlide=0; const TOTAL=4; let chartsDrawn={1:false,2:false,3:false}; let annualData=null,spiData=null,isAnimating=false;
  function parseCSV(text){
    const lines=text.trim().split('\n'), headers=lines[0].split(',').map(h=>h.trim());
    return lines.slice(1).map(line=>{const vals=line.split(','),obj={};headers.forEach((h,i)=>{obj[h]=isNaN(vals[i])?vals[i].trim():parseFloat(vals[i]);});return obj;});
  }
  async function loadCaseData(){
    try{
      const[annualText,spiText]=await Promise.all([fetch('case_study_annual.csv').then(r=>r.text()),fetch('case_study_spi.csv').then(r=>r.text())]);
      annualData=parseCSV(annualText);
      spiData=parseCSV(spiText).map(d=>({date:new Date(d.date+'-01'),gb_spi:d.gb_spi,dv_spi:d.dv_spi}));
    }catch(err){console.warn('Case study CSVs not found',err);}
  }
  const caseDataLoaded=loadCaseData();
  const sliderTrack=document.getElementById('case-slider-track');
  const prevBtn=document.getElementById('case-prev'),nextBtn=document.getElementById('case-next');
  const dots=document.querySelectorAll('.case-dot-btn');
  function goTo(idx,skipDraw){
    if(isAnimating)return; idx=Math.max(0,Math.min(TOTAL-1,idx));
    if(idx===currentSlide&&!skipDraw)return;
    isAnimating=true; currentSlide=idx;
    if(sliderTrack)sliderTrack.style.transform=`translateX(-${idx*100}%)`;
    dots.forEach((d,i)=>d.classList.toggle('active',i===idx));
    if(prevBtn)prevBtn.classList.toggle('hidden',idx===0);
    if(nextBtn)nextBtn.classList.toggle('hidden',idx===TOTAL-1);
    setTimeout(()=>{isAnimating=false;},560);
    if(!skipDraw)maybeDrawChart(idx);
  }
  async function maybeDrawChart(idx){
    if(typeof d3==='undefined')await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
    await caseDataLoaded;
    if(idx===1&&!chartsDrawn[1]){const el=document.getElementById('case-chart-svg-1');if(el){drawBarChart(el);chartsDrawn[1]=true;}}
    if(idx===2&&!chartsDrawn[2]){const el=document.getElementById('case-chart-svg-2');if(el){drawLineChart(el);chartsDrawn[2]=true;}}
    if(idx===3&&!chartsDrawn[3]){const el=document.getElementById('case-chart-svg-3');if(el){drawFreqChart(el);chartsDrawn[3]=true;}}
  }
  prevBtn?.addEventListener('click',()=>goTo(currentSlide-1));
  nextBtn?.addEventListener('click',()=>goTo(currentSlide+1));
  dots.forEach(d=>{d.addEventListener('click',()=>goTo(parseInt(d.dataset.slide)));});
  document.addEventListener('keydown',e=>{
    const ct=document.getElementById('slide-case-track');if(!ct)return;
    const r=ct.getBoundingClientRect();if(r.top>0||r.bottom<window.innerHeight)return;
    if(e.key==='ArrowRight')goTo(currentSlide+1);if(e.key==='ArrowLeft')goTo(currentSlide-1);
  });
  let touchStartX=null;
  const viewport=document.getElementById('case-slider-viewport');
  viewport?.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;},{passive:true});
  viewport?.addEventListener('touchend',e=>{
    if(touchStartX===null)return; const dx=e.changedTouches[0].clientX-touchStartX; touchStartX=null;
    if(Math.abs(dx)<40)return; dx<0?goTo(currentSlide+1):goTo(currentSlide-1);
  },{passive:true});
  window.addEventListener('resize',async()=>{
    if(typeof d3==='undefined')return; await caseDataLoaded;
    const drawn={...chartsDrawn}; chartsDrawn={1:false,2:false,3:false};
    if(drawn[1]){const el=document.getElementById('case-chart-svg-1');if(el){drawBarChart(el);chartsDrawn[1]=true;}}
    if(drawn[2]){const el=document.getElementById('case-chart-svg-2');if(el){drawLineChart(el);chartsDrawn[2]=true;}}
    if(drawn[3]){const el=document.getElementById('case-chart-svg-3');if(el){drawFreqChart(el);chartsDrawn[3]=true;}}
  });
  goTo(0,true);
  function chartDims(svgEl){const W=svgEl.clientWidth||520,H=svgEl.clientHeight||320,margin={top:38,right:20,bottom:50,left:50};return{W,H,iW:W-margin.left-margin.right,iH:H-margin.top-margin.bottom,margin};}
  function styleAxis(g){g.selectAll('text').style('font-family',"'Montserrat',sans-serif").style('font-size','10px').style('fill',TEXT_COLOR);g.selectAll('line,path').style('stroke',AXIS_COLOR);return g;}
  function animateBars(bars,yScale,innerH,dur=820){bars.attr('y',innerH).attr('height',0).transition().duration(dur).ease(d3.easeCubicOut).attr('y',d=>yScale(d.value)).attr('height',d=>innerH-yScale(d.value));}
  function animateLine(path,dur=1350){const len=path.node().getTotalLength();path.attr('stroke-dasharray',`${len} ${len}`).attr('stroke-dashoffset',len).transition().duration(dur).ease(d3.easeLinear).attr('stroke-dashoffset',0);}
  function addGridlines(g,yScale,iW){const grid=g.append('g').attr('class','case-axis').call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));grid.select('.domain').remove();grid.selectAll('line').style('stroke','rgba(139,94,60,0.10)');}
  function addTitle(svg,W,margin,text){svg.append('text').attr('class','case-chart-title').attr('x',W/2).attr('y',margin.top*0.58).text(text);}
  function addLegend(g,iW){const leg=g.append('g').attr('transform',`translate(${iW-152},-26)`);[['Great Basin',GB_COLOR],['Death Valley',DV_COLOR]].forEach(([n,c],i)=>{leg.append('rect').attr('x',i*86).attr('width',11).attr('height',11).attr('rx',2).attr('fill',c).attr('opacity',0.88);leg.append('text').attr('x',i*86+15).attr('y',9.5).style('font-family',"'Montserrat',sans-serif").style('font-size','8.5px').style('fill',TEXT_COLOR).text(n);});}
  function drawBarChart(svgEl){
    if(!annualData?.length)return;
    const svg=d3.select(svgEl);svg.selectAll('*').remove();
    const{W,H,iW,iH,margin}=chartDims(svgEl);const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const gbTas=d3.mean(annualData,d=>d.gb_tas),dvTas=d3.mean(annualData,d=>d.dv_tas),gbPr=d3.mean(annualData,d=>d.gb_pr),dvPr=d3.mean(annualData,d=>d.dv_pr);
    const groups=['Temperature (C)','Precip (mm/mo)'];
    const x0=d3.scaleBand().domain(groups).range([0,iW]).paddingInner(0.38).paddingOuter(0.18);
    const x1=d3.scaleBand().domain(['Great Basin','Death Valley']).range([0,x0.bandwidth()]).paddingInner(0.12);
    const yTemp=d3.scaleLinear().domain([0,Math.max(gbTas,dvTas)*1.38]).range([iH,0]);
    const yPrecip=d3.scaleLinear().domain([0,Math.max(gbPr,dvPr)*1.38]).range([iH,0]);
    const yFor=name=>name==='Temperature (C)'?yTemp:yPrecip;
    addGridlines(g,yTemp,iW);
    const xAxisG=styleAxis(g.append('g').attr('class','case-axis').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(x0).tickSize(0)));
    xAxisG.select('.domain').remove();xAxisG.selectAll('text').attr('dy','1.4em').style('font-size','10.5px').style('font-weight','700').style('fill','#4a3020');
    styleAxis(g.append('g').attr('class','case-axis').call(d3.axisLeft(yTemp).ticks(5)));
    g.append('text').attr('class','case-axis-label').attr('transform','rotate(-90)').attr('x',-iH/2).attr('y',-40).attr('text-anchor','middle').text('Temperature C');
    styleAxis(g.append('g').attr('class','case-axis').attr('transform',`translate(${iW},0)`).call(d3.axisRight(yPrecip).ticks(5).tickSize(0)));
    g.append('text').attr('class','case-axis-label').attr('transform','rotate(90)').attr('x',iH/2).attr('y',-iW-36).attr('text-anchor','middle').text('Precip mm/mo');
    const barData={'Temperature (C)':[{region:'Great Basin',value:gbTas,color:GB_COLOR},{region:'Death Valley',value:dvTas,color:DV_COLOR}],'Precip (mm/mo)':[{region:'Great Basin',value:gbPr,color:GB_COLOR},{region:'Death Valley',value:dvPr,color:DV_COLOR}]};
    groups.forEach(gName=>{
      const gEl=g.append('g').attr('transform',`translate(${x0(gName)},0)`),yS=yFor(gName),dat=barData[gName];
      const bars=gEl.selectAll('rect').data(dat).enter().append('rect').attr('x',d=>x1(d.region)).attr('width',x1.bandwidth()).attr('rx',3).attr('fill',d=>d.color).attr('opacity',0.85);
      animateBars(bars,yS,iH);
      gEl.selectAll('.bv').data(dat).enter().append('text').attr('class','case-bar-label').attr('x',d=>x1(d.region)+x1.bandwidth()/2).attr('y',d=>yS(d.value)-5).text(d=>gName==='Temperature (C)'?`${d.value.toFixed(1)}`:`${d.value.toFixed(1)}`).attr('opacity',0).transition().delay(840).duration(280).attr('opacity',1);
    });
    addLegend(g,iW);addTitle(svg,W,margin,'Mean Temperature & Precipitation 1950-2014');
  }
  function drawLineChart(svgEl){
    if(!spiData?.length)return;
    const svg=d3.select(svgEl);svg.selectAll('*').remove();
    const{W,H,iW,iH,margin}=chartDims(svgEl);const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const x=d3.scaleTime().domain(d3.extent(spiData,d=>d.date)).range([0,iW]);
    const y=d3.scaleLinear().domain([-3.0,3.5]).range([iH,0]);
    g.append('rect').attr('x',0).attr('y',y(-1.0)).attr('width',iW).attr('height',iH-y(-1.0)).attr('fill','rgba(139,94,60,0.06)');
    addGridlines(g,y,iW);
    styleAxis(g.append('g').attr('class','case-axis').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(10))));
    styleAxis(g.append('g').attr('class','case-axis').call(d3.axisLeft(y).ticks(5)));
    g.append('text').attr('class','case-axis-label').attr('transform','rotate(-90)').attr('x',-iH/2).attr('y',-40).attr('text-anchor','middle').text('SPI-12');
    g.append('line').attr('x1',0).attr('x2',iW).attr('y1',y(0)).attr('y2',y(0)).style('stroke','rgba(139,94,60,0.22)').style('stroke-width',1);
    g.append('line').attr('class','case-threshold-line').attr('x1',0).attr('x2',iW).attr('y1',y(-1.0)).attr('y2',y(-1.0));
    g.append('text').attr('class','case-threshold-label').attr('x',iW-2).attr('y',y(-1.0)-4).attr('text-anchor','end').text('SPI = -1.0');
    const mkArea=key=>d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(Math.min(0,d[key]))).curve(d3.curveBasis);
    g.append('path').datum(spiData).attr('d',mkArea('gb_spi')).attr('fill',GB_COLOR).attr('opacity',0.14);
    g.append('path').datum(spiData).attr('d',mkArea('dv_spi')).attr('fill',DV_COLOR).attr('opacity',0.14);
    const mkLine=key=>d3.line().x(d=>x(d.date)).y(d=>y(d[key])).curve(d3.curveBasis);
    const pGB=g.append('path').datum(spiData).attr('d',mkLine('gb_spi')).attr('fill','none').attr('stroke',GB_COLOR).attr('stroke-width',1.8);
    const pDV=g.append('path').datum(spiData).attr('d',mkLine('dv_spi')).attr('fill','none').attr('stroke',DV_COLOR).attr('stroke-width',1.8);
    animateLine(pGB,1400);animateLine(pDV,1680);addLegend(g,iW);addTitle(svg,W,margin,'SPI-12 Time Series 1950-2014');
  }
  function drawFreqChart(svgEl){
    let freqData;
    if(spiData?.length){
      const gbVals=spiData.map(d=>d.gb_spi).filter(v=>!isNaN(v)),dvVals=spiData.map(d=>d.dv_spi).filter(v=>!isNaN(v));
      const pct=(arr,lo,hi=Infinity)=>arr.filter(v=>v<lo&&(hi===Infinity||v>=hi)).length/arr.length*100;
      freqData=[{cat:'Moderate\n(< -1.0)',gb:pct(gbVals,-1.0,-1.5),dv:pct(dvVals,-1.0,-1.5)},{cat:'Severe\n(< -1.5)',gb:pct(gbVals,-1.5,-2.0),dv:pct(dvVals,-1.5,-2.0)},{cat:'Extreme\n(< -2.0)',gb:pct(gbVals,-2.0),dv:pct(dvVals,-2.0)}];
    }else{freqData=[{cat:'Moderate\n(< -1.0)',gb:14.8,dv:14.8},{cat:'Severe\n(< -1.5)',gb:3.0,dv:3.0},{cat:'Extreme\n(< -2.0)',gb:3.0,dv:3.0}];}
    const svg=d3.select(svgEl);svg.selectAll('*').remove();
    const{W,H,iW,iH,margin}=chartDims(svgEl);const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const x0=d3.scaleBand().domain(freqData.map(d=>d.cat)).range([0,iW]).paddingInner(0.38).paddingOuter(0.18);
    const x1=d3.scaleBand().domain(['gb','dv']).range([0,x0.bandwidth()]).paddingInner(0.1);
    const maxV=Math.max(d3.max(freqData,d=>d.gb),d3.max(freqData,d=>d.dv));
    const y=d3.scaleLinear().domain([0,Math.max(maxV*1.38,6)]).range([iH,0]);
    addGridlines(g,y,iW);
    const xAxisG=g.append('g').attr('class','case-axis').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(x0).tickSize(0));
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('.tick text').each(function(d){const el=d3.select(this),parts=d.split('\n');el.text('');parts.forEach((p,i)=>el.append('tspan').attr('x',0).attr('dy',i===0?'1.3em':'1.2em').text(p));}).style('font-family',"'Montserrat',sans-serif").style('font-size','9.5px').style('font-weight','700').style('fill','#4a3020');
    styleAxis(g.append('g').attr('class','case-axis').call(d3.axisLeft(y).ticks(5).tickFormat(d=>d+'%')));
    g.append('text').attr('class','case-axis-label').attr('transform','rotate(-90)').attr('x',-iH/2).attr('y',-40).attr('text-anchor','middle').text('% of months');
    g.append('line').attr('class','case-threshold-line').attr('x1',0).attr('x2',iW).attr('y1',y(5)).attr('y2',y(5));
    g.append('text').attr('class','case-threshold-label').attr('x',iW-2).attr('y',y(5)-4).attr('text-anchor','end').text('5% expected under normal climate');
    freqData.forEach(d=>{
      const gEl=g.append('g').attr('transform',`translate(${x0(d.cat)},0)`);
      const dat=[{key:'gb',value:d.gb,color:GB_COLOR},{key:'dv',value:d.dv,color:DV_COLOR}];
      const bars=gEl.selectAll('rect').data(dat).enter().append('rect').attr('x',b=>x1(b.key)).attr('width',x1.bandwidth()).attr('rx',3).attr('fill',b=>b.color).attr('opacity',0.85);
      animateBars(bars,y,iH,920);
      gEl.selectAll('.fv').data(dat).enter().append('text').attr('class','case-bar-label').attr('x',b=>x1(b.key)+x1.bandwidth()/2).attr('y',b=>y(b.value)-4).text(b=>`${b.value.toFixed(1)}%`).attr('opacity',0).transition().delay(940).duration(280).attr('opacity',1);
    });
    addLegend(g,iW);addTitle(svg,W,margin,'Drought Category Frequency SPI-12 1950-2014');
  }
})();

/* ══════════════════════════════════════════════
   CLIMATE BUILDER
   ══════════════════════════════════════════════ */
(function(){
  const tempSlider=document.getElementById('temp-slider'),prSlider=document.getElementById('pr-slider');
  const tempVal=document.getElementById('temp-val'),prVal=document.getElementById('pr-val');
  const meterVerdict=document.getElementById('meter-verdict'),meterExample=document.getElementById('meter-example');
  const dialFill=document.getElementById('dial-fill'),dialTrack=document.getElementById('dial-track'),dialNeedle=document.getElementById('dial-needle-g');
  if(!tempSlider||!dialFill)return;
  let COUNTRY_CLIMATES=[];
  const similarName=document.getElementById('similar-name'),similarDesc=document.getElementById('similar-desc');
  const CX=130,CY=130,R=80,START_DEG=270,TOTAL_SWEEP=180;
  function polarToXY(deg){const rad=(deg-90)*Math.PI/180;return{x:CX+R*Math.cos(rad),y:CY+R*Math.sin(rad)};}
  function arcPath(fromDeg,toDeg){const s=polarToXY(fromDeg),e=polarToXY(toDeg),sweep=((toDeg-fromDeg+360)%360),large=sweep>180?1:0;return`M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;}
  dialTrack.setAttribute('d',arcPath(START_DEG,START_DEG+TOTAL_SWEEP));
  const ARC_LEN=(TOTAL_SWEEP/360)*2*Math.PI*R;
  dialFill.setAttribute('d',arcPath(START_DEG,START_DEG+TOTAL_SWEEP));
  dialFill.style.strokeDasharray=ARC_LEN.toFixed(2); dialFill.style.strokeDashoffset=ARC_LEN.toFixed(2);
  const TEMP_LABELS=['Cold','Cool','Moderate','Warm','Hot'],PR_LABELS=['Very Dry','Dry','Moderate','Wet','Very Wet'];
  const LEVELS=[{max:0.22,label:'Low',color:'#5a8a3c',example:'Mild conditions — water supply stable.'},{max:0.48,label:'Moderate',color:'#8B5E3C',example:'Some stress — seasonal dryness possible.'},{max:0.72,label:'High',color:'#c84b1a',example:'Vegetation stress; water restrictions likely.'},{max:1.01,label:'Very High',color:'#8B0000',example:'Severe drought conditions expected.'}];
  function labelFor(val,labels){return labels[Math.round((val/100)*(labels.length-1))];}
  function computeRisk(temp,pr){return Math.max(0,Math.min(1,(temp/100)*0.45+(1-pr/100)*0.55));}
  async function loadCountryClimateData(){
    try{
      const response=await fetch("climate_agg_country.csv");if(!response.ok)throw new Error("CSV not found");
      const text=await response.text(),lines=text.trim().split("\n"),headers=lines[0].split(",").map(h=>h.trim());
      const countries={};
      for(let i=1;i<lines.length;i++){const values=lines[i].split(","),row={};headers.forEach((h,idx)=>{row[h]=values[idx]?.trim();});const country=row.country;if(!country)continue;if(!countries[country])countries[country]={country,continent:row.continent,climate_zone:row.climate_zone,tempSum:0,prSum:0,spiSum:0,count:0};countries[country].tempSum+=Number(row.mean_temp_C);countries[country].prSum+=Number(row.mean_pr_mm_day);countries[country].spiSum+=Number(row.mean_spi);countries[country].count+=1;}
      COUNTRY_CLIMATES=Object.values(countries).map(d=>({country:d.country,continent:d.continent,climate_zone:d.climate_zone,temp:d.tempSum/d.count,pr:d.prSum/d.count,spi:d.spiSum/d.count}));
      update();
    }catch(err){console.error(err);if(similarName)similarName.textContent="Climate data not found";if(similarDesc)similarDesc.textContent="Make sure climate_agg_country.csv is in the same folder.";}
  }
  function normalizeTemp(temp){return Math.max(0,Math.min(100,((temp+35)/65)*100));}
  function normalizePrecip(pr){return Math.max(0,Math.min(100,(pr/12)*100));}
  function findMostSimilarClimates(userTemp,userPr,count=3){if(!COUNTRY_CLIMATES.length)return[];return COUNTRY_CLIMATES.map(c=>({...c,distance:Math.hypot(userTemp-normalizeTemp(c.temp),userPr-normalizePrecip(c.pr))})).sort((a,b)=>a.distance-b.distance).slice(0,count);}
  function update(){
    const t=+tempSlider.value,p=+prSlider.value;
    tempVal.textContent=labelFor(t,TEMP_LABELS); prVal.textContent=labelFor(p,PR_LABELS);
    const risk=computeRisk(t,p),level=LEVELS.find(l=>risk<l.max);
    dialFill.style.strokeDashoffset=(ARC_LEN*(1-risk)).toFixed(2); dialFill.style.stroke=level.color;
    dialNeedle.setAttribute('transform',`rotate(${(risk*180)-90},130,130)`);
    meterVerdict.textContent=level.label; meterVerdict.style.color=level.color;
    const mvt=document.getElementById('meter-verdict-top');if(mvt){mvt.textContent=level.label;mvt.style.color=level.color;}
    meterExample.textContent=level.example;
    const matches=findMostSimilarClimates(t,p);
    if(matches.length&&similarName&&similarDesc){similarName.textContent=matches[0].country;similarDesc.innerHTML=matches.map((m,i)=>`${i+1}. ${m.country} (${m.continent}) — ${m.temp.toFixed(1)}C, ${m.pr.toFixed(2)} mm/day`).join("<br>");}
  }
  tempSlider.addEventListener('input',update); prSlider.addEventListener('input',update);
  loadCountryClimateData(); update();
})();

/* ══════════════════════════════════════════════
   COUNTRY GLOBE LOOKUP
   ══════════════════════════════════════════════ */
(function () {
  let allCountries  = [];
  let countryYearly = {};
  let rankings      = [];
  let topoCountries = null;

  let scene, camera, renderer, globe, countriesMesh;
  let isDragging      = false;
  let prevMouse       = { x: 0, y: 0 };
  let rotationVel     = { x: 0, y: 0 };
  let autoRotate      = true;
  let autoRotateTimer = null;
  let userPaused      = false;
  let hoveredCountry  = null;
  let selectedCountry = null;

  const COL_OCEAN_HEX = '#8d96d0';
  const COL_LAND_HEX  = '#d4c9b5';

  async function loadLookupData() {
    const [summaryRes, yearlyRes] = await Promise.all([
      fetch('country_summary.csv'),
      fetch('climate_agg_country.csv'),
    ]);
    const summaryText = await summaryRes.text();
    const yearlyText  = await yearlyRes.text();

    const sLines = summaryText.trim().split('\n');
    const sHdrs  = sLines[0].split(',').map(h => h.trim());
    for (let i = 1; i < sLines.length; i++) {
      const vals = sLines[i].split(','), row = {};
      sHdrs.forEach((h, idx) => { row[h] = vals[idx]?.trim(); });
      if (!row.country) continue;
      allCountries.push({
        country:    row.country,
        continent:  row.continent,
        spi_change: parseFloat(row.spi_change),
        spi_base:   parseFloat(row.mean_spi_base),
        spi_mod:    parseFloat(row.mean_spi_mod),
        temp_base:  parseFloat(row.mean_temp_C_base),
      });
    }
    rankings = [...allCountries].sort((a, b) => a.spi_change - b.spi_change);
    populateRankLists();

    const yLines     = yearlyText.trim().split('\n');
    const yHdrs      = yLines[0].split(',').map(h => h.trim());
    const yearIdx    = yHdrs.indexOf('year');
    const countryIdx = yHdrs.indexOf('country');
    const spiIdx     = yHdrs.indexOf('mean_spi');
    for (let i = 1; i < yLines.length; i++) {
      const vals = yLines[i].split(',');
      if (vals.length < 4) continue;
      const country = vals[countryIdx]?.trim();
      const year    = parseInt(vals[yearIdx]);
      const spi     = parseFloat(vals[spiIdx]);
      if (!country || isNaN(year) || isNaN(spi)) continue;
      if (!countryYearly[country]) countryYearly[country] = [];
      countryYearly[country].push({ year, spi });
    }
  }

  function populateRankLists() {
    const worstEl = document.getElementById('rank-list-worst');
    const bestEl  = document.getElementById('rank-list-best');
    if (!worstEl || !bestEl) return;
    const worst = rankings.slice(0, 5);
    const best  = [...rankings].reverse().slice(0, 5);
    function makeItem(c) {
      const li = document.createElement('li');
      li.className = 'rank-list-item';
      const sign = c.spi_change >= 0 ? '+' : '';
      li.innerHTML = `<span class="rank-list-item-name">${c.country}</span><span class="rank-list-item-val">${sign}${c.spi_change.toFixed(2)} SPI</span>`;
      li.addEventListener('click', () => showResult(c.country));
      return li;
    }
    worst.forEach(c => worstEl.appendChild(makeItem(c)));
    best.forEach(c  => bestEl.appendChild(makeItem(c)));
  }

  function pointInPolygon(point, polygon) {
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function latLonToCountry(lat, lon) {
    if (!topoCountries) return null;
    for (const feature of topoCountries) {
      const geom = feature.geometry;
      const name = feature.properties?.name || '';
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
      for (const poly of polys) { if (pointInPolygon([lon, lat], poly[0])) return name; }
    }
    return null;
  }

  const NAME_MAP = {
    'United States of America':'United States','Russian Federation':'Russia','Iran (Islamic Republic of)':'Iran',
    'Venezuela (Bolivarian Republic of)':'Venezuela','Bolivia (Plurinational State of)':'Bolivia',
    'United Republic of Tanzania':'Tanzania','Korea, Republic of':'South Korea',
    "Korea, Democratic People's Republic of":'North Korea','Viet Nam':'Vietnam',
    'Syrian Arab Republic':'Syria',"Lao People's Democratic Republic":'Laos',
    'Congo, Democratic Republic of the':'DR Congo','Congo':'Republic of the Congo',
    "Cote d'Ivoire":'Ivory Coast','Burma':'Myanmar','Czech Republic':'Czechia',
    'Republic of Moldova':'Moldova','Swaziland':'Eswatini',
  };
  function normalizeName(n) { return NAME_MAP[n] || n; }

  function buildGlobeTexture(features) {
    const SIZE = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = COL_OCEAN_HEX;
    ctx.fillRect(0, 0, SIZE, SIZE);
    function lonLatToXY(lon, lat) { return [((lon+180)/360)*SIZE, ((90-lat)/180)*SIZE]; }
    function drawRing(ring, doFill, doStroke) {
      ctx.beginPath(); let first=true, prevX=null;
      for (const [lon, lat] of ring) {
        const [x, y] = lonLatToXY(lon, lat);
        if (!first && prevX !== null && Math.abs(x-prevX) > SIZE*0.4) {
          ctx.closePath(); if(doFill)ctx.fill(); if(doStroke)ctx.stroke(); ctx.beginPath(); first=true;
        }
        first ? ctx.moveTo(x,y) : ctx.lineTo(x,y); first=false; prevX=x;
      }
      ctx.closePath(); if(doFill)ctx.fill(); if(doStroke)ctx.stroke();
    }
    ctx.fillStyle = COL_LAND_HEX; ctx.strokeStyle='transparent';
    for (const f of features) {
      const polys = f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];
      for (const poly of polys) for (const ring of poly) drawRing(ring, true, false);
    }
    ctx.strokeStyle='rgba(139,94,60,0.55)'; ctx.lineWidth=1.2;
    for (const f of features) {
      const polys = f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];
      for (const poly of polys) for (const ring of poly) drawRing(ring, false, true);
    }
    return new THREE.CanvasTexture(canvas);
  }

  function buildOverlayTexture(features, hovered, selected, summaryMap) {
    const SIZE = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    function lonLatToXY(lon, lat) { return [((lon+180)/360)*SIZE, ((90-lat)/180)*SIZE]; }
    function drawFeature(feature, fillColor) {
      const geom = feature.geometry;
      const polys = geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
      ctx.fillStyle = fillColor;
      for (const poly of polys) {
        ctx.beginPath(); let first=true, prevX=null;
        for (const [lon, lat] of poly[0]) {
          const [x,y] = lonLatToXY(lon, lat);
          if (!first && prevX!==null && Math.abs(x-prevX)>SIZE*0.4) { ctx.closePath();ctx.fill();ctx.beginPath();first=true; }
          first?ctx.moveTo(x,y):ctx.lineTo(x,y); first=false; prevX=x;
        }
        ctx.closePath(); ctx.fill();
      }
    }
    for (const feature of features) {
      const rawName  = feature.properties?.name || '';
      const normName = normalizeName(rawName);
      if (normName === selected) {
        drawFeature(feature, 'rgba(139,94,60,0.85)');
      } else if (normName === hovered) {
        drawFeature(feature, 'rgba(200,75,26,0.6)');
      } else {
        const meta = summaryMap[normName];
        if (meta) {
          if (meta.spi_change < 0) {
            const intensity = Math.min(1, Math.abs(meta.spi_change) / 1.2);
            drawFeature(feature, `rgba(200,75,26,${0.08 + intensity * 0.42})`);
          } else if (meta.spi_change > 0.1) {
            const intensity = Math.min(1, meta.spi_change / 1.2);
            drawFeature(feature, `rgba(59,139,212,${0.08 + intensity * 0.38})`);
          }
        }
      }
    }
    return new THREE.CanvasTexture(canvas);
  }

  async function initGlobe() {
    const container = document.getElementById('globe-container');
    const canvasEl  = document.getElementById('globe-canvas');
    if (!container || !canvasEl) return;

    if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    if (!window.topojson) await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');

    const topoRes = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const topo    = await topoRes.json();
    const geoJSON = window.topojson.feature(topo, topo.objects.countries);

    const idToName = {
      4:"Afghanistan",8:"Albania",12:"Algeria",24:"Angola",32:"Argentina",36:"Australia",40:"Austria",31:"Azerbaijan",50:"Bangladesh",56:"Belgium",64:"Bhutan",68:"Bolivia",70:"Bosnia and Herzegovina",72:"Botswana",76:"Brazil",84:"Belize",100:"Bulgaria",104:"Myanmar",108:"Burundi",112:"Belarus",116:"Cambodia",120:"Cameroon",124:"Canada",132:"Cape Verde",140:"Central African Republic",144:"Sri Lanka",148:"Chad",152:"Chile",156:"China",170:"Colombia",178:"Republic of the Congo",180:"DR Congo",188:"Costa Rica",191:"Croatia",192:"Cuba",196:"Cyprus",203:"Czechia",204:"Benin",208:"Denmark",214:"Dominican Republic",218:"Ecuador",222:"El Salvador",231:"Ethiopia",232:"Eritrea",233:"Estonia",246:"Finland",250:"France",262:"Djibouti",266:"Gabon",268:"Georgia",276:"Germany",288:"Ghana",300:"Greece",320:"Guatemala",324:"Guinea",328:"Guyana",332:"Haiti",340:"Honduras",348:"Hungary",356:"India",360:"Indonesia",364:"Iran",368:"Iraq",372:"Ireland",376:"Israel",380:"Italy",384:"Ivory Coast",388:"Jamaica",392:"Japan",398:"Kazakhstan",400:"Jordan",404:"Kenya",408:"North Korea",410:"South Korea",414:"Kuwait",417:"Kyrgyzstan",418:"Laos",422:"Lebanon",426:"Lesotho",428:"Latvia",430:"Liberia",434:"Libya",440:"Lithuania",450:"Madagascar",454:"Malawi",458:"Malaysia",466:"Mali",478:"Mauritania",484:"Mexico",496:"Mongolia",498:"Moldova",504:"Morocco",508:"Mozambique",512:"Oman",516:"Namibia",524:"Nepal",528:"Netherlands",554:"New Zealand",558:"Nicaragua",562:"Niger",566:"Nigeria",578:"Norway",586:"Pakistan",591:"Panama",598:"Papua New Guinea",600:"Paraguay",604:"Peru",608:"Philippines",616:"Poland",620:"Portugal",634:"Qatar",642:"Romania",643:"Russia",646:"Rwanda",682:"Saudi Arabia",686:"Senegal",688:"Serbia",694:"Sierra Leone",703:"Slovakia",704:"Vietnam",705:"Slovenia",706:"Somalia",710:"South Africa",716:"Zimbabwe",724:"Spain",728:"South Sudan",729:"Sudan",740:"Suriname",748:"Eswatini",752:"Sweden",756:"Switzerland",760:"Syria",762:"Tajikistan",764:"Thailand",768:"Togo",788:"Tunisia",792:"Turkey",800:"Uganda",804:"Ukraine",818:"Egypt",826:"United Kingdom",834:"Tanzania",840:"United States",854:"Burkina Faso",858:"Uruguay",860:"Uzbekistan",862:"Venezuela",887:"Yemen",894:"Zambia",51:"Armenia",10:"Antarctica",275:"Palestine",
    };

    for (const feature of geoJSON.features) {
      const id = parseInt(feature.id, 10);
      feature.properties = feature.properties || {};
      feature.properties.name = idToName[id] || '';
    }
    topoCountries = geoJSON.features;

    const summaryMap = {};
    for (const c of allCountries) summaryMap[c.country] = c;

    const W = container.getBoundingClientRect().width  || 520;
    const H = container.getBoundingClientRect().height || 520;

    const DEFAULT_Z   = 3.8;
    const MIN_Z       = 1.8;
    const MAX_Z       = 6.0;
    let   currentScale = 1.0;

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.z = DEFAULT_Z;

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const baseTex = buildGlobeTexture(topoCountries);
    globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ map: baseTex, specular: new THREE.Color(0x2a1a0a), shininess: 12 })
    );
    scene.add(globe);

    const overlayTex = buildOverlayTexture(topoCountries, null, null, summaryMap);
    countriesMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.001, 64, 64),
      new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, opacity: 1, depthWrite: false })
    );
    scene.add(countriesMesh);

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5e8d0), transparent: true, opacity: 0.08, side: THREE.BackSide })
    ));

    const ambient = new THREE.AmbientLight(0xf5f0e8, 0.45); scene.add(ambient);
    const sun     = new THREE.DirectionalLight(0xfff5e8, 0.7); sun.position.set(3,2,3); scene.add(sun);
    const fill    = new THREE.DirectionalLight(0xe8d4b8, 0.15); fill.position.set(-3,-1,-2); scene.add(fill);

    function animate() {
      requestAnimationFrame(animate);
      if (autoRotate) {
        globe.rotation.y += 0.0018;
        countriesMesh.rotation.y = globe.rotation.y;
        countriesMesh.rotation.x = globe.rotation.x;
      }
      if (!isDragging && !autoRotate) {
        globe.rotation.y += rotationVel.y;
        globe.rotation.x += rotationVel.x;
        countriesMesh.rotation.y = globe.rotation.y;
        countriesMesh.rotation.x = globe.rotation.x;
        rotationVel.x *= 0.92;
        rotationVel.y *= 0.92;
        if (Math.abs(rotationVel.x) < 0.0001 && Math.abs(rotationVel.y) < 0.0001) {
          if (!userPaused) autoRotateTimer = setTimeout(() => { autoRotate = true; }, 2000);
        }
      }
      renderer.render(scene, camera);
    }
    animate();

    const raycaster = new THREE.Raycaster();
    const mouse2D   = new THREE.Vector2();
    const tooltipEl = document.getElementById('globe-tooltip');

    function getLatLon(intersection) {
      const p = intersection.point.clone();
      p.applyQuaternion(globe.quaternion.clone().invert());
      const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, p.y))) * 180) / Math.PI;
      let lon = (Math.atan2(p.z, -p.x) * 180) / Math.PI - 180;
      lon = ((lon + 540) % 360) - 180;
      return { lat, lon };
    }

    function hitTest(clientX, clientY) {
      const rect = canvasEl.getBoundingClientRect();
      mouse2D.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      mouse2D.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse2D, camera);
      const hits = raycaster.intersectObject(globe);
      return hits.length ? getLatLon(hits[0]) : null;
    }

    function updateOverlay() {
      const newTex = buildOverlayTexture(topoCountries, hoveredCountry, selectedCountry, summaryMap);
      countriesMesh.material.map.dispose();
      countriesMesh.material.map = newTex;
      countriesMesh.material.needsUpdate = true;
    }

    canvasEl.addEventListener('mousedown', e => {
      isDragging  = true;
      prevMouse   = { x: e.clientX, y: e.clientY };
      clearTimeout(autoRotateTimer);
      autoRotate  = false;
      rotationVel = { x: 0, y: 0 };
    });

    window.addEventListener('mousemove', e => {
      if (isDragging) {
        const dx = e.clientX - prevMouse.x, dy = e.clientY - prevMouse.y;
        rotationVel.y = dx * 0.005; rotationVel.x = dy * 0.005;
        globe.rotation.y += rotationVel.y;
        globe.rotation.x  = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x + rotationVel.x));
        countriesMesh.rotation.y = globe.rotation.y;
        countriesMesh.rotation.x = globe.rotation.x;
        prevMouse = { x: e.clientX, y: e.clientY };
        tooltipEl.classList.remove('visible');
      } else {
        const ll = hitTest(e.clientX, e.clientY);
        if (ll) {
          const name = normalizeName(latLonToCountry(ll.lat, ll.lon) || '');
          if (name && name !== hoveredCountry) { hoveredCountry = name; updateOverlay(); }
          if (name) {
            const rect = canvasEl.getBoundingClientRect();
            tooltipEl.textContent = name;
            tooltipEl.style.left = (e.clientX - rect.left) + 'px';
            tooltipEl.style.top  = (e.clientY - rect.top)  + 'px';
            tooltipEl.classList.add('visible');
          } else { tooltipEl.classList.remove('visible'); }
        } else {
          hoveredCountry = null;
          tooltipEl.classList.remove('visible');
        }
      }
    });

    window.addEventListener('mouseup', e => {
      if (!isDragging) return;
      const dx = Math.abs(e.clientX - prevMouse.x), dy = Math.abs(e.clientY - prevMouse.y);
      isDragging = false;
      if (dx < 4 && dy < 4) {
        const ll = hitTest(e.clientX, e.clientY);
        if (ll) {
          const rawName = latLonToCountry(ll.lat, ll.lon);
          if (rawName) {
            selectedCountry = normalizeName(rawName);
            hoveredCountry  = null;
            updateOverlay();
            tooltipEl.classList.remove('visible');
            showResult(selectedCountry);
          }
        }
      }
      clearTimeout(autoRotateTimer);
      if (!userPaused) autoRotateTimer = setTimeout(() => { autoRotate = true; }, 3000);
    });

    let lastTouch = null, lastPinchDist = null;

    canvasEl.addEventListener('touchstart', e => {
      e.preventDefault();
      clearTimeout(autoRotateTimer);
      autoRotate  = false;
      rotationVel = { x: 0, y: 0 };
      if (e.touches.length === 1) {
        isDragging = true;
        lastTouch  = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      } else if (e.touches.length === 2) {
        isDragging    = false;
        lastTouch     = null;
        lastPinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      }
    }, { passive: false });

    canvasEl.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinchDist !== null) {
        const dist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
        const newZ = Math.max(MIN_Z, Math.min(MAX_Z, camera.position.z + (lastPinchDist-dist)*0.01));
        camera.position.z = newZ;
        currentScale = DEFAULT_Z / newZ;
        globe.scale.setScalar(currentScale);
        countriesMesh.scale.setScalar(currentScale);
        lastPinchDist = dist;
        return;
      }
      if (e.touches.length !== 1 || !isDragging || !lastTouch) return;
      const dx = e.touches[0].clientX - lastTouch.x, dy = e.touches[0].clientY - lastTouch.y;
      rotationVel.y = dx * 0.005; rotationVel.x = dy * 0.005;
      globe.rotation.y += rotationVel.y;
      globe.rotation.x  = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x + rotationVel.x));
      countriesMesh.rotation.y = globe.rotation.y;
      countriesMesh.rotation.x = globe.rotation.x;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    }, { passive: false });

    canvasEl.addEventListener('touchend', e => {
      if (lastTouch && Date.now() - lastTouch.time < 200) {
        const ll = hitTest(lastTouch.x, lastTouch.y);
        if (ll) {
          const rawName = latLonToCountry(ll.lat, ll.lon);
          if (rawName) { selectedCountry = normalizeName(rawName); updateOverlay(); showResult(selectedCountry); }
        }
      }
      isDragging = false; lastTouch = null; lastPinchDist = null;
      clearTimeout(autoRotateTimer);
      if (!userPaused) autoRotateTimer = setTimeout(() => { autoRotate = true; }, 3000);
    }, { passive: true });

    canvasEl.addEventListener('wheel', e => {
      e.preventDefault();
      e.stopPropagation();
      const newZ = Math.max(MIN_Z, Math.min(MAX_Z, camera.position.z + e.deltaY * 0.008));
      camera.position.z = newZ;
      currentScale = DEFAULT_Z / newZ;
      globe.scale.setScalar(currentScale);
      countriesMesh.scale.setScalar(currentScale);
    }, { passive: false });

    window.addEventListener('resize', () => {
      const W = container.clientWidth, H = container.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });

    const spinBtn = document.getElementById('globe-spin-toggle');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => {
        userPaused = !userPaused;
        autoRotate = !userPaused;
        spinBtn.textContent = userPaused ? '> Spin' : 'II Pause';
        if (userPaused) clearTimeout(autoRotateTimer);
      });
    }

    document.getElementById('globe-reset')?.addEventListener('click', () => {
      camera.position.z = DEFAULT_Z;
      currentScale = 1.0;
      globe.scale.setScalar(1.0);
      countriesMesh.scale.setScalar(1.0);
      globe.rotation.x = 0; globe.rotation.y = 0;
      countriesMesh.rotation.x = 0; countriesMesh.rotation.y = 0;
      rotationVel = { x: 0, y: 0 };
      userPaused = false; autoRotate = true;
      if (spinBtn) spinBtn.textContent = 'II Pause';
      selectedCountry = null; hoveredCountry = null;
      updateOverlay();
      document.getElementById('lookup-result').innerHTML = '';
    });
  }

  async function showResult(countryName) {
    const resultEl = document.getElementById('lookup-result');
    if (!resultEl) return;
    const data = allCountries.find(c => c.country.toLowerCase() === countryName.toLowerCase())
              || allCountries.find(c => c.country.toLowerCase().includes(countryName.toLowerCase()));
    if (!data) {
      resultEl.innerHTML = `<div class="lookup-not-found">No drought data found for <strong>${countryName}</strong>.</div>`;
      return;
    }
    const rank       = rankings.findIndex(c => c.country === data.country) + 1;
    const total      = rankings.length;
    const trend      = data.spi_change < 0 ? 'worsening' : 'improving';
    const trendSign  = data.spi_change < 0 ? '' : '+';
    const timeSeries = (countryYearly[data.country] || []).sort((a, b) => a.year - b.year);

    resultEl.innerHTML = `
      <div class="lookup-card">
        <div class="lookup-card-left">
          <div>
            <div class="lookup-card-continent">${data.continent}</div>
            <div class="lookup-card-country">${data.country}</div>
          </div>
          <div class="lookup-rank-badge">
            <span class="lookup-rank-num">#${rank}</span>
            <span class="lookup-rank-label">of ${total} most worsening drought</span>
          </div>
          <div class="lookup-stats-grid">
            <div class="lookup-stat-cell"><span class="lookup-stat-val">${data.spi_base.toFixed(2)}</span><span class="lookup-stat-lbl">Baseline SPI</span></div>
            <div class="lookup-stat-cell"><span class="lookup-stat-val">${data.spi_mod.toFixed(2)}</span><span class="lookup-stat-lbl">Modern SPI</span></div>
            <div class="lookup-stat-cell"><span class="lookup-stat-val">${data.temp_base.toFixed(1)}C</span><span class="lookup-stat-lbl">Mean Temp</span></div>
            <div class="lookup-stat-cell"><span class="lookup-stat-val">${trendSign}${data.spi_change.toFixed(2)}</span><span class="lookup-stat-lbl">SPI Change</span></div>
          </div>
          <div class="lookup-trend-badge ${trend}">
            ${trend === 'worsening' ? 'Drought worsening' : 'Drought improving'}
          </div>
        </div>
        <div class="lookup-card-right">
          <div class="lookup-chart-title">SPI over time 1850-2014</div>
          <div class="lookup-chart-wrap"><svg id="lookup-spi-svg"></svg></div>
        </div>
      </div>`;

    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (timeSeries.length > 0) drawLookupChart(timeSeries, data.spi_change);
  }

  async function drawLookupChart(series, spiChange) {
    if (typeof d3 === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
    const svgEl = document.getElementById('lookup-spi-svg');
    if (!svgEl) return;
    const W = svgEl.clientWidth || 520, H = svgEl.clientHeight || 260;
    const margin = { top: 20, right: 16, bottom: 36, left: 44 };
    const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;
    const svg = d3.select(svgEl); svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain(d3.extent(series, d => d.year)).range([0, iW]);
    const yExtent = d3.extent(series, d => d.spi);
    const y = d3.scaleLinear().domain([Math.min(yExtent[0],-2.5), Math.max(yExtent[1],1.5)]).range([iH, 0]);
    g.append('rect').attr('x',0).attr('y',y(-1.0)).attr('width',iW).attr('height',iH-y(-1.0)).attr('fill','rgba(200,75,26,0.07)');
    g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat('')).call(gg=>{gg.select('.domain').remove();gg.selectAll('line').attr('stroke','rgba(139,94,60,0.1)');});
    const xA=g.append('g').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));
    xA.select('.domain').attr('stroke','rgba(139,94,60,0.2)');xA.selectAll('text').style('font-family',"'Montserrat',sans-serif").style('font-size','9px').style('fill','#7a6248');xA.selectAll('line').attr('stroke','rgba(139,94,60,0.2)');
    const yA=g.append('g').call(d3.axisLeft(y).ticks(5));
    yA.select('.domain').attr('stroke','rgba(139,94,60,0.2)');yA.selectAll('text').style('font-family',"'Montserrat',sans-serif").style('font-size','9px').style('fill','#7a6248');yA.selectAll('line').attr('stroke','rgba(139,94,60,0.2)');
    g.append('line').attr('x1',0).attr('x2',iW).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','rgba(139,94,60,0.25)').attr('stroke-width',1);
    g.append('line').attr('x1',0).attr('x2',iW).attr('y1',y(-1.0)).attr('y2',y(-1.0)).attr('stroke','rgba(200,75,26,0.55)').attr('stroke-width',1).attr('stroke-dasharray','4 3');
    g.append('text').attr('x',iW-2).attr('y',y(-1.0)-4).attr('text-anchor','end').style('font-family',"'Montserrat',sans-serif").style('font-size','8px').style('fill','rgba(200,75,26,0.7)').text('SPI = -1.0 drought threshold');
    g.append('path').datum(series).attr('d',d3.area().x(d=>x(d.year)).y0(y(0)).y1(d=>y(Math.min(0,d.spi))).curve(d3.curveBasis)).attr('fill',spiChange<0?'rgba(200,75,26,0.12)':'rgba(59,139,212,0.1)');
    const n=series.length,sumX=d3.sum(series,d=>d.year),sumY=d3.sum(series,d=>d.spi),sumXY=d3.sum(series,d=>d.year*d.spi),sumX2=d3.sum(series,d=>d.year*d.year);
    const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX),intercept=(sumY-slope*sumX)/n;
    const xMin=d3.min(series,d=>d.year),xMax=d3.max(series,d=>d.year);
    g.append('line').attr('x1',x(xMin)).attr('y1',y(slope*xMin+intercept)).attr('x2',x(xMax)).attr('y2',y(slope*xMax+intercept)).attr('stroke',spiChange<0?'rgba(200,75,26,0.6)':'rgba(59,139,212,0.6)').attr('stroke-width',1.5).attr('stroke-dasharray','6 3');
    const path=g.append('path').datum(series).attr('d',d3.line().x(d=>x(d.year)).y(d=>y(d.spi)).curve(d3.curveBasis)).attr('fill','none').attr('stroke',spiChange<0?'#c84b1a':'#3b8bd4').attr('stroke-width',1.8);
    const len=path.node().getTotalLength();
    path.attr('stroke-dasharray',`${len} ${len}`).attr('stroke-dashoffset',len).transition().duration(1200).ease(d3.easeLinear).attr('stroke-dashoffset',0);
  }

  async function boot() {
    await loadLookupData();
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { observer.disconnect(); initGlobe(); }
    }, { rootMargin: '200px' });
    const section = document.getElementById('slide-lookup');
    if (section) observer.observe(section);
  }

  boot();
})();