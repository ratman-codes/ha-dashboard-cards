# Home Assistant Dashboard Notes (sanitized public copy)

> This is the sanitized archive copy for the backup repo. Real operational values
> (dashboard url_path, HA LAN address, PWS station id, location-bearing entity ids,
> tap-through URLs) live in the private project notes and in the dashboard YAML
> inside HA itself. Placeholders below mark where they go.

## Standing rule (owner-set, 2026-07-09)
**Do NOT make changes to Home Assistant (dashboards, config, DB, anything) unless the owner explicitly asks.** Read-only inspection is fine. Always propose YAML first; owner usually pastes it themselves. HACS installs / resource writes OK only with explicit go-ahead.

## Standing rule (owner-set, 2026-07-10): no personal details in implementations or documentation
Do not embed personal details (address, street/area names, real names beyond the "Ratman" handle, LAN IPs, dashboard url_paths, PWS station ids, coordinate-bearing entity ids, or anything that identifies the home/identity) in code, headers, entity naming, docs, or archives unless genuinely necessary — and when necessary, flag it explicitly at the time. Prefer generic wording and pointers in anything that could leave the private project.

## Standing rule (owner-set, 2026-07-10): track everything built, delete nothing without express permission
Every helper/automation/entity built must be inventoried (label in HA + manifest doc) so teardown is exact. Nothing gets deleted without explicit sign-off.

## Standing rule (owner-set, 2026-07-10): always offer a sanitized copy for the repo
Whenever archiving to the GitHub backup repo, a freshly sanitized version of any notes/docs must be offered alongside the code — never let the repo copy silently go stale or, worse, receive an unsanitized paste.

