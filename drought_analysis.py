"""
climate_analysis.py

Exploratory analysis of climate_agg.csv and climate_agg_country.csv,
adapted from drought_analysis.py.

Covers:
  A. Continent-level  (climate_agg.csv)
     1.  SPI heatmap by decade
     2.  Decade-to-decade SPI change
     3.  Magnitude of SPI change
     4.  Baseline (1850–1949) vs Modern (1990–2014): SPI, variability, temperature
     5.  Temperature trend heatmap by decade
     6.  Precipitation trend heatmap by decade
     7.  Trend slopes (SPI, temp, precip) — baseline vs modern
     8.  Final summary table

  B. Country-level  (climate_agg_country.csv)
     9.  Top / bottom countries by SPI change
     10. Top / bottom countries by temperature change
     11. Country-level SPI trend slopes (modern period)

SPI sign: positive = wetter than normal, negative = drier than normal.
"""

import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.stats import linregress

# ═══════════════════════════════════════════════════════════════════════════════
# 0. Load & filter
# ═══════════════════════════════════════════════════════════════════════════════

CONTINENT_CSV = "climate_agg.csv"
COUNTRY_CSV   = "climate_agg_country.csv"

BASELINE_START, BASELINE_END = 1850, 1949
MODERN_START,   MODERN_END   = 1990, 2014

df_cont = pd.read_csv(CONTINENT_CSV)
df_ctry = pd.read_csv(COUNTRY_CSV)

# Drop ocean / unclassified rows if any leaked through
EXCLUDE = {"Ocean / Unclassified"}
df_cont = df_cont[~df_cont["continent"].isin(EXCLUDE)].copy()
df_ctry = df_ctry[~df_ctry["continent"].isin(EXCLUDE)].copy()

