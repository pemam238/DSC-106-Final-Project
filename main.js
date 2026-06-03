/* ───────────────────────────────────────────────
   SCROLL LOCK & PANEL LOGIC (Slide 2)
   ─────────────────────────────────────────────── */
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
  if (!buttonPressed) {
    if (isOnSlide2()) {
      const track = document.getElementById('slide-2-track');
      window.scrollTo({ top: track.offsetTop, behavior: 'instant' });
    }
    return;
  }
  drivePanels();
  driveMap();      // Map scrollytelling
  driveSpi();      // SPI rain dots
});

document.querySelector('.scroll-arrow')?.addEventListener('click', () => {
  document.getElementById('slide-2-track').scrollIntoView({ behavior: 'smooth' });
});

function chooseClimate(choice) {
  // choice can be 'hot' or 'cold' – not used for logic but kept for consistency
  document.getElementById('reveal-overlay').classList.add('visible');
  const halves = document.getElementById('hot-cold-halves');
  halves.style.opacity = '0';
  halves.style.pointerEvents = 'none';
  buttonPressed = true;
  drivePanels();
}

// Add click listeners to the half divs
document.querySelectorAll('.half').forEach(half => {
  half.addEventListener('click', () => {
    if (buttonPressed) return;
    const choice = half.getAttribute('data-choice');
    chooseClimate(choice);
  });
});

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

/* ══════════════════════════════════════════════
   SLIDE 3 — WORLD MAP SCROLLYTELLING (from original)
   ══════════════════════════════════════════════ */
const MAP_STEPS = [0, 0.12, 0.22, 0.33, 0.44, 0.55, 0.66, 0.78];

const STEP_LABELS = [
  `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone‑dry deserts to monsoon‑soaked mountains.</span>`,
  `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone‑dry deserts to monsoon‑soaked mountains.</span>`,
  `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone‑dry deserts to monsoon‑soaked mountains.</span>`,
  `<strong>WHERE THEY MEET</strong><br><span>Heat and rain overlaid across every country — revealing where climates are hot‑and‑dry, cold‑and‑wet, or somewhere between. The gap between what falls and what's expected is exactly where drought hides.</span>`,
  `<strong>WHERE THEY MEET</strong><br><span>Heat and rain overlaid across every country — revealing where climates are hot‑and‑dry, cold‑and‑wet, or somewhere between. The gap between what falls and what's expected is exactly where drought hides.</span>`,
];

const COUNTRY_DATA = {
  "Mali":       { temp: 29.1,  pr: 0.52, spi: -0.85 },
  "Antarctica": { temp: -28.9, pr: 0.14, spi: -0.12 },
  "Myanmar":    { temp: 24.3,  pr: 7.18, spi:  0.31 },
  "Egypt":      { temp: 25.8,  pr: 0.07, spi: -0.92 },
};

const HIGHLIGHT_COUNTRIES = {
  1: ["Mali"],
  2: ["Antarctica"],
  4: ["Myanmar"],
  5: ["Egypt"],
  7: ["Mali","Antarctica","Myanmar","Egypt"],
};

const INFO_CONTENT = {
  "Mali": {
    label: "Hottest Country",
    stat: "29.1°C",
    unit: "Mean annual temperature",
    color: "rgb(200,60,20)",
    body: "Mali's position in the Sahel and Sahara makes it the single hottest‑averaging country in the dataset. Sparse vegetation amplifies radiative heating.",
  },
  "Antarctica": {
    label: "Coldest Region",
    stat: "−28.9°C",
    unit: "Mean annual temperature",
    color: "rgb(80,120,180)",
    body: "High elevation, polar location, and a year‑round ice sheet that reflects nearly all incoming sunlight combine to make Antarctica the coldest landmass on Earth.",
  },
  "Myanmar": {
    label: "Among the Wettest",
    stat: "7.18 mm/day",
    unit: "Mean daily precipitation",
    color: "rgb(30,100,180)",
    body: "Southwest monsoon winds drop enormous moisture loads against Myanmar's mountain ranges from May through October, producing one of the world's highest national rainfall averages.",
  },
  "Egypt": {
    label: "One of the Driest",
    stat: "0.07 mm/day",
    unit: "Mean daily precipitation",
    color: "rgb(180,70,30)",
    body: "Rain almost never falls in Egypt. The country owes its agriculture entirely to the Nile. Its mean SPI of −0.92 marks persistent hydrological drought.",
  },
};

function tempColor(tempC) {
  const t = Math.max(0, Math.min(1, (tempC + 30) / 62));
  const r = Math.round(245 - t * (245 - 153));
  const g = Math.round(235 - t * (235 - 15));
  const b = Math.round(230 - t * (230 - 2));
  return `rgb(${r},${g},${b})`;
}

function prColor(prMm) {
  const t = Math.max(0, Math.min(1, prMm / 9));
  const r = Math.round(235 - t * (235 - 10));
  const g = Math.round(240 - t * (240 - 20));
  const b = Math.round(245 - t * (245 - 80));
  return `rgb(${r},${g},${b})`;
}

function overlayColor(tempC, prMm) {
  const tT = Math.max(0, Math.min(1, (tempC + 30) / 62));
  const tP = Math.max(0, Math.min(1, prMm / 9));
  const r = Math.round(10  + tT * (153 - 10)  - tP * (10 * tT));
  const g = Math.round(31  + tT * (15  - 31)  - tP * (15 * tT));
  const b = Math.round(74  + tT * (2   - 74)  + tP * (80 * (1 - tT)));
  return `rgb(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))})`;
}

let mapLoaded = false;
let mapStep = -1;
let countryMeta = {};

