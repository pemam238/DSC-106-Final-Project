"""
climate_pipeline.py

Loads pr (precipitation) + tas (near-surface air temperature) from CMIP6,
computes SPI-12, and aggregates to:
  1. One row per (year, climate_zone, continent)   → climate_agg.csv
  2. One row per (year, country)                   → climate_agg_country.csv

Key fixes vs original:
  - assign_continent() replaced with a lookup-table approach (country centroids →
    nearest country → continent), eliminating bounding-box gaps that caused
    "Ocean / Unclassified" over Africa, South America, and parts of Asia.
  - assign_country() added using the same nearest-centroid logic (scipy KDTree).
  - Country→continent mapping sourced from the provided authoritative list.
"""

import numpy as np
import pandas as pd
import xarray as xr
import gcsfs
from scipy.spatial import cKDTree

# ── catalog + connection ─────────────────────────────────────────────────────
df_cat = pd.read_csv('https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv')
gcs    = gcsfs.GCSFileSystem(token='anon')

SOURCE_ID          = 'GISS-E2-1-G'
FALLBACK_SOURCE_ID = 'GFDL-ESM4'
MEMBER_ID          = 'r1i1p1f1'
EXPERIMENT_ID      = 'historical'   # change to 'abrupt-4xCO2', 'ssp585', etc.
COARSEN_DEG        = 5              # spatial resolution in degrees
SPI_SCALE          = 12             # months — SPI-12 captures long-term drought


