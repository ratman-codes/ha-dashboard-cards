# flat-thermostat-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-thermostat-card v2.5.6 (never-hide chip 2026-08-11; runtime graph + centering 2026-08-05; runtime chip 2026-07-23; eco toggle 2026-07-20; v2.2 signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source:
`flat-thermostat-card.js` in this repo. YAML: `type: custom:flat-thermostat-card`
+ `entity: <climate entity>` + optional `runtime_cooling`/`runtime_heating`
(daily runtime meters, hours) + `runtime_cooling_stats`/`runtime_heating_stats`
(long-term statistics sources for the graph — typically the Riemann totals
behind the daily meters). Eco (v2.3): Nest `none|eco` preset as a detached leaf
button beside the mode strip; while on, track renders the entity-reported eco
setpoints green and read-only. Runtime chip (v2.4.x): today's ACTIVE
compressor/furnace hours in a fixed-width slot under the temp block; mode picks
the meter (cool/heat), heat_cool shows both rows, and the chip NEVER hides: off mode prefers
whichever ran today, showing all configured meters at 0m when nothing ran
(v2.5.6); transparent at rest, hover highlight only. Runtime graph (v2.5):
tap the chip and the card expands in place (grid-rows animation, no popups, no
dependencies) into a 14-day daily-runtime bar chart pulled from HA long-term
statistics over the card's own websocket (`recorder/statistics_during_period`,
change/day), with a live dashed today bar fed by the daily meter, a dashed
7-day-average line, a peak label (historical days only), per-bar hover/tap
tooltips, and a today / 7-day avg / peak summary row whose tiles tap through to
native more-info (v2.5.5). Layout/centering rule (v2.5.2–v2.5.4, owner-final):
the left column is fixed-width; the empty region spans from the card's visible
edge (card padding counts as empty space) to the track's left edge, and the
temp digits, status text, and chip all sit on that region's center axis — the
small degree unit is absolutely positioned outside the centering as an
adornment. Mode strip's left edge aligns exactly with the track's left edge;
track and eco run flush right. Full spec, version trail with hashes, and the
runtime-sensor pipeline live in the private project notes.
