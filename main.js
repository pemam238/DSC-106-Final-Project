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
  { id: 'slide-why', label: 'Why It Matters' },
  { id: 'slide-climate',     label: 'Build a Climate' },
  { id: 'slide-lookup',      label: 'Country Lookup' },
  { id: 'slide-outro',       label: 'Takeaway' },
];

chapterDots.forEach(dot => {
  dot.addEventListener('click', () => {
    const target = document.getElementById(dot.dataset.target);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'smooth' });
    }
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
const MAP_STEPS = [0, 0.33, 0.66];

const STEP_LABELS = [
  `<strong style="color:#6b0a0a">Drought is not limited to places that appear dry.</strong><br><span>In this visualization, we calculated the mean temperature of countries over 164 years (1850-2014) to visualize the effects of temperature on the SPI Index between hot and cold places. Scroll through to see the entire story.<br><br></span>`,
  `<strong style="color:#6b0a0a">Drought is not limited to places that appear dry.</strong><br><span>In this visualization, we calculated the mean temperature of countries over 164 years (1850-2014) to visualize the effects of temperature on the SPI Index between hot and cold places. Scroll through to see the entire story.<br><br></span>`,
  `<strong style="color:#6b0a0a">Drought is not limited to places that appear dry.</strong><br><span>In this visualization, we calculated the mean temperature of countries over 164 years (1850-2014) to visualize the effects of temperature on the SPI Index between hot and cold places. Scroll through to see the entire story.<br><br></span>`
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
    if(mapStep>=1) valHtml+=`<div class="tt-val">SPI ${meta.spi_base.toFixed(2)}</div>`;
    if(mapStep>=2) valHtml+=`<div class="tt-val">SPI change: ${meta.spi_change>=0?'+':''}${meta.spi_change.toFixed(2)}</div>`;
    if(mapStep>=1&&isCold) valHtml+=`<div class="tt-val" style="color:#8B5E3C;font-weight:700">Click to explore</div>`;
    tooltip.innerHTML=`<div class="tt-name">${name}</div>${valHtml}`;
    tooltip.style.left=(e.clientX+14)+"px"; tooltip.style.top=(e.clientY-10)+"px";
    tooltip.classList.add("visible");
  });
  svg.addEventListener("mouseleave",()=>tooltip.classList.remove("visible"));
  mapStep=-1; applyMapStep(0);
}

function updateLegend(mode) {
  const legend=document.getElementById("map-legend"),bar=document.getElementById("legend-bar"),label=document.getElementById("legend-label"),minEl=document.getElementById("legend-min"),maxEl=document.getElementById("legend-max");
  if(!legend) return;
  legend.classList.add("visible");
  if(mode==="temp"){label.textContent="Mean Temperature";bar.style.background=`linear-gradient(to right,${tempColor(-30)},${tempColor(0)},${tempColor(30)})`;minEl.textContent="-30°C";maxEl.textContent="30°C";}
  else if(mode==="spi"){label.textContent="SPI Drought Deficit";bar.style.background=`linear-gradient(to right,${spiColor(-1.5)},${spiColor(0)},${spiColor(1.5)})`;minEl.textContent="-1.5 Severe drought";maxEl.textContent="+1.5 Wet";}
  else if(mode==="spi_change"){label.textContent="SPI Change (baseline to modern)";bar.style.background=`linear-gradient(to right,${spiChangeColor(-1)},${spiChangeColor(0)},${spiChangeColor(1)})`;minEl.textContent="Worsening drought";maxEl.textContent="Improving";}
}

function attachColdDroughtClicks() {
  if (clickListenersAttached) return; clickListenersAttached=true;
  COLD_DROUGHT_COUNTRIES.forEach(name=>{
    const meta=countryMeta[name]; if(!meta?.el) return;
    meta.el.addEventListener("click",()=>{ if(mapStep<1)return; showColdDroughtInfo(name); });
  });
}

