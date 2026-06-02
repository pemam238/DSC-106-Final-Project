"""
climate_pipeline.py

Loads pr (precipitation) + tas (near-surface air temperature) from CMIP6,
computes SPI-12, and aggregates to one row per (year, climate_zone, continent).

Output: climate_agg.csv
Columns:
  year, climate_zone, continent,
  mean_temp_C     – average near-surface air temperature (°C)
  mean_pr_mm_day  – average daily precipitation (mm/day)
  mean_spi        – average SPI-12 (negative = drier than normal)
"""

import numpy as np
import pandas as pd
import xarray as xr
import gcsfs

# ── catalog + connection ─────────────────────────────────────────────────────
df_cat = pd.read_csv('https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv')
gcs    = gcsfs.GCSFileSystem(token='anon')

SOURCE_ID          = 'GISS-E2-1-G'
FALLBACK_SOURCE_ID = 'GFDL-ESM4'
MEMBER_ID          = 'r1i1p1f1'
EXPERIMENT_ID      = 'historical'   # change to 'abrupt-4xCO2', 'ssp585', etc.
COARSEN_DEG        = 5              # spatial resolution in degrees
SPI_SCALE          = 12             # months — SPI-12 captures long-term drought


# ── loader ───────────────────────────────────────────────────────────────────
def load_var(variable_id, table_id,
             experiment_id=EXPERIMENT_ID,
             source_id=SOURCE_ID,
             member_id=MEMBER_ID):
    subset = df_cat.query(
        f"experiment_id=='{experiment_id}' & "
        f"variable_id=='{variable_id}' & "
        f"table_id=='{table_id}' & "
        f"source_id=='{source_id}' & "
        f"member_id=='{member_id}'"
    )
    if subset.empty and source_id == SOURCE_ID:
        print(f"  [FALLBACK] {variable_id} | trying {FALLBACK_SOURCE_ID}")
        return load_var(variable_id, table_id,
                        experiment_id=experiment_id,
                        source_id=FALLBACK_SOURCE_ID,
                        member_id=member_id)
    if subset.empty:
        print(f"  [MISS] {variable_id} | {table_id} | {experiment_id} | {source_id}")
        return None
    return xr.open_zarr(gcs.get_mapper(subset.iloc[0].zstore), consolidated=True)


# ── SPI calculation ──────────────────────────────────────────────────────────
def compute_spi(pr_series: pd.Series, scale: int = SPI_SCALE) -> pd.Series:
    """
    Standardized Precipitation Index over a rolling window.

    SPI interpretation:
        0    to -0.99  : near normal / mild dry
       -1.00 to -1.49  : moderate drought
       -1.50 to -1.99  : severe drought
       -2.00 and below : extreme drought

    Returns NaN for the first (scale - 1) months (insufficient window).
    """
    rolled = pr_series.rolling(scale, min_periods=scale).mean()
    mean   = rolled.mean()
    std    = rolled.std()
    if std == 0 or np.isnan(std):
        return pd.Series(np.nan, index=pr_series.index)
    return (rolled - mean) / std


# ── regional classifiers ─────────────────────────────────────────────────────
def assign_climate_zone(lat: float) -> str:
    alat = abs(lat)
    if alat <= 23.5:
        return 'Tropical'
    elif alat <= 66.5:
        return 'Temperate'
    else:
        return 'Polar'


def assign_continent(lat: float, lon: float) -> str:
    if lon > 180:
        lon -= 360
    if lat <= -60:
        return 'Antarctica'
    if -50 <= lat <= 0 and 110 <= lon <= 180:
        return 'Australia-Oceania'
    if -25 <= lat <= 25 and 160 <= lon <= 180:
        return 'Australia-Oceania'
    if -60 <= lat <= 15 and -85 <= lon <= -34:
        return 'South America'
    if 15 <= lat <= 85 and -170 <= lon <= -50:
        return 'North America'
    if 50 <= lat <= 85 and -50 <= lon <= -10:
        return 'North America'
    if -40 <= lat <= 38 and -20 <= lon <= 55:
        return 'Africa'
    if 35 <= lat <= 72 and -25 <= lon <= 45:
        return 'Europe'
    if 0 <= lat <= 80 and 25 <= lon <= 180:
        return 'Asia'
    if -15 <= lat <= 30 and 45 <= lon <= 80:
        return 'Asia'
    return 'Ocean / Unclassified'


# ── coarsen helper ────────────────────────────────────────────────────────────
def coarsen_da(da: xr.DataArray, target_deg: float = COARSEN_DEG) -> xr.DataArray:
    lat_step = abs(float(da.lat[1] - da.lat[0]))
    factor   = max(1, int(round(target_deg / lat_step)))
    if factor > 1:
        da = da.coarsen(lat=factor, lon=factor, boundary='trim').mean()
    return da


