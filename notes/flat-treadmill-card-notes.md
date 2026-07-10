# flat-treadmill-card — archive notes (v2.11, 2026-07-09)

Companion source file: `claude/flat-treadmill-card.js` (v2.11, final as of sign-off).
Sibling of flat-thermostat-card; same hosting pattern, same dashboard.

## What it is
Custom Lovelace card controlling the Egofit ComfortDeck M2 walking pad via FTMS
(dudanov/hassio-ftms, device FS-BT-D2 "FS-AF5E46", through ESPHome BT proxy
"Bluetooth Proxy 71e8ec" on the fridge). Three rows:
1. Live mph + status | interactive speed track | play/stop buttons
2. Stats pill with NOW/TODAY scope toggle (tap pill; vertical mode tag on left edge)
3. Daily progress bar vs adjustable target, distance or time mode (tap TODAY to flip)

## Hosting / update workflow
- Resource id: `698b5e9479724e12a978aec4cb7b17dc`, URL form:
  `data:text/javascript;name=flat-treadmill-card;base64,<blob>` (name= is the
  human-readable label on the Resources page; RFC 2397 media-type param).
- Code lives entirely inside the URL in `.storage/lovelace_resources` — no file on
  disk, no internet dependency, included in HA backups automatically.
- Update workflow (established, owner-preferred): Claude hands a .txt containing the
  full data: URL; owner pastes it over the resource URL at Settings > Dashboards >
  three-dot menu > Resources, then hard-refreshes. Claude direct-push via
  ha_config_set_dashboard_resource works but is slow (~15KB base64 through model
  output twice) — paste workflow is the standard.
- Card YAML (complete): `type: custom:flat-treadmill-card` — all entity ids and
  options are defaults in source; override via YAML keys if entities are renamed.
- Full maintain-me instructions are in the source header (decode, edit ASCII-only,
  node --check, re-encode, replace URL).

## Tap map (final)
- Speed digits -> more-info speed sensor (history)
- Speed track -> drag/tap sets number.treadmill_speed; drag preview shows native
  km/h (unit label flips to "kph") so every 0.1 notch is distinct; reverts to mph
- Play / Stop -> button.treadmill_start_resume / button.treadmill_stop
- Stats pill (non-kcal area) -> toggles NOW/TODAY scope; mode tag highlights on hover
- kcal cell -> "Net calorie assumptions" dialog (weight stepper, hands selector,
  exploratory grade dropdown, live net/mi + net/day readout, Save writes helpers,
  explicit "Open full calculator" link to the ledger site)
- Progress bar -> more-info history of active metric (net kcal sensor in distance
  mode; daily time meter in time mode)
- TODAY label -> flips bar distance <-> time
- X.X / T.T readout -> more-info edit of the ACTIVE target (mile or time helper)

## Color scheme
Amber (owner-chosen): ACCENT #ffc107 / ACCENT_TEXT #ffd54f / ACTIVE_CELL #ffa000.
Done state: #4caf50 green. Back-pocket alternates documented in source header:
teal original (#00bcd4/#4dd0e1/#00838f), green (#9ccc65/#c5e1a5/#558b2f — if used,
switch done-state to amber to avoid collision).

## HA-side objects (all labeled `treadmill_dashboard_card`, cyan, mdi:walk)
- sensor.living_room_treadmill_daily_distance — utility_meter, entry 01KX4KD9Y53G7Q046G3DEGJX5R
- sensor.living_room_treadmill_daily_time — utility_meter, entry 01KX4KEMRYRW7K25Q8HZSV2618
- sensor.living_room_treadmill_daily_energy — utility_meter, entry 01KX4KEWNG7JYKHSWMBGE9NJ0H
  - All three: cycle NONE by design, periodically_resetting true,
    **always_available true** (added post-audit — keeps daily totals reporting
    through BT drops). Reset mechanism is the automation below, NOT a meter cycle.
- automation.treadmill_daily_meters_reset_3am (unique_id 1783639866378) — 03:00:00
  calibrate-to-0 on all three meters. Rationale in its description field. The meters
  and this automation are a coupled pair: do not delete/alter one without the other.
- input_number.treadmill_daily_mile_target — 8.0 now, ramps to ~12 as speed ramp
  completes (8 -> 9.5 -> 12 at ~793-net-equivalent), then parks
- input_number.treadmill_daily_time_target — 4.0 h
- input_number.treadmill_weight — 150 lb (update at weigh-in milestones via dialog)
- input_select.treadmill_hands — Free swing / Typing at desk / Leaning on desk
  (currently Typing)
- sensor.treadmill_daily_net_kcal — template, entry 01KX4V82T0DS84A7S3YC04XPBY:
  daily_miles x weight_kg x 1.24279 x (1-discount), unit kcal, state_class
  total_increasing (permanent long-term statistics = the daily history record;
  graph via statistics-graph card, stat_types: change, period: day)
- sensor.treadmill_steps — template, session steps = distance_ft/5280 x 2250
  (2250 steps/mi pending deck calibration; calculator site uses 2112)
- number.treadmill_speed_mph — template wrapper, unused by card, harmless

