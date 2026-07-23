# flat-thermostat-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-thermostat-card v2.4.5 (runtime chip 2026-07-23; eco toggle 2026-07-20; v2.2 signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source:
`flat-thermostat-card.js` in this repo. YAML: `type: custom:flat-thermostat-card`
+ `entity: <climate entity>` + optional `runtime_cooling`/`runtime_heating`
(daily runtime meter entities, in hours). v2.3 adds the eco preset (Nest
`none|eco`) as a detached leaf button beside the mode strip — a separate
rounded-rect, NOT a fifth strip slot, because eco overlays the active hvac mode
rather than replacing it. While eco is on: leaf and idle status go green
(#4caf50/#81c784), and the track renders the entity-reported eco setpoints
green and read-only (handles hidden, drag disabled — the thermostat rejects
setpoint changes in eco). The button self-hides on entities without an eco
preset. v2.4.x adds a daily HVAC runtime chip: a fixed 80px readout in a slot
under the temp block (same-width column keeps the mode strip edge-aligned with
the temperature track), showing today's ACTIVE cooling/heating hours ("2h 41m"
+ "TODAY" caption; both meters as two rows in heat_cool). Fed by daily
utility-meter entities built on Riemann integrals of 0/1 template signals over
the climate entity's `hvac_action` (mode-on time is NOT counted, only actual
compressor/furnace run time). Chip always shows when configured and mode is not
off; unavailable meters render '--'; no resting background — hover highlight
only (`@media (hover:hover)`); tap opens the meter's more-info history. Full
spec, version trail, and the statistics backfill notes live in the private
project.
