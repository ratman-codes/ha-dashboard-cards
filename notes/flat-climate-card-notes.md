# flat-climate-card — sanitized notes (repo copy)

Deployed as a data: URL dashboard resource (see README). **Repo copy of the JS is
NOT byte-identical to the deployed blob from v2.0.2 on — one deliberate sanitization:**
the deployed card bakes the household's hourly-capable weather entity into
`DEF_FORECAST`; that id is location-bearing, so the repo copy carries the placeholder
`weather.home` plus a comment. Set `forecast_entity` in YAML (or `false` to disable).
Deployed v2.3 = 119,705 B, FNV-1a 97a50668; this repo copy = 119,918 B, FNV-1a 3ae822af.
Everything else is identical. Full private design history lives in the project notes.

## What it is
Whole-house climate card for a fleet of BLE temperature/humidity meters plus the
thermostat's own thermometer.

- **Hero (always visible):** indoor-vs-outdoor delta headline + OPEN WINDOWS chip
  (delta-only with hysteresis; a moisture gate was deliberately removed after
  historical dew-point analysis — reasoning in the source header; **v2.2:** hidden
  while the thermostat reports `heating`, and replaced by an amber **CLOSE WINDOWS**
  chip when a window contact is open and it is no longer cooler outside — own
  hysteresis `chip.close_on` 0 / `close_off` 1) over a 24h
  six-series temperature overlay with translucent dashed average lines.
  Line grammar (house rule): **solid = measured · dashed = computed · dotted = forecast.**
  Legend tap = spotlight; band-gated scrub with graph-anchored viewport-fixed
  tooltips and interpolated on-curve dots (`scrub_dots: false` removes dots).
- **Expansion:** averages row (live in/out/Δ readings, dashed) → **moisture row
  (v1.7):** in/out averages across ALL humidity sensors, dashed, own color pair
  (in `#e0834e` / out `#38bfd8`); tapping the row title toggles **Humidity ⇄ Dew point**
  (Magnus per-sensor per-bucket then side-averaged; dew mode: min-span 10°F scale,
  Δ readout, threshold colors plain <60 / amber 60–65 / orange 65+; mode persists in
  localStorage, default via `moisture_mode`) → per-room now-strip → **"History & stats"
  strip (v2.0):** opens the pop-out.
- **History pop-out (v2.0–v2.0.2):** card-rendered full-screen overlay (zero
  dependencies, zero HA-side entities; Esc/✕/backdrop close). Range tabs
  24h/7d/14d/1m/3m/6m/1y. 24h = raw history + 12h hourly forecast from the weather
  entity (dotted, outdoor only — indoor is never forecast) with a predicted-venting
  strip and tile (forecast outdoor ≥ `on_delta` below current indoor, dew forecast
  shown as information, not a gate). 7d+ = `recorder/statistics_during_period`
  min/mean/max (hour period ≤14d, day beyond; zero-poisoned rows filtered) drawn as
  dashed means with min–max envelope bands (edges smoothed display-only via
  `band_smooth`, default 1; tiles keep raw extremes). Room picker overlays ≤3 sensors
  as solid lines with envelopes; single pick swaps the room tile to that sensor.
  Venting heatmap = mean Δ by hour × weekday (square cells, all 24 hour labels,
  hover tooltip; capped at the last 30 days on seasonal tabs). Faint overlays on
  24h/7d: window-open (green, from contact sensors), cooling (blue) / heating
  (heat-orange) from the thermostat's `hvac_action` history. **v2.3:** on 14d+ two
  thin strips under the chart carry the same story from long-term statistics of
  0/1 signal sensors (`cooling_stats` / `heating_stats` / `window_stats`; hourly on
  14d/1m, daily on 3m+; intensity = share of the period on; a row is absent until
  its sensor exists or if the fetch fails). Tiles: venting offered
  h/day + share captured (chip-on hours with a window actually open, past 7d),
  range extremes (sun-trimmed), warmest/selected room, muggy hours (outdoor dew
  ≥65/≥60 share). Both pop-out charts scrub like the card rows.
