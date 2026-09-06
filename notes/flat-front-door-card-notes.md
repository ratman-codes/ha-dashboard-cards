# flat-front-door-card — notes (sanitized repo copy)

Front-door activity card for a battery video doorbell (built against a Reolink
battery doorbell integrated in Home Assistant, hub-free). Full working notes
(real entity ids, deploy state, version hashes, resource id) live in the private
project archive — this copy is the spec.

## What it answers

"Did anything happen at my door today, and was it real?" On a shared walkway a
doorbell's person detector fires ~20 times a day and almost all of them are
pass-throughs. The card separates the four things that matter (rings, packages,
people who *lingered*, vehicles) from the walker noise, and turns the noise into
a per-hour density strip and a permanent weekday x hour heatmap.

Layout (owner picked layout A of a three-layout mockup drawn with a real week of
events):

- **Collapsed header:** doorbell glyph (blue; amber for the rest of the day
  after a ring), title, and a subtitle like "1 package - 1 lingering - 23
  walkers today". An optional package-waiting glyph (orange box + age) sits in
  the notable slot while a configured helper is on; tap = its more-info.
- **LAST 24H:** tick rows for Ring / Package / Lingering / Vehicle with times
  labeled (tap = pop-out) over a WALKERS per-hour density strip.
- **SNAPSHOTS:** the newest `gallery_count` dated snapshot files (kind chip on
  the tile, date below; tap = lightbox).
- **`history >`** opens ONE pop-out: the walkway heatmap (tabs 7d/30d/90d/1y
  with a statistics sensor, 7d/14d without), tiles (walkers total / busiest
  hour / packages + lingering), and every snapshot two-wide.
- An (i) glyph next to the section name carries the "how to read this" text as
  a hover/tap tooltip (the house tooltip pattern shared with the vacuum card).

The card creates **zero HA entities** and **never renders a camera entity** —
rendering one wakes a battery doorbell. Everything visual comes from binary
sensors, a media folder of static snapshot files, and recorder/statistics
websocket calls.

## Config

```yaml
type: custom:flat-front-door-card
title: Front Door
collapsed_default: true
ring: binary_sensor.doorbell_visitor          # doorbell button / visitor sensor
package: binary_sensor.doorbell_package       # AI package detection
vehicle: binary_sensor.doorbell_vehicle       # AI vehicle detection
person: binary_sensor.doorbell_person         # AI person detection (the walker source)
package_waiting: input_boolean.package_waiting   # optional: delivery-mode helper -> header glyph
walkers_stats: sensor.doorbell_walkers_total     # optional: total_increasing sensor -> permanent heatmap
snapshots: media-source://media_source/local/doorbell_snapshots   # optional: media folder id
history_hours: 24
gallery_count: 3
heatmap_days: 7
```

Optional keys with defaults: `history_hours` 24 · `gallery_count` 3 ·
`heatmap_days` 7 · `max_files` 200. Omit `walkers_stats` and the heatmap falls
back to raw recorder history (tabs 7d/14d — HA's recorder keeps ~10 days). Omit
`package_waiting` and there is no header glyph. Omit `snapshots` and there is no
gallery AND no lingering row (lingering marks come from files, see below).

## Data sources (all client-side websocket calls, cached)

- **Timeline / header counts:** `history/history_during_period` over the four
  sensors for the `history_hours` window (minimal, compressed rows); refetched
  every 10 min INCLUDING while collapsed (the header needs the counts). An
  onset = off/unavailable -> on. The walkers strip = person onsets binned into
  24 equal bins.
- **Lingering marks:** the `lingering_<YYYYMMDD-HHMMSS>.jpg` files in the
  snapshot folder that fall inside the window. HA does **not** record an
  automation's `last_triggered` attribute in history (v1.0 tried), so a
  per-event snapshot written by the lingering automation is the only durable
  trace. An alert that fires while the doorbell is unavailable leaves no file
  and therefore no tick — accepted.
- **Gallery:** `media_source/browse_media` on the `snapshots` id (every 5 min
  while open, 10 min collapsed). Understood file names:
  `<ring|package|lingering|vehicle>_<YYYYMMDD-HHMMSS>.jpg` and
  `package_<epoch10>.jpg`; anything else is ignored. Newest first, `max_files`
  cap. Thumbnails via `media_source/resolve_media` (signed URLs, cached 4 min
  because the signatures expire), resolved only while the body or pop-out is
  visible.
- **Heatmap:** with `walkers_stats`, `recorder/statistics_during_period`
  (`period: hour`, `types: [change]`) over 7/30/90/365 days -> weekday x hour
  grid, cell = per-week average (tooltip: avg/h over N weeks + total); 30-min
  cache per window. Without it: person-history onsets, tabs 7d/14d. Tab
  changes re-render only the heatmap block — the previous grid stays, dimmed,
  until the new window arrives (v1.4.2 fixed a whole-overlay flash).

## Companion HA-side pieces (not part of the card, documented in the project)

The card reads what these leave behind: a snapshot automation/blueprint that
writes dated `<kind>_<stamp>.jpg` files per event; a "person lingering"
automation that writes `lingering_<stamp>.jpg`; a delivery-mode helper
(`package_waiting`) set on package detection and cleared on door open; a
counter + `total_increasing` template sensor incremented on every person onset
(the permanent heatmap source, backfilled from recorder history once via
`recorder/import_statistics`); and a nightly prune of snapshot files older than
30 days.

## Look

Header matches the security card's chrome exactly (icon centre, text start and
chevron position; 56 px tall, 14 px title, 11.5 px subtitle, 18 px chevron).
Tick colors: ring blue, package green, lingering amber, vehicle violet — identity
is carried by row labels and kind chips, color is secondary. Empty rows say
"none" (green-is-boring). ASCII-clean source; zero dependencies; data-URL
resource hosting.

## Version history (see project archive for hashes)

- v1.0 — first build from the mockup; jsdom harness + headless-Chromium render
  at the owner's card width. Lingering from the automation's `last_triggered`
  history — did not work (HA does not record it).
- v1.1 — header chrome copied from the security card; ONE pop-out entry (a
  redundant "walkway pattern" row removed); footer text -> (i) glyph;
  lingering marks from files.
- v1.2 — `package_waiting` header glyph (moved here from the security card's
  v1.5); chevron 18 px.
- v1.3 — `walkers_stats`: statistics-driven permanent heatmap, tabs
  7d/30d/90d/1y, per-week averages.
- v1.4 — header condensed (56 px) with a doorbell glyph.
- v1.4.1 — (i) tooltip = the vacuum card's `ha-icon` + bubble pattern, verbatim.
- v1.4.2 — (i) vertically centred; pop-out tab changes re-render only the
  heatmap block (no overlay flash).