function showColdDroughtInfo(name) {
  const info=COLD_DROUGHT_INFO[name], meta=countryMeta[name]; if(!info)return;
  const spiVal=meta?.spi_base!==undefined?`SPI ${meta.spi_base.toFixed(2)}`:info.spi;
  const tempVal=meta?.temp_base!==undefined?`Mean temp: ${meta.temp_base.toFixed(1)}°C`:info.temp;
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
  if(!box) return;
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
  if (labelEl) {
    labelEl.style.opacity="0";
    setTimeout(()=>{labelEl.innerHTML=STEP_LABELS[step]||"";labelEl.style.opacity="1";},300);
  }
  
  if(step===0){
    updateLegend("temp");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue; meta.el.setAttribute("fill",tempColor(meta.temp_base??15)); meta.el.style.cursor="default";
      const isHot=HOT_DROUGHT_COUNTRIES.includes(name);
      if(isHot){meta.el.style.opacity="1";meta.el.setAttribute("stroke",tempColor(meta.temp_base??25));meta.el.setAttribute("stroke-width","2");meta.el.style.filter="drop-shadow(0 0 8px rgba(200,60,20,0.7))";}
      else{meta.el.style.opacity="0.18";meta.el.setAttribute("stroke","rgba(255,255,255,0.05)");meta.el.setAttribute("stroke-width","0.3");meta.el.style.filter="";}
    }
    setInfoBox(`<div class="cib-label">Where drought is expected</div><div class="cib-name">Hot & Dry</div><div class="cib-divider"></div><div class="cib-body">Regions with this climate include Mali, Egypt, Saudi Arabia, Libya, and Mauritania — all hot, all dry, all obvious candidates for drought.<br><br>Temperatures above <strong>25°C</strong>. Precipitation near zero. This is the picture most people have.<br><br><em style="color:#8B5E3C">Scroll on — the map is about to change.</em></div>`);
  } else if(step===1){
    updateLegend("spi");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue;
      const col=spiColor(meta.spi_base);
      meta.el.setAttribute("fill",col);
      const isCold=COLD_DROUGHT_COUNTRIES.includes(name), isHot=HOT_DROUGHT_COUNTRIES.includes(name);
      if(isCold||isHot){meta.el.style.opacity="1";meta.el.setAttribute("stroke",col);meta.el.setAttribute("stroke-width","2");meta.el.style.filter=`drop-shadow(0 0 8px ${col})`;meta.el.style.cursor=isCold?"pointer":"default";}
      else{meta.el.style.opacity="0.3";meta.el.setAttribute("stroke","rgba(255,255,255,0.08)");meta.el.setAttribute("stroke-width","0.3");meta.el.style.filter="";meta.el.style.cursor="default"}
    }
    attachColdDroughtClicks();
    setInfoBox(`<div class="cib-label">Now look at SPI</div><div class="cib-name">Cold Drought</div><div class="cib-divider"></div><div class="cib-body">The hot deserts are still red. But now cold and temperate regions are glowing too.<br><br>Kazakhstan. Mongolia. Russia. Argentina. The United States Great Basin.<br><br><em style="color:#8B5E3C">Click any highlighted country to explore its drought story.</em></div>`);
  } else if(step===2){
    updateLegend("spi_change");
    for(const[name,meta]of Object.entries(countryMeta)){
      if(!meta.el)continue;
      const col=spiChangeColor(meta.spi_change);
      meta.el.setAttribute("fill",col);
      const isCold=COLD_DROUGHT_COUNTRIES.includes(name), isHot=HOT_DROUGHT_COUNTRIES.includes(name);
      if(isCold||isHot){meta.el.style.opacity="1";meta.el.setAttribute("stroke",col);meta.el.setAttribute("stroke-width","2");meta.el.style.filter=`drop-shadow(0 0 8px ${col})`;meta.el.style.cursor=isCold?"pointer":"default";}
      else{meta.el.style.opacity="0.3";meta.el.setAttribute("stroke","rgba(255,255,255,0.08)");meta.el.setAttribute("stroke-width","0.3");meta.el.style.filter="";meta.el.style.cursor="default"}
    }
    attachColdDroughtClicks();
    setInfoBox(`<div class="cib-label">SPI is changing</div><div class="cib-name">Drought Trends</div><div class="cib-divider"></div><div class="cib-body">Red means drought is intensifying — SPI is falling further below normal.<br><br>Some of the sharpest declines are in cold or temperate regions that were never thought of as drought-prone.<br><br><em style="color:#8B5E3C">Click any highlighted country to explore.</em></div>`);
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
    if(e.key==='ArrowLeft')goTo(currentSlide-1);
    if(e.key==='ArrowRight')goTo(currentSlide+1);
  });
})();