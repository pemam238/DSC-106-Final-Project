"""
great_basin_vs_death_valley.py
===============================
Case-study comparison: Great Basin vs Death Valley
using CMIP6 data pulled live from the Pangeo GCS Zarr store.

Research question
-----------------
Despite sitting just ~4° of latitude apart, the Great Basin (cold desert) and
Death Valley (hot desert) are both in persistent drought.  This script
visualises their shared aridity through SPI while highlighting the temperature
contrast that makes them climatologically distinct.

Figures produced
----------------
  1. fig1_climate_profile.png   — Walter-Lieth monthly climate profile
  2. fig2_temp_precip.png       — annual temperature & precipitation time series
  3. fig3_spi_timeseries.png    — SPI-12 side-by-side panels
  4. fig4_drought_frequency.png — drought-category frequency bar chart

Dependencies  (all pip-installable, NO intake-esm required)
------------
  pip install gcsfs zarr xarray numpy pandas scipy matplotlib requests

Data
----
  Model      : MPI-ESM1-2-HR  (high-res, good western-US coverage)
  Experiment : historical  (1850–2014)
  Variables  : tas (near-surface air temp, K), pr (precipitation, kg m⁻² s⁻¹)
  Zarr store : gs://cmip6/ (Pangeo, anonymous access)

Coordinates
-----------
  Great Basin center : 40.67°N, 117.67°W
  Death Valley center: 36.46°N, 116.87°W
"""

# ── Standard library ──────────────────────────────────────────────────────────
import warnings, json, requests
warnings.filterwarnings("ignore")

# ── Third-party ───────────────────────────────────────────────────────────────
import numpy  as np
import pandas as pd
import matplotlib.pyplot    as plt
import matplotlib.patches   as mpatches
from   matplotlib.lines import Line2D
import gcsfs
import xarray as xr
from   scipy.stats import gamma, norm

# ═══════════════════════════════════════════════════════════════════════════════
# 0.  Configuration
# ═══════════════════════════════════════════════════════════════════════════════

LOCS = {
    "Great Basin":  {"lat": 40.67, "lon": -117.67},
    "Death Valley": {"lat": 36.46, "lon": -116.87},
}

COLORS = {
    "Great Basin":  "#5B8DB8",   # dusty blue  (cold desert)
    "Death Valley": "#C0622B",   # burnt sienna (hot desert)
}

# CMIP6 search parameters
MODEL      = "MPI-ESM1-2-HR"
EXPERIMENT = "historical"
MEMBER     = "r1i1p1f1"
GRID       = "gn"
TABLE      = "Amon"

SPI_WINDOW   = 12
MODERN_SLICE = slice("1950", "2014")
CLIMATE_NORM = slice("1981", "2010")

# ═══════════════════════════════════════════════════════════════════════════════
# 1.  Locate Zarr stores via the Pangeo catalog CSV (no intake-esm needed)
# ═══════════════════════════════════════════════════════════════════════════════

CATALOG_CSV = "https://storage.googleapis.com/cmip6/pangeo-cmip6.csv"

print("Downloading Pangeo catalog CSV …")
cat = pd.read_csv(CATALOG_CSV)

def find_zarr_path(variable_id: str) -> str:
    """Return the GCS Zarr path for the requested variable."""
    mask = (
        (cat["source_id"]      == MODEL)      &
        (cat["experiment_id"]  == EXPERIMENT) &
        (cat["variable_id"]    == variable_id) &
        (cat["table_id"]       == TABLE)       &
        (cat["member_id"]      == MEMBER)      &
        (cat["grid_label"]     == GRID)
    )
    hits = cat[mask]
    if hits.empty:
        raise RuntimeError(
            f"No catalog entry for variable='{variable_id}' "
            f"model='{MODEL}' experiment='{EXPERIMENT}' member='{MEMBER}'.\n"
            f"Available members: {cat[cat['source_id']==MODEL]['member_id'].unique()}"
        )
    # 'zstore' column holds the gs:// path
    return hits.iloc[0]["zstore"]


print("Locating Zarr stores …")
zpath_tas = find_zarr_path("tas")
zpath_pr  = find_zarr_path("pr")
print(f"  tas → {zpath_tas}")
print(f"  pr  → {zpath_pr}")

# ── Open via gcsfs (anonymous) ────────────────────────────────────────────────
fs = gcsfs.GCSFileSystem(token="anon")

