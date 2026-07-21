# flat-weather-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-weather-card v1.3 (v1.2 dew line 2026-07-17; v1.3 chip delta 2026-07-19)
Merged weather card; all entity ids/URLs in YAML (source location-clean).
Header w/ station conditions + dew/humidity line (dew thresholds: plain <60°F,
#ffc107 60–65, #ff9c4a ≥65), forecast-vs-actual chip with signed delta, 12h
hourly SVG curve, 5-day strip, press feedback, configurable tap-throughs.
Forecast data via weather/subscribe_forecast; daily deduped, nulls skipped.
