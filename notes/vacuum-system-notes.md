# Roborock Q Revo Auto-Clean System — Authoritative Notes

Built 2026-07-13, single session. This doc + `claude/flat-vacuum-card.js` are the
authoritative references. The card section of `claude/ha-dashboard-notes.md` is
superseded by this doc for the vacuum card.

## What it is

Presence-aware automatic full-house cleaning with phone warning/abort/start,
maintenance tracking with an illustrated in-dashboard service manual, device
config, and run history — one automation pair + one custom card.

## HA inventory (all labeled `vacuum_auto` unless noted)

**Automations**
- `automation.vacuum_auto_clean_opportunistic_backstop` (unique_id 1783947925268,
  config_hash at ship: `21edd4b35f4d6e7d`). Full rules live in its description
  field (append-only). Key semantics:
  - Full clean via `button.roborock_q_revo_full_cleaning`, never more often than
    every X CALENDAR days (`input_number.vacuum_min_days_between`, dates not
    hours, manual runs count, fail-closed on unknown last_clean).
  - Triggers: `leave` (all-away for templated delay), `window_open` (window
    start +30min fixed offset — COUPLED to the delay slider's max 30, catches
    pre-window departures AND multi-day-away mornings), `backstop` (daily time,
    ignores presence and window).
  - Notify modes Off/Quiet/Loud (Android channels; Off = no wait). Warning wait
    = `input_number.vacuum_notify_delay`, fractional MINUTES 0.25 step —
    ALWAYS `| float`, never `| int`.
  - Abort channels: phone action VACUUM_ABORT, event `vacuum_warning_abort`
    (card). Start channels: phone action VACUUM_START ("Start now"), event
    `vacuum_warning_start` (card) — start runs immediately and deliberately
    skips the someone-returned re-check.
  - Dock errors are WARN-ONLY (mentioned in notification); hard blocks: not
    docked, vacuum error, unknown last_clean.
  - HISTORY ATTRIBUTION: writes `<trigger.id> <ISO>` to
    `input_text.vacuum_run_trigger` right before pressing full_cleaning.
- `automation.vacuum_maintenance_overdue_notify` (unique_id 1783954328760):
  one notification per counter per below-zero crossing, channel
  "Vacuum maintenance", mode queued max 5. Items already negative at creation
  (side brush, sensors) will not notify until serviced + re-crossed.

**Helpers**
- `input_number.vacuum_min_days_between` 0–14 box ("Min Days Between Runs";
  0 = no limit). Tuned: 2.
- `input_number.vacuum_departure_delay` 1–30 min slider. Tuned: 10.
  Hard max 30 = window_open offset coupling. DO NOT raise one without the other.
- `input_datetime.vacuum_window_start` / `_end`: 08:00 / 16:00.
- `input_datetime.vacuum_backstop_time`: 16:00 (post-window; 4:15 rejected as
  over-engineering — mode:single + staleness make 4:00 equally safe).
- `input_select.vacuum_notify_mode` Off/Quiet/Loud. Tuned: Loud.
- `input_number.vacuum_notify_delay` 0.25–30 MIN, 0.25 step (15s). Card slider
  soft-max 10 (`notify_slider_max`); label-edit reaches 30. Tuned: 5 (3:00 at
  one point — owner adjusts freely).
- `input_text.vacuum_run_trigger` — trigger attribution record. Do not repurpose.
- `binary_sensor.household_all_away` — template helper, label
  `household_presence` (SHARED — NOT vacuum teardown scope). Membership edited
  inside the helper (person list).

**Other HA-side**
- Android notification channels: "Vacuum warnings" (high), "Vacuum quiet" (low),
  "Vacuum maintenance" (default). Importance is fixed at channel creation —
  if ping behavior seems stuck, delete the app's channels and let them recreate.
- `/config/www/vacuum-guides/` — 7 owner-processed webp guide images (640px),
  served at `/local/vacuum-guides/`, inside HA backups. Teardown scope.

## The card — flat-vacuum-card

- The main dashboard (storage mode), first section, card index 5
  (`type: custom:flat-vacuum-card`). Hosted as a base64 data-URL resource
  (`data:text/javascript;name=flat-vacuum-card;base64,<blob>`) — no disk file,
  no internet, inside HA backups. Full read/modify workflow in the source header.
- Deploy loop: edit source → `node --check` → grep non-ASCII (must be 0,
  comments included) → base64 → paste over the resource URL → hard refresh.