## Net-calorie math (ported verbatim from the walking-calorie-calculator site)
- ShapeSense cubic per integer grade -5..+5 (POLY table in source), ACSM >=6%,
  linear interpolation + 5->6% blend. 1-MET baseline (weight x 1.05 kcal/kg/hr).
  Hands discount (0 / 8% / 20%) applies to activity portion ONLY, never baseline.
- Card computes net/mile live from weight+hands helpers at fixed grade 3 (config)
  and reference speed 4.8 kph (config; net/mi is speed-invariant within ~4%).
- Folded constant at 3%/4.8kph: 1.24279 net kcal per mile per kg (pre-discount).
- Regression anchors (any change moving these is a bug): 150lb/typing/3% -> 77.8/mi,
  934 for 12mi; 130lb/leaning/3% -> 58.6/mi; 150lb/free/0% -> 66.2/mi; site targets
  1080 gross / 793 net / 729 typing / 286 baseline at 150lb 4h 3mph 0%.
- Deck's own kcal: validated-accurate FLAT math on 3%-inclined hardware = consistent
  ~13-15% under-count; retired from card display; meters still collect it for the
  future empirical-TDEE back-solve.

## Egofit M2 / FTMS device facts (hard-won)
- State machine (owner-mapped): idle (incl. blank display AND stats-held "PAU"
  state) / pre_workout (3-2-1) / manual_mode (moving) / post_workout (spin-down).
  Second stop while idle clears deck stats.
- sensor.treadmill_speed reports SET speed, not belt motion — freezes at last set
  value when stopped. It DOES tick through real 0.1 km/h steps during manual speed
  CHANGES, but on STOP it snaps instantly to 1.0 km/h with no deceleration data
  (deck display's ramp-down is a local animation, never broadcast). Hence:
  status-driven card state, big number 0.0 unless manual_mode.
- number.treadmill_speed is km/h (1.0-5.0 step 0.1); sensors arrive HA-converted
  (speed mph, distance ft — 2240 m session = 7349.08 ft verified).
- After an FTMS integration reload, number.treadmill_speed sits at 'unknown' until
  the deck reports a target speed — this is why card availability keys off
  sensor.treadmill_status, NEVER the number (v2.11 fix; ghosted-forever bug).
- Commanded disconnect (switch.treadmill_connection off) keeps entities alive with
  last values; only a LOST connection (proxy down) produces 'unavailable'. To
  simulate: disable the ESPHome proxy config entry (01KX2DRSW8CNAKEGXBTHRY0SB0).
  FTMS self-heals in ~4-6 min after proxy returns; passive BLE (SwitchBot) seconds.
- Inclination sensor is decorative junk: read 5.0%, then 0% after a reconnect;
  manufacturer-confirmed chassis is fixed 3%. Nothing consumes it.
- Deck display time counter caps at 99:99 but FTMS time field is 16-bit seconds
  (~18h) — owner's pause-at-1h habit is harmless either way (meters sum deltas).

## Known cosmetics (accepted, not bugs)
- sensor.treadmill_steps renders 0 (not '--') during outages — template float(0)
  default; fix would be an availability template on the helper. Owner declined ≈
  prefix on TODAY steps (estimate without symbol is fine per owner).
- Daily net kcal statistic slightly distorts on any day weight/hands are edited
  mid-day (step change reads as reset); edit in the morning for pristine bars.

## Version history (one line each)
v1.0 single strip -> v1.1 split strips (pushed unapproved; mockup-first rule born)
-> v1.2 Option B compact buttons + stats pill -> v1.3 status-driven state -> v1.4
daily distance bar + NOW/TODAY scope -> v1.5 tap-to-edit target -> v1.6 hover
center fix -> v1.7 TODAY ledger easter egg -> v1.8 pointer cursor -> v1.9 2-decimal
drag preview -> v2.0 native-kph drag preview -> v2.1 net-kcal era (math port,
assumptions dialog, deck kcal retired) -> v2.2 self-doc header + name= label +
kcal hover -> v2.3 mode-tag hover -> v2.4 amber scheme + dialog site link -> v2.5
YOUR BODY WEIGHT label -> v2.6 net/day second headline -> v2.7 caption simplify ->
v2.8 bar -> history more-info -> v2.9 TODAY toggles distance/time bar (easter egg
retired; time target helper) -> v2.10 audit fixes (daily-null guard, '--' when
unavailable; meters got always_available) -> v2.11 availability from status sensor.

## Open / deferred (owner validates passively; NO ACTION NEEDED unless raised)
- 3am meter reset first firing (tonight); trace check optional next session.
- Remote-control test: belt start/stop from card play/stop while standing at pad;
  if play proves decorative, demote visually.
- Steps calibration: owner reports deck steps + deck distance after a session ->
  back-solve deck steps/mile, replace 2250 in card config + steps template.
- Mile target manual bumps during speed ramp (owner does at phase changes).
- Weight edits at weigh-in milestones via the kcal dialog (owner).
- Someday: adjustable-incline deck would justify promoting full per-session
  ShapeSense math into HA (distance bar's validity condition: constant grade).
