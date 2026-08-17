# flat-climate-card — notes (sanitized repo copy; authoritative doc lives in the private project)

Whole-house climate card for a fleet of 5 BLE temperature/humidity meters (3 indoor rooms, 2 outdoor) heard via ESPHome Bluetooth proxies, plus the thermostat's own thermometer as a sixth line. Deployed v1.5; repo source is byte-identical to the live dashboard resource.

## Layout
- **Hero row (170px, always visible):** big indoor-vs-outdoor delta ("5.8 °F cooler outside") with the OPEN WINDOWS chip directly beneath it (top-left), over a 24h temperature overlay of six solid series + two translucent dashed average lines. Legend bottom-left in **grouped-by-meaning order: the three indoor rooms, then Hall (the thermostat — indoor), then the two outdoor sensors**; the same order everywhere the six appear (legend, strip, scrub tooltip). Outdoor pair direct-labeled at max/min points; average dashes end-labeled "in avg" / "out avg" at the right edge. Title pill toggles the expansion (hover wash per house style). No tap action on the hero — touch/hover only scrubs (removed v1.3; it fought mobile tap-scrubbing).
- **Average dashes (v1.5; dashed = computed, solid = measured):** in-avg (#e6c193) + out-avg (#8fb8e8), 2px dash, default opacity 0.35 (`avg_opacity`; 0 hides). The out-avg dash IS the sun-trimmed value the headline reports — the trim is visible where the dash refuses to follow a solar spike. Averages are bucket-time-aligned across available sensors, trim applied per bucket.
- **Hall line (v1.5):** the thermostat's temperature sensor, solid violet #a774d6, seated in the indoor group. Display-only by default — NOT in the indoor average (thermostat-embedded sensors run slightly warm); `hall: {in_average: true}` counts it, `hall: false` removes the line.
- **Expansion (grid-rows 0fr↔1fr + border-width 0↔1px):** humidity row (outdoor vs indoor, 2 series; row tap → more-info) + six-room now-strip (temp big, name, RH small; cell tap → more-info).
- **Scrub:** pointermove on either graph = vertical hairline + one tooltip listing every solid series' value at that time (averages excluded — they're derived).
- **Chip:** green or absent, never red. ON at delta ≥ on_delta (default 3 °F), OFF below off_delta (1.5) — hysteresis so it never flickers.

## The three data-driven design decisions
1. **Sun-spike trim (`sun_cap`, default 4 °F).** One outdoor sensor sits near glass/wall surfaces and reads +9 to +11.8 °F over the other on sunny afternoons (radiant heating of the sensor, not the air; clean-hour true difference ≤ 2.5 °F; ~1.4 °F LOW overnight from open-sky radiation). No honest reposition existed → each outdoor temp counts at most `sun_cap` above the coolest outdoor sensor before averaging. Graph lines stay raw. Legitimate warm-side air (that side is the intake) still counts up to the cap.
2. **No moisture gate on the chip.** Historical analysis (95 h of computed dew point via Magnus from T+RH) showed local summer dew point never leaves a narrow ~63–68 °F band — a textbook Td ≤ 60 gate would never fire, and an RH ceiling is permanently pessimistic (cool humid-climate air is always high-RH) → removed (v1.4). Bonus: computed dew point is IMMUNE to the solar sensor-heating (Td agreement ~0.6 °F between the two outdoor sensors even mid-spike). If a moisture rule is ever wanted again, re-add as a dew-point gate thresholded from a real offending evening, never RH.
3. **The sixth color, by measurement (v1.5).** A red sixth line was requested; an OKLab distance sweep showed red's best case ≈7 ΔE from the nearest existing series (the orange) — would be the most confusable pair on the chart — while violet #a774d6 sits ≈14 from its nearest neighbor (the blue), the one hue region the five left empty, and passes 3:1 contrast on the dark surface. Violet shipped after both were mocked. All-pairs CVD for six braided series is formally unpassable — identity is carried by legend + tooltip + the hall line's flattest-in-the-braid position. Do not add a seventh series.

## Config
`type: custom:flat-climate-card` (defaults baked). Overridables: `hours`, `indoor: [{entity, humidity, name, color}...]`, `outdoor: [...]`, `hall: {entity, humidity, name, color, in_average}` (or `false`), `sun_cap` (0 = pure min-of-outdoor, large = pure average), `avg_opacity` (default 0.35), `chip: {on_delta, off_delta, label}`. Humidity graph uses outdoor[0]+indoor[0] humidity entities. Delta = avg(available indoor [+hall if in_average]) − sun-trimmed avg(available outdoor); card-internal, no helper entities.

## Colors
Solids (hardcoded per house rule): indoor #d95926 / #c98500 / #d55181, hall #a774d6, outdoor #3987e5 / #199e70; chip #4caf50; avg dashes #e6c193 / #8fb8e8.

## Availability honesty
Unavailable sensors show '--' and drop out of the averages; if all outdoor sensors drop, the headline goes '--', the chip hides, and the hero dims. Nothing is coerced to 0.

## History plumbing
`history/history_during_period` WS (REST fallback), hourly-averaged buckets, last point pinned to live state, 5-min refresh, shared y-scale per graph (average lines included in the scale pass), 8 entities per call.

## Version history
- v1.0 (25,412 B, FNV-1a 7b183b6c): initial build; headless-Chromium mock-hass verified (collapsed/expanded/scrub/outdoor-dropout).
- v1.1 (25,636 B, 1e5642e3): hero condensed 224→170px; chip moved beside the legend.
- v1.2 (25,909 B, 7a5665bf): chip nowrap + chip/legend line fits one row down to ~400px card width. Lesson: the test bed was wider than the real dashboard column and the chip wrapped on install — verify at the deployment width; a 400px fit assertion now lives in the test driver.
- v1.3 (27,203 B, 86b35356): hero tap-to-more-info removed; sun-spike trim added.
- v1.4 (27,804 B, 20c34f83): chip moisture gate removed (delta-only).
- v1.5 (32,173 B, c074a151): hall line (solid violet, indoor group, display-only default) + translucent average dashes @0.35 + chip back to top-left under the headline. **Deployed + signed off.**

## Verification method
Headless Chromium + a mock-hass harness (stubbed states + callWS synthetic history, harness-injected ha-card styles) driving expand/scrub/unavailable/narrow-width/tap assertions plus v1.5 checks (6 solids + 2 dashes at 0.35, group order across all three surfaces, chip position) — no HA instance needed.