# ── to tidy dataframe helper ──────────────────────────────────────────────────
def to_tidy(da: xr.DataArray, name: str) -> pd.DataFrame:
    df = da.to_dataframe(name=name).reset_index().dropna(subset=[name])
    time_col = next(c for c in df.columns if 'time' in c.lower())
    df = df.rename(columns={time_col: 'time'})
    return df[['lat', 'lon', 'time', name]]


# ══════════════════════════════════════════════════════════════════════════════
# 1. PRECIPITATION (pr)
# ══════════════════════════════════════════════════════════════════════════════
print("Loading pr (precipitation) ...")
ds_pr  = load_var('pr', 'Amon')
pr_da  = coarsen_da(ds_pr['pr'] * 86400)   # kg/m²/s → mm/day
df_pr  = to_tidy(pr_da, 'pr_mm_day').sort_values(['lat', 'lon', 'time'])

# Compute SPI-12 per grid cell
print(f"Computing SPI-{SPI_SCALE} ...")
df_pr['spi'] = (
    df_pr
    .groupby(['lat', 'lon'])['pr_mm_day']
    .transform(lambda s: compute_spi(s, SPI_SCALE))
)

# Annual means per cell
df_pr['year'] = df_pr['time'].apply(lambda t: t.year)
df_pr_annual  = (
    df_pr.dropna(subset=['spi'])
         .groupby(['lat', 'lon', 'year'])
         .agg(mean_pr_mm_day=('pr_mm_day', 'mean'),
              mean_spi       =('spi',       'mean'))
         .reset_index()
)

# ══════════════════════════════════════════════════════════════════════════════
# 2. TEMPERATURE (tas  — near-surface air temperature)
# ══════════════════════════════════════════════════════════════════════════════
print("Loading tas (near-surface air temperature) ...")
ds_tas = load_var('tas', 'Amon')
tas_da = coarsen_da(ds_tas['tas'] - 273.15)   # K → °C
df_tas = to_tidy(tas_da, 'tas_C').sort_values(['lat', 'lon', 'time'])

df_tas['year']   = df_tas['time'].apply(lambda t: t.year)
df_tas_annual    = (
    df_tas.dropna(subset=['tas_C'])
          .groupby(['lat', 'lon', 'year'])
          .agg(mean_temp_C=('tas_C', 'mean'))
          .reset_index()
)

# ══════════════════════════════════════════════════════════════════════════════
# 3. MERGE pr + tas on (lat, lon, year)
# ══════════════════════════════════════════════════════════════════════════════
print("Merging precipitation and temperature ...")
df_combined = pd.merge(df_pr_annual, df_tas_annual,
                       on=['lat', 'lon', 'year'], how='inner')

# ══════════════════════════════════════════════════════════════════════════════
# 4. REGIONAL LABELS
# ══════════════════════════════════════════════════════════════════════════════
df_combined['climate_zone'] = df_combined['lat'].apply(assign_climate_zone)
df_combined['continent']    = df_combined.apply(
    lambda r: assign_continent(r['lat'], r['lon']), axis=1
)

# ══════════════════════════════════════════════════════════════════════════════
# 5. AGGREGATE to (year, climate_zone, continent)
# ══════════════════════════════════════════════════════════════════════════════
print("Aggregating ...")
agg = (
    df_combined
    .groupby(['year', 'climate_zone', 'continent'])
    .agg(
        mean_temp_C    = ('mean_temp_C',    'mean'),
        mean_pr_mm_day = ('mean_pr_mm_day', 'mean'),
        mean_spi       = ('mean_spi',       'mean'),
    )
    .reset_index()
)

float_cols = ['mean_temp_C', 'mean_pr_mm_day', 'mean_spi']
agg[float_cols] = agg[float_cols].round(4)

agg.to_csv('climate_agg.csv', index=False)

# ── sanity output ─────────────────────────────────────────────────────────────
print(f"\n[SAVED] climate_agg.csv")
print(f"Shape  : {agg.shape}")
print(f"Years  : {agg['year'].min()}–{agg['year'].max()}")
print(f"\nColumns:\n{agg.dtypes}")
print(f"\nSample (10 rows):\n{agg.head(10).to_string(index=False)}")
print(f"\nMean temperature by continent:")
print(agg.groupby('continent')['mean_temp_C'].mean().sort_values().round(2).to_string())
print(f"\nMean SPI by continent:")
print(agg.groupby('continent')['mean_spi'].mean().sort_values().round(4).to_string())