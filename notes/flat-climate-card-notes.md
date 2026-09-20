# flat-climate-card — sanitized notes (repo copy)

Deployed as a data: URL dashboard resource (see README). **Repo copy of the JS is
NOT byte-identical to the deployed blob from v2.0.2 on — one deliberate sanitization:**
the deployed card bakes the household's hourly-capable weather entity into
`DEF_FORECAST`; that id is location-bearing, so the repo copy carries the placeholder
`weather.home` plus a comment. Set `forecast_entity` in YAML (or `false` to disable).
Deployed v2.6.2 = 137,321 B, FNV-1a d2e6a7e6; this repo copy = 137,534 B, FNV-1a e94293d3.
Everything else is identical. Full private design history lives in the project notes.

## What it is
Whole-house climate card for a fleet of BLE temperature/humidity meters plus the
thermostat's own thermometer.

- **Hero (always visible):** indoor-vs-outdoor delta headline + OPEN WINDOWS chip
  (delta-only with hysteresis; a moisture gate was deliberately removed after
  historical dew-point analysis — reasoning in the source header; **v2.2:** hidden
  while the thermostat reports `heating`, and replaced by an amber **CLOSE WINDOWS**
  chip when a window contact is open and it is no longer cooler outside — own
  hysteresis `chip.close_on` 0 / `close_off` 1; **v2.4:** optional comfort ceiling from
  a Number helper (`ceiling`) — OPEN is suppressed while outdoors is above it, and a
  blue **RUN AC** / **CLOSE · RUN AC** chip shows when house and outdoors are both
  above it and the thermostat is neither cooling nor set to cool/heat_cool with its
  setpoint ≤ the ceiling (v2.4.2); **v2.5:** venting keyed on cooler/warmer outside
  (1 °F dead band) — cooler and under the ceiling → OPEN WINDOWS until the two
  `vent_windows` are both open, then **TURN ON FAN** until `vent_fan` is on; outside
  over the ceiling with any contact open → CLOSE WINDOWS (v2.6.1 — was "warmer than
  inside", which held on card memory and vanished on reload); a tappable "≤ N°" tag at the
  right end of the legend row (v2.6.2; beside the chip before) opens the helper; 1 °F hysteresis; priority RUN AC > CLOSE > OPEN) over a 24h
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
`avg_opacity`, `scrub_dots`, `chip: {on_delta, off_delta, label, close_on, close_off, close_label, ac_label, ac_close_label}`,
`ceiling` (an `input_number` entity id; absent/false = no ceiling logic),
`vent_windows` (list of contact ids — the intake/exhaust pair; defaults to the household pair), `vent_fan` (fan id or `false`), `chip.fan_label`,
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
- v2.4 (2026-09-12): comfort ceiling (`ceiling` helper): OPEN suppressed above it,
  RUN AC / CLOSE · RUN AC chip, tappable ceiling tag; the chip shows only when
  there is an action not yet taken. Dew point deliberately still not a gate
  (885 h re-check: outdoor dew 58–73 °F, mean 65.5).
- v2.4.1 (2026-09-12): the ceiling tag is plain text-stroked grey text beside the chip
  instead of a second pill (owner: the hero got busy). CSS only.
- v2.4.2 (2026-09-12): RUN AC stands down when the thermostat is already SET to handle
  it (cool/heat_cool, setpoint ≤ ceiling), not only while the compressor runs — first
  live afternoon it nagged at a Nest idle at its 78 setpoint. Unavailable thermostat
  = no RUN AC.
- v2.4.3 (2026-09-17): CLOSE WINDOWS gated on the ceiling — shown only while the house
  is above it; under it, warmer-outside-with-a-window-open is left alone (0.2 °F
  wobbles are not an action; a closed unit loses airflow). Without `ceiling` the v2.2
  rule stands.
- v2.5 (2026-09-19): venting policy rewritten — the 3 °F delta and the v2.4.3 house
  gate are gone; cooler outside (±1 °F dead band) and under the ceiling = vent mode
  (OPEN WINDOWS → TURN ON FAN → quiet), warmer outside + any contact open = CLOSE.
  Owner-declined, do not re-propose: close-while-AC-cooling; a comfort floor.
- v2.6.1 (2026-09-20): CLOSE WINDOWS keys on the ceiling (outside over it + any contact
  open), not on warmer-than-inside; the ±1 °F warm band is removed. Under the ceiling,
  slightly warmer air cannot push the house past it, so nothing to close for.
- v2.6 (2026-09-19): pop-out window shading by count + window names on hover. The
  per-contact tint is halved (.07 -> .035) and still stacks, so two open windows keep
  the old look and more windows read darker (owner picked this over fixed steps from
  a rendered comparison); the 24h/7d temperature tooltip gains "N windows open" plus
  one line per open window (friendly name, leading "Sensor - " dropped, HTML-escaped;
  nothing added when all closed, in the forecast area, or when the contact history did
  not load); a `contacts` entry that is a group is read through its members in the
  pop-out (a freshly created group has no history, which left the shading empty).
  The chip still reads the contacts as configured. No new YAML keys.
- v2.6.2 (2026-09-20): the ceiling tag moves from beside the chip to the right end of
  the legend row. The chip row sits at y 47-65 px and the graph lines start at y 50 px,
  so high-running indoor lines cut through the plain-text tag; the legend row is the one
  band the lines never enter (30 px bottom padding). Same tap / hover / pressed
  behavior, legend type (11 px regular), margin-left: auto. Measured: legend items end
  at ~294 px, tag ~36 px — fits with 35 px spare at a 380 px column; on a narrower
  column the tag is what clips, never a room name. CSS + markup only.

## Verification
Headless Chromium harness (2026-09-20, v2.6.2): 40 assertions (tag in the legend row at 380/400/430/470 px: not clipped, legend items unmoved, below the line band, legend type; tap → helper more-info without spotlighting a room; follows / hides with the helper; hero, expansion and six chip states identical to v2.6.1). Headless Chromium harness (2026-09-19, v2.6): 43 assertions (layer count + tint per tab, tooltip rows for 1/2/3 windows, an unavailable blip, the forecast area, a group contact read through its members, failed/empty contact history, and hero / expansion / 7d / 14d identity against v2.5). Headless Chromium harness (2026-09-19, v2.5): 50 assertions on the new policy (vent mode, dead band, over-ceiling, unavailable entities, no-ceiling identity vs v2.3); earlier (v2.4–v2.4.3): 91 assertions — the six chip states,
hysteresis crossings on both ceiling comparisons, AC start/stop, heating, helper
unavailable/absent/changed, tag tap → more-info, and hero + expansion DOM identity
against v2.3 with no `ceiling` key. jsdom audit harness (2026-09-06): 12 behavioral cases run bug-mode against v2.1.1
and fixed-mode against v2.1.2, an 11-state chip matrix for v2.2, and a render-identity
comparison across tabs. Earlier headless Chromium harness: stubbed hass (raw history incl. a sparse reporter,
synthetic statistics incl. a deliberately zero-poisoned row, contact/hvac history,
forecast via subscription and service fallback); ~45 assertions across card + pop-out
at 470px and 400px widths. Rebuildable from this description; no HA needed.
