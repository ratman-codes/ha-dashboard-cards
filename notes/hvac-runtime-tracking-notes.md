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

Ribbon permanence (card v2.10): two numeric mirror template sensors - a 0/1
"thermostat mode on" signal and a setpoint sensor (null while off), both
state_class measurement - give the card's ran-during ribbon permanent hourly
statistics to fall back on once recorder purges the raw history. The last
~10 days of pre-sensor history were rescued by computing hourly mean/min/max
from remaining recorder rows and importing via the recorder/import_statistics
websocket command (measurement metadata: has_mean true, has_sum false;
exclude the current hour to avoid colliding with live stat compilation).

Eco when away (card v2.11): a standing rule armed from the card (long-press
the eco leaf). Engine = a toggle helper (the rule) + a latch helper (records
that the AUTOMATION engaged eco, so manual eco is never clobbered) + a
minutes input_number (the away delay; the trigger's templated `for:` reads it
live) + two automations: ENGAGE (presence binary_sensor "away" held for the
delay, rule armed, mode active, not already eco -> latch on, set native eco
preset, actionable notification with an "Exit Eco" button; edge-triggered =
once per departure) and RESTORE (presence home OR the notification action;
latch-gated; exits eco only if still in eco; clears latch + notification).
Testable while home: presence lives only in the trigger, so firing the
engage automation manually exercises the whole loop without touching
anything else that watches presence.

Eco bounds (card v2.11.1/.2): the climate entity only reports the eco bound
matching the CURRENT hvac mode, and the eco range itself is vendor-locked
(editable only in the vendor app; the API exposes eco on/off only). Two
input_number helpers carry the range for the card's eco render, seeded from
the vendor app's values and kept SELF-HEALING by a mirror automation: while
eco is active, whatever bound the entity exposes (cool mode = the cool
point, heat = the heat point, heat_cool = both) is copied into the matching
helper - so a vendor-app range change propagates the next time eco runs in
that mode, and nothing is hardcoded in YAML.
