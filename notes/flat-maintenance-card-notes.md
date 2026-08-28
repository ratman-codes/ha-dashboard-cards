# flat-maintenance-card — notes (sanitized repo copy)

Device maintenance card: connectivity + battery levels + purifier filter life, in
the flat-* house style. Renamed from flat-health-card at v1.2. The full working
notes (live YAML, household watch lists, incident history) live in the private
project; this copy documents the card itself.

## Concept
One quiet collapsed row when everything is healthy (green is boring). An alert
strip (red first, then amber) shows even while collapsed. Expanding reveals three
sections: Connectivity, Batteries, Filters. Rows and alerts tap through to
more-info; the header toggles expand/collapse (grid-rows animation, hover wash).

Card-only by design: it sends NO notifications and creates NO helper entities —
everything is computed client-side from the frontend state cache on each hass
push. Removing the card removes everything.

## Auto-discovery (v1.1+)
The card reads the frontend registry objects (`hass.entities`, `hass.devices`,
`hass.areas`):

- **Connectivity:** every device owning at least one entity whose registry
  platform is in `platforms` (default `[matter]`) joins the watch. Display name
  and area come from the device registry (area renders as a dim suffix in rows
  and parenthesized in alerts). New pairings appear with zero YAML edits.
- **Batteries:** every `sensor.*` with `device_class: battery` and unit `%`
  (one per device). Non-numeric values (text states, unavailable) are skipped
  silently in auto mode.
- **Curation:** `exclude:` — case-insensitive substrings matched against device
  names AND entity_ids (for e.g. bulbs on a switched circuit, phones, devices
  another card owns); `rename:` — exact device name to display label.
- **Manual mode / extras:** a `devices:` list (name + `entity` canary and/or
  `battery`) works standalone (`auto: false`) or merged on top of auto. Manual
  entries get a red "entity not found" row on typos and a dim "no data" row for
  battery-only entries with no numeric value.

## Detection semantics (the honest model)
- Only state `unavailable` counts as unreachable. `unknown` is normal (event
  entities reset on restart) and never alarmed.
- A device is down only when ALL of its present entities are unavailable — a
  single orphaned entity cannot false-flag a healthy device.
- `debounce_minutes` (default 15): unavailable younger than this is "settling"
  — kept out of the alert strip, but (v1.3) listed in the body as a named dim
  row with its age and a more-info tap-through, and named in the collapsed
  header when exactly one device is settling. Controller restarts produce
  transient unavailable storms that drain in ~10 minutes; an HA restart resets
  every device's clock, so a long-dead device re-enters "settling" for one
  debounce window after each restart.
- `banner_threshold` (default 5): at this many simultaneous downs the alert
  strip collapses to a single "widespread outage" banner (header goes red, the
  footer swaps to recovery advice) — but the body ALWAYS lists every down
  device individually (v1.2; suppression was tried in v1.0/v1.1 and removed).
- Sleepy battery devices can die silently while still showing available; that
  failure mode is not passively detectable (validated: their battery sensors'
  last_reported pins to restart time, so staleness heuristics don't work). The
  card footer states this instead of pretending.
- Battery thresholds are tiered: amber at `battery_warn` (default 20), red at
  `battery_crit` (default 10). Filters amber at `filter_warn` (default 30).
  Non-numeric values are never coerced to 0.

## Example YAML
```yaml
type: custom:flat-maintenance-card
title: Devices
collapsed_default: true
auto: true
platforms:              # any integration domains; one device per registry device
  - matter
  - esphome
  - homekit_controller
  - switchbot
  - reolink
  - roborock
exclude:
  - my track light      # switched circuit - routinely unpowered
  - my phone            # battery cycles daily
  - my ups              # another card's territory
rename:
  "Vendor Remote (B) Red": B Red (spare)
battery_warn: 20
battery_crit: 10
filter_warn: 30
debounce_minutes: 15
banner_threshold: 5
history_hours: 24         # LAST 24H lanes; 0 disables the section
history_max_lanes: 6      # fold point; "+N more" expands
history_event_window_s: 120
filters:
  - name: Purifier Living Room
    entity: sensor.my_purifier_filter_life
devices:                # optional manual extras
  - name: Extra Device
    entity: sensor.my_extra_canary
    battery: sensor.my_extra_battery
```

## Version history
- v1.0 (2026-08-17, 21,154 B, FNV-1a a11649cf; never installed): manual device
  list; banner suppressed rows.
- v1.1 (27,559 B, 64d55e4b): registry auto-discovery, exclude/rename,
  all-entities-unavailable device logic, text-battery skip.
- v1.2 (2026-08-17, 28,629 B, FNV-1a 76efb15f): renamed
  flat-health-card -> flat-maintenance-card; registry areas shown by default;
  banner row-suppression removed; header geometry aligned to native tiles
  (painted circle 10px / title 56px from the border-box edge).
- v1.3 (2026-08-25, 29,379 B, FNV-1a b52e80b1): settling devices are
  NAMED — per-device dim rows ("settling - 4m", tap = more-info) replace the
  bare count; header names a lone settling device; render signature includes
  settling names. Debounce/alert semantics unchanged. Motivated by an HA
  restart that left the card saying "1 settling" for 15 minutes without saying
  what. Same day the live config widened `platforms` from matter-only to six
  integrations (YAML only, no card change).
- v1.4 (2026-08-25, 44,674 B, FNV-1a 9033f11f): LAST 24H section —
  on expand, one `history/history_during_period` call (compressed rows;
  `lc`/`lu` epoch seconds, full-row fallback) over one canary entity per
  watched device; timeline lanes for devices that were unavailable in the
  window (red = past the debounce, grey sliver = blip, 3px minimum so a
  2-minute blip stays visible), an amber "Network event" lane when
  `banner_threshold` devices drop within `history_event_window_s` (tap to list
  members), right column = count + total downtime ("all day" for an outage that
  spans the whole window), worst-first, capped at `history_max_lanes` with a
  "+N more" row; header gains "24h: N outages"; refreshes every 5 min while
  open; absent when the window is clean; micro-blips under 30 s (integration
  reloads) dropped. New YAML: `history_hours` (24; 0 disables),
  `history_max_lanes` (6), `history_event_window_s` (120). Still zero HA
  entities. Verified: jsdom (event grouping, blip class, cap, disabled, error
  row, lazy fetch only on expand) + headless-Chromium render at the
  dashboard's column width.
- v1.5 (2026-08-25, 46,011 B, FNV-1a e2bc03ad): device-level taps
  (Connectivity rows, unreachable alerts, 24h lanes, network-event members)
  navigate to the HA device page (`/config/devices/device/<id>` via
  pushState + `location-changed`) instead of more-info on one arbitrary
  canary entity — tapping a camera's lane had opened its IR-light toggle.
  Manual `devices:` entries, battery and filter rows keep more-info.
- v1.6 (2026-08-26, 46,887 B, FNV-1a 906d5861, CURRENT): the lane cap is a
  FOLD, not a crop — "+N more" is tappable and reveals every lane, "show less"
  folds back; the fold and any open network-event member list reset when the
  card collapses. Owner caught a 12-device night showing six lanes and an
  inert "+6 more".

Verification per house checklist: node --check, zero-non-ASCII scan, headless-
Chromium mock-hass harness (manual + auto scenarios incl. partial-unavailability,
excludes, rename, banner threshold, typo net) with rendered screenshots at the
dashboard's column width and a header-geometry assert.
