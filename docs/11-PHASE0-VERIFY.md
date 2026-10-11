# PranVayu: Phase 0 verification

Run these on your own computer (the cloud workspace used for writing these docs has a restricted network). They check that every external assumption holds before an agent builds on it. Save each response as a fixture file and record the result in 10-DECISIONS-AND-ASSUMPTIONS. Parameter names below come from documentation as I know it; where one fails, read the API docs and adjust. That is the point of the exercise.

Set up once:

```
export MAP_KEY=<your FIRMS key>
export OPENAQ_KEY=<your OpenAQ key>
mkdir -p backend/tests/fixtures
```

## 1. Open-Meteo weather: winds and boundary layer

```
curl -s "https://api.open-meteo.com/v1/forecast?latitude=28.59&longitude=77.05&hourly=wind_speed_975hPa,wind_direction_975hPa,wind_speed_950hPa,wind_direction_950hPa,wind_speed_925hPa,wind_direction_925hPa,wind_speed_10m,wind_direction_10m,boundary_layer_height&models=ecmwf_ifs025&wind_speed_unit=ms&past_hours=24&forecast_hours=48&timeformat=unixtime" -o backend/tests/fixtures/winds_dwarka.json
```
Check: every variable is present and not all null; timestamps cover past and forecast; the model name in the response. Repeat with `models=gfs_seamless` if anything is null. Then test a batch call with several comma-separated latitudes and longitudes to confirm the response is a list.
Record: model that works, variables that exist, whether BLH exists, batch size accepted.

## 2. Open-Meteo air quality (CAMS)

```
curl -s "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.59&longitude=77.05&hourly=pm2_5,pm10&domains=cams_global&past_hours=48&forecast_hours=72&timeformat=unixtime" -o backend/tests/fixtures/cams_dwarka.json
```
Check: values are plausible for Delhi (tens to hundreds), hourly resolution, and how far back it goes.

## 3. NASA FIRMS

```
curl -s "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/$MAP_KEY/ALL" | head -30
curl -s "https://firms.modaps.eosdis.nasa.gov/api/area/csv/$MAP_KEY/VIIRS_SNPP_NRT/73.5,27.5,78.5,32.5/1" -o backend/tests/fixtures/fires_snpp.csv
head -3 backend/tests/fixtures/fires_snpp.csv; wc -l backend/tests/fixtures/fires_snpp.csv
```
Check: the column names, the confidence coding (letters or numbers), the date and time columns, and that the three NRT sources and the `_SP` standard-processing source are listed with the date ranges they cover. October to November 2025 must appear for `VIIRS_SNPP_SP` (and NOAA-20 if used). Off-season the count may be small; that is fine, you are checking structure.

## 4. OpenAQ v3

```
curl -s -H "X-API-Key: $OPENAQ_KEY" "https://api.openaq.org/v3/parameters?limit=100" | head -c 2000
curl -s -H "X-API-Key: $OPENAQ_KEY" "https://api.openaq.org/v3/locations?bbox=76.8,28.4,77.4,28.9&parameters_id=2&limit=100" -o backend/tests/fixtures/openaq_locations.json
```
Check: which parameter id is PM2.5 (the example uses 2; use what the parameters call shows). For the Delhi locations returned, note id, name, coordinates, the datetime of last value, and whether the provider is CPCB. Then, for three locations:
```
curl -s -H "X-API-Key: $OPENAQ_KEY" "https://api.openaq.org/v3/locations/<LOCATION_ID>/latest"
curl -s -H "X-API-Key: $OPENAQ_KEY" "https://api.openaq.org/v3/locations/<LOCATION_ID>/sensors"
curl -s -H "X-API-Key: $OPENAQ_KEY" "https://api.openaq.org/v3/sensors/<SENSOR_ID>/hours?datetime_from=2025-11-01T00:00:00Z&datetime_to=2025-11-03T00:00:00Z&limit=100"
```
Check: the latest timestamp is within hours (stale otherwise), hourly history for Nov 2025 exists, and the field names. Write down the list of stations with live data and at least 80% coverage in Nov 2025; this decides D-OPEN-1 and D-OPEN-2.

## 5. Replay archives for winds and CAMS

Probe each of these with one Delhi point and a few days in early November 2025, with the same variables as test 1 and test 2:
- `https://historical-forecast-api.open-meteo.com/v1/forecast` (archived model runs, best-available analysis winds): are pressure-level winds and BLH returned for 2025-11-01 to 2025-11-03?
- `https://previous-runs-api.open-meteo.com/v1/forecast` (values as forecast at fixed previous lead times): does it return pressure-level winds for those days? If yes, data mode A may be possible.
- `https://archive-api.open-meteo.com/v1/archive` (reanalysis): are pressure-level winds available?
- `https://air-quality-api.open-meteo.com/v1/air-quality` with `start_date=2025-11-01&end_date=2025-11-03`: does CAMS return values for that period?
Record, for each: works or not, variables returned, resolution. This decides the data mode (D-OPEN-3). Honest default if only reanalysis or best-available winds exist: mode B, upper bound, said on the page.

## 6. GRAP and CPCB reference values

- Open the CAQM site, find the current GRAP stage and the latest order (note the effective date and URL) and the revised plan approved around 28 Sept 2026; note what it says about schools. Write `config/grap.json` from it.
- Open the CPCB AQI bulletin or the National AQI technical note and copy the six category colour hexes and PM2.5 breakpoints. Compare the breakpoints with the thresholds in 04 section 6.

## 7. AWS

- Account created; Builder Center student verification done.
- `aws sts get-caller-identity` works with the profile you will deploy with.
- `sam --version` installed; Docker present if a container build is needed.
- Check that Lambda, API Gateway, DynamoDB, S3, EventBridge Scheduler, SSM and Amplify Hosting are usable in ap-south-1.
- Create a billing alarm or budget now.

## 8. Write down the results

Add to 10-DECISIONS-AND-ASSUMPTIONS section 6, one line per assumption A1 to A12: confirmed, changed (what), or failed (fallback taken). Commit the fixtures with the log.
