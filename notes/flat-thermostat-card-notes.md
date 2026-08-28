# flat-thermostat-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-thermostat-card v2.11.2 (permanent ribbon history + eco-when-away + eco range 2026-08-28; ran-during ribbon + setpoint ticks 2026-08-25; run-once 2026-08-23; runtime views 2026-08-18; never-hide chip 2026-08-11; runtime graph + centering 2026-08-05; runtime chip 2026-07-23; eco toggle 2026-07-20; v2.2 signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source:
`flat-thermostat-card.js` in this repo. YAML: `type: custom:flat-thermostat-card`
+ `entity: <climate entity>` + optional `runtime_cooling`/`runtime_heating`
(daily runtime meters, hours) + `runtime_cooling_stats`/`runtime_heating_stats`
(long-term statistics sources — typically the Riemann totals behind the daily
meters) + `runtime_cooling_signal`/`runtime_heating_signal` (the pipeline's 0/1
template signal sensors, v2.6: exact on/off ribbon) + `outdoor_high_stats`
(an outdoor temperature entity with long-term statistics, v2.6: records
scatter) + `period_default: 7d|14d|30d|60d|season` (v2.6.11, default 14d) +
`run_once_entity` (an input_boolean, v2.7: one-shot arming).
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
via one quiet stats fetch. Run once (v2.7-v2.7.2): long-press (550ms) the
power mode button while the mode is active to arm "off after this run" -
armed state = a standby-amber quarter-arc orbiting the power glyph (5s/lap,
pure CSS; static ring under prefers-reduced-motion) with the glyph tinted to
match; short-tap power stays "off now", the click trailing a long-press is
swallowed, off mode ignores the gesture. The card only toggles/displays the
paired input_boolean; a small HA automation does the actual work (hvac_action
cooling/heating -> idle for 1 min while armed -> set_hvac_mode off + disarm;
manual off from any UI just disarms) so the one-shot fires with every
dashboard closed. Amber is deliberately mode-agnostic (the pending off is
neither a cooling nor a heating thing) and a paler sibling of the heat_cool
accent - thin ring vs solid fill keeps them distinct.
Ran-during ribbon (v2.8-v2.9.3): the TODAY ribbon paints the thermostat's
mode-on span as a faint series-tinted band UNDER the solid run segments (gray
= purposely off, faint = on but idle, solid = running; read from the climate
entity's own recorder history, so it shares the ribbon's retention limit and
needs zero configuration), and a thin label row above it carries SETPOINT
TICKS: every turn-on and every setpoint change gets a 1px tick climbing out of
the band with the value just right of it - never centered, a label always
marks "from this moment, this value". Rapid dial-turn bursts (a real Nest
emits 76 then 77 two seconds apart, or 78-79-78 in five seconds) settle: change
events chaining within 120s collapse into one tick carrying the settled value,
and a chain that lands back where it started emits no tick at all. When labels
collide, the visible label goes to the value that GOVERNED THE LONGEST (not
the earliest); losing ticks drop to a quiet band-only notch so a tick never
slices through another label's text. A scrub tooltip (hover/press anywhere on
the ribbon) gives the exact time, mode, setpoint, and running/idle state.
Since v2.9 the same full ribbon also renders on the DEFAULT expanded panel -
"Ran during - today" between the summary tiles and the 14-day bars - and the
panel header simplified to just the series name with each section carrying its
own label. Implementation note: the websocket history API returns COMPRESSED
rows (state=s, attributes=a, last_updated=lu seconds) - attribute-derived
features must read `a`, not the REST-style `attributes` key, and should carry
attributes forward across rows that omit them. Layout/centering rule (v2.5.2–v2.5.4, owner-final):
the left column is fixed-width; the empty region spans from the card's visible
edge (card padding counts as empty space) to the track's left edge, and the
temp digits, status text, and chip all sit on that region's center axis — the
small degree unit is absolutely positioned outside the centering as an
adornment. Mode strip's left edge aligns exactly with the track's left edge;
track and eco run flush right. Full spec, version trail with hashes, and the
runtime-sensor pipeline live in the private project notes.
Permanent ribbon history (v2.10): raw recorder history purges at ~10 days, so
two numeric mirror template sensors (a 0/1 "thermostat on" signal and a
setpoint sensor, null while off) keep hourly long-term statistics forever;
card keys `mode_stats`/`setpoint_stats` point at them, and any day recorder
no longer has falls back to HOUR RESOLUTION - "RAN DURING - HOURLY" section
label, on-band from hours whose mode-on mean > 0, runtime-shaded hour cells
with 1px gaps (opacity ~ fraction of the hour that ran; the visible
quantization is the honesty cue), setpoint ticks at hour boundaries (a stable
hour labels, a min!=max transition hour gets a quiet tick), and an hourly
tooltip ("12p-1p - on - set 76 - ran 24m"). Minute-exact rendering still wins
whenever raw history exists; the fallback hour-stats can also be backfilled
from whatever recorder still holds via recorder/import_statistics
(measurement metadata: has_mean true / has_sum false) - done on this install
before the sensors' first purge cycle. Eco range render (v2.11.1/.2): in eco
the track shows BOTH eco bounds as a green range (action-zone fills to each
bound, dark comfort deadband between) with flush full-height 3px marks
contained inside the track; the entity only reports the bound matching the
CURRENT hvac mode (the eco range itself is vendor-locked - the device rejects
setpoint writes in eco and the API only exposes eco on/off), so helper
input_numbers carry the blind side via `eco_low_entity`/`eco_high_entity`,
kept self-healing by a small automation that copies whatever bound the entity
exposes into the matching helper while eco is active. Eco-when-away (v2.11):
long-press the eco leaf to arm a STANDING rule - armed mark = the run-once
arc geometry but STATIC and green (motion stays reserved for pending
one-shots), white atop the active green button; when a household presence
binary_sensor holds "away" for a helper-set delay, an HA-side automation
flips the thermostat to native eco and sends an actionable notification with
an "Exit Eco" button; presence returning restores automatically, and a latch
helper guarantees only automation-engaged eco is ever undone (manual eco
untouched). Engage is edge-triggered, so undo cannot re-fire until the next
departure. The default panel gains an "ECO WHEN AWAY" row: armed shows
"sets Eco after [-] 30m [+] away" with a debounced stepper writing the delay
helper; disarmed shows "off - hold the leaf to arm". Config keys:
`eco_away_entity` (arming input_boolean) + `eco_away_delay_entity` (minutes
input_number). Version trail: v2.10 2f0cfa12 -> v2.11 745fb705 -> v2.11.1
1fd75b72 -> v2.11.2 ddd39a78 (118,211 -> 128,182 B).
