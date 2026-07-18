# Roborock Q Revo Auto-Clean System — Authoritative Notes

Built 2026-07-13; extended 2026-07-14 (full cleaning profiles, notification
lifecycle, run history with settings, dock-error findings). This doc +
`claude/flat-vacuum-card.js` are the authoritative references. The card
section of `claude/ha-dashboard-notes.md` is superseded by this doc.

## What it is

Presence-aware automatic full-house cleaning with per-context cleaning
profiles (aggressive when everyone's out, comfortable default otherwise),
phone warning/abort/start with a full notification lifecycle, maintenance
tracking with an illustrated in-dashboard service manual, device config,
and an annotated run history — three automations + one custom card.

## HA inventory (all labeled `vacuum_auto` unless noted)

**Automations**
- `automation.vacuum_auto_clean_opportunistic_backstop` (unique_id
  1783947925268, config_hash at ship: `e99a48d6c6f2647c`). Full rules live
  in its description field (append-only). Key semantics:
  - Full clean via `button.roborock_q_revo_full_cleaning`, never more often
    than every X CALENDAR days (`input_number.vacuum_min_days_between`,
    dates not hours, manual runs count, fail-closed on unknown last_clean).
  - Triggers: `leave` (all-away for templated delay), `window_open` (window
    start +30min fixed offset — COUPLED to the delay slider's max 30;
    catches pre-window departures AND multi-day-away mornings), `backstop`
    (daily time, ignores presence and window).
  - Notify modes Off/Quiet/Loud (Android channels; Off = no wait). Warning
    wait = `input_number.vacuum_notify_delay`, fractional MINUTES 0.25 step
    — ALWAYS `| float`, never `| int`.
  - Abort: phone action VACUUM_ABORT or event `vacuum_warning_abort` (card).
    Start now: VACUUM_START or event `vacuum_warning_start` — skips the
    someone-returned re-check by design.
  - Dock errors WARN-ONLY; hard blocks: not docked, vacuum error, unknown
    last_clean.
  - AWAY PROFILE: after the warning wait, if `binary_sensor.
    household_all_away` is ON at action time (deliberately not keyed to
    trigger id — backstops can fire while away), the FULL away profile is
    applied: `vacuum.set_fan_speed` + both mop selects from the `_away`
    helpers. Aborted runs never touch settings (the apply is post-wait).
  - NOTIFICATION LIFECYCLE: both warning sends carry tag `vacuum_warning`;
    abort path clears the notification; after the press, a replacement on
    the same tag with `alert_once: true` silently becomes "🤖 Vacuum
    started" (channel follows the mode).
  - RUN RECORD: right before the press, `input_text.vacuum_run_trigger`
    gets `"<trigger.id> <ISO> A:suction|mopi|mopm"` (away branch) or
    `"... D:..."` (default). The card's History group parses this.
- `automation.vacuum_suction_restore_default` "Vacuum: Profile Restore
  Default" (unique_id 1784341549589, config_hash `e042cc5cf721280d`):
  restores the FULL Default profile (suction + mop intensity + mop mode
  from the `_default` helpers) whenever a run ends. Triggers:
  `last_clean_end` change (definitive run end) + status `charging` for
  5 min (idle-docked catch). Deliberately NOT vacuum-state docked triggers
  — the vacuum entity reads `docked` during MID-RUN mop washes and would
  restore settings mid-clean. Condition: any of the three differs.
  DO NOT fold into the auto-clean automation as a wait-then-restore: a
  long-running automation + docked robot makes the card hallucinate a
  warning countdown.
- `automation.vacuum_maintenance_overdue_notify` (unique_id 1783954328760):
  one notification per counter per below-zero crossing, channel
  "Vacuum maintenance", mode queued max 5.

**Profile semantics (the core design):** the Default profile is the single
source of truth for normal cleaning. Away runs and any pre-run tweak (app,
card Config rows) are per-run visitors — everything reverts to Default at
run end. Profile helpers deliberately EXCLUDE custom/custom_water_flow
(profiles are deterministic; the live Config rows can still reach those).

**Helpers (14, all `vacuum_auto`)**
- `input_number.vacuum_min_days_between` 0–14 box (0 = no limit). Tuned: 2.
- `input_number.vacuum_departure_delay` 1–30 min slider. Tuned: 10.
  Hard max 30 = window_open offset coupling. DO NOT raise one alone.
- `input_datetime.vacuum_window_start` / `_end`: 08:00 / 16:00.
- `input_datetime.vacuum_backstop_time`: 16:00.
- `input_select.vacuum_notify_mode` Off/Quiet/Loud. Tuned: Loud.
- `input_number.vacuum_notify_delay` 0.25–30 MIN, 0.25 step. Card slider
  soft-max 10 (`notify_slider_max`); label-edit reaches 30. Tuned: 5.
- `input_text.vacuum_run_trigger` — run record (trigger + timestamp +
  profile). Do not repurpose. Card-armed manual starts also write it
  ("manual <ISO> M:fan|mopi|mopm" with LIVE device values).
- Six profile `input_select`s: `vacuum_suction_away/_default` (options
  quiet/balanced/turbo/max/max_plus), `vacuum_mop_intensity_away/_default`
  (off/low/medium/high), `vacuum_mop_mode_away/_default`
  (standard/deep/deep_plus/fast). Shipped values: away = max·high·deep,
  default = balanced·medium·standard.
- `binary_sensor.household_all_away` — template helper, label
  `household_presence` (SHARED — NOT vacuum teardown scope).

**Other HA-side**
- Android channels: "Vacuum warnings" (high) / "Vacuum quiet" (low) /
  "Vacuum maintenance" (default). Importance fixed at channel creation —
  if ping behavior sticks, delete the app's channels and let them recreate.
- `/config/www/vacuum-guides/` — 7 owner-processed 640px webp guide images,
  served at `/local/vacuum-guides/`, inside HA backups. Teardown scope.

## The card — flat-vacuum-card

- Main dashboard (storage mode), first section, card index 5
  (`type: custom:flat-vacuum-card`). Base64 data-URL resource
  (`data:text/javascript;name=flat-vacuum-card;base64,<blob>`) — no disk
  file, no internet, inside HA backups. Read/modify workflow in the source
  header. Deploy loop: edit source → `node --check` → grep non-ASCII
  (must be 0) → base64 → paste over the resource URL → hard refresh.
- **Deployed at ship: v2.6rev6, FNV-1a `31a8077d`, 90,173 bytes**
  (owner-confirmed pasted; byte-verify vs live resource still pending a
  browser session).
- Structure: status header + four accordion groups:
  - HEADER: warning-first amber prefix tokens (blocked > dock > water)
    ahead of state-colored text; "34% done"; current room while cleaning;
    dock-activity states (washing_the_mop / going_to_wash_the_mop /
    emptying_the_bin from `sensor.roborock_q_revo_status`) render as
    run-in-progress with pause + dock + map controls available
    (`charging` and stale `paused` deliberately excluded). Contextual
    controls: two-tap-arm play / warning Start+Abort / map+pause+dock;
    long-press = more-info. Map dialog 900px, live-refreshing via the
    image entity's entity_picture token.
  - AUTO-CLEAN: toggle + 7 setting rows + Away profile / Default profile
    rows (summary chips "max · high · deep ›"; tap → popup editor with
    segmented Suction / Mop intensity / Mop mode pickers, Save writes the
    helpers) + Presence row.
  - MAINTENANCE: conditional amber ISSUE ROWS at top (one per active
    problem: "Robot: <error>" blocks-hint / "Dock: <error>" warn-only /
    "Water low"; labels ellipsize — flex:1 min-width:0 — so long error
    names never push the hint off-card; tap → sensor more-info; group
    summary leads with the issue, group height flexes) + 7 counter rows
    with guide dialogs (480px, /local images, steps, intervals, app reset
    path) + runtime/reset captions.
  - CONFIG: Suction → Mop intensity → Mop mode dropdowns (order matches
    the summary grammar; summary = "balanced · medium · standard",
    prettified, mirroring the profile chips), read-only dock empty mode,
    volume, DND, child lock, Mop drying status, Battery status.
  - HISTORY: last 4 runs (day · time · trigger · duration · area) with a
    settings second line — cyan = away profile (A:), dim = default (D:)
    or card-manual (M:), absent = app-started or pre-feature — aligned
    under the time text (61px), condensed rows, dynamic group height +
    14-day strip. Websocket history fetch (4 entities, 14 days), 5-min
    cache, refresh on group open. Trigger attribution + settings live
    from 2026-07-13/14 onward; earlier runs correctly show "manual"/bare.
- Version history (FNV-1a): v1.0 2aed706c … v2.2 f83dc8fd → v2.3 (warning-
  first tokens, map, dock-activity) → v2.4 f6881983 → v2.4rev d8b6be72 →
  v2.4rev2 8cbac835 (issue rows) → v2.5 6c4d7e99 (suction profiles) →
  v2.6 febc9840 (full profiles + popup editor) → rev 075bc5b5 (history
  settings) → rev2 0788aa74 (issue-row overflow) → rev3 953c811e (manual
  M: records) → rev4 2ea335fc (config reorder + summary) → rev5 be21ccb3
  (history rt alignment) → **rev6 31a8077d (condensed history, SHIP)**.
  (A rev7 48405154 history sanitizer was built and REVERTED same-day —
  owner rejected display filtering; all runs show as recorded.)

## Device/integration findings (hard-won)

- **DOCK ERROR LATCHING (verified by config-entry reload test):** the dock
  error sensor mirrors Roborock's API faithfully — the DEVICE latches
  errors (e.g. `cleaning_tank_full_or_blocked`) until the next wash cycle
  re-validates the tank, while the app shows nothing for latched
  non-blocking errors. Card-shows-it + app-doesn't = latched; clears at
  the next run's mop wash (verified live). Auto-reload does NOT help
  (re-fetches the same latched error — tested). Card suppression rejected
  (would mask real faults). An error that SURVIVES a run's washes is real
  — physical check (float sensor / tank seating). Working model: sensed
  conditions (water empty) likely self-clear on fix; functional faults
  (blocked) clear only at the next wash — unconfirmed for the sensed case.
- Dock empty mode: integration rejects SET_DUST_COLLECTION_MODE (verified
  by direct API call). Card renders it read-only with tooltip. OWNER MAY
  TEST in the Roborock app someday; NO ASSISTANT ACTION until reported.
- Dock maintenance-brush sensor: permanently unknown on this dock
  (hardware likely absent). Recheck only after integration updates.
- `sensor.roborock_q_revo_status` can hold a stale `paused` after runs —
  deliberately ignored by the dock-activity mapping.
- Guide images soften if dialogs exceed ~660px width (640px sources);
  owner holds originals.
- Strainer counter decrements per wash-cycle-ish, not 1:1 runtime —
  cosmetic.

## Open items — ALL passive, owner validates, NO ASSISTANT ACTION

- First away-run through the full v2.6 stack: warning → started-morph,
  away profile applied (max·high·deep), profile restored at dock, history
  row with cyan settings line. Owner tests when next out.
- Side brush replace + sensor wipe + app counter reset (first live
  maintenance-loop test).
- Dock button during a mop wash (if `return_to_base` no-ops while docked,
  switch it to `vacuum.stop`).
- Byte-verify deployed blob vs `31a8077d` at next browser session.

## v-NEXT wishlist (ideas only)

- "Skip next scheduled clean" one-shot toggle.
- Per-run map snapshot from a History row.
- Low-battery notification (probably never).

## Teardown order (if ever dismantling)

1. Automations (auto-clean, profile restore, maintenance notify)
2. Helpers with label `vacuum_auto` (14) — NOT
   `binary_sensor.household_all_away` (shared, `household_presence`)
3. Dashboard: card entry + the flat-vacuum-card resource
4. `/config/www/vacuum-guides/`
5. Android channels self-clean when the app's notifications are cleared

## Repo copy

Card source + a sanitized copy of this doc scan clean of identifiers
(street/IP/station/username/hostname); the "Ratman" handle is allowed.
Images do NOT go to the repo. Batch-synced per the repo cadence rule.