async function initMap() {
  if (mapLoaded) return;
  mapLoaded = true;

  const [topoRes, csvRes] = await Promise.all([
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    fetch("climate_agg_country.csv"),
  ]);
  const topo = await topoRes.json();
  const csvText = await csvRes.text();

  // Parse CSV → country means
  const rows = csvText.trim().split("\n").slice(1);
  const sums = {}, counts = {};
  for (const row of rows) {
    const [year, country, , , temp, pr, spi] = row.split(",");
    if (!country) continue;
    const name = country.replace(/^"|"$/g, "").trim();
    if (!sums[name]) { sums[name] = { temp: 0, pr: 0, spi: 0 }; counts[name] = 0; }
    sums[name].temp += parseFloat(temp) || 0;
    sums[name].pr   += parseFloat(pr)   || 0;
    sums[name].spi  += parseFloat(spi)  || 0;
    counts[name]++;
  }
  for (const name in sums) {
    const n = counts[name];
    countryMeta[name] = {
      temp: sums[name].temp / n,
      pr:   sums[name].pr   / n,
      spi:  sums[name].spi  / n,
    };
  }
  for (const [k, v] of Object.entries(COUNTRY_DATA)) {
    if (!countryMeta[k]) countryMeta[k] = v;
  }

  const countries = topojson.feature(topo, topo.objects.countries).features;

  // Natural Earth numeric ID → CSV country name
  const idToName = {
    4:"Afghanistan", 8:"Albania", 12:"Algeria", 24:"Angola", 32:"Argentina",
    36:"Australia", 40:"Austria", 31:"Azerbaijan", 50:"Bangladesh",
    56:"Belgium", 64:"Bhutan", 68:"Bolivia", 70:"Bosnia and Herzegovina",
    72:"Botswana", 76:"Brazil", 84:"Belize", 100:"Bulgaria", 104:"Myanmar",
    108:"Burundi", 112:"Belarus", 116:"Cambodia", 120:"Cameroon",
    124:"Canada", 132:"Cape Verde", 140:"Central African Republic",
    144:"Sri Lanka", 148:"Chad", 152:"Chile", 156:"China", 170:"Colombia",
    178:"Republic of the Congo", 180:"DR Congo", 188:"Costa Rica",
    191:"Croatia", 192:"Cuba", 196:"Cyprus", 203:"Czechia", 204:"Benin",
    208:"Denmark", 214:"Dominican Republic", 218:"Ecuador", 222:"El Salvador",
    231:"Ethiopia", 232:"Eritrea", 233:"Estonia", 246:"Finland",
    250:"France", 262:"Djibouti", 266:"Gabon", 268:"Georgia",
    276:"Germany", 288:"Ghana", 300:"Greece", 308:"Grenada",
    320:"Guatemala", 324:"Guinea", 328:"Guyana", 332:"Haiti",
    340:"Honduras", 348:"Hungary", 356:"India", 360:"Indonesia",
    364:"Iran", 368:"Iraq", 372:"Ireland", 376:"Israel", 380:"Italy",
    384:"Ivory Coast", 388:"Jamaica", 392:"Japan", 398:"Kazakhstan",
    400:"Jordan", 404:"Kenya", 408:"North Korea", 410:"South Korea",
    414:"Kuwait", 417:"Kyrgyzstan", 418:"Laos", 422:"Lebanon",
    426:"Lesotho", 428:"Latvia", 430:"Liberia", 434:"Libya",
    440:"Lithuania", 450:"Madagascar", 454:"Malawi", 458:"Malaysia",
    466:"Mali", 478:"Mauritania", 480:"Mauritius", 484:"Mexico",
    496:"Mongolia", 498:"Moldova", 499:"Montenegro", 504:"Morocco",
    508:"Mozambique", 512:"Oman", 516:"Namibia", 524:"Nepal",
    528:"Netherlands", 540:"New Caledonia", 554:"New Zealand",
    558:"Nicaragua", 562:"Niger", 566:"Nigeria", 578:"Norway",
    586:"Pakistan", 591:"Panama", 598:"Papua New Guinea", 600:"Paraguay",
    604:"Peru", 608:"Philippines", 616:"Poland", 620:"Portugal",
    624:"Guinea-Bissau", 626:"Timor-Leste", 634:"Qatar", 642:"Romania",
    643:"Russia", 646:"Rwanda", 678:"Sao Tome and Principe",
    682:"Saudi Arabia", 686:"Senegal", 688:"Serbia", 694:"Sierra Leone",
    703:"Slovakia", 704:"Vietnam", 705:"Slovenia", 706:"Somalia",
    710:"South Africa", 716:"Zimbabwe", 724:"Spain", 728:"South Sudan",
    729:"Sudan", 740:"Suriname", 748:"Eswatini", 752:"Sweden",
    756:"Switzerland", 760:"Syria", 762:"Tajikistan", 764:"Thailand",
    768:"Togo", 776:"Tonga", 780:"Trinidad and Tobago", 784:"United Arab Emirates",
    788:"Tunisia", 792:"Turkey", 800:"Uganda", 804:"Ukraine",
    807:"North Macedonia", 818:"Egypt", 826:"United Kingdom",
    834:"Tanzania", 840:"United States", 854:"Burkina Faso",
    858:"Uruguay", 860:"Uzbekistan", 862:"Venezuela", 887:"Yemen",
    894:"Zambia", 51:"Armenia", 10:"Antarctica", 90:"Solomon Islands",
    275:"Palestine", 548:"Vanuatu",
  };

  function project([lon, lat]) {
    const x = (lon + 180) / 360 * 960;
    const y = (90 - lat) / 180 * 500;
    return [x, y];
  }

  function coordsToPath(geometry) {
    function ringToD(ring) {
      const segments = [];
      let current = [];
      for (let i = 0; i < ring.length; i++) {
        if (i > 0 && Math.abs(ring[i][0] - ring[i-1][0]) > 180) {
          if (current.length > 1) segments.push(current);
          current = [];
        }
        current.push(ring[i]);
      }
      if (current.length > 1) segments.push(current);
      return segments.map(seg =>
        seg.map((pt, i) => {
          const [x, y] = project(pt);
          return (i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`);
        }).join(" ") + " Z"
      ).join(" ");
    }
    if (geometry.type === "Polygon") return geometry.coordinates.map(ringToD).join(" ");
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map(poly => poly.map(ringToD).join(" ")).join(" ");
    return "";
  }

  const svg = document.getElementById("world-map");
  svg.innerHTML = "";

  for (const feature of countries) {
    const id = parseInt(feature.id, 10);
    const rawName = idToName[id] || "";
    const csvName = normalizeName(rawName);
    const meta = countryMeta[csvName] || countryMeta[rawName] || null;

    const d = coordsToPath(feature.geometry);
    if (!d) continue;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("data-name", csvName);
    path.setAttribute("fill", "#c8bfad");
    svg.appendChild(path);

    if (meta) {
      if (!countryMeta[csvName]) countryMeta[csvName] = meta;
      countryMeta[csvName].el = path;
    }
    if (rawName && !countryMeta[rawName]) countryMeta[rawName] = { el: path };
    else if (rawName && countryMeta[rawName]) countryMeta[rawName].el = path;
  }

  svg.querySelectorAll("path[data-name]").forEach(p => {
    const n = p.getAttribute("data-name");
    if (!countryMeta[n]) countryMeta[n] = {};
    countryMeta[n].el = p;
  });

  const tooltip = document.getElementById("map-tooltip");
  svg.addEventListener("mousemove", (e) => {
    const path = e.target.closest("path");
    if (!path) { tooltip.classList.remove("visible"); return; }
    const name = path.getAttribute("data-name");
    const meta = countryMeta[name];
    if (!meta || meta.temp === undefined) { tooltip.classList.remove("visible"); return; }

    const mode = mapStep <= 2 ? "temp" : mapStep <= 5 ? "pr" : "overlay";
    let valHtml = "";
    if (mode === "temp" || mode === "overlay")
      valHtml += `<div class="tt-val">🌡 ${meta.temp.toFixed(1)}°C</div>`;
    if (mode === "pr" || mode === "overlay")
      valHtml += `<div class="tt-val">🌧 ${meta.pr.toFixed(2)} mm/day</div>`;

    tooltip.innerHTML = `<div class="tt-name">${name}</div>${valHtml}`;
    tooltip.style.left = (e.clientX + 14) + "px";
    tooltip.style.top  = (e.clientY - 10) + "px";
    tooltip.classList.add("visible");
  });

  svg.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });

  mapStep = -1;
  applyMapStep(0);
}

function normalizeName(name) {
  const map = {
    "United States of America": "United States",
    "Russian Federation": "Russia",
    "Iran (Islamic Republic of)": "Iran",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Bolivia (Plurinational State of)": "Bolivia",
    "United Republic of Tanzania": "Tanzania",
    "Korea, Republic of": "South Korea",
    "Korea, Democratic People's Republic of": "North Korea",
    "Viet Nam": "Vietnam",
    "Syrian Arab Republic": "Syria",
    "Lao People's Democratic Republic": "Laos",
    "Congo, Democratic Republic of the": "DR Congo",
    "Congo": "Republic of the Congo",
    "Côte d'Ivoire": "Ivory Coast",
    "Burma": "Myanmar",
    "Czech Republic": "Czechia",
    "Macedonia, the former Yugoslav Republic of": "North Macedonia",
    "Republic of Moldova": "Moldova",
    "Swaziland": "Eswatini",
    "São Tomé and Príncipe": "Sao Tome and Principe",
    "Brunei Darussalam": "Brunei",
    "Palestine, State of": "Palestine",
    "Taiwan, Province of China": "Taiwan",
    "Tanzania, United Republic of": "Tanzania",
    "Micronesia (Federated States of)": "Micronesia",
    "Macao": "Macau",
    "Dominican Rep.": "Dominican Republic",
  };
  return map[name] || name;
}

function updateLegend(mode) {
  const legend = document.getElementById("map-legend");
  const bar = document.getElementById("legend-bar");
  const label = document.getElementById("legend-label");
  const minEl = document.getElementById("legend-min");
  const maxEl = document.getElementById("legend-max");

  legend.classList.add("visible");

  if (mode === "temp") {
    label.textContent = "Mean Temperature";
    bar.style.background = `linear-gradient(to right, ${tempColor(-30)}, ${tempColor(0)}, ${tempColor(30)})`;
    minEl.textContent = "−30°C";
    maxEl.textContent = "30°C";
  } else if (mode === "pr") {
    label.textContent = "Mean Precipitation";
    bar.style.background = `linear-gradient(to right, ${prColor(0)}, ${prColor(4)}, ${prColor(9)})`;
    minEl.textContent = "0 mm/day";
    maxEl.textContent = "9+ mm/day";
  } else {
    label.textContent = "Temp + Precipitation";
    bar.style.background = `linear-gradient(to right, ${overlayColor(-30,0)}, ${overlayColor(15,4)}, ${overlayColor(30,9)})`;
    minEl.textContent = "Cold & Dry";
    maxEl.textContent = "Hot & Wet";
  }
}

function applyMapStep(step) {
  if (step === mapStep) return;
  if (Object.keys(countryMeta).length === 0) return;
  mapStep = step;

  const labelEl = document.getElementById("map-label-text");
  labelEl.style.opacity = "0";
  setTimeout(() => {
    labelEl.innerHTML = STEP_LABELS[step] || "";
    labelEl.style.opacity = "1";
  }, 300);

  const mode = step <= 2 ? "temp" : step <= 5 ? "pr" : "overlay";
  updateLegend(mode);

  for (const [name, meta] of Object.entries(countryMeta)) {
    if (!meta.el) continue;
    meta.el.setAttribute("fill", getBaseColor(meta, mode));
    meta.el.style.opacity = "1";
  }

  const highlights = HIGHLIGHT_COUNTRIES[step];
  if (highlights) {
    for (const [name, meta] of Object.entries(countryMeta)) {
      if (!meta.el) continue;
      const isHighlighted = highlights.some(h => name === h);
      if (isHighlighted) {
        meta.el.style.opacity = "1";
        meta.el.setAttribute("stroke", "#111");
        meta.el.setAttribute("stroke-width", "1.5");
      } else {
        meta.el.style.opacity = "0.15";
        meta.el.setAttribute("stroke", "rgba(255,255,255,0.1)");
        meta.el.setAttribute("stroke-width", "0.3");
      }
    }
  } else {
    for (const [name, meta] of Object.entries(countryMeta)) {
      if (!meta.el) continue;
      meta.el.style.opacity = "1";
      meta.el.setAttribute("stroke", "rgba(255,255,255,0.25)");
      meta.el.setAttribute("stroke-width", "0.3");
    }
  }

  updateInfoBox(step, highlights);
}

function getBaseColor(meta, mode) {
  if (!meta || meta.temp === undefined) return "#c8bfad";
  if (mode === "temp") return tempColor(meta.temp);
  if (mode === "pr")   return prColor(meta.pr);
  return overlayColor(meta.temp, meta.pr);
}

function updateInfoBox(step, highlights) {
  const box = document.getElementById("country-info-box");

  function setContent(html) {
    const doEnter = () => {
      box.classList.remove("exit");
      box.style.transition = "none";
      box.style.transform = "translateY(calc(-50% + 80px))";
      box.style.opacity = "0";
      box.innerHTML = html;
      void box.offsetWidth;
      box.style.transition = "";
      box.style.transform = "";
      box.style.opacity = "";
      if (html) box.classList.add("visible");
    };

    if (box.classList.contains("visible")) {
      box.classList.add("exit");
      box.classList.remove("visible");
      setTimeout(doEnter, 340);
    } else {
      doEnter();
    }
  }

  if (!highlights || step === 7) {
    if (step === 7) {
      setContent(`
        <div class="cib-label">Four Countries, One Story</div>
        <div class="cib-name">Drought & Surplus</div>
        <div class="cib-divider"></div>
        <div class="cib-body">
          <strong style="color:#990f02">Mali & Egypt</strong> — extremely hot and dry, chronic SPI deficits near −0.9.<br><br>
          <strong style="color:#3a3a6a">Antarctica</strong> — cold and snowless by volume; ice accumulation is slow.<br><br>
          <strong style="color:#0a3060">Myanmar</strong> — warm and drenched; positive SPI buffers against drought.<br><br>
          Drought isn't defined by heat. It's defined by the <em>gap</em> between what fell and what was expected.
        </div>`);
      return;
    }
    setContent("");
    box.classList.remove("visible");
    return;
  }

  const countryName = highlights[0];
  const info = INFO_CONTENT[countryName];
  if (!info) { setContent(""); box.classList.remove("visible"); return; }

  setContent(`
    <div class="cib-label">${info.label}</div>
    <div class="cib-name">${countryName}</div>
    <div class="cib-stat" style="color:${info.color}">${info.stat}</div>
    <div class="cib-unit">${info.unit}</div>
    <div class="cib-divider"></div>
    <div class="cib-body">${info.body}</div>
  `);
}

function driveMap() {
  const slide3Track = document.getElementById("slide-3-track");
  if (!slide3Track) return;
  const rect = slide3Track.getBoundingClientRect();
  const trackHeight = slide3Track.offsetHeight;
  const vh = window.innerHeight;
  if (rect.top > vh || rect.bottom < 0) return;
  const progress = Math.max(0, Math.min(1, -rect.top / (trackHeight - vh)));
  let currentStep = 0;
  for (let i = MAP_STEPS.length - 1; i >= 0; i--) {
    if (progress >= MAP_STEPS[i]) { currentStep = i; break; }
  }
  applyMapStep(currentStep);
}

// Lazy load map when entering view
let topojsonLoaded = false;
function loadTopojsonAndMap() {
  if (topojsonLoaded) return;
  const rect = document.getElementById("slide-3-track")?.getBoundingClientRect();
  if (rect && rect.top < window.innerHeight * 1.5 && !window.topojson) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
    s.onload = () => { topojsonLoaded = true; initMap(); };
    document.head.appendChild(s);
  } else if (rect && rect.top < window.innerHeight * 1.5 && window.topojson) {
    topojsonLoaded = true;
    initMap();
  }
}
window.addEventListener("scroll", loadTopojsonAndMap);
loadTopojsonAndMap();

/* ══════════════════════════════════════════════
   SPI RAIN DOT SCROLLYTELLING
   ══════════════════════════════════════════════ */
(function () {
  const SPI_STEPS = [
    { spi: 0.0,  label: 'Normal rainfall',   dropRate: 1.0,  color: [70, 140, 210] },
    { spi: 0.0,  label: 'What is SPI?',      dropRate: 1.0,  color: [70, 140, 210] },
    { spi: -0.6, label: 'Mild drought',      dropRate: 0.52, color: [180, 130,  70] },
    { spi: -1.5, label: 'Severe drought',    dropRate: 0.18, color: [200,  80,  30] },
    { spi: -2.1, label: 'Extreme drought',   dropRate: 0.04, color: [160,  35,  10] },
  ];

  function spiToNeedle(spi) {
    return Math.max(0, Math.min(100, ((spi + 2.5) / 4.0) * 100));
  }

  function spiToColor(spi) {
    const t = Math.max(0, Math.min(1, (spi + 2.5) / 4.0));
    const r = Math.round(180 + (90 - 180) * t);
    const g = Math.round(60 + (170 - 60) * t);
    const b = Math.round(20 + (255 - 20) * t);
    return `rgb(${r},${g},${b})`;
  }

  const canvas = document.getElementById('spi-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
  resize();
  window.addEventListener('resize', () => { resize(); drops.length = 0; });

  const drops = [];
  let currentStep = 0;
  let targetDropRate = 1.0;
  let currentDropColor = [90, 160, 220];
  let targetDropColor  = [90, 160, 220];
  let animColor = [90, 160, 220];
  const splashes = [];

  function spawnDrop() {
    const step = SPI_STEPS[currentStep] || SPI_STEPS[0];
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

  let lastTime = 0;
  let spawnAccum = 0;
  function tick(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, W, H);
    const groundY = H * 0.88;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.strokeStyle = 'rgba(139,94,60,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const step = SPI_STEPS[currentStep] || SPI_STEPS[0];
    const baseRate = 2.8;
    spawnAccum += (baseRate * step.dropRate * dt) / 16;
    while (spawnAccum >= 1) { spawnDrop(); spawnAccum -= 1; }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y  += d.vy;
      d.x  += d.wobble;
      if (d.y >= groundY) {
        splashes.push({ x: d.x, y: groundY, r: d.r * 1.2, maxR: d.r * 7, life: 1.0, color: d.color });
        drops.splice(i, 1);
        continue;
      }
      const [r, g, b] = d.color;
      ctx.beginPath();
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(1, 1.6);
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.restore();
      ctx.fillStyle = `rgba(${r},${g},${b},${d.opacity})`;
      ctx.fill();
    }

    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.life -= 0.045;
      s.r += (s.maxR - s.r) * 0.2;
      if (s.life <= 0) { splashes.splice(i, 1); continue; }
      const [r, g, b] = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${s.life * 0.35})`;
      ctx.stroke();
    }

    const puddleAlpha = 0.07 + step.dropRate * 0.13;
    const puddleGrad = ctx.createLinearGradient(0, groundY, 0, H);
    puddleGrad.addColorStop(0, `rgba(${animColor[0]},${animColor[1]},${animColor[2]},${puddleAlpha})`);
    puddleGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = puddleGrad;
    ctx.fillRect(0, groundY, W, H - groundY);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function setSpiPanel(idx) {
    const panels = document.querySelectorAll('.spi-panel');
    panels.forEach((p, i) => {
      if (i === idx) {
        p.classList.remove('exit-up');
        p.classList.add('active');
      } else {
        p.classList.remove('active');
        p.classList.add('exit-up');
      }
    });
    const step = SPI_STEPS[idx];
    if (!step) return;
    const needleEl = document.getElementById(`spi-needle-${idx}`);
    const statEl   = document.getElementById(`spi-stat-${idx}`);
    if (!needleEl || !statEl) return;
    const needlePct = spiToNeedle(step.spi);
    needleEl.style.left = needlePct + '%';
    statEl.style.color  = spiToColor(step.spi);
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

  window.addEventListener('scroll', driveSpi);
  setSpiPanel(0);
})();

/* ══════════════════════════════════════════════
   CASE STUDY (slideshow)
   ══════════════════════════════════════════════ */
(function () {
  const GB_COLOR   = '#5B8DB8';
  const DV_COLOR   = '#C0622B';
  const AXIS_COLOR = 'rgba(139,94,60,0.18)';
  const TEXT_COLOR = '#7a6248';

  let currentSlide = 0;
  const TOTAL      = 4;
  let chartsDrawn  = { 1: false, 2: false, 3: false };
  let annualData   = null;
  let spiData      = null;
  let isAnimating  = false;

  function parseCSV(text) {
    const lines   = text.trim().split('\n');
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
    } catch (err) { console.warn('Case study CSVs not found', err); }
  }
  const caseDataLoaded = loadCaseData();

  const track   = document.getElementById('case-slider-track');
  const prevBtn = document.getElementById('case-prev');
  const nextBtn = document.getElementById('case-next');
  const dots    = document.querySelectorAll('.case-dot-btn');

  function goTo(idx, skipDraw) {
    if (isAnimating) return;
    idx = Math.max(0, Math.min(TOTAL - 1, idx));
    if (idx === currentSlide && !skipDraw) return;
    isAnimating = true;
    currentSlide = idx;
    if (track) track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (prevBtn) prevBtn.classList.toggle('hidden', idx === 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', idx === TOTAL - 1);
    setTimeout(() => { isAnimating = false; }, 560);
    if (!skipDraw) maybeDrawChart(idx);
  }

  async function maybeDrawChart(idx) {
    if (typeof d3 === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
    }
    await caseDataLoaded;
    if (idx === 1 && !chartsDrawn[1]) {
      const el = document.getElementById('case-chart-svg-1');
      if (el) { drawBarChart(el);  chartsDrawn[1] = true; }
    }
    if (idx === 2 && !chartsDrawn[2]) {
      const el = document.getElementById('case-chart-svg-2');
      if (el) { drawLineChart(el); chartsDrawn[2] = true; }
    }
    if (idx === 3 && !chartsDrawn[3]) {
      const el = document.getElementById('case-chart-svg-3');
      if (el) { drawFreqChart(el); chartsDrawn[3] = true; }
    }
  }

  prevBtn?.addEventListener('click', () => goTo(currentSlide - 1));
  nextBtn?.addEventListener('click', () => goTo(currentSlide + 1));
  dots.forEach(d => { d.addEventListener('click', () => goTo(parseInt(d.dataset.slide))); });

  document.addEventListener('keydown', e => {
    const casetrack = document.getElementById('slide-case-track');
    if (!casetrack) return;
    const r = casetrack.getBoundingClientRect();
    if (r.top > 0 || r.bottom < window.innerHeight) return;
    if (e.key === 'ArrowRight') goTo(currentSlide + 1);
    if (e.key === 'ArrowLeft')  goTo(currentSlide - 1);
  });

  let touchStartX = null;
  const viewport = document.getElementById('case-slider-viewport');
  viewport?.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  viewport?.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 40) return;
    dx < 0 ? goTo(currentSlide + 1) : goTo(currentSlide - 1);
  }, { passive: true });

  window.addEventListener('resize', async () => {
    if (typeof d3 === 'undefined') return;
    await caseDataLoaded;
    const drawn = { ...chartsDrawn };
    chartsDrawn = { 1: false, 2: false, 3: false };
    if (drawn[1]) { const el = document.getElementById('case-chart-svg-1'); if (el) { drawBarChart(el);  chartsDrawn[1] = true; } }
    if (drawn[2]) { const el = document.getElementById('case-chart-svg-2'); if (el) { drawLineChart(el); chartsDrawn[2] = true; } }
    if (drawn[3]) { const el = document.getElementById('case-chart-svg-3'); if (el) { drawFreqChart(el); chartsDrawn[3] = true; } }
  });

  goTo(0, true);

  function chartDims(svgEl) {
    const W = svgEl.clientWidth  || 520;
    const H = svgEl.clientHeight || 320;
    const margin = { top: 38, right: 20, bottom: 50, left: 50 };
    return { W, H, iW: W - margin.left - margin.right, iH: H - margin.top - margin.bottom, margin };
  }

  function styleAxis(g) {
    g.selectAll('text').style('font-family', "'Montserrat', sans-serif").style('font-size', '10px').style('fill', TEXT_COLOR);
    g.selectAll('line, path').style('stroke', AXIS_COLOR);
    return g;
  }

  function animateBars(bars, yScale, innerH, dur = 820) {
    bars.attr('y', innerH).attr('height', 0)
      .transition().duration(dur).ease(d3.easeCubicOut)
      .attr('y', d => yScale(d.value)).attr('height', d => innerH - yScale(d.value));
  }

  function animateLine(path, dur = 1350) {
    const len = path.node().getTotalLength();
    path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
      .transition().duration(dur).ease(d3.easeLinear).attr('stroke-dashoffset', 0);
  }

  function addGridlines(g, yScale, iW) {
    const grid = g.append('g').attr('class', 'case-axis').call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''));
    grid.select('.domain').remove();
    grid.selectAll('line').style('stroke', 'rgba(139,94,60,0.10)');
  }

  function addTitle(svg, W, margin, text) {
    svg.append('text').attr('class', 'case-chart-title')
      .attr('x', W / 2).attr('y', margin.top * 0.58).text(text);
  }

  function addLegend(g, iW) {
    const leg = g.append('g').attr('transform', `translate(${iW - 152}, -26)`);
    [['Great Basin', GB_COLOR], ['Death Valley', DV_COLOR]].forEach(([n, c], i) => {
      leg.append('rect').attr('x', i * 86).attr('width', 11).attr('height', 11).attr('rx', 2).attr('fill', c).attr('opacity', 0.88);
      leg.append('text').attr('x', i * 86 + 15).attr('y', 9.5)
        .style('font-family', "'Montserrat',sans-serif").style('font-size', '8.5px')
        .style('fill', TEXT_COLOR).text(n);
    });
  }

  function drawBarChart(svgEl) {
    if (!annualData?.length) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    const { W, H, iW, iH, margin } = chartDims(svgEl);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const gbTas = d3.mean(annualData, d => d.gb_tas);
    const dvTas = d3.mean(annualData, d => d.dv_tas);
    const gbPr  = d3.mean(annualData, d => d.gb_pr);
    const dvPr  = d3.mean(annualData, d => d.dv_pr);

    const groups = ['Temperature (°C)', 'Precip (mm/mo)'];
    const x0 = d3.scaleBand().domain(groups).range([0, iW]).paddingInner(0.38).paddingOuter(0.18);
    const x1 = d3.scaleBand().domain(['Great Basin', 'Death Valley']).range([0, x0.bandwidth()]).paddingInner(0.12);
    const yTemp   = d3.scaleLinear().domain([0, Math.max(gbTas, dvTas) * 1.38]).range([iH, 0]);
    const yPrecip = d3.scaleLinear().domain([0, Math.max(gbPr,  dvPr)  * 1.38]).range([iH, 0]);
    const yFor    = name => name === 'Temperature (°C)' ? yTemp : yPrecip;

    addGridlines(g, yTemp, iW);
    const xAxisG = styleAxis(g.append('g').attr('class', 'case-axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x0).tickSize(0)));
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('text').attr('dy', '1.4em').style('font-size', '10.5px').style('font-weight', '700').style('fill', '#4a3020');
    styleAxis(g.append('g').attr('class', 'case-axis').call(d3.axisLeft(yTemp).ticks(5)));
    g.append('text').attr('class', 'case-axis-label').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -40).attr('text-anchor', 'middle').text('Temperature °C');
    styleAxis(g.append('g').attr('class', 'case-axis').attr('transform', `translate(${iW},0)`).call(d3.axisRight(yPrecip).ticks(5).tickSize(0)));
    g.append('text').attr('class', 'case-axis-label').attr('transform', 'rotate(90)').attr('x', iH / 2).attr('y', -iW - 36).attr('text-anchor', 'middle').text('Precip mm/mo');

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
    groups.forEach(gName => {
      const gEl = g.append('g').attr('transform', `translate(${x0(gName)},0)`);
      const yS  = yFor(gName);
      const dat = barData[gName];
      const bars = gEl.selectAll('rect').data(dat).enter().append('rect')
        .attr('x', d => x1(d.region)).attr('width', x1.bandwidth()).attr('rx', 3).attr('fill', d => d.color).attr('opacity', 0.85);
      animateBars(bars, yS, iH);
      gEl.selectAll('.bv').data(dat).enter().append('text')
        .attr('class', 'case-bar-label')
        .attr('x', d => x1(d.region) + x1.bandwidth() / 2)
        .attr('y', d => yS(d.value) - 5)
        .text(d => gName === 'Temperature (°C)' ? `${d.value.toFixed(1)}°` : `${d.value.toFixed(1)}`)
        .attr('opacity', 0).transition().delay(840).duration(280).attr('opacity', 1);
    });
    addLegend(g, iW);
    addTitle(svg, W, margin, 'Mean Temperature & Precipitation · 1950–2014');
  }

  function drawLineChart(svgEl) {
    if (!spiData?.length) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    const { W, H, iW, iH, margin } = chartDims(svgEl);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleTime().domain(d3.extent(spiData, d => d.date)).range([0, iW]);
    const y = d3.scaleLinear().domain([-3.0, 2.0]).range([iH, 0]);
    g.append('rect').attr('x', 0).attr('y', y(-1.0)).attr('width', iW).attr('height', iH - y(-1.0)).attr('fill', 'rgba(139,94,60,0.06)');
    addGridlines(g, y, iW);
    styleAxis(g.append('g').attr('class', 'case-axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(10))));
    styleAxis(g.append('g').attr('class', 'case-axis').call(d3.axisLeft(y).ticks(5)));
    g.append('text').attr('class', 'case-axis-label').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -40).attr('text-anchor', 'middle').text('SPI-12');
    g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'rgba(139,94,60,0.22)').style('stroke-width', 1);
    g.append('line').attr('class', 'case-threshold-line').attr('x1', 0).attr('x2', iW).attr('y1', y(-1.0)).attr('y2', y(-1.0));
    g.append('text').attr('class', 'case-threshold-label').attr('x', iW - 2).attr('y', y(-1.0) - 4).attr('text-anchor', 'end').text('SPI = −1.0');
    const mkArea = key => d3.area().x(d => x(d.date)).y0(y(0)).y1(d => y(Math.min(0, d[key]))).curve(d3.curveBasis);
    g.append('path').datum(spiData).attr('d', mkArea('gb_spi')).attr('fill', GB_COLOR).attr('opacity', 0.14);
    g.append('path').datum(spiData).attr('d', mkArea('dv_spi')).attr('fill', DV_COLOR).attr('opacity', 0.14);
    const mkLine = key => d3.line().x(d => x(d.date)).y(d => y(d[key])).curve(d3.curveBasis);
    const pGB = g.append('path').datum(spiData).attr('d', mkLine('gb_spi')).attr('fill', 'none').attr('stroke', GB_COLOR).attr('stroke-width', 1.8);
    const pDV = g.append('path').datum(spiData).attr('d', mkLine('dv_spi')).attr('fill', 'none').attr('stroke', DV_COLOR).attr('stroke-width', 1.8);
    animateLine(pGB, 1400);
    animateLine(pDV, 1680);
    addLegend(g, iW);
    addTitle(svg, W, margin, 'SPI-12 Time Series · 1950–2014');
  }

  function drawFreqChart(svgEl) {
    let freqData;
    if (spiData?.length) {
      const gbVals = spiData.map(d => d.gb_spi).filter(v => !isNaN(v));
      const dvVals = spiData.map(d => d.dv_spi).filter(v => !isNaN(v));
      const pct = (arr, lo, hi = Infinity) => arr.filter(v => v < lo && (hi === Infinity || v >= hi)).length / arr.length * 100;
      freqData = [
        { cat: 'Moderate\n(< −1.0)', gb: pct(gbVals, -1.0, -1.5), dv: pct(dvVals, -1.0, -1.5) },
        { cat: 'Severe\n(< −1.5)',   gb: pct(gbVals, -1.5, -2.0), dv: pct(dvVals, -1.5, -2.0) },
        { cat: 'Extreme\n(< −2.0)',  gb: pct(gbVals, -2.0),       dv: pct(dvVals, -2.0)        },
      ];
    } else {
      freqData = [
        { cat: 'Moderate\n(< −1.0)', gb: 14.8, dv: 14.8 },
        { cat: 'Severe\n(< −1.5)',   gb: 3.0,  dv: 3.0  },
        { cat: 'Extreme\n(< −2.0)',  gb: 3.0,  dv: 3.0  },
      ];
    }
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    const { W, H, iW, iH, margin } = chartDims(svgEl);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x0 = d3.scaleBand().domain(freqData.map(d => d.cat)).range([0, iW]).paddingInner(0.38).paddingOuter(0.18);
    const x1 = d3.scaleBand().domain(['gb', 'dv']).range([0, x0.bandwidth()]).paddingInner(0.1);
    const maxV = Math.max(d3.max(freqData, d => d.gb), d3.max(freqData, d => d.dv));
    const y = d3.scaleLinear().domain([0, Math.max(maxV * 1.38, 6)]).range([iH, 0]);
    addGridlines(g, y, iW);
    const xAxisG = g.append('g').attr('class', 'case-axis').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x0).tickSize(0));
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('.tick text').each(function(d) {
      const el = d3.select(this);
      const parts = d.split('\n');
      el.text('');
      parts.forEach((p, i) => el.append('tspan').attr('x', 0).attr('dy', i === 0 ? '1.3em' : '1.2em').text(p));
    }).style('font-family', "'Montserrat',sans-serif").style('font-size', '9.5px').style('font-weight', '700').style('fill', '#4a3020');
    styleAxis(g.append('g').attr('class', 'case-axis').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%')));
    g.append('text').attr('class', 'case-axis-label').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -40).attr('text-anchor', 'middle').text('% of months');
    g.append('line').attr('class', 'case-threshold-line').attr('x1', 0).attr('x2', iW).attr('y1', y(5)).attr('y2', y(5));
    g.append('text').attr('class', 'case-threshold-label').attr('x', iW - 2).attr('y', y(5) - 4).attr('text-anchor', 'end').text('5% expected under normal climate');
    freqData.forEach(d => {
      const gEl = g.append('g').attr('transform', `translate(${x0(d.cat)},0)`);
      const dat = [
        { key: 'gb', value: d.gb, color: GB_COLOR },
        { key: 'dv', value: d.dv, color: DV_COLOR },
      ];
      const bars = gEl.selectAll('rect').data(dat).enter().append('rect')
        .attr('x', b => x1(b.key)).attr('width', x1.bandwidth()).attr('rx', 3).attr('fill', b => b.color).attr('opacity', 0.85);
      animateBars(bars, y, iH, 920);
      gEl.selectAll('.fv').data(dat).enter().append('text')
        .attr('class', 'case-bar-label')
        .attr('x', b => x1(b.key) + x1.bandwidth() / 2)
        .attr('y', b => y(b.value) - 4)
        .text(b => `${b.value.toFixed(1)}%`)
        .attr('opacity', 0).transition().delay(940).duration(280).attr('opacity', 1);
    });
    addLegend(g, iW);
    addTitle(svg, W, margin, 'Drought Category Frequency · SPI-12 · 1950–2014');
  }
})();

