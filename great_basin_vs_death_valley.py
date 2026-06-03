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
  1. fig1_climate_profile.png  — stacked monthly climate profile (temp + precip bars)
  2. fig2_temp_precip.png      — annual temperature & precipitation comparison
  3. fig3_spi_timeseries.png   — 12-month SPI side-by-side time series
  4. fig4_drought_frequency.png— drought-category frequency bar chart

Data
----
  Model : MPI-ESM1-2-HR  (high-resolution, good western-US coverage)
  Experiment : historical  (1850-2014)
  Variables  : tas (near-surface air temp), pr (precipitation)
  Zarr store : Google Cloud Storage via Pangeo ESGF catalog

Coordinates
-----------
  Great Basin center : 40.67°N, 117.67°W
  Death Valley center: 36.46°N, 116.87°W
"""

# ── Standard library ──────────────────────────────────────────────────────────
import warnings
warnings.filterwarnings("ignore")

# ── Third-party ───────────────────────────────────────────────────────────────
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec
from matplotlib.lines import Line2D
import gcsfs
import xarray as xr
import intake
from scipy.stats import gamma, norm

# ═══════════════════════════════════════════════════════════════════════════════
# 0.  Configuration
# ═══════════════════════════════════════════════════════════════════════════════

LOCS = {
    "Great Basin":  {"lat": 40.67, "lon": -117.67},
    "Death Valley": {"lat": 36.46, "lon": -116.87},
}

# Plotting palette  (earthy / desert tones)
COLORS = {
    "Great Basin":  "#5B8DB8",   # dusty blue  (cold desert sky)
    "Death Valley": "#C0622B",   # burnt sienna (hot sand)
    "neutral":      "#6B6B6B",
}

MODEL       = "MPI-ESM1-2-HR"
EXPERIMENT  = "historical"
TABLE_TAS   = "Amon"   # monthly air temperature
TABLE_PR    = "Amon"   # monthly precipitation
MEMBER      = "r1i1p1f1"
GRID        = "gn"

SPI_WINDOW  = 12        # months  — 12-month SPI is standard for drought
MODERN_SLICE = slice("1950", "2014")
CLIMATE_NORM  = slice("1981", "2010")   # WMO climate normal for profile

# ═══════════════════════════════════════════════════════════════════════════════
# 1.  Load CMIP6 data from GCS via Pangeo catalog
# ═══════════════════════════════════════════════════════════════════════════════

print("Opening Pangeo ESGF catalog …")
cat_url = "https://storage.googleapis.com/cmip6/pangeo-cmip6.json"
col = intake.open_esm_datastore(cat_url)

def query_var(variable_id, table_id):
    """Return a single Dataset for the requested variable."""
    subset = col.search(
        source_id       = MODEL,
        experiment_id   = EXPERIMENT,
        variable_id     = variable_id,
        table_id        = table_id,
        member_id       = MEMBER,
        grid_label      = GRID,
    )
    if len(subset.df) == 0:
        raise RuntimeError(
            f"No results for {variable_id}/{table_id}/{MODEL}/{EXPERIMENT}. "
            "Try a different member_id or grid_label."
        )
    dsets = subset.to_dataset_dict(
        zarr_kwargs={"consolidated": True},
        storage_options={"token": "anon"},
    )
    key = list(dsets.keys())[0]
    return dsets[key]

print(f"Fetching tas ({TABLE_TAS}) …")
ds_tas = query_var("tas", TABLE_TAS)

print(f"Fetching pr ({TABLE_PR}) …")
ds_pr  = query_var("pr", TABLE_PR)

# ── Normalize longitude to –180 … 180 if stored as 0 … 360 ──────────────────
for ds in [ds_tas, ds_pr]:
    if ds["lon"].values.max() > 180:
        ds["lon"] = xr.where(ds["lon"] > 180, ds["lon"] - 360, ds["lon"])

# ═══════════════════════════════════════════════════════════════════════════════
# 2.  Extract nearest grid cells
# ═══════════════════════════════════════════════════════════════════════════════

def nearest_point(ds, lat, lon, var):
    """Select the single grid cell nearest to (lat, lon) and return a DataArray."""
    return ds[var].sel(lat=lat, lon=lon, method="nearest").squeeze()

print("Extracting grid cells …")
series = {}   # dict[location][variable] → monthly DataArray
for name, coords in LOCS.items():
    lat, lon = coords["lat"], coords["lon"]
    tas_da = nearest_point(ds_tas, lat, lon, "tas")   # K
    pr_da  = nearest_point(ds_pr,  lat, lon, "pr")    # kg m⁻² s⁻¹  →  mm/day

    # Unit conversions
    tas_C  = tas_da - 273.15                          # → °C
    pr_mmd = pr_da * 86_400                           # → mm day⁻¹

    # Restrict to MODERN_SLICE and load into memory
    series[name] = {
        "tas": tas_C.sel(time=MODERN_SLICE).load(),
        "pr":  pr_mmd.sel(time=MODERN_SLICE).load(),
    }
    print(f"  {name}: lat={float(tas_C.lat):.2f}, lon={float(tas_C.lon):.2f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3.  Compute SPI-12
# ═══════════════════════════════════════════════════════════════════════════════

def compute_spi(pr_monthly: xr.DataArray, window: int = 12) -> pd.Series:
    """
    Compute SPI for a 1-D monthly precipitation DataArray.

    Steps
    -----
    1. Roll a `window`-month accumulation.
    2. For each calendar month, fit a gamma distribution to the rolling sums
       from the full record (using the calibration period).
    3. Transform to standard normal (SPI).

    Returns a pd.Series aligned to the input time index (NaN for the first
    `window-1` periods).
    """
    pr = pd.Series(pr_monthly.values, index=pd.DatetimeIndex(pr_monthly.time.values))
    acc = pr.rolling(window).sum()          # rolling accumulation

    spi = pd.Series(np.nan, index=acc.index)

    for month in range(1, 13):
        mask  = acc.index.month == month
        vals  = acc[mask].dropna()
        if len(vals) < 10:
            continue

        # Fit gamma (loc=0 forced — precipitation can't be negative)
        shape, loc, scale = gamma.fit(vals, floc=0)

        # CDF → ppf of normal
        cdf_vals = gamma.cdf(acc[mask], shape, loc=loc, scale=scale)

        # Clip to avoid inf at 0 or 1
        cdf_vals = np.clip(cdf_vals, 1e-6, 1 - 1e-6)
        spi[mask] = norm.ppf(cdf_vals)

    return spi


print("Computing SPI-12 …")
spi_series = {}
for name in LOCS:
    spi_series[name] = compute_spi(series[name]["pr"], window=SPI_WINDOW)
    print(f"  {name}: mean SPI = {spi_series[name].mean():.3f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 4.  Climate normals (monthly averages over 1981-2010)
# ═══════════════════════════════════════════════════════════════════════════════

def monthly_normal(da: xr.DataArray, time_slice: slice) -> pd.DataFrame:
    """Return a DataFrame with columns [month, mean] from a monthly DataArray."""
    sub = da.sel(time=time_slice)
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

# Annual summaries (modern period)
annual = {}
for name in LOCS:
    tas_pd = pd.Series(
        series[name]["tas"].values,
        index=pd.DatetimeIndex(series[name]["tas"].time.values),
    )
    pr_pd = pd.Series(
        series[name]["pr"].values,
        index=pd.DatetimeIndex(series[name]["pr"].time.values),
    )
    annual[name] = {
        "tas": tas_pd.resample("YE").mean(),
        "pr":  pr_pd.resample("YE").mean() * 30.44,   # mm/day → mm/month approx
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

# ── Figure 1: Monthly climate profile (Walter-Lieth inspired) ─────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 6), sharey=False)
fig.suptitle(
    "Monthly Climate Profiles — Great Basin vs Death Valley\n"
    "(WMO Normal 1981–2010, MPI-ESM1-2-HR historical)",
    fontsize=13, fontweight="bold", y=1.01,
)

for ax, name in zip(axes, LOCS):
    color   = COLORS[name]
    tas_n   = normals[name]["tas"]
    pr_n    = normals[name]["pr"]

    x = np.arange(1, 13)
    ax2 = ax.twinx()

    # Precipitation bars (left axis)
    bars = ax.bar(x, pr_n.values, color=color, alpha=0.55, label="Precip (mm/day)", zorder=2)

    # Temperature line (right axis)
    ax2.plot(x, tas_n.values, color=color, linewidth=2.5,
             marker="o", markersize=5, label="Temp (°C)", zorder=3)
    ax2.axhline(0, color="grey", linewidth=0.6, linestyle="--")

    ax.set_xticks(x)
    ax.set_xticklabels(MONTHS, fontsize=9)
    ax.set_ylabel("Precipitation (mm/day)", color="steelblue", fontsize=10)
    ax2.set_ylabel("Temperature (°C)", color=color, fontsize=10)
    ax.set_title(f"{name}", fontsize=12, fontweight="bold", color=color)

    # Shade the "drought zone": where precip < 2×temp/10 (Gaussen aridity rule)
    for m in range(12):
        if pr_n.values[m] < (tas_n.values[m] / 5):
            ax.axvspan(m + 0.55, m + 1.45, color=color, alpha=0.10, zorder=0)

    # Annotation: mean annual temp & precip
    ax.text(0.97, 0.97,
            f"Mean annual\nT: {tas_n.mean():.1f}°C\nP: {pr_n.mean()*30.44:.0f} mm/mo",
            transform=ax.transAxes, va="top", ha="right", fontsize=9,
            bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.7))

    legend_patches = [
        mpatches.Patch(color=color, alpha=0.55, label="Precip (mm/day)"),
        Line2D([0], [0], color=color, linewidth=2.5, marker="o", label="Temp (°C)"),
        mpatches.Patch(color=color, alpha=0.10, label="Aridity period"),
    ]
    ax.legend(handles=legend_patches, fontsize=8, loc="upper left")

plt.tight_layout()
plt.savefig("fig1_climate_profile.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig1_climate_profile.png")


# ── Figure 2: Annual temperature & precipitation over time ────────────────────
fig, (ax_t, ax_p) = plt.subplots(2, 1, figsize=(13, 8), sharex=True)
fig.suptitle(
    "Annual Temperature & Precipitation — Great Basin vs Death Valley\n"
    "(1950–2014, MPI-ESM1-2-HR historical)",
    fontsize=13, fontweight="bold",
)

for name in LOCS:
    color = COLORS[name]
    yr    = annual[name]["tas"].index.year

    # Temperature with 10-yr rolling mean
    tas_ann = annual[name]["tas"]
    ax_t.plot(yr, tas_ann.values, color=color, alpha=0.35, linewidth=0.9)
    ax_t.plot(yr, tas_ann.rolling(10, center=True).mean().values,
              color=color, linewidth=2.2, label=name)

    # Precipitation
    pr_ann = annual[name]["pr"]
    ax_p.plot(yr, pr_ann.values, color=color, alpha=0.35, linewidth=0.9)
    ax_p.plot(yr, pr_ann.rolling(10, center=True).mean().values,
              color=color, linewidth=2.2, label=name)

ax_t.set_ylabel("Temperature (°C)", fontsize=11)
ax_t.legend(fontsize=10)
ax_t.set_title("Near-Surface Air Temperature (10-yr rolling mean bold)", fontsize=10)

ax_p.set_ylabel("Precipitation (mm/month)", fontsize=11)
ax_p.set_xlabel("Year", fontsize=11)
ax_p.set_title("Monthly Precipitation — annual mean (10-yr rolling mean bold)", fontsize=10)
ax_p.legend(fontsize=10)

plt.tight_layout()
plt.savefig("fig2_temp_precip.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig2_temp_precip.png")


# ── Figure 3: SPI-12 time series (side-by-side panels) ───────────────────────
fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
fig.suptitle(
    "12-Month Standardised Precipitation Index (SPI-12)\n"
    "Great Basin vs Death Valley  ·  1950–2014",
    fontsize=13, fontweight="bold",
)

DROUGHT_THRESHOLDS = {
    "Moderate drought":  (-1.0, -1.5),
    "Severe drought":    (-1.5, -2.0),
    "Extreme drought":   (-2.0, -99),
}
DROUGHT_COLORS = {
    "Moderate drought":  "#F4A460",
    "Severe drought":    "#CD5C5C",
    "Extreme drought":   "#8B0000",
}

for ax, name in zip(axes, LOCS):
    spi  = spi_series[name].dropna()
    color = COLORS[name]

    ax.axhline(0,    color="grey",  linewidth=0.7, linestyle="--")
    ax.axhline(-1.0, color="#F4A460", linewidth=0.8, linestyle=":")
    ax.axhline(-1.5, color="#CD5C5C", linewidth=0.8, linestyle=":")
    ax.axhline(-2.0, color="#8B0000", linewidth=0.8, linestyle=":")

    # Fill: wet (blue) / dry (red)
    ax.fill_between(spi.index, spi.values, 0,
                    where=(spi.values >= 0), color="#4575b4", alpha=0.45, label="Wet")
    ax.fill_between(spi.index, spi.values, 0,
                    where=(spi.values < 0),  color=color,     alpha=0.55, label="Dry")

    ax.plot(spi.index, spi.values, color=color, linewidth=0.7, alpha=0.7)

    # 24-month rolling mean
    roll = spi.rolling(24, center=True).mean()
    ax.plot(roll.index, roll.values, color="black", linewidth=1.8,
            linestyle="-", label="24-mo rolling mean")

    # Percent of months in drought (SPI < –1)
    pct_drought = (spi < -1.0).mean() * 100
    ax.text(0.01, 0.04,
            f"Months with SPI < −1.0: {pct_drought:.1f}%",
            transform=ax.transAxes, fontsize=9,
            color="darkred",
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


# ── Figure 4: Drought category frequency bar chart ───────────────────────────
CATEGORIES = {
    "Near Normal":       (spi >= -1.0),
    "Moderate\nDrought": (spi >= -1.5) & (spi < -1.0),
    "Severe\nDrought":   (spi >= -2.0) & (spi < -1.5),
    "Extreme\nDrought":  (spi < -2.0),
}
CAT_COLORS = ["#a8d5e2", "#F4A460", "#CD5C5C", "#8B0000"]

# Recompute per-location
def drought_frequencies(spi: pd.Series) -> dict:
    s = spi.dropna()
    return {
        "Near Normal":       (s >= -1.0).mean() * 100,
        "Moderate Drought":  ((s >= -1.5) & (s < -1.0)).mean() * 100,
        "Severe Drought":    ((s >= -2.0) & (s < -1.5)).mean() * 100,
        "Extreme Drought":   (s < -2.0).mean() * 100,
    }

freq = {name: drought_frequencies(spi_series[name]) for name in LOCS}
cats = list(freq[list(LOCS.keys())[0]].keys())

x     = np.arange(len(cats))
width = 0.35

fig, ax = plt.subplots(figsize=(10, 6))
fig.suptitle(
    "Drought Category Frequency — Great Basin vs Death Valley\n"
    "(SPI-12, 1950–2014)",
    fontsize=13, fontweight="bold",
)

names = list(LOCS.keys())
for i, name in enumerate(names):
    offset = (i - 0.5) * width
    vals   = [freq[name][c] for c in cats]
    bars   = ax.bar(x + offset, vals, width, label=name,
                    color=COLORS[name], alpha=0.80, edgecolor="white", linewidth=0.6)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=8)

ax.set_xticks(x)
ax.set_xticklabels(cats, fontsize=10)
ax.set_ylabel("% of months", fontsize=11)
ax.set_ylim(0, 100)
ax.axhline(5, color="grey", linewidth=0.7, linestyle="--",
           label="5% reference (expected under normal climate)")
ax.legend(fontsize=10)

# Callout: both deserts, different temperatures, same drought
ax.text(0.5, 0.92,
        "Both cold (Great Basin) and hot (Death Valley) deserts\n"
        "show elevated drought frequency — aridity transcends temperature.",
        transform=ax.transAxes, ha="center", va="top", fontsize=9, style="italic",
        bbox=dict(boxstyle="round,pad=0.4", fc="#FFF8F0", ec="#C0622B", alpha=0.9))

plt.tight_layout()
plt.savefig("fig4_drought_frequency.png", dpi=150, bbox_inches="tight")
plt.show()
print("Saved fig4_drought_frequency.png")

# ═══════════════════════════════════════════════════════════════════════════════
# 6.  Print summary statistics
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "="*60)
print("SUMMARY — Great Basin vs Death Valley (1950–2014)")
print("="*60)
for name in LOCS:
    spi = spi_series[name].dropna()
    tas_ann = annual[name]["tas"]
    pr_ann  = annual[name]["pr"]
    print(f"\n{name}")
    print(f"  Mean annual temperature : {tas_ann.mean():.2f} °C")
    print(f"  Mean monthly precip     : {pr_ann.mean():.1f} mm/month")
    print(f"  Mean SPI-12             : {spi.mean():.3f}")
    print(f"  % months SPI < –1.0     : {(spi < -1.0).mean()*100:.1f}%")
    print(f"  % months SPI < –2.0     : {(spi < -2.0).mean()*100:.1f}%")

print("\n[DONE] 4 figures saved.")