# Debug lessons (sanitized, general) — append-only

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

## Debug lessons (general)
- Measure native components live (shadowRoot walks, getBoundingClientRect)
  instead of guessing colors/geometry.
- `display:none→block` resets CSS transitions; svg in ha-icon sags without
  flex + line-height:0; literal non-ASCII can mojibake depending on charset.
- Native dial (HA 2026.7): track rgb(70,70,70) @.3; faded arc accent @.5; bright
  arc accent @1, round caps, rendered even at zero length; current-temp dot
  rgb(225,225,225) @.5, darkened on bright fill.
- Sensor-card compact heights: graph `.footer` paints over text; fix =
  `position:relative; z-index:1` on `.header, .info`.
- Text stroke over busy backgrounds: `-webkit-text-stroke: 4px <bg>` +
  `paint-order: stroke fill`.
- data: URLs accept `;name=<label>` params — Chrome imports fine.
- Custom cards can subscribe to forecast pushes
  (`weather/subscribe_forecast`; NWS = twice_daily+hourly only, today's high =
  the `is_daytime:true` period) and can query long-term statistics
  (`recorder/statistics_during_period`; sensors need `state_class`).
- Custom cards can read/write the resource registry over WS
  (`lovelace/resources` / `lovelace/resources/update`, admin-only) — that's how
  the Card Manager works. Hard-refresh after resource changes.
- View-transition InvalidStateError console noise on dashboard load (HA 2026.7)
  is benign; freshly-reloaded sections views can take seconds to paint.
- Nest eco preset (verified live): with `preset_mode: eco` the climate entity
  reports the ECO setpoints in the normal `temperature`/`target_temp_low/high`
  attributes; in a single mode only that side's eco bound is exposed (the other
  bound is not available from HA); the device rejects `set_temperature` in eco.
- PetKit: manual-feed text entity dispenses on write (cancel button = undo
  basis); bowl-fill % is coarse; eat events are per-feeder (per-cat attribution
  impossible); litter `last_used_by` is reliable; event images reset at
  midnight/restart and lag the media poll (~15 min) — morning placeholders are
  expected behavior.