def open_zarr(zpath: str) -> xr.Dataset:
    store = fs.get_mapper(zpath)
    return xr.open_zarr(store, consolidated=True)

print("Opening zarr stores (this may take ~30 s on first access) …")
ds_tas = open_zarr(zpath_tas)
ds_pr  = open_zarr(zpath_pr)

# ── Normalise longitude 0–360 → −180–180 if needed ───────────────────────────
def fix_lon(ds: xr.Dataset) -> xr.Dataset:
    if float(ds["lon"].max()) > 180:
        ds = ds.assign_coords(lon=(ds["lon"] + 180) % 360 - 180)
        ds = ds.sortby("lon")
    return ds

ds_tas = fix_lon(ds_tas)
ds_pr  = fix_lon(ds_pr)

# ═══════════════════════════════════════════════════════════════════════════════
# 2.  Extract nearest grid cells & convert units
# ═══════════════════════════════════════════════════════════════════════════════

print("Extracting grid cells …")
series = {}
for name, coords in LOCS.items():
    lat, lon = coords["lat"], coords["lon"]

    tas_da = ds_tas["tas"].sel(lat=lat, lon=lon, method="nearest").squeeze()
    pr_da  = ds_pr ["pr" ].sel(lat=lat, lon=lon, method="nearest").squeeze()

    tas_C  = tas_da - 273.15          # K → °C
    pr_mmd = pr_da  * 86_400          # kg m⁻² s⁻¹ → mm day⁻¹

    series[name] = {
        "tas": tas_C.sel( time=MODERN_SLICE).load(),
        "pr":  pr_mmd.sel(time=MODERN_SLICE).load(),
    }
    actual_lat = float(tas_C.lat)
    actual_lon = float(tas_C.lon)
    print(f"  {name}: matched lat={actual_lat:.2f}, lon={actual_lon:.2f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3.  Compute SPI-12 (McKee et al. 1993)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_spi(pr_da: xr.DataArray, window: int = 12) -> pd.Series:
    """
    1. Rolling window accumulation.
    2. Per calendar-month gamma fit.
    3. CDF → standard-normal quantile (SPI).
    """
    pr  = pd.Series(pr_da.values,
                    index=pd.DatetimeIndex(pr_da.time.values))
    acc = pr.rolling(window).sum()
    spi = pd.Series(np.nan, index=acc.index)

    for m in range(1, 13):
        mask = acc.index.month == m
        vals = acc[mask].dropna()
        if len(vals) < 10:
            continue
        shape, loc, scale = gamma.fit(vals, floc=0)
        cdf = np.clip(gamma.cdf(acc[mask], shape, loc=loc, scale=scale),
                      1e-6, 1 - 1e-6)
        spi[mask] = norm.ppf(cdf)

    return spi


print("Computing SPI-12 …")
spi_series = {}
for name in LOCS:
    spi_series[name] = compute_spi(series[name]["pr"], window=SPI_WINDOW)
    print(f"  {name}: mean SPI = {spi_series[name].mean():.3f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 4.  Climate normals (1981-2010 monthly means)
# ═══════════════════════════════════════════════════════════════════════════════

def monthly_normal(da: xr.DataArray, tslice: slice) -> pd.Series:
    sub = da.sel(time=tslice)
    df  = pd.DataFrame({
        "month": pd.DatetimeIndex(sub.time.values).month,
        "value": sub.values,
    })
    return df.groupby("month")["value"].mean()


normals = {}
for name in LOCS:
    normals[name] = {
        "tas": monthly_normal(series[name]["tas"], CLIMATE_NORM),
        "pr":  monthly_normal(series[name]["pr"],  CLIMATE_NORM),
    }

# Annual means (for time-series plot)
annual = {}
for name in LOCS:
    tas_s = pd.Series(series[name]["tas"].values,
                      index=pd.DatetimeIndex(series[name]["tas"].time.values))
    pr_s  = pd.Series(series[name]["pr"].values,
                      index=pd.DatetimeIndex(series[name]["pr"].time.values))
    annual[name] = {
        "tas": tas_s.resample("YE").mean(),
        "pr":  pr_s.resample("YE").mean() * 30.44,   # mm/day → mm/month approx
    }

# ═══════════════════════════════════════════════════════════════════════════════
# 5.  Plotting
# ═══════════════════════════════════════════════════════════════════════════════

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun",
          "Jul","Aug","Sep","Oct","Nov","Dec"]

plt.rcParams.update({
    "font.family":      "serif",
    "font.size":        11,
    "axes.spines.top":  False,
    "axes.spines.right":False,
    "figure.dpi":       150,
})

# ── Fig 1: Walter-Lieth climate profile ──────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle(
    "Monthly Climate Profiles — Great Basin vs Death Valley\n"
    "(WMO Normal 1981–2010 · MPI-ESM1-2-HR historical)",
    fontsize=13, fontweight="bold", y=1.01,
)

