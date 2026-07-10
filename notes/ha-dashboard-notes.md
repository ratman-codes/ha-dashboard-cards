# Home Assistant Dashboard Notes

## Standing rule (user-set, 2026-07-09)
**Do NOT make changes to Home Assistant (dashboards, config, DB, anything) unless the user explicitly asks.** Read-only inspection is fine. Always propose YAML first; user usually pastes it themselves. HACS installs / resource writes OK only with explicit go-ahead.

## Custom-card build checklist (READ THIS before building any bespoke card for this user)
Distilled from ~25 iterations on flat-thermostat-card. A new card should satisfy ALL of these before handoff:

1. **Hosting:** zero external dependencies. Ship as a data-URL module in the dashboard resource registry via `ha_config_set_dashboard_resource` (one resource per card; save the resource_id in these notes). **Label the URL with a name parameter so the Resources page is readable: `data:text/javascript;name=<card-name>;base64,...`** (RFC 2397 media-type param; verified Chrome imports it fine). NEVER the ha-mcp `content=` mode (Cloudflare relay) or any CDN. `node --check` before encoding.
2. **Self-documenting header:** the JS must open with a comment block: card name/version, what it is, and HOW-TO (this is base64 in a data: URL; decode to read; edit → re-encode → replace resource URL in Settings > Dashboards > Resources; stored in .storage/lovelace_resources, included in HA backups; the card YAML that uses it).
3. **ASCII-safe source:** no literal `°` or other non-ASCII in strings — `&deg;` in innerHTML, `°` escapes in JS. (Comments with non-ASCII are fine; strings are not.)
4. **Hardcode accent hexes** — user's theme primary is GREEN and leaks through theme vars. Measured HA state colors: heat #ff6f22, cool #2196f3, heat_cool #ffc107, off #9e9e9e.
5. **Match native visual language** (measure, don't guess — walk shadowRoots with getBoundingClientRect/computed styles on the live dashboard (HA LAN address withheld from this archive - see project notes) via Claude-in-Chrome): track rgba(70,70,70,.3); faded fill = accent opacity .5; active/bright = accent opacity 1 with round caps that extend ±8px past endpoints (and render even at zero length as a cap around the handle); white handle ~0.7× track height, no shadow; mode/button strip 42px, 20px icons.
6. **ha-icon centering:** ha-icon needs `display:flex; align-items:center; justify-content:center; line-height:0` or the svg sags ~1.3px.
7. **Animations:** transitions die if you flip `display:none→block` every render — show elements idempotently (only touch style.display when it actually changes) and hide unused ones at the end. Add the transition-suppressing `dragging` class on pointermove, never pointerdown, so taps still animate. .35s cubic-bezier(.4,0,.2,1) matches native.
8. **Optimistic UI:** hold user-set values ~8s past commit (`_optUntil`) so stale hass pushes don't snap controls back.
9. **No redundant text:** state/status shown once (status text under the big number), not repeated on the track.
10. **more-info access:** big-number/status block fires `hass-more-info` CustomEvent (bubbles+composed) and shows cursor:pointer.
11. **Availability honesty:** key card availability off the entity that reflects real device state (the treadmill uses its status sensor, NOT the number entity, which sits 'unknown' after integration reloads). Never coerce unavailable values to 0 in displays — show '--'. Check what happens to helper/meter entities during device dropouts (utility meters needed `always_available: true`).
12. **Verify in the user's browser before claiming done** — reload the dashboard, assert computed styles/geometry via injected JS, and revert any test styles. The user WILL check pixel-level claims.
13. **Archive:** after user sign-off, write the source to a project doc (like `claude/flat-thermostat-card.js`) and record resource_id + update procedure here.

## Environment
- Main dashboard: storage mode (url_path withheld from this archive). HA core-2026.7.1, HAOS **in a KVM VM on the user's unraid server**, at its LAN address (withheld from this archive - see project notes).
- **User strongly prefers zero external dependencies** — no CDN/relay-hosted resources. Self-contained data: URLs or local files only. User also rejected /config/www file hosting (doesn't want manual file management) — data: URLs with name= labels + self-documenting headers are the chosen pattern. HACS-repo hosting considered 2026-07-10 and deliberately declined (slower iteration loop; cards are single-user); a GitHub repo exists as a pure backup archive only.
- HACS lovelace cards: Mushroom, expander-card, card-mod, auto-entities, Timer Bar Card, Firemote, Grid Remote, simple-thermostat v4.0.27 (Wheemer fork; now unused after custom card replaced it).
- User's theme has a green primary color — never rely on theme vars for accent colors; hardcode hexes.

## Debug lessons
- Don't iterate CSS blind: HA reachable via Claude-in-Chrome at its LAN address (withheld from this archive - see project notes) — inject test styles into shadowRoots, measure getBoundingClientRect live. Measure the native component's SVG/computed styles instead of guessing colors.
- svg inside `ha-icon` is inline-laid-out and sags ~1.3px from line-height; fix = ha-icon display:flex + line-height:0.
- Literal `°`/non-ASCII in resource JS can mojibake (`Â°`) depending on serving charset — use `&deg;` in innerHTML and `°` escapes in JS strings.
- Native tile/thermostat feature metrics: 42px strip, 20px icons, active heat_cool = mustard #ffc107; native cool fill anchors from setpoint to MAX (right), heat from MIN to setpoint (left).
- **Native dial measured values (ha-control-circular-slider, HA 2026.7):** track = stroke rgb(70,70,70) opacity .3; faded/colored arc = accent at opacity .5; bright/active arc = accent opacity 1, stroke-linecap round, rendered even at zero length (→ always a bright cap around the handle); heat accent = `--state-climate-heat-color` = **#ff6f22** (deep-orange), cool #2196f3, heat_cool amber #ffc107; current-temp dot = rgb(225,225,225) opacity .5 (grey), darkened when on the bright fill.
- `display:none→block` resets CSS transitions — show elements idempotently; only add a transition-suppressing class on real pointermove, not pointerdown.
- Native sensor-card anatomy: header icon at `.header .icon` (hidden via card_mod on "Desk Temp — 24h"); at compact heights the graph `.footer` is absolutely positioned over the WHOLE card and paints ON TOP of the text (it follows in the DOM). Fix = `position: relative; z-index: 1` on `.header, .info` so text paints above the line.
- **Text stroke over busy backgrounds:** `-webkit-text-stroke: 4px <bg-color>` + `paint-order: stroke fill` gives a clean OUTER stroke (stroke renders behind the fill, letterforms untouched) — works on HTML text in Chromium and beats the 8-direction hard text-shadow hack (lumpy) and blurred halos (foggy). Applied to Desk Temp value/title.
- data: URLs accept extra media-type params: `data:text/javascript;name=<label>;base64,...` — Chrome imports modules from these fine (tested live 2026-07-10). Use for human-readable labels on the Resources page.

## House style for dropdowns (expander-card)
Modeled by "Party Mode" / "Lighting Brightness and Temp Status" (views[0].sections[0]):
- expander-card: `padding: 0px`, `title-card-padding: 0px`, `title-card-button-overlay: true`
- title-card = mushroom-template-card, horizontal, fill_container; card_mod strips margin/shadow/border; primary 14px/500, secondary 12px, `--icon-size: 26px`, `--spacing: 6px`
- children in `grid` (columns 1, square false), `#root { grid-gap: 0px }`; every inner card card_mod-stripped
- expander card_mod: `button.header` absolute full-width h60 z1; `.ico` opacity 0 (whole header toggles)
- title icon_color: colored when active, 'disabled' when off

## Key entities
- `climate.hall_nest_thermostat` (heat, cool, heat_cool, off; fan separate → `script.circulate_air_toggle` tile). Nest range 50–90°F, step 1°F, min deadband gap ~2°F. NOTE: Nest/Google re-applies its own stored heat setpoint (73°F) 1–5s after entering heat mode — device-side, not HA.
- Winix: `sensor.kitchen_dining_winix_living_room_air_qvalue`, `fan.winix_air_purifiers` (group of 4), `sensor.kitchen_dining_winix_living_room_filter_life`
- Treadmill (Egofit M2 via FTMS): see `claude/flat-treadmill-card-notes.md` for the full entity/helper inventory, device quirk census, and net-calorie math.

## Winix dropdown — FINAL (applied)
Expander in house style; title = mushroom-template-card "Winix Air Qvalue", secondary = `{{ states('sensor...air_qvalue') }} qv` only, icon mdi:air-purifier cyan when fan on. Children in gap-0 grid:
- mushroom-fan-card: icon_animation, show_percentage_control, tap AND icon_tap = more-info (shows all 4 purifiers), `.actions { flex:none; width: calc(50% - 6px) }`
- tile + bar-gauge inline for filter life, `hui-card-features { width: calc(50% - 6px); flex:none }`; card_mod Jinja: v ≤ 30% → `--tile-color`/`--feature-color: hsl(v*1.5, 90%, 55%) !important` (amber→red)

## Desk Temp sensor card — FINAL (applied 2026-07-10)
Native `sensor` card, `sensor.living_room_desk_meter_pro_co2_b98a_temperature`, graph line 24h, columns full. card_mod: hide `.header .icon`; `.header, .info { position: relative; z-index: 1 }` (text above graph line); `-webkit-text-stroke: 4px var(--card-background-color)` + `paint-order: stroke fill` on `.info, .header .name` for a clean outer stroke where the line passes behind the digits.

## Thermostat — FINAL: custom flat-thermostat-card v2.2 (user signed off 2026-07-09; native dial card can be removed)
Bespoke vanilla-JS custom card replicating the native HA thermostat dial in flat/horizontal form. **Full source: project doc `claude/flat-thermostat-card.js`** (authoritative; also `/home/claude/work/flat-thermostat-card.js` in the build session).

- **Card YAML in use:** `type: custom:flat-thermostat-card` + `entity: climate.hall_nest_thermostat` (that's all).
- **Hosting:** HA dashboard resource `a1bc4b7a12124ab38ded7859b5ed12bc`, type module, URL = **`data:text/javascript;name=flat-thermostat-card;base64,...`** — code lives entirely inside HA's .storage resource registry, zero external dependencies; source opens with a self-documenting HOW-TO header. To update: edit source, `node --check`, base64-encode, `ha_config_set_dashboard_resource(resource_id=..., resource_type="module", url="data:text/javascript;name=flat-thermostat-card;base64,...")`, user hard-refreshes.
- **Layout:** ~125px card. Main row: temp block flex 0 0 25% (centered over power button column, opens native more-info on click), current temp 32px centered on digits (°F absolutely positioned outside centering), hvac_action text under it, action-colored radial glow behind the digits (`.cur::before`, 104×84px, opacity .14) when heating/cooling; 16px track flex:1; mode strip = native recipe (42px, 20px flex ha-icons, active solid colors).
- **Track visuals (all values measured from native dial):** track rgba(70,70,70,.3), radius 8; faded fill = accent at opacity .5 (heat #ff6f22 left-anchored min→setpoint, cool #2196f3 right-anchored setpoint→max, heat_cool both + dark deadband); **bright work-zone segment** = accent opacity 1 between current temp and setpoint, extended ±8px with 8px radius so round caps surround handle & dot; when no work zone, a 16px bright cap is still always drawn centered on each handle (native zero-length round-cap behavior). White handle 11px on 16px track (no shadow) so fill ring shows around it. Current-temp dot 7px #a6a6a6, switches to rgba(0,0,0,.5) overlay when sitting on the bright fill. Setpoint labels above (#ff9c4a heat / #64b5f6 cool, ° in absolute span).
- **Behavior:** drag or tap-track (nearest handle), snap to entity step, min/max from entity attrs, 2° gap enforced, optimistic UI w/ 8s hold, commits climate.set_temperature on release, modes via set_hvac_mode, unavailable dims card, click on temp/status block fires `hass-more-info`. Animations: .35s cubic-bezier left/width transitions; `dragging` class (added on pointermove only) disables them during drag. Off mode: bar empty, no extra "Off" label (status text under temp covers it).
- Config options: entity (req), modes, min_temp, max_temp, step, gap, icon_<mode>.
- **Version history:** v1.0 initial → v1.2 mojibake + cool-fill direction + data:URL hosting → v1.8 round caps/animations/glow-on-digits → v1.9 handle inset + dark dot → v2.0 native-measured colors + always-on caps → v2.1 more-info click → v2.2 redundant off-label removed, then self-documenting header + `;name=` URL label added. Each verified in-browser before handoff.

## Treadmill — FINAL: custom flat-treadmill-card v2.11 (signed off & archived 2026-07-09)
Built in a sibling chat; audited and archived from this one. **Full source: project doc `claude/flat-treadmill-card.js`. Full design/entity/quirk notes: project doc `claude/flat-treadmill-card-notes.md`** (hosting + resource id `698b5e9479724e12a978aec4cb7b17dc`, tap map, amber color scheme, all HA-side helpers/meters with entry IDs, net-calorie math with regression anchors, Egofit/FTMS device facts, accepted cosmetics, version history, deferred owner-validation items).
Sign-off verification (this chat, 2026-07-09): deployed resource byte-identical to archived source; `node --check` pass; zero non-ASCII; card rendered live (Idle, 0.0 mph, progress 2.8/8.0 mi correct through an earlier BT drop thanks to always_available meters + the v2.10/2.11 availability fixes).

## Backup archive
GitHub repo (owner-pushed via GitHub Desktop, pure backup — NOT the deployment and NOT wired to HACS): contains both card sources, this notes file, and the treadmill notes. The live deployment remains the data: URL resources inside HA.