- **Sun-spike trim** (`sun_cap`, default 4°F): an outdoor sensor heated by reflected
  sun can't distort the headline/averages; graph lines stay raw. Dew point is immune
  to that heating (temperature up, RH down cancel in Magnus), so the dew view needs
  no trim.
- **Availability honesty:** unavailable sensors show '--' and drop from averages;
  nothing is ever coerced to 0.

## Config
`type: custom:flat-climate-card` — defaults cover the original household; override:
`hours` (coerced to a positive integer; labels follow it), `indoor: [{entity, humidity, name, color}...]`, `outdoor: [...]`,
`hall: {entity, humidity, name, color, in_average}` or `false`, `sun_cap`,
`avg_opacity`, `scrub_dots`, `chip: {on_delta, off_delta, label, close_on, close_off, close_label}`,
`moisture_mode: rh|dew`, `popout: false`, `contacts: [binary_sensor ids]`, a single id, or `false`,
`hvac_entity` or `false`, `forecast_entity` (hourly-capable weather entity) or `false`,
`cooling_stats` / `heating_stats` / `window_stats` (0/1 signal sensors with LTS, or `false`),
`band_smooth` (0 = raw envelopes).

## Version history (details in the source header)
- v1.0–v1.2 (2026-08-05): initial "option 2+5" build; hero condensed; narrow-column fit.
- v1.3/v1.4 (2026-08-10): hero tap removed; sun-spike trim; chip moisture gate removed
  after dew-point analysis (delta-only).
- v1.5 (2026-08-17): thermostat (hall) line, indoor group, display-only by default;
  translucent average dashes.
- v1.6–v1.6.4 (2026-08-17/18): readability pass — viewport-fixed anchored tooltips,
  text-free hero, legend spotlight, averages row, band-gated scrub, interpolated dots.
- v2.0.2 (2026-08-31): moisture-row rework (v1.7) + history pop-out (v2.0) + pop-out
  scrub & band calming (v2.0.1) + heatmap polish (v2.0.2), shipped as one release.
  First repo-sanitized version (see top).
- v2.1 (2026-08-31): seasonal heatmap — 3m/6m/1y tabs draw hour x MONTH rows
  (chronological; hourly stats in 45-day chunks; empty cells until data
  accumulates) — and a "vs prior period" outdoor-mean line in the extremes
  tile (same-length preceding window, cached, silently absent without data).
- v2.1.1 (2026-08-31): 3m heatmap rows are Monday-aligned weeks labeled by
  start date; 6m/1y keep months.
- v2.1.2 (2026-09-06): full source audit, nine items in one version — pop-out
  lines/bands moved onto the same padded x-axis as the hairline, dots, shading
  and labels (they were up to 8px apart at the chart edges); captured-% tile says
  "window data unavailable" instead of a false 0% when the contact history did
  not load; "Loading history…" state + the 24h tab re-renders when history
  lands; `set hass` renders only when one of the card's own entities changed;
  failed range clears the previous range's tiles; `hours`/`contacts` hardening;
  re-`setConfig` cleanup; listener/subscription hygiene; header refresh.
- v2.2 (2026-09-06): chip hidden while heating; amber CLOSE WINDOWS chip
  (contact open + no longer cooler outside, own hysteresis).
- v2.3 (2026-09-07): AC / window strips under the 14d+ pop-out charts (LTS-fed;
  owner chose strips over full-height columns after a side-by-side mockup).

## Verification
jsdom audit harness (2026-09-06): 12 behavioral cases run bug-mode against v2.1.1
and fixed-mode against v2.1.2, an 11-state chip matrix for v2.2, and a render-identity
comparison across tabs. Earlier headless Chromium harness: stubbed hass (raw history incl. a sparse reporter,
synthetic statistics incl. a deliberately zero-poisoned row, contact/hvac history,
forecast via subscription and service fallback); ~45 assertions across card + pop-out
at 470px and 400px widths. Rebuildable from this description; no HA needed.
