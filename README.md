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
- `flat-weather-card.js` — v1.2. Merged weather card: station current conditions
  header (incl. optional threshold-colored dew-point line for ventilation
  decisions), forecast-vs-actual chip (auto-hides without its helper entities),
  12h hourly temperature curve, 5-day strip, press feedback, tap-throughs to the
  station's Weather Underground pages. All entity ids and URLs are card YAML
  config — the source is location-clean by design. Used as
  `type: custom:flat-weather-card` (see notes for the YAML shape).
  HA resource id: `9bb445a4ae6a4bdb984fa563e4897e2d`.
- `flat-sensor-stack-card.js` — v1.2. Collapsible stack of compact sensor history
  graphs (desk temperature, CO2, humidity — 24h); row 0 always visible, top-right
  label toggles the rest. Used as `type: custom:flat-sensor-stack-card`.
  HA resource id: `c2d6b8f73e474ae084f4052a7b3c133a`.
- `flat-vacuum-card.js` — v2.6. Roborock control card: status header, room-pick
  clean flow, full cleaning profiles (Away/Default popup editors), maintenance
  counters. Used as `type: custom:flat-vacuum-card` (see
  `notes/vacuum-system-notes.md`). HA resource id: `8dc0c8f4ad6a4d0ea3da4e97c3873f8b`.
- `flat-cat-card.js` — v1.6. Adds per-cat litter history panels (tap a cat row: visits-per-day bars, recent-visit log with duration + scale weight, 10-day weight trend — fetched live from the recorder, no helper entities) and configurable camera tiles (camera_image: eat | visit | feed). Consolidated cats card (PetKit litter box + two
  feeders + per-cat rows): headerless tap-to-expand layout, litter level bar with
  Clean/More controls and a guarded two-step maintenance mode (Dump litter is
  hold-to-confirm), feeder rows with dispensed-vs-planned grams and portion-chip
  manual feeds (single or both feeders) with a 5s undo window, always-visible
  last-eat camera snapshots (tap for live), amber alert strip (litter low, bin
  full, hopper empty, offline, frequent-use health flag), pulsing
  occupied-right-now dot. All entities via YAML config (cat list + entity
  prefixes). Used as `type: custom:flat-cat-card` (see notes for the YAML shape).
  HA resource id: `6de3dc9ee5524b81a702ecbabae6e156`.
- `card-manager-card.js` — v1.2. The admin card that manages all of the above:
  lists every dashboard resource, decodes each data-URL card's header
  (name/version/size/FNV-1a), and replaces the old raw paste-in-Settings update
  workflow with a guarded flow — paste is validated against the target card's
  `;name=` label and header, backup of the outgoing blob is force-downloaded,
  the write goes by resource ID over the `lovelace/resources/update` websocket
  API, and the registry is re-verified after. Wrong-card pastes are hard-blocked.
  Lives on a separate admin-only dashboard; an optional YAML-configured PIN gates
  Update mode (Inspect stays open); updating the manager itself additionally
  requires typing the card name. Brand-new cards are added through the same UI
  (create via the websocket API, with a duplicate-label hard block).
  Used as `type: custom:card-manager-card`.
  HA resource id: `19e69a73342741468a1d86c736b4f612`.
- `notes/ha-dashboard-notes.md` — the dashboard's working notes: build checklist for
  new cards, measured native-HA visual constants, debug lessons, house styles,
  entity inventory, and final specs for the cards.
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