## Custom-card build checklist (READ THIS before building any bespoke card)
1. **Hosting:** zero external dependencies. Ship as a data-URL module in the dashboard resource registry (`data:text/javascript;name=<card-name>;base64,...`). NEVER relay/CDN hosting. `node --check` before encoding.
2. **Self-documenting header:** card name/version, what it is, and maintenance HOW-TO (decode, edit, re-encode, replace resource URL; stored in .storage/lovelace_resources; in HA backups automatically).
3. **ASCII-safe source:** no literal degree sign or other non-ASCII in strings — `&deg;` in innerHTML, unicode escapes in JS strings.
4. **Hardcode accent hexes** — the theme primary is GREEN and leaks through theme vars. Measured HA state colors: heat #ff6f22, cool #2196f3, heat_cool #ffc107, off #9e9e9e.
5. **Match native visual language** (measure computed styles on the live dashboard, don't guess): track rgba(70,70,70,.3); faded fill = accent opacity .5; bright = accent opacity 1 with round caps extending ±8px; white handle ~0.7× track height; mode strip 42px, 20px icons.
6. **ha-icon centering:** needs `display:flex; align-items:center; justify-content:center; line-height:0` or the svg sags ~1.3px.
7. **Animations:** show elements idempotently (never flip display:none→block every render); transition-suppressing class on pointermove, not pointerdown. .35s cubic-bezier(.4,0,.2,1) matches native.
8. **Optimistic UI:** hold user-set values ~8s past commit so stale hass pushes don't snap controls back.
9. **No redundant text:** state shown once.
10. **more-info access:** big-number/status block fires `hass-more-info` (bubbles+composed), cursor:pointer.
11. **Availability honesty:** key availability off the entity reflecting real device state; show '--', never coerce unavailable to 0; check helper/meter behavior during dropouts (`always_available: true` where needed).
12. **Verify in the owner's browser before claiming done** — including PERSISTENCE: a dashboard save can be silently clobbered by a stale edit session open in another tab/app (observed 2026-07-10). Re-read the server config after a couple of minutes.
13. **Archive after sign-off:** source to the private project doc, resource_id + update procedure recorded, deployed blob verified byte-identical (crypto.subtle is unavailable on the http:// LAN origin — use Math.imul-based FNV-1a).

## Environment
- Main dashboard: storage mode, url_path in private notes. HA core-2026.7.1, HAOS in a KVM VM on the owner's unraid server, reachable on the LAN (address in private notes).
- **Owner strongly prefers zero external dependencies** — data: URL resources only; /config/www rejected (no manual file management); HACS-repo hosting considered and declined (cards are single-user). This GitHub repo is a pure backup archive, NOT the deployment.
- HACS lovelace cards: Mushroom, expander-card, card-mod, auto-entities, Timer Bar Card, Firemote, Grid Remote, simple-thermostat (unused since the custom card).
- HACS integrations: weather.com (jaydeethree/Home-Assistant-weatherdotcom) — hourly forecast source, same IBM/TWC engine as Weather Underground; API key is the public web key per its README.
- Theme has a green primary — never rely on theme vars for accents.

## Debug lessons
- Iterate CSS against the live dashboard (inject test styles into shadowRoots, measure getBoundingClientRect); measure native components instead of guessing.
- svg inside `ha-icon` sags ~1.3px from line-height; fix = flex + line-height:0.
- Literal non-ASCII in resource JS can mojibake depending on serving charset.
- Native dial measured values (HA 2026.7): track rgb(70,70,70) @ .3; faded arc accent @ .5; bright arc accent @ 1 with round caps rendered even at zero length; heat #ff6f22, cool #2196f3, heat_cool #ffc107; current-temp dot rgb(225,225,225) @ .5, darkened on bright fill.
- `display:none→block` resets CSS transitions.
- Native sensor-card: compact-height graph `.footer` paints OVER the text; fix = `position:relative; z-index:1` on `.header, .info`.
- Text stroke over busy backgrounds: `-webkit-text-stroke: 4px <bg>` + `paint-order: stroke fill` = clean outer stroke.
- data: URLs accept `;name=<label>` media-type params — Chrome imports modules from them fine; labels the Resources page.
- **Custom cards can subscribe to forecast pushes:** `hass.connection.subscribeMessage(cb, {type: 'weather/subscribe_forecast', forecast_type: 'hourly'|'daily'|'twice_daily', entity_id})` — initial forecast arrives immediately, updates push after. Unsubscribe in disconnectedCallback, re-subscribe on reconnect. NWS exposes twice_daily+hourly only (NO daily); today's high = the `is_daytime: true` period.
- View-transition InvalidStateError console exceptions on dashboard load are benign HA 2026.7 noise; a fresh sections view can take seconds to paint (blank ≠ broken).

- `input_select.set_options` (the service) is volatile — options revert on HA restart; the admin WS command `input_select/update` persists them. This is how the party card's effect-list editor saves.
- A `position: fixed` overlay dialog renders fine from inside a card's shadow DOM (backdrop div + centered panel, high z-index) — no browser_mod or HA dialog internals needed.
- Horizontal overflow-x chip strips are unusable with a mouse wheel (only middle-click drag scrolls); wrap chips onto multiple lines or move long lists into a popup with vertical scrolling.
- A looping script (mode: restart + repeat-while on a selector) makes a clean server-side animation engine — but scope every frame to the per-room enable booleans, or an end-of-party repaint can race the engine's final frame (observed: reset needed two clicks until the engine was room-scoped).
- Cloud-integration lights (goveelife) report state seconds late; drive UI state from helpers, never from the light entity, and give cloud fixtures a slow lane (every 2nd-3rd tick) in animation loops.

## House style for dropdowns (expander-card)
- expander-card: `padding: 0px`, `title-card-padding: 0px`, `title-card-button-overlay: true`
- title-card = mushroom-template-card, horizontal, fill_container; card_mod strips margin/shadow/border; primary 14px/500, secondary 12px, `--icon-size: 26px`, `--spacing: 6px`
- children in `grid` (columns 1, square false), `#root { grid-gap: 0px }`; inner cards card_mod-stripped
- expander card_mod: `button.header` absolute full-width z1; `.ico` opacity 0 (whole header toggles)

## House style for press feedback (established with flat-weather-card v1.1)
No hover highlights on large clickable regions. Press-state feedback instead: pressed section dips to `scale(.985)` with wash `rgba(70,70,70,.22)`, `transition .12s ease`; class on pointerdown, removed on pointerup/cancel/leave. Small repeated elements (day cells) may keep a subtle `:hover`. Affordance glyphs considered and not adopted.

## Thermostat — flat-thermostat-card v2.2 (signed off 2026-07-09)
Slim flat replica of the native HA thermostat dial. Source: `flat-thermostat-card.js` in this repo. Card YAML: `type: custom:flat-thermostat-card` + `entity: <climate entity>`. Full layout/behavior spec and version history in the private notes; visual constants in the checklist above are the load-bearing ones.

## Treadmill — flat-treadmill-card v2.11 (signed off 2026-07-09)
Walking-pad control/stats card (FTMS). Source: `flat-treadmill-card.js`; design/entity/quirk notes: `notes/flat-treadmill-card-notes.md` in this repo.

## Weather — flat-weather-card v1.2 (v1.1 signed off 2026-07-10; v1.2 dew-point line 2026-07-17)
Merged weather card replacing two native weather-forecast cards: station current conditions (header), optional forecast-vs-actual chip, 12h hourly temperature curve (SVG polyline, 2px accent stroke, labels at first/peak/last, hour ticks every 3), 5-day strip. Source: `flat-weather-card.js` in this repo — deliberately location-clean: ALL entity ids and tap-through URLs are card YAML config, never code.
- Card YAML shape (real values in the dashboard + private notes): `station_entity` = the local PWS weather entity (current conditions), `hourly_entity` = the weather.com entity (curve), `daily_entity` = the PWS entity (5-day, TWC daily), `name`, `station_url`/`hourly_url`/`daily_url` (tap-throughs to the station's Weather Underground history/hourly/10-day pages), `chip_forecast_entity`/`chip_actual_entity` (forecast-lab helpers; chip auto-hides when absent), `chip_path` (lab dashboard), `accent`, `hours`, `days`.
- Tap map: click header → station history page; curve → WU hourly; day cell → WU 10-day; chip → lab dashboard (pushState + location-changed); long-press (550ms) → hass-more-info for that section's entity. URL keys optional; falls back to more-info.
- Data via `weather/subscribe_forecast` (hourly + daily on separate entities). Daily entries deduped by date, null-temperature entries skipped (WU nulls today's high in the evening → header H/L shows '--').
- Availability: '--' for missing temps, dimmed header + 'Unavailable' when the station entity is out, 'forecast unavailable' on subscription failure.
- v1.0 initial (mockup-approved) → v1.1 press feedback → v1.2 dew-point line: the humidity line becomes "Dew NN deg · RH%" when the optional `dew_entity` key points at a dew-point sensor (the local PWS measures one directly), color-coded by the owner's window-flush thresholds — plain under 60F (crisp), amber 60–65F, orange 65F+ (sticky, don't ventilate); falls back to humidity-only when the sensor is absent. Each version's deployed blob byte-verified against this source at sign-off.

## Card Manager — card-manager-card v1.2 (built 2026-07-18)
Admin card that replaces the raw paste-in-Settings update workflow for the data-URL cards. Source: `card-manager-card.js` in this repo. Runs on its own admin-only dashboard.
- **Why:** every bespoke card is a `data:...;name=<card>;base64,...` resource; updating one meant pasting a new base64 wall over the right entry by eye — one mis-click overwrites the wrong card. The manager makes that mistake structurally impossible.
- **Inspect mode (always open, read-only):** lists all resources; data-URL entries with a `;name=` label become managed rows showing label, header-parsed name/version, decoded size, FNV-1a hash (Math.imul FNV-1a — crypto.subtle is unavailable on http:// LAN origins), resource id, and a decoded header preview. Per-row: live hash re-verify against the registry (flags drift), full-blob download (`<card>_v<ver>_<hash>.txt`). Other resources (HACS paths) listed read-only.
- **Update mode (PIN-gated when `pin:` is configured in the card YAML; idle re-lock drops back to Inspect after `relock_minutes`, default 5):** paste the replacement data: URL into the target card's row → validation: URL parses, base64 decodes, `;name=` label MUST match the row, header must self-identify as the same card, non-ASCII and identical-hash warnings → old/new version-size-hash diff → forced backup download of the outgoing blob → write by resource ID via `lovelace/resources/update` (admin-only WS API) → registry re-read, re-decoded, re-hashed, compared. Mismatched pastes are hard-blocked before any write.
- **Self-update:** the manager is itself a data-URL resource and lists itself (SELF tag). Overwriting itself additionally requires typing the card name exactly; recovery from a bad self-write is the ordinary manual paste at Settings > Dashboards > Resources, which always remains available.
- **Notes:** PIN is a casual-taps deterrent, not security (it lives in dashboard YAML, admin-visible; HA has no per-dashboard password — the dashboard itself is admin-only). Frontend caches data: URL modules, so every write ends with a hard-refresh prompt. v1.0 initial → v1.1 PIN moved from whole-card to Update-mode-only (gate prompted on tab tap, cancelable) → v1.2 Add-new-card flow: paste a brand-new card's data: URL in Update mode, same validations plus a duplicate-label hard block (existing label = you meant to update), creates via `lovelace/resources/create`, re-verifies, and surfaces the new resource_id for the inventory notes. Verified with a 26-check mock-hass harness (headless Chromium) incl. wrong-card block with zero WS traffic, backup-before-write, byte-level post-write verify, and self-update guardrails.

## Cats — flat-cat-card v1.0 (shipped 2026-07-18)
Consolidated cats card replacing five separate cards (litter tile, two pet weight tiles, two feeder camera cards) on the main dashboard. Source: `flat-cat-card.js` in this repo. Backed by the Jezza34000/homeassistant-petkit HACS integration (cloud; PetKit has no local API).
- **Layout:** headerless; tap anywhere on the card body toggles expand/collapse (slim right-edge chevron rotates). Collapsed = one-line cat rows (avatar from the pet's entity_picture, weight, last litter visit) + camera strip. Expanded adds the litter section and feeder rows between them. Interactive elements swallow taps.
- **Litter:** level bar (green / amber below 30% / red on sand-lack or offline), state + last-used-by line, weight/uses/bin stats. Buttons: Clean (the integration's scoop = one cleaning cycle) and More — a pure-UI panel with Level litter, Pause/Resume, and Start maintenance. Maintenance is an explicit two-step: nothing moves until Start is pressed; the section then becomes an amber panel ("parking..." until the state sensor confirms; buttons disabled meanwhile) with Dump litter (hold-2s, the only destructive action), Level, and Done — exit. Detected and shown even when maintenance is started from the PetKit app; collapsing mid-maintenance pins an alert-strip reminder.
- **Feeders:** per-feeder rows labeled by which cat nominally owns them, with eat-visit count, dispensed/planned grams for the day (a missed scheduled feed is visible at a glance), bowl status text (the bowl-fill % sensor is coarse — reads 0 most of the day, so no bar), portion chips (grams, YAML-configurable) + Feed writing the integration's manual_feed text entity. Optional "Both feeders" row (`feed_both`) dispenses to both back-to-back. Every feed shows a 5s countdown Undo that fires cancel_manual_feed — honest limit: only effective while the drop is still queued cloud-side.
- **Cameras:** always-visible strip (both states) showing each feeder's last_eat_event image entity with timestamp — answers "did they actually eat" better than a live view of an empty floor; tap opens the real live stream (cloud relay, seconds of lag). `camera_mode: live` embeds live streams instead (experimental).
- **Alerts/health:** thin amber strip at the top, only when active: litter below 30%, sand-lack, bin full, hopper empty, device offline, and the box's frequent-use detection (early UTI signal in cats). Occupied dot pulses while the box is in use (attribution to a specific cat is impossible until the visit ends — the indicator is deliberately generic). Eat counts are per-feeder, never per-cat (cats cross-visit; per-cat counts would be fiction — considered and rejected).
- **YAML shape:** `cats:` list (name, weight + last_use entities, color), `litter_prefix`, `feeders:` list (label, owner, prefix — list order = display order), `portions`, `default_portion`, `feed_both`, `camera_mode`, `avatars`. Validated by the Card Manager's add-new flow on install (its header-self-identification check caught a v1.0 header-format bug before anything reached HA — first real save by that guardrail).

## Party Mode — whole-house color system + flat-party-card v1.3 (shipped 2026-07-18)
A layered party-lighting system plus its control card. Card source: `flat-party-card.js` in this repo; YAML: `type: custom:flat-party-card` (defaults target the `lighting_party_mode_*` helpers). Full system inventory lives in the private project plan doc; everything Claude-created carries the HA label `party_mode`.
- **Three priority layers:** (1) per-fixture Govee native-effect overrides (selector helpers; an overridden fixture self-animates on-device and the rest of the system leaves it alone until cleared), (2) the HA engine — a looping script painting one frame every 2-3 s: Pulse (brightness breathe), Cycle (synced hue walk), Chase (hue walk with per-fixture spatial offsets), (3) the normal schedule, gated per room by freeze booleans.
- **Design rules:** a party action never turns on an off light (late-joining lights get dressed by an automation when they turn on); color is stored as hue,sat (engine math and the card wheel are trivial in hue space); tapping a color also flips the room freeze booleans; Reset returns each unfrozen room to schedule by re-running the owner's own schedule automations (no duplicated settings) and idles the system when no room is partying; the 3AM house reset is the designated unconditional party-killer.
- **Hard limit:** true strobe is impossible from HA (mesh/cloud rate limits) — strobe-like looks come only from Govee on-device effects; the engine caps at ~1 s beats with smooth fades on the Matter lights.
- **Card:** swatches + inline hue/sat sliders; motion chips; per-Govee effect chip rows with a pencil that opens a popup editor listing the fixture's full native catalog (read live from the light's `effect_list`; search filter; N-of-M count; Save persists via `input_select/update`, admin-only; "None" pinned); brightness track; room freeze pills; reset. 8 s optimistic holds throughout. v1.0 initial → v1.1 chip wrap → v1.2 inline catalog editor → v1.3 popup editor (mockup-approved).

## Forecast Lab (running since 2026-07-09)
Six-way daily forecast-accuracy experiment (WU/TWC, Google, Met.no, OpenWeatherMap, NWS, Open-Meteo) scored nightly at 23:58 against the actual high measured at the nearby PWS: 6am snapshot automation stores each source's predicted high in input_number helpers; a tracker automation follows the station's running max; nightly scoring accumulates |forecast − actual| and day counts per source; template sensors expose running average error. All experiment entities labeled `forecast_scoreboard` in HA; full inventory + teardown order in the private project manifest. Context: OpenWeatherMap was found forecasting ~15°F hot on coastal marine-layer days (confirmed against its own site — model issue, not config), prompting the bake-off and the switch of the hourly card source to weather.com (same TWC engine as WU, so the cards always agree).
