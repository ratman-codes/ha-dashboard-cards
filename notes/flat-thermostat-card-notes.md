# flat-thermostat-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-thermostat-card v2.6.11 (runtime views 2026-08-18; never-hide chip 2026-08-11; runtime graph + centering 2026-08-05; runtime chip 2026-07-23; eco toggle 2026-07-20; v2.2 signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source:
`flat-thermostat-card.js` in this repo. YAML: `type: custom:flat-thermostat-card`
+ `entity: <climate entity>` + optional `runtime_cooling`/`runtime_heating`
(daily runtime meters, hours) + `runtime_cooling_stats`/`runtime_heating_stats`
(long-term statistics sources — typically the Riemann totals behind the daily
meters) + `runtime_cooling_signal`/`runtime_heating_signal` (the pipeline's 0/1
template signal sensors, v2.6: exact on/off ribbon) + `outdoor_high_stats`
(an outdoor temperature entity with long-term statistics, v2.6: records
scatter) + `period_default: 7d|14d|30d|60d|season` (v2.6.11, default 14d).
Eco (v2.3): Nest `none|eco` preset as a detached leaf button beside the mode
strip; while on, track renders the entity-reported eco setpoints green and
read-only. Runtime chip (v2.4.x): today's ACTIVE compressor/furnace hours in a
fixed-width slot under the temp block; mode picks the meter (cool/heat),
heat_cool shows both rows, and the chip NEVER hides: off mode prefers whichever
ran today, showing all configured meters at 0m when nothing ran (v2.5.6);
transparent at rest, hover highlight only. Runtime graph (v2.5): tap the chip
and the card expands in place (grid-rows animation, no popups, no dependencies)
into a 14-day daily-runtime bar chart pulled from HA long-term statistics over
the card's own websocket (`recorder/statistics_during_period`, change/day),
with a live dashed today bar, a dashed avg line, a peak label (historical days
only), and per-bar tooltips that clamp inside the plot (v2.6.6). Runtime views
(v2.6.x): the today / avg / peak summary tiles sit ABOVE the plot and act as a
tab switcher — tapping one swaps the plot area in place (X restores the bars;
supersedes v2.5.5's more-info tap-throughs). TODAY: two-row hero (total + runs
+ longest), fixed-slot day pager with a native calendar picker and a
jump-to-today arrow, exact on/off ribbon from the signal sensor's recorder
history (recorder retention limits it to recent days; it quietly drops out
beyond that), minutes-per-hour bars from hourly statistics (any day, forever).
PERIOD explorer: range chips (season = since Jun 1 cooling / Nov 1 heating;
custom = native date inputs), total / avg-per-day / days-ran / vs-previous
stat row, daily bars auto-aggregating weekly past 35 days, and a TRANSPOSED
time-of-day heatmap — 8 fixed 3-hour band columns across the top, dates down
as rows newest-first (Today on top), every row labeled, uniform 20px square
cells at every range, grid optically centered (panel center nudged a quarter
of the label column). RECORDS: peak-day hero, top-5 ranked days (tap a rank to
drill into that day's TODAY view), and a runtime-vs-outdoor-high scatter of
the last 60 days with a dashed least-squares trend line that hides itself when
r-squared < 0.1. The middle summary tile tracks the selected window ("14d
avg"), persisting after the view closes; larger-than-14d defaults self-fill
via one quiet stats fetch. Layout/centering rule (v2.5.2–v2.5.4, owner-final):
the left column is fixed-width; the empty region spans from the card's visible
edge (card padding counts as empty space) to the track's left edge, and the
temp digits, status text, and chip all sit on that region's center axis — the
small degree unit is absolutely positioned outside the centering as an
adornment. Mode strip's left edge aligns exactly with the track's left edge;
track and eco run flush right. Full spec, version trail with hashes, and the
runtime-sensor pipeline live in the private project notes.
