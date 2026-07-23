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
flat-thermostat-card runtime chip; the totals feed statistics graphs
("change" per day = daily runtime bars).

Notes: the integral/meter entities carry no unit_of_measurement (unitless
source) — cosmetic only. Hourly LTS rows appear only for hours with actual
state changes; gaps are normal. Riemann sensors sit `unknown` until the source
emits once (`homeassistant.update_entity` on the signal fixes it). Historical
runtime can be backfilled into the total's long-term statistics from raw
recorder history (hvac_action transitions) via the `recorder/import_statistics`
websocket API + a `recorder/adjust_sum_statistics` shift so sums start at zero
— done for ~11 days of cooling history on this install; method details in the
private project notes.
