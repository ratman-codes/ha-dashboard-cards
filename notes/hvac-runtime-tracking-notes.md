# HVAC runtime tracking — sanitized notes

Pipeline that turns a climate entity's `hvac_action` attribute into daily
active-runtime statistics, built 2026-07-23 entirely from native HA helpers
(config flows, no YAML):

`hvac_action` → template sensor (1 while cooling/heating, else 0, state_class
measurement) → integration (Riemann sum) helper (method `left` — exact for a
0/1 step signal; `max_sub_interval` 5 min so the total ticks mid-run; output =
total hours, state_class `total`, kept forever in long-term statistics) →
utility_meter helper (cycle daily; "hours today", resets at local midnight).
One chain per action (cooling, heating). The daily meters feed the
flat-thermostat-card runtime chip; the totals feed the card's expanding 14-day
runtime graph and any statistics-graph card ("change" per day = daily runtime
bars, arbitrary window since LTS is permanent).

Notes: the integral/meter entities carry no unit_of_measurement (unitless
source) — cosmetic only. Hourly LTS rows appear only for hours with actual
state changes; gaps are normal. Riemann sensors sit `unknown` until the source
emits once (`homeassistant.update_entity` on the signal fixes it). Historical
runtime can be backfilled into the total's long-term statistics from raw
recorder history (hvac_action transitions) via the `recorder/import_statistics`
websocket API + a `recorder/adjust_sum_statistics` shift so sums start at zero
— done for ~11 days of cooling history on this install. Known cosmetic
artifact of backfilling: the total's raw History **state** line shows a cliff
where the synthetic backfilled odometer meets the real sensor (born at 0) —
the statistics **sum/change** series is continuous across the seam, which is
what every change-per-day view consumes. Method details in the private
project notes.

Run once - "off after this run" (2026-08-23): a toggle helper + one small
automation turn a manually-started run into a one-shot. While the helper is
on, `hvac_action` cooling/heating -> idle sustained 1 min (blip guard) turns
the climate entity off and clears the helper; the climate entity going off
manually (any UI) also clears it. Arming while idle means the NEXT completed
run turns it off. The flat-thermostat-card arms/disarms the helper via a
long-press on its power button (`run_once_entity` config key) and shows an
orbiting standby-amber arc while armed - but the automation is the engine,
so the one-shot works with every dashboard closed.

The card's ran-during ribbon (v2.8+) additionally reads the climate entity's
OWN recorder history (state + attributes) for a mode on/off band and setpoint
tick marks - no pipeline entities involved, zero new helpers; noted here only
because the ribbon renders alongside the pipeline-fed run segments and shares
their recorder-retention limit.
