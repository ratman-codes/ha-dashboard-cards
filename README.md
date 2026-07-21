# Custom Home Assistant dashboard cards

Backup archive of the bespoke Lovelace cards (and their design notes) built for the
main Home Assistant dashboard, July 2026, by Claude + Ratman.

**This repo is an archive, not the deployment.** The cards do NOT run from here.
Each card is deployed as a self-contained dashboard resource inside Home Assistant
itself: the entire JS file is base64-encoded into the resource URL
(`data:text/javascript;name=<card-name>;base64,<blob>`) stored in
`.storage/lovelace_resources`, so it lives in HA's own config, ships with every HA
backup, and has zero runtime dependencies on the internet or on this repo.

## Contents
- `flat-thermostat-card.js` — v2.2. Slim flat replica of the native HA thermostat
  dial: dual/single-handle temperature track, native-measured colors, mode strip.
  Used as `type: custom:flat-thermostat-card` with `entity: climate.hall_nest_thermostat`.
  HA resource id: `a1bc4b7a12124ab38ded7859b5ed12bc`.
- `flat-treadmill-card.js` — v2.11. Controller for an Egofit M2 walking pad via the
  FTMS HACS integration: speed track, start/stop, NOW/TODAY stats, daily target
  progress bar, live net-kcal model. Used as `type: custom:flat-treadmill-card`
  (all entity ids are baked-in defaults). HA resource id: `698b5e9479724e12a978aec4cb7b17dc`.
- `flat-scoreboard-card.js` — v1.0. Forecast-accuracy leaderboard for the six-provider
  experiment: medal ranks, avg-error bars with off-scale overflow, today's call with
  busted-call marking, yesterday's miss, live actual, permanent-statistics trend strip.
  All entity ids are card YAML config. `type: custom:flat-scoreboard-card`.
- `flat-weather-card.js` — v1.3 (adds signed delta to the forecast-vs-actual chip). Merged weather card: station current conditions
  header (incl. optional threshold-colored dew-point line for ventilation
  decisions), forecast-vs-actual chip (auto-hides without its helper entities),
  12h hourly temperature curve, 5-day strip, press feedback, tap-throughs to the
  station's Weather Underground pages. All entity ids and URLs are card YAML
  config — the source is location-clean by design. Used as
  `type: custom:flat-weather-card` (see notes for the YAML shape).
  HA resource id: `9bb445a4ae6a4bdb984fa563e4897e2d`.
- `notes/ha-dashboard-notes.md` — the dashboard's working notes: build checklist for
  new cards, measured native-HA visual constants, debug lessons, house styles,
  entity inventory, and final specs for all three cards.
- `notes/flat-treadmill-card-notes.md` — deep notes for the treadmill card: tap map,
  HA helper/meter inventory with entry IDs, net-calorie math with regression anchors,
  Egofit/FTMS device quirk census, version history.

## How to read / modify a deployed card
Each source file opens with a "HOW THIS WORKS / HOW TO MAINTAIN IT" header. Short
version: decode the resource URL's base64 to read; edit (ASCII-only in strings),
`node --check`, re-encode, and replace the resource URL under
Settings > Dashboards > (three-dot) > Resources, then hard-refresh.

The same sources and notes are also archived in the "NAS / Smart Home" Claude
project, which is where these cards are iterated.
