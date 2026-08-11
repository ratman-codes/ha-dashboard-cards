# flat-climate-card — notes (sanitized repo copy; authoritative doc lives in the private project)

Whole-house climate card for a fleet of 5 BLE temperature/humidity meters (3 indoor rooms, 2 outdoor) heard via ESPHome Bluetooth proxies. Deployed v1.4; repo source is byte-identical to the live dashboard resource.

## Layout
- **Hero row (170px, always visible):** big indoor-vs-outdoor delta ("5.8 °F cooler outside") over a 24h all-rooms temperature overlay (5 series); legend + OPEN WINDOWS chip share the bottom line; the outdoor pair is direct-labeled at its max/min points. Title pill toggles the expansion (hover wash per house style). No tap action on the hero — touch/hover only scrubs (a tap-to-more-info was removed in v1.3 because it fought mobile tap-scrubbing).
- **Expansion (grid-rows 0fr↔1fr + border-width 0↔1px per the house checklist):** humidity row (outdoor vs indoor, 2 series; row tap → more-info) + per-room now-strip (temp big, name, RH small; cell tap → more-info).
- **Scrub:** pointermove on either graph = vertical hairline + one tooltip listing every series' value at that time.
- **Chip:** green or absent, never red. ON at delta ≥ on_delta (default 3 °F), OFF below off_delta (1.5) — hysteresis so it never flickers at the crossover.

## The two data-driven design decisions (v1.3/v1.4)
1. **Sun-spike trim (`sun_cap`, default 4 °F).** One outdoor sensor sits near glass/wall surfaces and reads +9 to +11.8 °F over the other on sunny afternoons (radiant heating of the sensor, not the air; clean-hour true difference measured ≤ 2.5 °F; it also reads ~1.4 °F LOW overnight from open-sky radiation). No honest reposition existed, so each outdoor temp counts at most `sun_cap` above the coolest outdoor sensor before averaging. Graph lines stay raw — the spike remains visible, it just can't distort the headline/chip. Legitimate warm-side air (this side is the house's intake) still counts up to the cap.
2. **No moisture gate on the chip.** Early versions gated on outdoor RH ≤ 70%. Historical analysis (95 h of computed dew point via Magnus from T+RH) showed local summer dew point never leaves a narrow ~63–68 °F band — a textbook Td ≤ 60 gate would never fire, and an RH ceiling is permanently pessimistic (cool humid-climate air is always high-RH). With Td near-constant, no moisture gate discriminates → removed. Bonus finding: computed dew point is IMMUNE to the solar sensor-heating above (T up, RH down, Td invariant — the two outdoor sensors' Td agree within ~0.6 °F even mid-spike). If a moisture rule is ever wanted again, re-add it as a dew-point gate thresholded from a real offending evening, never RH.

## Config
`type: custom:flat-climate-card` (defaults baked). Overridables: `hours`, `indoor: [{entity, humidity, name, color}...]`, `outdoor: [...]`, `sun_cap` (0 = pure min-of-outdoor, large = pure average), `chip: {on_delta, off_delta, label}`. Humidity graph uses outdoor[0]+indoor[0] humidity entities. Delta = avg(available indoor) − sun-trimmed avg(available outdoor); card-internal, no helper entities exist.

## Colors
CVD-validated dark 5-set (hardcoded per house rule): indoor #d95926 / #c98500 / #d55181, outdoor #3987e5 / #199e70; chip #4caf50. The yellow↔orange pair fails all-pairs CVD — carried by legend + scrub tooltip; re-validate before adding a 6th series.

## Availability honesty
Unavailable sensors show '--' and drop out of the averages; if all outdoor sensors drop, the headline goes '--', the chip hides, and the hero dims. Nothing is coerced to 0.

## History plumbing
`history/history_during_period` WS (REST fallback), hourly-averaged buckets, last point pinned to live state, 5-min refresh, shared y-scale per graph, 7 entities per call.

## Version history
- v1.0 (25,412 B, FNV-1a 7b183b6c): initial build; headless-Chromium mock-hass verified (collapsed/expanded/scrub/outdoor-dropout).
- v1.1 (25,636 B, 1e5642e3): hero condensed 224→170px; chip moved beside the legend.
- v1.2 (25,909 B, 7a5665bf): chip nowrap + chip/legend line fits one row down to ~400px card width. Lesson: the test bed was wider than the real dashboard column and the chip wrapped on install — verify at the deployment width; a 400px fit assertion now lives in the test driver.
- v1.3 (27,203 B, 86b35356): hero tap-to-more-info removed; sun-spike trim added.
- v1.4 (27,804 B, 20c34f83): chip moisture gate removed (delta-only). **Deployed + signed off.**

## Verification method
Headless Chromium + a mock-hass harness (stubbed states + callWS synthetic history, harness-injected ha-card styles) driving expand/scrub/unavailable/narrow-width/tap assertions — no HA instance needed.