for ax, name in zip(axes, LOCS):
    color = COLORS[name]
    tas_n = normals[name]["tas"]
    pr_n  = normals[name]["pr"]
    x     = np.arange(1, 13)
    ax2   = ax.twinx()

    ax.bar(x, pr_n.values, color=color, alpha=0.55, zorder=2)
    ax2.plot(x, tas_n.values, color=color, linewidth=2.5,
             marker="o", markersize=5, zorder=3)
    ax2.axhline(0, color="grey", linewidth=0.6, linestyle="--")

    # Gaussen aridity shading: P (mm/day) < T(°C)/5
    for m in range(12):
        if pr_n.values[m] < (tas_n.values[m] / 5):
            ax.axvspan(m + 0.55, m + 1.45, color=color, alpha=0.10, zorder=0)

    ax.set_xticks(x)
    ax.set_xticklabels(MONTHS, fontsize=9)
    ax.set_ylabel("Precipitation (mm/day)", fontsize=10)
    ax2.set_ylabel("Temperature (°C)", color=color, fontsize=10)
    ax.set_title(name, fontsize=12, fontweight="bold", color=color)
    ax.text(0.97, 0.97,
            f"Mean annual\nT: {tas_n.mean():.1f}°C\n"
            f"P: {pr_n.mean()*30.44:.0f} mm/mo",
            transform=ax.transAxes, va="top", ha="right", fontsize=9,
            bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.7))
    ax.legend(handles=[
        mpatches.Patch(color=color, alpha=0.55, label="Precip (mm/day)"),
        Line2D([0],[0], color=color, lw=2.5, marker="o", label="Temp (°C)"),
        mpatches.Patch(color=color, alpha=0.10, label="Aridity period"),
    ], fontsize=8, loc="upper left")

plt.tight_layout()
plt.savefig("fig1_climate_profile.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig1_climate_profile.png")


# ── Fig 2: Annual temperature & precipitation ─────────────────────────────────
fig, (ax_t, ax_p) = plt.subplots(2, 1, figsize=(13, 8), sharex=True)
fig.suptitle(
    "Annual Temperature & Precipitation — Great Basin vs Death Valley\n"
    "(1950–2014 · MPI-ESM1-2-HR historical)",
    fontsize=13, fontweight="bold",
)

for name in LOCS:
    color   = COLORS[name]
    tas_ann = annual[name]["tas"]
    pr_ann  = annual[name]["pr"]
    yr      = tas_ann.index.year

    ax_t.plot(yr, tas_ann.values, color=color, alpha=0.3, lw=0.9)
    ax_t.plot(yr, tas_ann.rolling(10, center=True).mean().values,
              color=color, lw=2.2, label=name)

    ax_p.plot(yr, pr_ann.values,  color=color, alpha=0.3, lw=0.9)
    ax_p.plot(yr, pr_ann.rolling(10, center=True).mean().values,
              color=color, lw=2.2, label=name)

ax_t.set_ylabel("Temperature (°C)", fontsize=11)
ax_t.set_title("Near-Surface Air Temperature (10-yr rolling mean bold)", fontsize=10)
ax_t.legend(fontsize=10)

ax_p.set_ylabel("Precipitation (mm/month)", fontsize=11)
ax_p.set_xlabel("Year", fontsize=11)
ax_p.set_title("Monthly Precipitation — annual mean (10-yr rolling mean bold)", fontsize=10)
ax_p.legend(fontsize=10)

plt.tight_layout()
plt.savefig("fig2_temp_precip.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig2_temp_precip.png")


# ── Fig 3: SPI-12 time series ─────────────────────────────────────────────────
fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
fig.suptitle(
    "12-Month Standardised Precipitation Index (SPI-12)\n"
    "Great Basin vs Death Valley · 1950–2014",
    fontsize=13, fontweight="bold",
)

