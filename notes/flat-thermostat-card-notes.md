# flat-thermostat-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-thermostat-card v2.3 (eco toggle 2026-07-20; v2.2 signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source:
`flat-thermostat-card.js` in this repo. YAML: `type: custom:flat-thermostat-card`
+ `entity: <climate entity>`. v2.3 adds the eco preset (Nest `none|eco`) as a
detached leaf button beside the mode strip — a separate rounded-rect, NOT a
fifth strip slot, because eco overlays the active hvac mode rather than
replacing it. While eco is on: leaf and idle status go green (#4caf50/#81c784),
and the track renders the entity-reported eco setpoints green and read-only
(handles hidden, drag disabled — the thermostat rejects setpoint changes in
eco). The button self-hides on entities without an eco preset. Full spec and
version history in the private notes.
