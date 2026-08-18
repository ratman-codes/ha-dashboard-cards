# Custom Home Assistant dashboard cards

Backup archive of the bespoke Lovelace cards (and their design notes) built for the
main Home Assistant dashboard, July 2026, by Claude + Ratman.

**This repo is an archive, not the deployment.** The cards do NOT run from here.
Each card is deployed as a self-contained dashboard resource inside Home Assistant
itself: the entire JS file is base64-encoded into the resource URL
(`data:text/javascript;name=<card-name>;base64,<blob>`) stored in
`.storage/lovelace_resources`, so it lives in HA's own config, ships with every HA
backup, and has zero runtime dependencies on the internet or on this repo.

*(Version lines below are regenerated from the JS file headers in this repo — the
headers are ground truth. If an entry here ever disagrees with a header, trust the
header.)*

## Contents
- `flat-thermostat-card.js` — v2.6.11. Slim flat replica of the native HA thermostat
  dial: dual/single-handle temperature track, native-measured colors, mode strip,
  a detached eco-preset leaf button (green when on; track renders the
  entity-reported eco setpoints read-only, since the device rejects setpoint
  writes in eco), a daily HVAC runtime chip (today's ACTIVE compressor/furnace
  hours from daily runtime meter entities; never hides - off mode with zero
  runtime shows all configured meters at 0m), a tap-to-expand in-card 14-day
  runtime graph fed by HA long-term statistics (live today bar, avg line,
  per-bar tooltips clamped inside the plot; zero dependencies), and — v2.6 —
  three tile-switched RUNTIME VIEWS swapped into the graph slot: TODAY (exact
  on/off ribbon from the 0/1 signal sensors' recorder history + minutes-per-hour
  bars from hourly statistics, day pager with native calendar picker),
  PERIOD explorer (7d/14d/30d/60d/season/custom chips, totals + vs-previous,
  daily bars auto-aggregating weekly past 35 days, transposed time-of-day
  heatmap: 8 fixed 3-hour columns, dates down as rows newest-first), and
  RECORDS (top-5 days, runtime-vs-outdoor-high scatter with a least-squares
  trend line that hides when the fit is noise). Used as
  `type: custom:flat-thermostat-card` with a climate entity + optional
  runtime_cooling/runtime_heating (daily meters),
  runtime_cooling_stats/runtime_heating_stats (long-term stats sources),
  runtime_cooling_signal/runtime_heating_signal (0/1 signal sensors for the
  ribbon), outdoor_high_stats (outdoor temperature entity for the scatter),
  and period_default (7d|14d|30d|60d|season).
  HA resource id: `a1bc4b7a12124ab38ded7859b5ed12bc`.
- `flat-treadmill-card.js` — v2.11. Controller for an Egofit M2 walking pad via the
  FTMS HACS integration: speed track, start/stop, NOW/TODAY stats, daily target
  progress bar, live net-kcal model. Used as `type: custom:flat-treadmill-card`
  (all entity ids are baked-in defaults). HA resource id: `698b5e9479724e12a978aec4cb7b17dc`.
- `flat-weather-card.js` — v1.5.1. Merged weather card: station current conditions
  header (incl. optional threshold-colored dew-point line for ventilation
  decisions), forecast-vs-actual chip with signed delta, 12h hourly
  temperature curve, 5-day strip, press feedback, station tap-throughs, and
  card-level auto-fallback to a backup station's entities whenever the primary
  PWS reads unavailable (v1.5). All entity ids and URLs are card YAML config — the
  source is location-clean by design. Used as `type: custom:flat-weather-card`
  (see notes for the YAML shape). HA resource id: `9bb445a4ae6a4bdb984fa563e4897e2d`.
- `flat-scoreboard-card.js` — v1.0. Leaderboard card for the permanent forecast
  accuracy lab: per-source average-error ranking with medal chips and scaled bars,
  today's calls with "busted" marking, yesterday's misses with blowup alerts, and
  a long-term trend strip fed by HA's permanent statistics. Used as
  `type: custom:flat-scoreboard-card` (sources configured in YAML). Resource
  identified by its `name=flat-scoreboard-card` label.
- `flat-sensor-stack-card.js` — v1.2. Collapsible stack of compact sensor history
  graphs (desk temperature, CO2, humidity — 24h); row 0 always visible, top-right
  label toggles the rest. Used as `type: custom:flat-sensor-stack-card`.
  HA resource id: `c2d6b8f73e474ae084f4052a7b3c133a`.
- `flat-vacuum-card.js` — v2.7. Roborock control card (Qrevo Edge 2): status
  header, room-pick clean flow, full cleaning profiles (Away/Default popup
  editors), maintenance counters. Used as `type: custom:flat-vacuum-card` (see
  `notes/vacuum-system-notes.md`). HA resource id: `8dc0c8f4ad6a4d0ea3da4e97c3873f8b`.