/* ══════════════════════════════════════════════
   CLIMATE BUILDER
   ══════════════════════════════════════════════ */
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

  dialTrack.setAttribute('d', arcPath(START_DEG, START_DEG + TOTAL_SWEEP));
  const ARC_LEN = (TOTAL_SWEEP / 360) * 2 * Math.PI * R;
  dialFill.setAttribute('d', arcPath(START_DEG, START_DEG + TOTAL_SWEEP));
  dialFill.style.strokeDasharray  = ARC_LEN.toFixed(2);
  dialFill.style.strokeDashoffset = ARC_LEN.toFixed(2);

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
      if (!response.ok) throw new Error("CSV not found");
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
          countries[country] = { country, continent: row.continent, climate_zone: row.climate_zone, tempSum: 0, prSum: 0, spiSum: 0, count: 0 };
        }
        countries[country].tempSum += Number(row.mean_temp_C);
        countries[country].prSum   += Number(row.mean_pr_mm_day);
        countries[country].spiSum  += Number(row.mean_spi);
        countries[country].count   += 1;
      }
      COUNTRY_CLIMATES = Object.values(countries).map(d => ({
        country: d.country, continent: d.continent, climate_zone: d.climate_zone,
        temp: d.tempSum / d.count, pr: d.prSum / d.count, spi: d.spiSum / d.count
      }));
      update();
    } catch(err) {
      console.error(err);
      if (similarName) similarName.textContent = "Climate data not found";
      if (similarDesc) similarDesc.textContent = "Make sure climate_agg_country.csv is in the same folder.";
    }
  }

  function normalizeTemp(temp) { return Math.max(0, Math.min(100, ((temp + 35) / 65) * 100)); }
  function normalizePrecip(pr) { return Math.max(0, Math.min(100, (pr / 12) * 100)); }

  function findMostSimilarClimates(userTemp, userPr, count = 3) {
    if (!COUNTRY_CLIMATES.length) return [];
    return COUNTRY_CLIMATES.map(c => {
      const tempNorm = normalizeTemp(c.temp);
      const prNorm = normalizePrecip(c.pr);
      const distance = Math.hypot(userTemp - tempNorm, userPr - prNorm);
      return { ...c, distance };
    }).sort((a,b) => a.distance - b.distance).slice(0, count);
  }

  function update() {
    const t = +tempSlider.value;
    const p = +prSlider.value;
    tempVal.textContent = labelFor(t, TEMP_LABELS);
    prVal.textContent   = labelFor(p, PR_LABELS);
    const risk  = computeRisk(t, p);
    const level = LEVELS.find(l => risk < l.max);
    const offset = ARC_LEN * (1 - risk);
    dialFill.style.strokeDashoffset = offset.toFixed(2);
    dialFill.style.stroke = level.color;
    const needleDeg = (risk * 180) - 90;
    dialNeedle.setAttribute('transform', `rotate(${needleDeg}, 130, 130)`);
    meterVerdict.textContent = level.label;
    meterVerdict.style.color = level.color;
    meterExample.textContent = level.example;
    const matches = findMostSimilarClimates(t, p);
    if (matches.length && similarName && similarDesc) {
      similarName.textContent = matches[0].country;
      similarDesc.innerHTML = matches.map((m,i) => `${i+1}. ${m.country} (${m.continent}) — ${m.temp.toFixed(1)}°C, ${m.pr.toFixed(2)} mm/day`).join("<br>");
    }
  }

  tempSlider.addEventListener('input', update);
  prSlider.addEventListener('input', update);
  loadCountryClimateData();
  update();
})();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}