# ══════════════════════════════════════════════════════════════════════════════
# COUNTRY / CONTINENT LOOKUP  (replaces heuristic bounding-box logic)
# ══════════════════════════════════════════════════════════════════════════════
# Each entry: (country_name, continent, centroid_lat, centroid_lon)
# Centroids from the provided coordinates list; continent from the authoritative
# mapping supplied by the user.  Russia is split between Asia and Europe in the
# original list — we keep it as "Asia/Europe" to match that source.
COUNTRY_DATA = [
    # South America
    ("Brazil",          "South America", -14.24, -51.93),
    ("Colombia",        "South America",   4.57, -74.30),
    ("Argentina",       "South America", -38.42, -63.62),
    ("Peru",            "South America",  -9.19, -75.02),
    ("Venezuela",       "South America",   6.42, -66.59),
    ("Chile",           "South America", -35.68, -71.54),
    ("Ecuador",         "South America",  -1.83, -78.18),
    ("Bolivia",         "South America", -16.29, -63.59),
    ("Paraguay",        "South America", -23.44, -58.44),
    ("Uruguay",         "South America", -32.52, -55.77),
    ("Guyana",          "South America",   4.86, -58.93),
    ("Suriname",        "South America",   3.92, -56.03),
    ("French Guiana",   "South America",   3.93, -53.13),
    ("Falkland Islands","South America", -51.80, -59.52),
    # Oceania
    ("Australia",             "Oceania", -25.27,  133.78),
    ("Papua New Guinea",      "Oceania",  -6.31,  143.96),
    ("New Zealand",           "Oceania", -40.90,  174.89),
    ("Fiji",                  "Oceania", -16.58,  179.41),
    ("Solomon Islands",       "Oceania",  -9.65,  160.16),
    ("Vanuatu",               "Oceania", -15.38,  166.96),
    ("New Caledonia",         "Oceania", -20.90,  165.62),
    ("French Polynesia",      "Oceania", -17.68, -149.41),
    ("Samoa",                 "Oceania", -13.76, -172.10),
    ("Guam",                  "Oceania",  13.44,  144.79),
    ("Kiribati",              "Oceania",  -3.37, -168.73),
    ("Micronesia",            "Oceania",   7.43,  150.55),
    ("Tonga",                 "Oceania", -21.18, -175.20),
    ("American Samoa",        "Oceania", -14.27, -170.13),
    ("Northern Mariana Islands","Oceania",17.33,  145.38),
    ("Marshall Islands",      "Oceania",   7.13,  171.18),
    ("Palau",                 "Oceania",   7.51,  134.58),
    ("Cook Islands",          "Oceania", -21.24, -159.78),
    ("Nauru",                 "Oceania",  -0.52,  166.93),
    ("Wallis and Futuna",     "Oceania", -13.77, -177.16),
    ("Tuvalu",                "Oceania",  -7.11,  177.65),
    ("Tokelau",               "Oceania",  -8.97, -171.86),
    ("Niue",                  "Oceania", -19.05, -169.87),
    # North America
    ("United States",         "North America",  37.09,  -95.71),
    ("Mexico",                "North America",  23.63, -102.55),
    ("Canada",                "North America",  56.13, -106.35),
    ("Guatemala",             "North America",  15.78,  -90.23),
    ("Haiti",                 "North America",  18.97,  -72.29),
    ("Dominican Republic",    "North America",  18.74,  -70.16),
    ("Honduras",              "North America",  15.20,  -86.24),
    ("Cuba",                  "North America",  21.52,  -77.78),
    ("Nicaragua",             "North America",  12.87,  -85.21),
    ("El Salvador",           "North America",  13.79,  -88.90),
    ("Costa Rica",            "North America",   9.75,  -83.75),
    ("Panama",                "North America",   8.54,  -80.78),
    ("Puerto Rico",           "North America",  18.22,  -66.59),
    ("Jamaica",               "North America",  18.11,  -77.30),
    ("Trinidad and Tobago",   "North America",  10.69,  -61.22),
    ("Belize",                "North America",  17.19,  -88.50),
    ("Bahamas",               "North America",  25.03,  -77.40),
    ("Barbados",              "North America",  13.19,  -59.54),
    ("Grenada",               "North America",  12.26,  -61.60),
    ("Saint Lucia",           "North America",  13.91,  -60.98),
    ("Dominica",              "North America",  15.41,  -61.37),
    ("Antigua and Barbuda",   "North America",  17.06,  -61.80),
    ("Saint Vincent and the Grenadines", "North America", 12.98, -61.29),
    ("Saint Kitts and Nevis", "North America",  17.36,  -62.78),
    ("Greenland",             "North America",  71.71,  -42.60),
    ("Bermuda",               "North America",  32.32,  -64.76),
    ("Cayman Islands",        "North America",  19.51,  -80.57),
    ("Turks and Caicos Islands","North America",21.69,  -71.80),
    ("British Virgin Islands","North America",  18.42,  -64.64),
    ("Aruba",                 "North America",  12.52,  -69.97),
    ("Martinique",            "North America",  14.64,  -61.02),
    ("Guadeloupe",            "North America",  17.00,  -62.07),
    ("Montserrat",            "North America",  16.74,  -62.19),
    # Europe
    ("Germany",    "Europe",  51.17,  10.45),
    ("United Kingdom","Europe",55.38,  -3.44),
    ("France",     "Europe",  46.23,   2.21),
    ("Italy",      "Europe",  41.87,  12.57),
    ("Spain",      "Europe",  40.46,  -3.75),
    ("Ukraine",    "Europe",  48.38,  31.17),
    ("Poland",     "Europe",  51.92,  19.15),
    ("Romania",    "Europe",  45.94,  24.97),
    ("Netherlands","Europe",  52.13,   5.29),
    ("Belgium",    "Europe",  50.50,   4.47),
    ("Sweden",     "Europe",  60.13,  18.64),
    ("Czechia",    "Europe",  49.82,  15.47),
    ("Portugal",   "Europe",  39.40,  -8.22),
    ("Greece",     "Europe",  39.07,  21.82),
    ("Hungary",    "Europe",  47.16,  19.50),
    ("Austria",    "Europe",  47.52,  14.55),
    ("Switzerland","Europe",  46.82,   8.23),
    ("Belarus",    "Europe",  53.71,  27.95),
    ("Bulgaria",   "Europe",  42.73,  25.49),
    ("Serbia",     "Europe",  44.02,  21.01),
    ("Denmark",    "Europe",  56.26,   9.50),
    ("Norway",     "Europe",  60.47,   8.47),
    ("Finland",    "Europe",  61.92,  25.75),
    ("Slovakia",   "Europe",  48.67,  19.70),
    ("Ireland",    "Europe",  53.41,  -8.24),
    ("Croatia",    "Europe",  45.10,  15.20),
    ("Bosnia and Herzegovina","Europe", 43.92, 17.68),
    ("Moldova",    "Europe",  47.41,  28.37),
    ("Lithuania",  "Europe",  55.17,  23.88),
    ("Albania",    "Europe",  41.15,  20.17),
    ("Slovenia",   "Europe",  46.15,  15.00),
    ("Latvia",     "Europe",  56.88,  24.60),
    ("North Macedonia","Europe",41.61, 21.75),
    ("Cyprus",     "Europe",  35.13,  33.43),
    ("Estonia",    "Europe",  58.60,  25.01),
    ("Luxembourg", "Europe",  49.82,   6.13),
    ("Montenegro", "Europe",  42.71,  19.37),
    ("Malta",      "Europe",  35.94,  14.38),
    ("Iceland",    "Europe",  64.96, -19.02),
    ("Andorra",    "Europe",  42.55,   1.60),
    ("Faroe Islands","Europe",61.89,  -6.91),
    ("Liechtenstein","Europe",47.17,   9.56),
    ("Monaco",     "Europe",  43.75,   7.41),
    ("San Marino", "Europe",  43.94,  12.46),
    ("Vatican City","Europe", 41.90,  12.45),
    # Asia / Europe (Russia straddles both)
    ("Russia",     "Asia/Europe", 61.52, 105.32),
    # Asia
    ("India",         "Asia",  20.59,  78.96),
    ("China",         "Asia",  35.86, 104.20),
    ("Indonesia",     "Asia",  -0.79, 113.92),
    ("Pakistan",      "Asia",  30.38,  69.35),
    ("Bangladesh",    "Asia",  23.68,  90.36),
    ("Japan",         "Asia",  36.20, 138.25),
    ("Philippines",   "Asia",  12.88, 121.77),
    ("Vietnam",       "Asia",  14.06, 108.28),
    ("Iran",          "Asia",  32.43,  53.69),
    ("Turkey",        "Asia",  38.96,  35.24),
    ("Thailand",      "Asia",  15.87, 100.99),
    ("Myanmar",       "Asia",  21.91,  95.96),
    ("South Korea",   "Asia",  35.91, 127.77),
    ("Iraq",          "Asia",  33.22,  43.68),
    ("Afghanistan",   "Asia",  33.94,  67.71),
    ("Yemen",         "Asia",  15.55,  48.52),
    ("Uzbekistan",    "Asia",  41.38,  64.59),
    ("Malaysia",      "Asia",   4.21, 101.98),
    ("Saudi Arabia",  "Asia",  23.89,  45.08),
    ("Nepal",         "Asia",  28.39,  84.12),
    ("North Korea",   "Asia",  40.34, 127.51),
    ("Syria",         "Asia",  34.80,  39.00),
    ("Sri Lanka",     "Asia",   7.87,  80.77),
    ("Taiwan",        "Asia",  23.70, 120.96),
    ("Kazakhstan",    "Asia",  48.02,  66.92),
    ("Cambodia",      "Asia",  12.57, 104.99),
    ("Jordan",        "Asia",  30.59,  36.24),
    ("United Arab Emirates","Asia", 23.42, 53.85),
    ("Tajikistan",    "Asia",  38.86,  71.28),
    ("Azerbaijan",    "Asia",  40.14,  47.58),
    ("Israel",        "Asia",  31.05,  34.85),
    ("Laos",          "Asia",  19.86, 102.50),
    ("Turkmenistan",  "Asia",  38.97,  59.56),
    ("Kyrgyzstan",    "Asia",  41.20,  74.77),
    ("Hong Kong",     "Asia",  22.40, 114.11),
    ("Singapore",     "Asia",   1.35, 103.82),
    ("Lebanon",       "Asia",  33.85,  35.86),
    ("Palestine",     "Asia",  31.95,  35.30),
    ("Oman",          "Asia",  21.51,  55.92),
    ("Kuwait",        "Asia",  29.31,  47.48),
    ("Georgia",       "Asia",  42.32,  43.36),
    ("Mongolia",      "Asia",  46.86, 103.85),
    ("Qatar",         "Asia",  25.35,  51.18),
    ("Armenia",       "Asia",  40.07,  45.04),
    ("Bahrain",       "Asia",  25.93,  50.64),
    ("Timor-Leste",   "Asia",  -8.87, 125.73),
    ("Bhutan",        "Asia",  27.51,  90.43),
    ("Macau",         "Asia",  22.20, 113.54),
    ("Maldives",      "Asia",   3.20,  73.22),
    ("Brunei",        "Asia",   4.54, 114.73),
    # Africa
    ("Nigeria",       "Africa",   9.08,   8.68),
    ("Ethiopia",      "Africa",   9.15,  40.49),
    ("Egypt",         "Africa",  26.82,  30.80),
    ("DR Congo",      "Africa",  -4.04,  21.76),
    ("Tanzania",      "Africa",  -6.37,  34.89),
    ("South Africa",  "Africa", -30.56,  22.94),
    ("Kenya",         "Africa",  -0.02,  37.91),
    ("Sudan",         "Africa",  12.86,  30.22),
    ("Uganda",        "Africa",   1.37,  32.29),
    ("Algeria",       "Africa",  28.03,   1.66),
    ("Angola",        "Africa", -11.20,  17.87),
    ("Morocco",       "Africa",  31.79,  -7.09),
    ("Mozambique",    "Africa", -18.67,  35.53),
    ("Ghana",         "Africa",   7.95,  -1.02),
    ("Madagascar",    "Africa", -18.77,  46.87),
    ("Ivory Coast",   "Africa",   7.54,  -5.55),
    ("Cameroon",      "Africa",   7.37,  12.35),
    ("Niger",         "Africa",  17.61,   8.08),
    ("Mali",          "Africa",  17.57,  -4.00),
    ("Burkina Faso",  "Africa",  12.24,  -1.56),
    ("Malawi",        "Africa", -13.25,  34.30),
    ("Zambia",        "Africa", -13.13,  27.85),
    ("Chad",          "Africa",  15.45,  18.73),
    ("Somalia",       "Africa",   5.15,  46.20),
    ("Senegal",       "Africa",  14.50, -14.45),
    ("Zimbabwe",      "Africa", -19.02,  29.15),
    ("Guinea",        "Africa",   9.95,  -9.70),
    ("Benin",         "Africa",   9.31,   2.32),
    ("Rwanda",        "Africa",  -1.94,  29.87),
    ("Burundi",       "Africa",  -3.37,  29.92),
    ("South Sudan",   "Africa",   6.88,  31.31),
    ("Tunisia",       "Africa",  33.89,   9.54),
    ("Togo",          "Africa",   8.62,   0.82),
    ("Sierra Leone",  "Africa",   8.46, -11.78),
    ("Libya",         "Africa",  26.34,  17.23),
    ("Republic of the Congo","Africa", -0.23, 15.83),
    ("Liberia",       "Africa",   6.43,  -9.43),
    ("Central African Republic","Africa", 6.61, 20.94),
    ("Mauritania",    "Africa",  21.01, -10.94),
    ("Eritrea",       "Africa",  15.18,  39.78),
    ("Namibia",       "Africa", -22.96,  18.49),
    ("Gambia",        "Africa",  13.44, -15.31),
    ("Gabon",         "Africa",  -0.80,  11.61),
    ("Botswana",      "Africa", -22.33,  24.68),
    ("Lesotho",       "Africa", -29.61,  28.23),
    ("Guinea-Bissau", "Africa",  11.80, -15.18),
    ("Equatorial Guinea","Africa", 1.65, 10.27),
    ("Eswatini",      "Africa", -26.52,  31.47),
    ("Mauritius",     "Africa", -20.35,  57.55),
    ("Djibouti",      "Africa",  11.83,  42.59),
    ("Comoros",       "Africa", -11.88,  43.87),
    ("Western Sahara","Africa",  24.22, -12.89),
    ("Cape Verde",    "Africa",  16.00, -24.01),
    ("Sao Tome and Principe","Africa", 0.19, 6.61),
    ("Seychelles",    "Africa",  -4.68,  55.49),
    # Antarctica
    ("Antarctica",    "Antarctica", -82.86, 135.00),
]