- `flat-cat-card.js` — v1.22. Consolidated cats card (pet-tech litter box + two
  feeders + per-cat rows): header-zone expand/collapse with hover strip and
  animated height (grid-rows technique), per-cat litter history panels (tap a cat
  row: visits-per-day bars with day filtering, recent-visit log with duration +
  scale weight, long-term weight trend from permanent statistics with a
  zero-poisoning filter and drift-delta readout — no helper entities), litter
  level bar with Maint/More controls (More = even 2x2 grid: Clean / Level /
  Pause / Settings) and a guarded two-step maintenance mode (Dump litter is
  hold-to-confirm), litter SETTINGS panel (grouped instant-write toggles,
  cleaning-delay and repeat-interval steppers, litter-type chips — switches,
  number, and selects from the litter-box integration; 8s optimistic overlay;
  `deep_deo_suffix` config override for integrations exposing duplicate
  deep-deodorizing switches), feeder rows with dispensed-vs-planned grams
  and portion-chip manual feeds (single or both feeders) with a 5s undo window,
  FEEDING PLANS POPUP (fixed-overlay modal, theme-var chrome; weekly meal
  plans parsed from the raw distribution sensor, both feeders stacked as
  color-keyed sections; meal editor with 15-min time steps, gram steps,
  weekday dots; local-until-Save editing — Save writes only edited feeders
  via the integration's set_feeding_schedule service, Discard reverts),
  YAML-defined FEEDING PRESETS with a view-switcher chip row (highlight =
  viewing, check = active, detected by honest live-plan comparison;
  read-only previews; one-tap Apply writes both feeders; Load-into-editor
  copies a preset into the draft for tweaking before saving),
  configurable event-snapshot camera tiles (camera_image: eat | visit | feed,
  tap for live), amber alert strip (litter low, bin full, hopper empty, offline,
  frequent-use health flag), pulsing occupied dot. Child panels reset with
  their parents (closing More closes Settings; collapsing the card closes
  Settings + the plans popup; Escape/scrim also close it). All entities via
  YAML config (cat list + entity prefixes).
  Used as `type: custom:flat-cat-card` (see notes for the YAML shape).
  HA resource id: `6de3dc9ee5524b81a702ecbabae6e156`.
- `flat-music-card.js` — v1.26. Whole-home music control card for Music Assistant
  sync groups: header mini-player with active-output retargeting, queue-transfer
  output switching, scrubber and transport controls, live favorites picker,
  per-room balance with ratio lock and a shared lock helper, mute-wins policy,
  PC-cast toggle chip, and switchable linear/anchored per-room volume-scaling
  curves with an in-card anchor editor. All entities via YAML config. Used as
  `type: custom:flat-music-card` (see notes for the YAML shape).
  HA resource id: `87772b46cd93458f86bb144df94f502c`.
- `flat-security-card.js` — v1.4.1. Collapsible Alarmo security card: a one-line
  sentinel header (state-colored shield, flat-hero state word, open-sensor and
  person glyphs, and a slim countdown strip during exit/entry delays — visible
  even when collapsed) that expands to a camera-forward panel — entry-camera
  still view with live/person chips and an optional Frigate-UI link chip,
  ARM/DISARM strip with optimistic hold (splitting into CANCEL + ARM NOW
  during the exit delay — ARM NOW cuts the countdown short via Alarmo's
  dedicated skip_delay service), and a perimeter sensor list with
  open / guarding / BYPASSED-while-armed (the silent bypass gap made visible) /
  no-signal states, quiet-twin row merging, and sub-25% battery badges; the list
  focuses to the tripped sensor during entry delay and alarm, and the card
  surface pulses while triggered. Card chrome (background/border/radius) comes
  from the theme's card variables. All entities via YAML config. Used as
  `type: custom:flat-security-card` (see notes for the YAML shape). Resource
  identified by its `name=flat-security-card` label.
- `flat-climate-card.js` — v1.6.4. Whole-house climate card for a fleet of BLE
  temperature/humidity meters plus the thermostat's own thermometer: an
  indoor-vs-outdoor delta headline ("5.8 F cooler outside") with an OPEN
  WINDOWS chip (temperature-delta-only with hysteresis; a moisture gate was
  deliberately removed after historical dew-point analysis — reasoning in the
  source header) over a 24h temperature overlay (six solid series in
  grouped-by-meaning legend order, indoor rooms + hall then outdoor; the
  chart itself is text-free — series identity lives in the legend, the scrub
  tooltip, and legend tap-to-spotlight, which draws one series full-strength
  with a name+value label while the rest dim) with translucent dashed
  average lines (dashed = computed, solid = measured; the out-avg dash is
  exactly the sun-trimmed headline value; opacity via `avg_opacity`),
  expanding to an averages row with live in/out/delta readings, an out-vs-in
  humidity row, and a per-room now-strip. Includes a sun-spike trim
  (`sun_cap`) so an outdoor sensor heated by reflected sun can't distort the
  headline (graph lines stay raw), an optional in-average hall toggle
  (`hall: {in_average}`; display-only by default), band-gated hover/tap
  scrubbing with viewport-fixed graph-anchored tooltips (never clipped by
  the card edge) and series-colored on-curve dots whose position and values
  interpolate between history points, so sparse reporters stay on the
  hairline (`scrub_dots: false` removes the dots), and availability-honest
  '--' handling. Default entities are this dashboard's sensors; override via
  indoor:/outdoor:/hall: YAML. Used as `type: custom:flat-climate-card`.
  HA resource id: `f8f2966083af4b31b2588016c24dcc19`.
- `flat-server-card.js` — v1.5. NAS health + backup confidence card ("is the
  server okay and is my data safe?"): green-is-boring collapsed header (one
  quiet row; problems surface as a red-first alert strip even collapsed) that
  expands to Storage (array state/fill, parity age with next-due countdown from
  an anchor helper, per-disk problem sensors collapsed to "N/N healthy", pool
  bars), Mounts (host-truth JSON from a cron script via webhook + staleness
  guard), Services (torrent-client WebUI truth, container count, quiet updates
  row), System (host RAM, HA-VM RAM and HA-VM disk with unit-converted
  "used / total GB" labels, uptime with reboot amber), Power (UPS status /
  battery bar / runtime / load) and Backups (client + HA age rows). Row
  tap-throughs to the server / torrent / backup web UIs; long-press = more-info;
  alert-only server-notification and CPU-temp checks; every threshold is card
  YAML. All entities via YAML config. Used as `type: custom:flat-server-card`
  (see notes for the YAML shape). HA resource id:
  `54f8b17d7b9547c68be324e899b5ed0f`.
- `flat-maintenance-card.js` — v1.2. Device maintenance card (connectivity +
  batteries + filter life; renamed from flat-health-card at v1.2): green-is-boring
  collapsed header + alert strip, expanding to Connectivity (unreachable devices
  with outage duration and registry area, a 15-min debounce that shows restart
  storms as a grey "settling" count instead of alarms, and a widespread-outage
  banner when many devices drop at once — the body still lists every down device
  individually), Batteries (tiered amber/red thresholds with bars and a quiet
  "all > N%" summary) and Filters (purifier filter life, hidden until low;
  no-data rows stay dim). AUTO-DISCOVERING: reads the frontend entity/device/area
  registries, so every device owned by the configured integrations (default:
  matter) and every battery-% sensor is watched with zero YAML upkeep — new
  pairings appear automatically; curation via `exclude` substrings and a `rename`
  map, with an optional manual devices list. Card-only by design: no
  notifications and no helper entities; a device counts as unreachable only when
  ALL of its entities read unavailable (single orphaned entities can't false-flag
  a device). Used as `type: custom:flat-maintenance-card` (see notes for the
  YAML shape). HA resource id: `3d1d66cbc6d14336b43358bde2782a91`.
- `card-manager-card.js` — v1.2. The admin card that manages all of the above:
  lists every dashboard resource, decodes each data-URL card's header
  (name/version/size/FNV-1a), and replaces the old raw paste-in-Settings update
  workflow with a guarded flow — paste is validated against the target card's
  `;name=` label and header, backup of the outgoing blob is force-downloaded,
  the write goes by resource ID over the `lovelace/resources/update` websocket
  API, and the registry is re-verified after. Wrong-card pastes are hard-blocked.
  Brand-new cards are added through the same UI with a duplicate-label hard block.
  Lives on a separate admin-only dashboard; an optional YAML-configured PIN gates
  Update mode (Inspect stays open); updating the manager itself additionally
  requires typing the card name. Used as `type: custom:card-manager-card`.
  HA resource id: `19e69a73342741468a1d86c736b4f612`.
- `notes/ha-dashboard-notes.md` — the dashboard's working notes: build checklist for
  new cards, measured native-HA visual constants, house styles, entity inventory,
  and the card index.
- `notes/debug-lessons.md` — append-only debug lessons distilled across builds.
- `notes/flat-treadmill-card-notes.md`, `notes/flat-thermostat-card-notes.md`,
  `notes/flat-weather-card-notes.md`, `notes/flat-scoreboard-card-notes.md`,
  `notes/flat-music-card-notes.md`, `notes/vacuum-system-notes.md`,
  `notes/hvac-runtime-tracking-notes.md`, `notes/flat-security-card-notes.md`,
  `notes/flat-climate-card-notes.md`, `notes/flat-server-card-notes.md`,
  `notes/flat-maintenance-card-notes.md` —
  sanitized per-card / per-system deep
  notes (tap maps, helper inventories, version history pointers).

## How to read / modify a deployed card
Each source file opens with a "HOW THIS WORKS / HOW TO MAINTAIN IT" header. Short
version: decode the resource URL's base64 to read; edit (ASCII-only in strings),
`node --check`, re-encode, and replace the resource URL via the Card Manager
card's guarded update flow or under Settings > Dashboards > (three-dot) >
Resources, then hard-refresh.

The same sources and notes are also archived in the "NAS / Smart Home" Claude
project, which is where these cards are iterated.
