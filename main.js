/* ── Scroll lock logic ───────────────────────── */
let scrollUnlocked = false;
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
  const progress = Math.max(0, Math.min(1, -trackTop / (trackHeight - vh)));
  if (progress > 0.25) panelL.classList.add('visible');
  else panelL.classList.remove('visible');
  if (progress > 0.55) panelR.classList.add('visible');
  else panelR.classList.remove('visible');
}

/* ══════════════════════════════════════════════
   SLIDE 3 — World map scroll sequence
   ══════════════════════════════════════════════ */

const MAP_STEPS = [0, 0.12, 0.22, 0.33, 0.44, 0.55, 0.66, 0.78];

const STEP_LABELS = [
  /* 0 */ `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  /* 1 */ `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  /* 2 */ `<strong style="color:#6b0a0a">THE HEAT MAP</strong><br><span>Mean surface temperature per country, averaged across 165 years of records from 1850 to 2014 — revealing how hot each place typically runs over the long run, not just in a single season.</span>`,
  /* 3 */ `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone-dry deserts to monsoon-soaked mountains.</span>`,
  /* 4 */ `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone-dry deserts to monsoon-soaked mountains.</span>`,
  /* 5 */ `<strong style="color:#0a1f4a">FOLLOW THE RAIN</strong><br><span>Mean daily precipitation in mm/day, averaged across 165 years from 1850 to 2014 — showing how much moisture each country typically receives, from bone-dry deserts to monsoon-soaked mountains.</span>`,
  /* 6 */ `<strong>WHERE THEY MEET</strong><br><span>Heat and rain overlaid across every country — revealing where climates are hot-and-dry, cold-and-wet, or somewhere between. The gap between what falls and what's expected is exactly where drought hides.</span>`,
  /* 7 */ `<strong>WHERE THEY MEET</strong><br><span>Heat and rain overlaid across every country — revealing where climates are hot-and-dry, cold-and-wet, or somewhere between. The gap between what falls and what's expected is exactly where drought hides.</span>`,
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
    color: tempColor(29.1),
    body: "Mali's position in the Sahel and Sahara makes it the single hottest-averaging country in the dataset. Sparse vegetation amplifies radiative heating.",
  },
  "Antarctica": {
    label: "Coldest Region",
    stat: "−28.9°C",
    unit: "Mean annual temperature",
    color: tempColor(0),
    body: "High elevation, polar location, and a year-round ice sheet that reflects nearly all incoming sunlight combine to make Antarctica the coldest landmass on Earth.",
  },
  "Myanmar": {
    label: "Among the Wettest",
    stat: "7.18 mm/day",
    unit: "Mean daily precipitation",
    color: prColor(7.18),
    body: "Southwest monsoon winds drop enormous moisture loads against Myanmar's mountain ranges from May through October, producing one of the world's highest national rainfall averages.",
  },
  "Egypt": {
    label: "One of the Driest",
    stat: "0.07 mm/day",
    unit: "Mean daily precipitation",
    color: prColor(3),
    body: "Rain almost never falls in Egypt. The country owes its agriculture entirely to the Nile. Its mean SPI of −0.92 marks persistent hydrological drought.",
  },
};

/* ── Color scales ─────────────────────────────── */
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

  // Hot end: cherry #990f02 = rgb(153,15,2)
  // Cold end: navy #0a1f4a = rgb(10,31,74)
  // Blend between navy (wet) and cherry (hot/dry)
  const r = Math.round(10  + tT * (153 - 10)  - tP * (10 * tT));
  const g = Math.round(31  + tT * (15  - 31)  - tP * (15 * tT));
  const b = Math.round(74  + tT * (2   - 74)  + tP * (80 * (1 - tT)));
  return `rgb(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))})`;
}

/* ── State ────────────────────────────────────── */
let mapLoaded = false;
let mapStep = -1;
let countryMeta = {};

/* ── Boot: load TopoJSON + CSV ────────────────── */
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

  // Tooltip
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

  // Map is ready — force step 0 to color everything
  mapStep = -1;
  applyMapStep(0);
}

/* ── Name normalizer ──────────────────────────── */
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
    "Moldova, Republic of": "Moldova",
    "Swaziland": "Eswatini",
    "São Tomé and Príncipe": "Sao Tome and Principe",
    "Brunei Darussalam": "Brunei",
    "Palestine, State of": "Palestine",
    "Taiwan, Province of China": "Taiwan",
    "Tanzania, United Republic of": "Tanzania",
    "Micronesia (Federated States of)": "Micronesia",
    "Micronesia, Federated States of": "Micronesia",
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

/* ── Apply a visual step ──────────────────────── */
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
  for (const [name, meta] of Object.entries(countryMeta)) {
    if (!meta.el) continue;
    meta.el.style.opacity = "1";
    meta.el.setAttribute("stroke", "rgba(255,255,255,0.25)");
    meta.el.setAttribute("stroke-width", "0.3");
  }
  if (highlights) {
    for (const [name, meta] of Object.entries(countryMeta)) {
      if (!meta.el) continue;
      const isHighlighted = highlights.some(h =>
        name === h
      );
      if (isHighlighted) {
        meta.el.style.opacity = "1";
        meta.el.setAttribute("stroke", "#111");
        meta.el.setAttribute("stroke-width", "1.5");
        meta.el.setAttribute("filter", "drop-shadow(0 0 4px rgba(0,0,0,0.4))");
      } else {
        meta.el.style.opacity = "0.15";
        meta.el.setAttribute("stroke", "rgba(255,255,255,0.1)");
        meta.el.setAttribute("stroke-width", "0.3");
        meta.el.removeAttribute("filter");
      }
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

/* ── Scroll driver for slide-3 ────────────────── */
const slide3Track = document.getElementById("slide-3-track");

function driveMap() {
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

window.addEventListener("scroll", () => {
  driveMap();

  if (!mapLoaded) {
    const rect = slide3Track && slide3Track.getBoundingClientRect();
    if (rect && rect.top < window.innerHeight * 1.5) {
      if (!window.topojson) {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
        s.onload = initMap;
        document.head.appendChild(s);
      } else {
        initMap();
      }
    }
  }
});