- **Expected deployed FNV-1a at ship: `f6881983` (76,032 bytes, v2.4).**
  Byte-verify vs live resource not yet performed (artifact-delivery hiccup at
  session end; owner may paste after ship). Verify next session via
  Claude-in-Chrome FNV (crypto.subtle unavailable — use imul FNV-1a) if desired.
- Structure: status header (contextual controls: two-tap-arm play / warning
  Start+Abort / map+pause+dock / long-press = more-info) + four accordion
  groups: Auto-clean (7 setting sub-rows; only the toggle flips the
  automation), Maintenance (7 rows: 5 counters + counter-less Mop pads and
  Dust bag; amber wash + "N overdue" summary; guide dialogs with /local
  images, steps, intervals, app reset path; runtime + reset caption lines),
  Config (mop intensity / mop mode / Suction dropdowns; dock empty mode
  READ-ONLY; volume slider; DND toggle+times; child lock; Mop drying status;
  Battery status w/ charging bolt), History (last 4 runs + 14-day strip;
  websocket history fetch, 5-min cache; trigger attribution via the
  input_text — records exist only from 2026-07-13 onward, older runs
  correctly show "manual").
- Header semantics: warning-first amber prefix tokens (blocked > dock > water)
  ahead of state-colored text; "34% done"; current room while cleaning;
  dock-activity states (washing_the_mop / going_to_wash_the_mop /
  emptying_the_bin from `sensor.roborock_q_revo_status`) render as
  run-in-progress instead of the misleading "Docked"; `charging` and stale
  `paused` deliberately excluded from that mapping.
- Version history (FNV-1a): v1.0 2aed706c → v1.4 19992bf2 → v1.5 66307309 →
  v1.6 913fc2ea → v1.7 a58b8e98 → v1.8 94149111 → v2.0 d12aaf78 →
  v2.1 f11039e2 → v2.2 f83dc8fd (final rev) → v2.3 (several revs) →
  **v2.4 f6881983 (ship)**.
- Frontend lessons reconfirmed: ha-icon needs explicit flex centering +
  line-height:0 at every size (the sag bit us again on the guide buttons);
  CSS specificity vs `.row ha-icon`; boxed buttons turn muddy below ~28px —
  bare glyphs for sub-row actions.

## Known issues / open items

- **Dock empty mode**: integration rejects SET_DUST_COLLECTION_MODE (verified
  by direct API call; HA error log). Card renders it read-only with an
  explanatory tooltip. OWNER VALIDATES PASSIVELY: try changing it in the
  Roborock app someday — app works = HA integration bug (check their GitHub);
  app fails = dock firmware. NO ASSISTANT ACTION NEEDED until owner reports.
  Re-enable: move 'empty' back into the dropdown binds (see source header).
- **Trigger attribution** starts 2026-07-13; the first away/backstop-labeled
  run will appear on the next automated clean. OWNER OBSERVES — do not check.
- **Two counters overdue** (side brush −144h = replace, one screw; sensors
  −271h = dry-cloth wipe). Servicing + app reset (robot → circled ••• →
  Maintenance) is the first live test of the full maintenance loop.
  OWNER'S TASK — do not resurface as assistant work.
- Dock maintenance-brush sensor: permanently unknown on this dock (hardware
  likely absent). Recheck only after integration updates.
- Guide images soften if dialogs ever exceed ~660px width (640px sources);
  owner holds originals for re-processing.
- `sensor.roborock_q_revo_status` can hold a stale `paused` after runs —
  deliberately ignored by the dock-activity mapping.
- Strainer counter ("Cleaning tray") decrements only during runs but at a
  rate suggesting per-mop-wash-cycle rather than 1:1 runtime — cosmetic,
  caption stays accurate ("usage, not clock time").

## v-NEXT wishlist (nothing pending, ideas only)

- "Skip next scheduled clean" one-shot toggle.
- Per-run map snapshot from a History row.
- Fan-speed in the Config summary (currently "mop <intensity> · <mode>").
- Low-battery notification (probably never — robot self-manages).

## Teardown order (if ever dismantling)

1. Automations (auto-clean, maintenance notify)
2. Helpers with label `vacuum_auto` (7 + input_text) — NOT
   `binary_sensor.household_all_away` (shared, `household_presence` label)
3. Dashboard: card entry + the flat-vacuum-card resource
4. `/config/www/vacuum-guides/`
5. Android channels self-clean when the app's notifications are cleared

## Repo copy

Card source scanned clean of personal identifiers except the owner alias in
the header credit line — strip/adjust that one line for the public repo copy.
Images do NOT go to the repo (Roborock imagery); the source only carries
/local paths, so no other sanitization needed. Staging for the repo happens
whenever the GitHub bridge session next occurs.