# ── Build KDTree for fast nearest-country lookup ─────────────────────────────
_country_names  = [r[0] for r in COUNTRY_DATA]
_continents     = [r[1] for r in COUNTRY_DATA]
_centroids_rad  = np.deg2rad([[r[2], r[3]] for r in COUNTRY_DATA])

# Use 3-D unit-vector representation so the KDTree works correctly across the
# antimeridian and poles.
def _to_xyz(lat_rad, lon_rad):
    return np.stack([
        np.cos(lat_rad) * np.cos(lon_rad),
        np.cos(lat_rad) * np.sin(lon_rad),
        np.sin(lat_rad),
    ], axis=-1)

_centroid_xyz = _to_xyz(_centroids_rad[:, 0], _centroids_rad[:, 1])
_tree = cKDTree(_centroid_xyz)


def _lookup(lat: float, lon: float):
    """Return (country, continent) for a lat/lon point via nearest centroid."""
    lat_r = np.deg2rad(lat)
    lon_r = np.deg2rad(lon if lon <= 180 else lon - 360)
    xyz   = _to_xyz(lat_r, lon_r)
    _, idx = _tree.query(xyz)
    return _country_names[idx], _continents[idx]


def assign_country(lat: float, lon: float) -> str:
    return _lookup(lat, lon)[0]