df_cont["decade"] = (df_cont["year"] // 10) * 10
df_ctry["decade"] = (df_ctry["year"] // 10) * 10

# ── Collapse climate_zone → one row per (continent, year) ────────────────────
# Each year otherwise appears up to 3× (Polar / Temperate / Tropical),
# which would bias regressions and period averages.
annual = (
    df_cont
    .groupby(["continent", "year", "decade"])
    .agg(
        mean_spi       = ("mean_spi",       "mean"),
        mean_temp_C    = ("mean_temp_C",    "mean"),
        mean_pr_mm_day = ("mean_pr_mm_day", "mean"),
    )
    .reset_index()
)

# ── Country annual (already one row per country/year in the country CSV) ─────
annual_ctry = (
    df_ctry
    .groupby(["country", "continent", "year", "decade"])
    .agg(
        mean_spi       = ("mean_spi",       "mean"),
        mean_temp_C    = ("mean_temp_C",    "mean"),
        mean_pr_mm_day = ("mean_pr_mm_day", "mean"),
    )
    .reset_index()
)


# ═══════════════════════════════════════════════════════════════════════════════
# PART A — CONTINENT-LEVEL
# ═══════════════════════════════════════════════════════════════════════════════

# ── 1. Heatmap: Raw SPI by decade ─────────────────────────────────────────────
heat_spi = (
    annual
    .groupby(["continent", "decade"])["mean_spi"]
    .mean()
    .reset_index()
    .pivot(index="continent", columns="decade", values="mean_spi")
)

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(heat_spi, center=0, cmap="RdBu", ax=ax, annot=False)
ax.set_title("Mean SPI by Continent and Decade\n(blue = wetter, red = drier)")
plt.tight_layout()
plt.savefig("heatmap_spi_raw.png", dpi=150)
plt.show()

# ── 2. Heatmap: Decade-to-decade SPI change ───────────────────────────────────
spi_change = heat_spi.diff(axis=1)

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(spi_change, center=0, cmap="RdBu", ax=ax)
ax.set_title("Decade-to-Decade SPI Change by Continent")
plt.tight_layout()
plt.savefig("heatmap_spi_change.png", dpi=150)
plt.show()

# ── 3. Heatmap: Magnitude of SPI change ───────────────────────────────────────
fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(spi_change.abs(), cmap="Reds", ax=ax)
ax.set_title("Magnitude of Decade-to-Decade SPI Change (absolute value)")
plt.tight_layout()
plt.savefig("heatmap_change_magnitude.png", dpi=150)
plt.show()

# ── 4. Baseline vs Modern: SPI, variability, temperature ──────────────────────
def period_stats(data, year_min, year_max, suffix):
    return (
        data[(data.year >= year_min) & (data.year <= year_max)]
        .groupby("continent")
        .agg(
            spi       = ("mean_spi",       "mean"),
            spi_std   = ("mean_spi",       "std"),
            temp_C    = ("mean_temp_C",    "mean"),
            pr_mm_day = ("mean_pr_mm_day", "mean"),
        )
        .rename(columns=lambda c: f"{c}_{suffix}")
    )

baseline_stats = period_stats(annual, BASELINE_START, BASELINE_END, "base")
modern_stats   = period_stats(annual, MODERN_START,   MODERN_END,   "mod")

comparison = baseline_stats.merge(modern_stats, left_index=True, right_index=True)
comparison["spi_change"]         = comparison["spi_mod"]     - comparison["spi_base"]
comparison["variability_change"] = comparison["spi_std_mod"] - comparison["spi_std_base"]
comparison["temp_change_C"]      = comparison["temp_C_mod"]  - comparison["temp_C_base"]
comparison["pr_change"]          = comparison["pr_mm_day_mod"] - comparison["pr_mm_day_base"]

print("\n── Baseline vs Modern Summary ──")
print(comparison[[
    "spi_base",  "spi_mod",  "spi_change",
    "spi_std_base", "spi_std_mod", "variability_change",
    "temp_C_base",  "temp_C_mod",  "temp_change_C",
    "pr_mm_day_base", "pr_mm_day_mod", "pr_change",
]].round(4).to_string())

# Heatmap: SPI + variability
fig, ax = plt.subplots(figsize=(12, 5))
sns.heatmap(
    comparison[["spi_base", "spi_mod", "spi_change",
                "spi_std_base", "spi_std_mod", "variability_change"]],
    center=0, cmap="RdBu", ax=ax, annot=True, fmt=".3f"
)
ax.set_title("Baseline vs Modern: SPI and Variability")
plt.tight_layout()
plt.savefig("heatmap_comparison_spi.png", dpi=150)
plt.show()

# Heatmap: Temperature change (separate — different scale from SPI)
fig, ax = plt.subplots(figsize=(8, 5))
sns.heatmap(
    comparison[["temp_C_base", "temp_C_mod", "temp_change_C"]],
    center=0, cmap="coolwarm", ax=ax, annot=True, fmt=".3f"
)
ax.set_title("Baseline vs Modern: Near-Surface Temperature (°C)")
plt.tight_layout()
plt.savefig("heatmap_comparison_temp.png", dpi=150)
plt.show()

# Heatmap: Precipitation change
fig, ax = plt.subplots(figsize=(8, 5))
sns.heatmap(
    comparison[["pr_mm_day_base", "pr_mm_day_mod", "pr_change"]],
    center=0, cmap="RdBu", ax=ax, annot=True, fmt=".3f"
)
ax.set_title("Baseline vs Modern: Precipitation (mm/day)")
plt.tight_layout()
plt.savefig("heatmap_comparison_precip.png", dpi=150)
plt.show()

# ── 5. Temperature trend heatmap by decade ────────────────────────────────────
heat_temp = (
    annual
    .groupby(["continent", "decade"])["mean_temp_C"]
    .mean()
    .reset_index()
    .pivot(index="continent", columns="decade", values="mean_temp_C")
)

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(heat_temp, cmap="coolwarm", ax=ax)
ax.set_title("Mean Near-Surface Temperature (°C) by Continent and Decade")
plt.tight_layout()
plt.savefig("heatmap_temp_decade.png", dpi=150)
plt.show()

# ── 6. Precipitation trend heatmap by decade ──────────────────────────────────
heat_pr = (
    annual
    .groupby(["continent", "decade"])["mean_pr_mm_day"]
    .mean()
    .reset_index()
    .pivot(index="continent", columns="decade", values="mean_pr_mm_day")
)

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(heat_pr, cmap="YlGnBu", ax=ax)
ax.set_title("Mean Precipitation (mm/day) by Continent and Decade")
plt.tight_layout()
plt.savefig("heatmap_precip_decade.png", dpi=150)
plt.show()

# ── 7. Trend slopes: baseline vs modern ───────────────────────────────────────
def get_slopes(data, year_min, year_max, variable):
    subset = data[(data.year >= year_min) & (data.year <= year_max)]
    return (
        subset
        .groupby("continent")
        .apply(
            lambda g: linregress(g["year"], g[variable]).slope,
            include_groups=False
        )
        .rename("slope")
    )

for var, label, fname in [
    ("mean_spi",       "SPI",                 "slopes_spi"),
    ("mean_temp_C",    "Temperature (°C)",     "slopes_temp"),
    ("mean_pr_mm_day", "Precipitation mm/day", "slopes_precip"),
]:
    base_s = get_slopes(annual, BASELINE_START, BASELINE_END, var)
    mod_s  = get_slopes(annual, MODERN_START,   MODERN_END,   var)
    delta  = (mod_s - base_s).rename("slope_change")
    slopes_df = pd.concat([base_s.rename("baseline_slope"),
                            mod_s.rename("modern_slope"),
                            delta], axis=1)
    print(f"\n── {label} Slope Change (modern − baseline) ──")
    print(slopes_df.round(6).to_string())

    fig, ax = plt.subplots(figsize=(7, 5))
    sns.heatmap(slopes_df, center=0, cmap="RdBu", annot=True,
                fmt=".5f", ax=ax)
    ax.set_title(f"{label}: Trend Slopes — Baseline vs Modern")
    plt.tight_layout()
    plt.savefig(f"heatmap_{fname}.png", dpi=150)
    plt.show()

# ── 8. Final continent summary table ──────────────────────────────────────────
spi_slope_base = get_slopes(annual, BASELINE_START, BASELINE_END, "mean_spi")
spi_slope_mod  = get_slopes(annual, MODERN_START,   MODERN_END,   "mean_spi")

summary = comparison[["spi_change", "variability_change",
                       "temp_change_C", "pr_change"]].copy()
summary["spi_slope_change"] = spi_slope_mod - spi_slope_base

print("\n── Final Continent Summary Table ──")
print(summary.round(4).to_string())
summary.to_csv("continent_summary.csv")


# ═══════════════════════════════════════════════════════════════════════════════
# PART B — COUNTRY-LEVEL
# ═══════════════════════════════════════════════════════════════════════════════

# ── 9. Top / bottom countries by SPI change ───────────────────────────────────
def country_period_mean(data, year_min, year_max, variable, suffix):
    return (
        data[(data.year >= year_min) & (data.year <= year_max)]
        .groupby(["country", "continent"])[variable]
        .mean()
        .rename(f"{variable}_{suffix}")
    )

spi_base_c = country_period_mean(annual_ctry, BASELINE_START, BASELINE_END, "mean_spi", "base")
spi_mod_c  = country_period_mean(annual_ctry, MODERN_START,   MODERN_END,   "mean_spi", "mod")
temp_base_c = country_period_mean(annual_ctry, BASELINE_START, BASELINE_END, "mean_temp_C", "base")
temp_mod_c  = country_period_mean(annual_ctry, MODERN_START,   MODERN_END,   "mean_temp_C", "mod")

ctry_comp = pd.concat([spi_base_c, spi_mod_c, temp_base_c, temp_mod_c], axis=1).dropna()
ctry_comp["spi_change"]    = ctry_comp["mean_spi_mod"]    - ctry_comp["mean_spi_base"]
ctry_comp["temp_change_C"] = ctry_comp["mean_temp_C_mod"] - ctry_comp["mean_temp_C_base"]

N = 15

fig, axes = plt.subplots(1, 2, figsize=(16, 6))
for ax, col, title, cmap in [
    (axes[0], "spi_change",    "Most Drying (lowest SPI change)", "RdBu"),
    (axes[1], "spi_change",    "Most Wetting (highest SPI change)", "RdBu_r"),
]:
    ascending = (title.startswith("Most Drying"))
    data = ctry_comp["spi_change"].sort_values(ascending=ascending).head(N)
    colors = ["#d73027" if v < 0 else "#4575b4" for v in data.values]
    ax.barh(data.index.get_level_values("country"), data.values, color=colors)
    ax.axvline(0, color="black", linewidth=0.8)
    ax.set_title(title)
    ax.set_xlabel("SPI change (modern − baseline)")
plt.suptitle("Country-Level SPI Change: Baseline vs Modern", fontsize=13)
plt.tight_layout()
plt.savefig("country_spi_change.png", dpi=150)
plt.show()

# ── 10. Top / bottom countries by temperature change ─────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
for ax, ascending, title in [
    (axes[0], False, f"Top {N} Largest Warming"),
    (axes[1], True,  f"Top {N} Smallest Warming / Cooling"),
]:
    data = ctry_comp["temp_change_C"].sort_values(ascending=ascending).head(N)
    colors = ["#d73027" if v > 0 else "#4575b4" for v in data.values]
    ax.barh(data.index.get_level_values("country"), data.values, color=colors)
    ax.axvline(0, color="black", linewidth=0.8)
    ax.set_title(title)
    ax.set_xlabel("Temp change °C (modern − baseline)")
plt.suptitle("Country-Level Temperature Change: Baseline vs Modern", fontsize=13)
plt.tight_layout()
plt.savefig("country_temp_change.png", dpi=150)
plt.show()

# ── 11. Country SPI trend slopes (modern period only, top movers) ─────────────
ctry_slopes = (
    annual_ctry[
        (annual_ctry.year >= MODERN_START) &
        (annual_ctry.year <= MODERN_END)
    ]
    .groupby(["country", "continent"])
    .apply(
        lambda g: linregress(g["year"], g["mean_spi"]).slope
        if len(g) >= 5 else np.nan,
        include_groups=False
    )
    .dropna()
    .rename("spi_slope_modern")
    .reset_index()
    .sort_values("spi_slope_modern")
)

fig, axes = plt.subplots(1, 2, figsize=(16, 6))
for ax, df_slice, title in [
    (axes[0], ctry_slopes.head(N),  f"Top {N} Drying Trends (most negative slope)"),
    (axes[1], ctry_slopes.tail(N),  f"Top {N} Wetting Trends (most positive slope)"),
]:
    colors = ["#d73027" if v < 0 else "#4575b4" for v in df_slice["spi_slope_modern"]]
    ax.barh(df_slice["country"], df_slice["spi_slope_modern"], color=colors)
    ax.axvline(0, color="black", linewidth=0.8)
    ax.set_title(title)
    ax.set_xlabel("SPI trend slope (SPI units / year)")
plt.suptitle("Country-Level SPI Trend Slopes — Modern Period", fontsize=13)
plt.tight_layout()
plt.savefig("country_spi_slopes.png", dpi=150)
plt.show()

# Save country comparison
ctry_comp.reset_index().to_csv("country_summary.csv", index=False)
ctry_slopes.to_csv("country_spi_slopes.csv", index=False)

print("\n[SAVED] continent_summary.csv, country_summary.csv, country_spi_slopes.csv")
print("[SAVED] 12 PNG figures")