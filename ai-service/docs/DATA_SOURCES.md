# Disaster Data Sources and Provenance

## Data Acquired and Processed

### 1. Rainfall Data
**Dataset:** Open-Meteo Historical API (ERA5 Reanalysis)
**Purpose:** Predicting flood risk based on past precipitation.
**Source:** Open-Meteo
**Official URL:** https://archive-api.open-meteo.com/v1/archive
**Provider:** Copernicus Climate Change Service
**Geographical coverage:** Guwahati / Kamrup Metropolitan (Lat: 26.1445, Lng: 91.7362)
**Date range:** 2021-01-01 to 2023-12-31
**Downloaded date:** 2026-09-12
**Original format:** JSON
**Processed format:** CSV (`data/processed/rainfall/rainfall_assam.csv`)
**License/usage notes:** Open Data (CC-BY 4.0).
**Transformations:** Extracted hourly rainfall, removed duplicates/missing values, normalized timestamps to ISO 8601.
**Missing-data handling:** Dropped rows with missing rainfall measurements.

### 2. Elevation / DEM
**Dataset:** Open-Meteo Elevation API
**Purpose:** Identifying low-lying areas vulnerable to flooding.
**Source:** Open-Meteo
**Official URL:** https://api.open-meteo.com/v1/elevation
**Provider:** SRTM / NASADEM / Copernicus DEM
**Geographical coverage:** Guwahati / Kamrup Metropolitan
**Date range:** Static
**Downloaded date:** 2026-09-12
**Original format:** JSON
**Processed format:** CSV (`data/processed/elevation/elevation_assam.csv`)
**License/usage notes:** Open Data.
**Transformations:** Extracted elevation in meters for the bounding box center.
**Missing-data handling:** Handled missing values by dropping them.

### 3. Road Network & Hospitals
**Dataset:** OpenStreetMap (Overpass API)
**Purpose:** Routing agents and resource allocation.
**Source:** OpenStreetMap
**Official URL:** https://overpass-api.de/api/interpreter
**Provider:** OSM Contributors
**Geographical coverage:** Bounding box for Guwahati [26.05, 91.50, 26.25, 91.90]
**Date range:** Current
**Downloaded date:** 2026-09-12
**Original format:** JSON
**Processed format:** CSV (`data/processed/hospitals/hospitals_assam.csv` and `data/processed/roads/roads_assam.csv`)
**License/usage notes:** ODbL (Open Data Commons Open Database License).
**Transformations:** Extracted relevant tags (name, highway, amenity, emergency) and coordinates. Note: Availability depends on the Overpass API uptime, sometimes timeouts occur.
**Missing-data handling:** Dropped features without valid coordinates.
**Known limitations:** Hospital capacity/occupancy is unavailable and will be simulated dynamically during the hackathon demonstration.

### 4. Synthetic SOS Data
**Dataset:** SYNTHETIC — FOR MODEL/SYSTEM TESTING ONLY
**Purpose:** Testing the Situation Agent and natural language parsing.
**Source:** Synthetically generated using Faker
**Geographical coverage:** Simulated addresses
**Date range:** N/A
**Original format:** CSV
**Processed format:** CSV (`data/raw/historical_incidents/synthetic_sos_reports.csv`)
**License/usage notes:** Internal testing only.
**Known limitations:** Not real citizen data.

## Datasets Requiring Manual Download

### 5. Water Levels
**Dataset:** Central Water Commission (CWC)
**Purpose:** Monitoring river levels against danger marks.
**Official URL:** https://ffs.india-water.gov.in/
**Notes:** Requires manual navigation and download due to captchas and dynamic rendering. Place the manually downloaded CSV into `data/raw/water_levels/` when available.
**Status:** MANUAL DOWNLOAD REQUIRED.

### 6. Flood Extent
**Dataset:** ISRO Bhuvan / Copernicus
**Purpose:** Historical flood validation and spatial risk mapping.
**Official URL:** https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php
**Notes:** Requires manual portal usage to download historical flood maps (GeoTIFF/Shapefile).
**Status:** MANUAL DOWNLOAD REQUIRED.

### 7. Population Data
**Dataset:** WorldPop / Census
**Purpose:** Identifying vulnerable populations in flood zones.
**Official URL:** https://www.worldpop.org/project/categories?id=3
**Notes:** Manual download required for high-res GeoTIFF.
**Status:** MANUAL DOWNLOAD REQUIRED.