def assign_continent(lat: float, lon: float) -> str:
    return _lookup(lat, lon)[1]


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


# ── climate zone classifier (unchanged) ──────────────────────────────────────
def assign_climate_zone(lat: float) -> str:
    alat = abs(lat)
    if alat <= 23.5:
        return 'Tropical'
    elif alat <= 66.5:
        return 'Temperate'
    else:
        return 'Polar'


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
#    assign_continent and assign_country both use the KDTree nearest-centroid
#    method — no more bounding-box gaps.
# ══════════════════════════════════════════════════════════════════════════════
print("Assigning country / continent labels ...")
labels = df_combined.apply(
    lambda r: pd.Series(_lookup(r['lat'], r['lon']), index=['country', 'continent']),
    axis=1
)
df_combined = pd.concat([df_combined, labels], axis=1)
df_combined['climate_zone'] = df_combined['lat'].apply(assign_climate_zone)

# ══════════════════════════════════════════════════════════════════════════════
# 5a. AGGREGATE to (year, climate_zone, continent)
# ══════════════════════════════════════════════════════════════════════════════
print("Aggregating by continent ...")
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
agg.to_csv('climate_agg_new.csv', index=False)

# ══════════════════════════════════════════════════════════════════════════════
# 5b. AGGREGATE to (year, country)
# ══════════════════════════════════════════════════════════════════════════════
print("Aggregating by country ...")
agg_country = (
    df_combined
    .groupby(['year', 'country', 'continent', 'climate_zone'])
    .agg(
        mean_temp_C    = ('mean_temp_C',    'mean'),
        mean_pr_mm_day = ('mean_pr_mm_day', 'mean'),
        mean_spi       = ('mean_spi',       'mean'),
        n_cells        = ('mean_temp_C',    'count'),   # grid cells averaged
    )
    .reset_index()
)
agg_country[float_cols] = agg_country[float_cols].round(4)
agg_country.to_csv('climate_agg_country.csv', index=False)

# ── sanity output ─────────────────────────────────────────────────────────────
print(f"\n[SAVED] climate_agg.csv  &  climate_agg_country.csv")
print(f"\n--- climate_agg ---")
print(f"Shape  : {agg.shape}")
print(f"Years  : {agg['year'].min()}–{agg['year'].max()}")
print(f"\nMean temperature by continent:")
print(agg.groupby('continent')['mean_temp_C'].mean().sort_values().round(2).to_string())
print(f"\nMean SPI by continent:")
print(agg.groupby('continent')['mean_spi'].mean().sort_values().round(4).to_string())

print(f"\n--- climate_agg_country ---")
print(f"Shape  : {agg_country.shape}")
print(f"\nTop 10 countries by mean temperature:")
print(
    agg_country.groupby('country')['mean_temp_C']
               .mean().sort_values(ascending=False).head(10).round(2).to_string()
)
print(f"\nBottom 10 countries by mean SPI (driest):")
print(
    agg_country.groupby('country')['mean_spi']
               .mean().sort_values().head(10).round(4).to_string()
)