for ax, name in zip(axes, LOCS):
    spi   = spi_series[name].dropna()
    color = COLORS[name]

    for yval, lcolor in [(0, "grey"), (-1.0, "#F4A460"),
                         (-1.5, "#CD5C5C"), (-2.0, "#8B0000")]:
        ax.axhline(yval, color=lcolor, lw=0.8,
                   linestyle="--" if yval == 0 else ":")

    ax.fill_between(spi.index, spi.values, 0,
                    where=(spi.values >= 0), color="#4575b4", alpha=0.45, label="Wet")
    ax.fill_between(spi.index, spi.values, 0,
                    where=(spi.values <  0), color=color,     alpha=0.55, label="Dry")
    ax.plot(spi.index, spi.values, color=color, lw=0.7, alpha=0.7)

    roll = spi.rolling(24, center=True).mean()
    ax.plot(roll.index, roll.values, color="black", lw=1.8, label="24-mo mean")

    pct = (spi < -1.0).mean() * 100
    ax.text(0.01, 0.04, f"Months with SPI < −1.0: {pct:.1f}%",
            transform=ax.transAxes, fontsize=9, color="darkred",
            bbox=dict(boxstyle="round,pad=0.25", fc="white", alpha=0.75))

    ax.set_ylim(-3.5, 3.5)
    ax.set_ylabel("SPI-12", fontsize=10)
    ax.set_title(name, fontsize=11, fontweight="bold", color=color)
    ax.legend(fontsize=8, loc="upper right")

axes[-1].set_xlabel("Year", fontsize=11)
plt.tight_layout()
plt.savefig("fig3_spi_timeseries.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig3_spi_timeseries.png")


# ── Fig 4: Drought category frequency ────────────────────────────────────────
def drought_frequencies(spi: pd.Series) -> dict:
    s = spi.dropna()
    return {
        "Near Normal":      (s >= -1.0).mean()                   * 100,
        "Moderate Drought": ((s < -1.0) & (s >= -1.5)).mean()   * 100,
        "Severe Drought":   ((s < -1.5) & (s >= -2.0)).mean()   * 100,
        "Extreme Drought":  (s < -2.0).mean()                    * 100,
    }

freq = {name: drought_frequencies(spi_series[name]) for name in LOCS}
cats = list(next(iter(freq.values())).keys())
x    = np.arange(len(cats))
w    = 0.35

fig, ax = plt.subplots(figsize=(10, 6))
fig.suptitle(
    "Drought Category Frequency — Great Basin vs Death Valley\n"
    "(SPI-12 · 1950–2014)",
    fontsize=13, fontweight="bold",
)

for i, name in enumerate(LOCS):
    vals  = [freq[name][c] for c in cats]
    bars  = ax.bar(x + (i - 0.5)*w, vals, w, label=name,
                   color=COLORS[name], alpha=0.80,
                   edgecolor="white", linewidth=0.6)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2,
                bar.get_height() + 0.5,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=8)

ax.set_xticks(x)
ax.set_xticklabels(cats, fontsize=10)
ax.set_ylabel("% of months", fontsize=11)
ax.set_ylim(0, 100)
ax.axhline(5, color="grey", lw=0.7, linestyle="--",
           label="5% expected under normal climate")
ax.legend(fontsize=10)
ax.text(0.5, 0.92,
        "Both cold (Great Basin) and hot (Death Valley) deserts\n"
        "show elevated drought frequency — aridity transcends temperature.",
        transform=ax.transAxes, ha="center", va="top",
        fontsize=9, style="italic",
        bbox=dict(boxstyle="round,pad=0.4", fc="#FFF8F0",
                  ec="#C0622B", alpha=0.9))

plt.tight_layout()
plt.savefig("fig4_drought_frequency.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig4_drought_frequency.png")

# ═══════════════════════════════════════════════════════════════════════════════
# 6.  Summary statistics
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "="*60)
print("SUMMARY — Great Basin vs Death Valley (1950–2014)")
print("="*60)
for name in LOCS:
    spi     = spi_series[name].dropna()
    tas_ann = annual[name]["tas"]
    pr_ann  = annual[name]["pr"]
    print(f"\n{name}")
    print(f"  Mean annual temperature : {tas_ann.mean():.2f} °C")
    print(f"  Mean monthly precip     : {pr_ann.mean():.1f} mm/month")
    print(f"  Mean SPI-12             : {spi.mean():.3f}")
    print(f"  % months SPI < −1.0     : {(spi < -1.0).mean()*100:.1f}%")
    print(f"  % months SPI < −2.0     : {(spi < -2.0).mean()*100:.1f}%")

print("\n[DONE] 4 figures saved.")