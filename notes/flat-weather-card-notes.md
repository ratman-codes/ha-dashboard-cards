# flat-weather-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-weather-card v1.5.1 (v1.2 dew line 2026-07-17; v1.3 chip delta 2026-07-19; v1.4 auto-fallback + v1.5 named backup tag 2026-08-04; v1.5.1 comment de-localization same day)
Merged weather card; all entity ids/URLs in YAML (source location-clean).
Header w/ station conditions + dew/humidity line (dew thresholds: plain <60°F,
#ffc107 60–65, #ff9c4a ≥65), forecast-vs-actual chip with signed delta, 12h
hourly SVG curve, 5-day strip, press feedback, configurable tap-throughs.
Forecast data via weather/subscribe_forecast (hourly + daily + fallback daily);
daily deduped, nulls skipped.

**Auto-fallback (v1.4/v1.5):** optional `fallback_entity` (a second weather
entity — the owner uses a nearby backup PWS) takes over the header current
conditions, today's H/L, and the 5-day strip whenever the primary station
entity reads unavailable/unknown; optional `fallback_dew_entity` keeps the dew
line honest (the primary's dew sensor was observed FREEZING at its last value
during station outages instead of going unavailable, so it is deliberately
ignored in backup mode); optional `fallback_name` labels the mode
"<name> (backup)" on the condition line (bare "Backup" if unset). Flips back
automatically when the primary reports again, and restarts the daily forecast
subscriptions on the unavailable→available transition so pushes resume. The
whole mechanism is card-side + YAML — no helpers or automations.
v1.5.1 is a comment-only sanitization fix (a header-comment example had named
a real neighborhood; scrubbed so the public copy stays location-clean while
remaining byte-identical to the deployed blob).
