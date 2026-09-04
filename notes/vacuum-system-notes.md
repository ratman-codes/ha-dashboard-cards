# Roborock Qrevo Edge 2 Auto-Clean System — Authoritative Notes

Single-writer doc (per the 2026-07-21 doc split): only the session actively
working on the vacuum card edits this file. This doc + `claude/flat-vacuum-card.js`
are the authoritative references for the whole system.

**History:** built on a Roborock Q Revo 2026-07-13; profiles + run history shipped
2026-07-18; the Q Revo malfunctioned after routine maintenance, was returned to
Costco, and the system was **migrated to a Qrevo Edge 2 on 2026-07-22** in one
session. Everything below describes the Edge 2 era. (Several notes written during
the migration session were mis-dated 2026-07-15 — the correct date is 2026-07-22.)

## What it is

Presence-aware automatic full-house cleaning with per-context cleaning profiles
(aggressive when everyone's out, comfortable default otherwise), phone
warning/abort/start with a full notification lifecycle, maintenance tracking with
an illustrated in-dashboard service manual, device config, and an annotated run
history — three automations + one custom card.

## The device

- **Name:** "QX Revo Ultra 2" — Costco's SKU name for the **Roborock Qrevo Edge 2**.
  Kept as-is at pairing; entity prefix is therefore `qx_revo_ultra_2`.
- Model `roborock.vacuum.a298`, firmware `02.15.44` at migration.
- Integration = **HA core Roborock** (not HACS). Config entry `01KTB3NAQ18JA0KVSD7JEF072F`.
- The integration registers **two devices**: the robot (38 entities on 2026.9.0)
  and a separate **"QX Revo Ultra 2 Dock"** device. **Since HA core 2026.9.0
  (python-roborock 7.1.1, installed 2026-09-02 21:44 PT) the Dock holds 14
  entities** (was exactly 3 through 2026.8.x — that count was the dock-type-38
  tripwire, now retired): `sensor.qx_revo_ultra_2_dock_dock_error` (enum, 11
  fault states, reads `ok`), `_dock_strainer_time_left` (h), `_dock_maintenance_
  brush_time_left` (permanently `unknown` — this dock has no such brush),
  `binary_sensor.…_dock_dirty_water_box` / `_dock_clean_water_box` (problem-class,
  `on` = fault), `select.…_dock_empty_mode` (smart/light/balanced/max, writable),
  `switch.…_dock_dust_emptying` / `_dock_mop_washing` / `_dock_mop_drying` (start/
  stop a dock job), `switch.…_dock_child_lock`, `sensor.…_dock_mop_drying_remaining_
  time` (**unit is now HOURS**), two `button.…_dock_reset_*_consumable` (disabled by
  the integration), and the DEPRECATED `binary_sensor.…_dock_mop_drying` (replaced
  by the switch; **disabled by owner 2026-09-03** to clear the integration's repair
  — the repair only re-evaluates on an integration reload). Robot side gained
  `select.qx_revo_ultra_2_cleaning_mode` (vacuum / vac_and_mop / mop) which reads
  `unknown` while the app carousel sits on "Vac followed by Mop" (see seq_type).
- Hardware notes: dual anti-tangle main brush; side brush is **screw-mounted**
  (owner-confirmed — the card's guide steps are correct as written).

## HA inventory (all labeled `vacuum_auto` unless noted)

**Automations**

- `automation.vacuum_auto_clean_opportunistic_backstop` (unique_id 1783947925268,
  config_hash `e951107809120179` since 2026-09-03; was `02d67387d8db6ec3`). Full
  rules live in its description field (append-only). Key semantics:
  - Full clean via **`vacuum.start`** (native service). The old system pressed
    `button.*_full_cleaning`; that button was a **cloud ROUTINE** on the returned
    unit — the integration creates one button per app routine, so a fresh device has
    none and none is needed. `vacuum.start` on a docked, idle Roborock is a
    full-house clean.
  - Never more often than every X CALENDAR days (`input_number.vacuum_min_days_between`,
    dates not hours, manual runs count, fail-closed on unknown last_clean).
  - Triggers: `leave` (all-away for templated delay), `window_open` (window start
    +30 min fixed offset — COUPLED to the delay slider's max of 30), `backstop`
    (daily time, ignores presence and window).
  - Notify modes Off/Quiet/Loud (Android channels; Off = no wait). Warning wait =
    `input_number.vacuum_notify_delay`, fractional MINUTES 0.25 step — ALWAYS
    `| float`, never `| int`.
  - Abort: phone action VACUUM_ABORT or event `vacuum_warning_abort` (card).
    Start now: VACUUM_START or event `vacuum_warning_start` — skips the
    someone-returned re-check by design.
  - Dock errors WARN-ONLY; hard blocks: not docked, vacuum error, unknown last_clean.
    The dock token in both notify branches guards `not in ['ok','unknown',
    'unavailable']` (fixed 2026-09-03 — the old `!= 'ok'` rendered `⚠ Dock:
    unknown.` on every warning while the sensor didn't exist).
  - AWAY PROFILE: after the warning wait, if `binary_sensor.household_all_away` is
    ON *at action time* (deliberately not keyed to trigger id — backstops can fire
    while away), the full away profile is applied. All three set actions carry
    `continue_on_error` (see SmartPlan hazard), so a rejected mode command can never
    block the start. **Live-proven cost of continue_on_error (2026-08-14): the away
    mop-mode set failed SILENTLY on the first real away run — see the `deep`/301
    library bug below. Working as designed, but failures are invisible; the run
    record logs the INTENDED profile, not what the device accepted.**
  - NOTIFICATION LIFECYCLE: both warning sends carry tag `vacuum_warning`; the abort
    path clears the notification; after the start, a replacement on the same tag
    with `alert_once: true` silently becomes "Vacuum started".
  - RUN RECORD: right before starting, `input_text.vacuum_run_trigger` gets
    `"<trigger.id> <ISO> A:suction|mopi|mopm"` (away branch) or `"... D:..."`
    (default). The card's History group parses this.
- `automation.vacuum_suction_restore_default` "Vacuum: Profile Restore Default"
  (unique_id 1784341549589, config_hash `6dcb9192d8198459`): restores the full
  Default profile (suction + mop intensity + mop mode from the `_default` helpers)
  whenever a run ends. Triggers: `last_clean_end` change (definitive run end) +
  status `charging` for 5 min (idle-docked catch). Deliberately NOT vacuum-state
  docked triggers — the vacuum entity reads `docked` during MID-RUN mop washes and
  would restore settings mid-clean. Conditions: any of the three differs, AND
  (since 2026-08-27) the restore may proceed only when the trigger is `run_end`
  OR `cleaning_progress` reads 0/0.0/100/100.0/unknown/unavailable — the
  RESTORE-MID-RECHARGE FIX (a mid-run recharge stall holds the in-progress
  percent, so the charging catch now skips it; see Fixed bugs).
  `continue_on_error` on all three actions.
  DO NOT fold into the auto-clean automation as a wait-then-restore: a long-running
  automation + docked robot makes the card hallucinate a warning countdown.
- `automation.vacuum_maintenance_overdue_notify` (unique_id 1783954328760,
  config_hash `2d13321fc5fd99cc` since 2026-09-03; was `14604c43cd22718c`): one
  notification per counter per below-zero crossing, channel "Vacuum maintenance",
  mode queued max 5. **Five** counter triggers (main brush, side brush, filter,
  sensors, **dock strainer — re-added 2026-09-03** once the entity existed; its
  friendly name is rewritten to "Cleaning tray" in the message to match the card).

**Profile semantics (the core design):** the Default profile is the single source of
truth for normal cleaning. Away runs and any pre-run tweak (app, card Config rows)
are per-run visitors — everything reverts to Default at run end. Profile helpers
deliberately EXCLUDE `custom`/`custom_water_flow` (profiles are deterministic) and
`smart_mode` (see SmartPlan hazard).

**Helpers (14, all `vacuum_auto`)**

- `input_number.vacuum_min_days_between` 0–14 box (0 = no limit). Tuned: 2.
- `input_number.vacuum_departure_delay` 1–30 min slider. Tuned: 10. Hard max 30 =
  window_open offset coupling. DO NOT raise one alone.
- `input_datetime.vacuum_window_start` / `_end`: 08:00 / 16:00.
- `input_datetime.vacuum_backstop_time`: 16:05 (doc previously said 16:00; live wins).
- `input_select.vacuum_notify_mode` Off/Quiet/Loud. Tuned: Loud.
- `input_number.vacuum_notify_delay` 0.25–30 MIN, 0.25 step. Card slider soft-max 10
  (`notify_slider_max`); label-edit reaches 30. Tuned: 3 (doc previously said 5).
- `input_text.vacuum_run_trigger` — run record (trigger + timestamp + profile). Do
  not repurpose. Card-armed manual starts also write it
  (`"manual <ISO> M:fan|mopi|mopm"` with LIVE device values).
- Six profile `input_select`s, options synced to the Edge 2's real lists:
  - `vacuum_suction_away` / `_default` — quiet, balanced, turbo, max, max_plus
  - `vacuum_mop_intensity_away` / `_default` — off, slight, low, medium, moderate,
    high, extreme (**7 levels** on this model, up from 4)
  - `vacuum_mop_mode_away` / `_default` — standard, deep_plus, fast (`deep`
    removed from both option lists by owner 2026-09-03; the device rejects it)
  - Current values (owner-set): **away = max · high · deep_plus** (suction max_plus→max
    by owner preference; mop mode deep→**deep_plus set 2026-08-17** as the 301-bug
    mitigation — deep_plus IS this model's real deep route), **default = balanced ·
    medium · standard**. `extreme` intensity was considered and declined (soaks the
    pads, slows the robot). `deep` is no longer offered anywhere (helpers, device
    select on 7.1.1, card pickers) — the 301 bug is closed, see findings.
- `binary_sensor.household_all_away` — template helper, label `household_presence`
  (SHARED — NOT vacuum teardown scope).

**Other HA-side**

- Android channels: "Vacuum warnings" (high) / "Vacuum quiet" (low) /
  "Vacuum maintenance" (default). Importance is fixed at channel creation — if ping
  behavior sticks, delete the app's channels and let them recreate.
- `/config/www/vacuum-guides/` — 7 guide images, served at `/local/vacuum-guides/`,
  inside HA backups. **Refreshed 2026-07-22 to Edge 2 app diagrams** (640px webp,
  same filenames: filter, main-brush, side-brush, sensors, mop, cleaning-tray,
  dust-bag). Teardown scope.

## The card — flat-vacuum-card

- Main dashboard (storage mode), first section, card index 5
  (`type: custom:flat-vacuum-card`). Base64 data-URL resource
  (`data:text/javascript;name=flat-vacuum-card;base64,<blob>`) — no disk file, no
  internet, inside HA backups. Resource id `8dc0c8f4ad6a4d0ea3da4e97c3873f8b`.
  Install path: **Card Manager** (preferred). Deploy loop: edit source →
  `node --check` → grep non-ASCII (must be 0) → base64 → paste over the resource URL
  → hard refresh.
- **Deployed: v2.8.1, FNV-1a `33f14a36`, 106,793 bytes** — owner-installed via
  Card Manager 2026-09-03 evening; live blob byte-verified = archive = local
  build (subagent registry read, `cmp` BYTE_IDENTICAL). Same-day lineage: v2.8
  `8df41b74` / 104,301 B (installed + verified that afternoon) → v2.8.1
  iterated through three superseded blobs (`34919e7b` dot title, `1cb1ee28`
  colon title, `d0934fd4` em-dash title, `5b1e92bd` + pit-stop label) → final
  `33f14a36` (+ Attaching mops). Previous: v2.7rev4 `19451dc0` / 93,541 B.
  Card YAML is bare `type: custom:flat-vacuum-card` — every entity id is a
  baked default.
- Structure: status header + four accordion groups:
  - HEADER: warning-first amber prefix tokens (blocked > dock > water) ahead of
    state-colored text; "34% done"; current room while cleaning; dock-activity
    states (washing_the_mop / going_to_wash_the_mop / emptying_the_bin from
    `sensor.qx_revo_ultra_2_status`) render as run-in-progress with pause + dock +
    map controls (`charging` and stale `paused` deliberately excluded). Contextual
    controls: two-tap-arm play / warning Start+Abort / map+pause+dock; long-press =
    more-info. Map dialog 900px, live-refreshing via the image entity's
    entity_picture token. **v2.8 additions:** RECHARGE-STALL state (vacuum
    `docked` + status `charging` + progress strictly 0–100 → "Charging to resume ·
    48% done · 1h 32m", cyan, map + dock buttons, play suppressed; the dock button
    calls `vacuum.stop` = end run — NOT yet exercised live); ELAPSED RUN TIME from
    `sensor.qx_revo_ultra_2_cleaning_time` appended to the cleaning / paused /
    stall lines only (the sensor holds the last run's value while idle; hidden
    under 1 min); STARTING LOCK — any card-issued start (armed play, warning Start
    chip) renders "Starting…" and hides play/arm for 30 s or until the vacuum
    leaves docked/idle (closes the double run-record bug). **v2.8.1 (first live
    run on v2.8, owner feedback):** while CLEANING the state word moves to the
    TITLE line — "Vacuum — Cleaning" (white label, grey `#777` em dash, accent
    state word at the title's weight; a dot and a colon were tried and both
    read like a link pasted into the title) — and the second line is just
    "25% done · 1h 40m · Kitchen" (room LAST, truncates first; four segments
    did not fit the 430px column). ONLY the cleaning state moves: a 14-state
    mockup showed moving every state left Starting/Returning/Unavailable with
    an empty second line = card height jumps. Dock-activity labels:
    `going_to_wash_the_mop` → **"Returning for pit stop"** (the device sends
    that code for ANY mid-run return — run 6 logged it before a bin-empty with
    no wash — so the label is neutral about the reason and says it's moving),
    `washing_the_mop` → "Washing mops", `emptying_the_bin` → "Emptying bin",
    and NEW `attaching_the_mop` → "Attaching mops" (the ~10 s pad pick-up
    between passes; previously fell through to the idle Docked line).
  - AUTO-CLEAN: toggle + 7 setting rows + Away profile / Default profile rows
    (summary chips "max+ · high · deep ›"; tap → popup editor with segmented
    Suction / Mop intensity / Mop mode pickers, Save writes the helpers) +
    Presence row.
  - MAINTENANCE: conditional amber ISSUE ROWS at top (one per active problem:
    "Robot: <error>" blocks-hint / "Dock: <error>" warn-only / "Dirty water tank —
    needs emptying" / "Clean water tank — needs refilling" (v2.8, the dock's two
    problem-class tank sensors; either one also lights the header's `⚠ dock` token
    and the group summary) / "Water low"; labels
    ellipsize — `flex:1 min-width:0`; tap → sensor more-info; group summary leads
    with the issue) + 7 counter rows **in Roborock app order: Filter, Main brush,
    Side brush, Sensors, Mop pads, Cleaning tray, Dust bag** with guide dialogs
    (480px, /local images, steps, intervals, app reset path) + runtime/reset
    captions.
  - CONFIG: **Suction → Mop intensity → Mop mode** dropdowns (order matches the
    summary grammar; summary reads "balanced · medium · standard", prettified,
    mirroring the profile chips), **Dock empty mode dropdown** (writable since
    v2.8; smart/light/balanced/max), **Dock actions row** (v2.8, deliberately
    compact: "Wash mops" / "Empty bin" chips bound to the mop_washing /
    dust_emptying switches — tap = turn_on, tint cyan + "Washing…"/"Emptying…"
    while on, tap again = turn_off), volume, DND, child lock, **Mop drying** (v2.8:
    reads `switch.…_dock_mop_drying`, gained a toggle; remaining-time text honors
    the sensor's unit — hours on 7.1.1), Battery status.
  - HISTORY: last 4 runs (day · time · trigger · duration · area) with a settings
    second line — cyan = away profile (A:), dim = default (D:) or card-manual (M:),
    absent = app-started — aligned under the time text (61px), condensed rows,
    14-day strip. Websocket history fetch (4 entities, 14 days), 5-min cache,
    refresh on group open. Begin/end pairing window is **12h** (v2.7rev4; was 6h —
    see Fixed bugs). **Caveat (2026-08-14): the settings line shows the
    profile the automation INTENDED, not what the device accepted — the 08-14 away
    run's cyan line reads A:max|high|deep though the route ran standard.**
- **Design patterns introduced in v2.7 (reusable elsewhere):**
  - **DORMANT-ENTITY PATTERN** — rows whose entity is absent from `hass.states` hide
    themselves and wake automatically if the entity is ever created. **Proven
    2026-09-03:** the Cleaning tray counter row and the Dock empty mode row woke
    on their own when 2026.9.0 created their entities — zero card change. v2.8's
    tank rows, dock-action chips, drying toggle and elapsed-time text follow the
    same rule. Critically, an **absent dock error sensor means NO error**, never
    a permanent error.
  - **grid-template-rows 0fr/1fr collapse** — outer body + all four groups. Runtime
    `.gin` wrappers built in `_bind`; `_setGroup` is pure class toggling. **All
    hardcoded group height math is gone** (the old 332 / 330+36n / 335 / 170+12n
    constants and the `_histH`/`_issueCt` bookkeeping); groups open to exact content
    size and the animation matches the cat card's smoothness. Adding rows to any
    group now needs zero height maintenance.
  - `smart_mode` is **filtered out of the Config dropdowns' pickable options** while
    still displaying as the current value if the app parked the device there — it's
    a one-way door from HA (see SmartPlan hazard). Since v2.8 `deep` is filtered the
    same way in the Config dropdown AND both profile-popup pickers (`HIDDEN_OPTS`).
- Version history (FNV-1a): v1.0 2aed706c … v2.2 f83dc8fd → v2.3 (warning-first
  tokens, map, dock-activity) → v2.4 f6881983 → v2.4rev d8b6be72 → v2.4rev2 8cbac835
  (issue rows) → v2.5 6c4d7e99 (suction profiles) → v2.6 febc9840 (full profiles +
  popup editor) → rev 075bc5b5 → rev2 0788aa74 → rev3 953c811e → rev4 2ea335fc
  (config reorder + trio summary) → rev5 be21ccb3 → rev6 31a8077d (condensed
  history; last Q Revo build) → **v2.7 e146db5b (EDGE 2 MIGRATION: remap,
  vacuum.start, dormant entities, grid collapse, hover affordance)** → rev2 5622b1a9
  (smart_mode dropdown filter) → rev3 ac4998d5 (maintenance rows in app order) →
  **rev4 19451dc0 (history begin/end pairing window 6h → 12h — SHIPPED 2026-08-27,
  installed and byte-verified 2026-08-28)** → **v2.8 8df41b74 / 104,301 B
  (2026-09-03, POST-DOCK-FIX REV: drying switch, tank issue rows, writable empty
  mode, dock-action chips, recharge-stall header, elapsed time, starting lock,
  `deep` filter, drying-time unit fix; 60-probe Playwright harness at 430px;
  new YAML keys with baked defaults: dirty_tank_sensor, clean_tank_sensor,
  cleaning_time_sensor, dust_empty_switch, mop_wash_switch)**.
  → **v2.8.1 33f14a36 / 106,793 B (2026-09-03 evening: cleaning state word on
  the title line "Vacuum — Cleaning", secondary "N% done · elapsed · room";
  "Returning for pit stop" + "Attaching mops" dock-activity labels; 66-probe
  harness)**.
  A rev7 `48405154` history "sanitizer" (hide sub-5-minute runs) was built and
  REVERTED the same day — the owner rejected display filtering; all runs show as
  recorded. Don't rebuild it.

## Device/integration findings (hard-won)

- **DOCK TYPE 38 — RESOLVED 2026-09-03 (HA core 2026.9.0 ships python-roborock
  7.1.1; Dock device 3 → 14 entities; the `Missing RoborockDockTypeCode code: 38`
  log line is gone).** History of the root cause, kept for the record: the Edge 2's
  Multifunctional Dock reports `RoborockDockTypeCode 38`, which `python-roborock`
  5.31.1 did not map. Log: `Missing RoborockDockTypeCode code: 38 - defaulting to
  'unknown'` (plus `Missing RoborockInCleaning code: 4`); diagnostics show
  `dockType: -9999` (unknown sentinel) while the raw dock status is perfectly
  healthy. **Confirmed at the wire 2026-07-27:** raw `get_status` via the CLI returns
  `"dock_type": 38` on the same device whose parsed status says `-9999` — the device
  is right, the library mapping is the whole gap. Unknown dock type → capability
  checks fail → no dock error sensor, no water tank binaries, no strainer counter,
  no empty-mode select — even though `device_features` reports
  `isDustCollectionSettingSupported` / `isCleanFluidDeliverySupported` /
  `isHotWashTowelSupported` all true (the dock-type gate overrides the flags).
  - **This is NOT** the HA core 2026.7 regression (core issue #175353 / PR #176686);
    that fix covers the **gen-1** Qrevo Edge dock, shipped in 2026.7.3, is installed,
    and is confirmed not applicable. Same symptom, different cause — don't re-run
    that diagnosis.
  - Upstream issue filed by the owner: **`Python-roborock/python-roborock#896`**
    (2026-07-22). Canonical repo is the **Python-roborock org**;
    `Lash-L/python-roborock` is a stale pre-org fork.
  - **UPSTREAM FIX RELEASED 2026-07-25 (not yet in HA).** `python-roborock` **v5.37.1**
    (commit `f431c5d`, "Add missing dock ids") adds 17 dock codes including
    **`38: shell_3p_dock`**, assigned to the clean-carousel-self-clean,
    water-updown-drain and double-serial-communication feature sets. #896 was not
    auto-closed (fix came via a bulk sweep). **HA cannot pull this in on its own:**
    the integration pins `python-roborock==5.31.1` and re-installs the pin at every
    startup. The fix arrives only via an HA core release that bumps the pin. Owner's
    stance: wait, no custom-component override. 38 was NOT obviously added to the
    dust-collection set — the writable empty-mode select is less certain than the
    tank binaries; survey, don't assume.
  - **Bump history:** 2026.7.4 / 2026.8.0 / 2026.8.1 all pinned 5.31.1 (tripwire
    negative each time). **2026.9.0 (stable 2026-09-02, owner installed the same
    evening) pins `python-roborock==7.1.1`** — a double-major jump; the manifest
    on the 2026.9.0 tag confirms it. Survey results are in "The device" above.
  - **7.1.1 side effect (NEW, upstream-worthy):** `DeviceFeatures.from_dict` fails
    — the 7.1.1 dataclass added `is_roller_mop_supported`,
    `is_ai_recognition_setting_supported`, `is_ai_recognition_obstacle_supported`
    with no defaults; the raw feature dict from home data lacks them, so
    `cls(**result)` raises, `convert_dict` logs `Failed to convert device_features
    …` at ERROR and drops the key. Logged TWICE per HA start (two feature dicts —
    the a298's, and a second with hot-wash/fluid/LiDAR-lift false). Harmless in
    practice (route gating is correct, so the integration takes the
    `from_feature_flags` bitfield path), but an ERROR on every boot. Section 7 of
    the re-based issue draft.
- **`in_cleaning` / RoborockInCleaning code 4 — the first-class mid-job flag
  (upstream issue #929, posted 2026-08-28 by owner).** The a298 reports
  `in_cleaning: 4`, unmapped by the library (log: `Missing RoborockInCleaning
  code: 4 - defaulting to 'unknown'`). Verified before filing: current main
  (lib 7.1.1, `roborock/data/v1/v1_code_mappings.py`) still defines only 0–3
  (complete / global / zone / segment "not complete"). Why it matters:
  `in_cleaning` is the device's own "am I mid-job" flag — the clean signal for
  the charging ambiguity (mid-run recharge stall vs finished run reads
  identically as status `charging`) that the restore automation's progress-gate
  and the planned v2.8 recharge-stall header state both work around. The dock
  entities coming with the 5.37.1 bump do NOT carry this — it is a separate gap.
  Path to usable: lib maps code 4 → HA bumps the pin → the integration exposes
  the field (last step may need its own core FR). When readable in HA, swap the
  restore automation's or-condition to it. Code 4's exact meaning is NOT
  confirmed (the issue deliberately makes no claim); if the maintainer asks,
  CLI-probe `get_status` during a stall vs idle-docked.
- **THE `deep` MOP-ROUTE BUG — FIXED UPSTREAM in 7.1.1 (verified in source +
  live 2026-09-03).** `get_clean_routes()` now gates DEEP on
  `not is_clean_efficiency_supported` (true on the a298 → `deep` gone from the
  device select), and the DEEP_PLUS_CN branch requires `region == "cn"` +
  `is_clean_route_deep_slow_plus_supported`, so this device is now sent **303**
  for deep_plus (was 305). Owner live-toggled standard → deep_plus → fast →
  standard via the card's Config dropdown on 7.1.1: all stick. Section 7 of the
  issue draft became a "resolved, thanks" note. Original analysis, for the record:
  wire codes for mop route (library `CleanRoutes`): standard 300 · **deep 301** ·
  deep_plus 303 · fast 304 · deep_plus_CN 305 · smart 306. The library's
  `get_clean_routes()` gates fast/smart/custom on `device_features` flags but
  **hardcodes STANDARD + DEEP as universal — no flag guards `deep`**. The a298
  REJECTS 301: owner live-verified via the card's Config dropdown — `standard`,
  `deep_plus`, `fast` all stick; `deep` snaps back to standard in ~10 s. Given this
  device's flags (`isCarefulSlowMopSupported: true`, `isCornerCleanModeSupported:
  false`, region us), the library sends **305** for "deep_plus" (the CN-variant
  branch — its comment suggests the condition may be inverted upstream, a second
  candidate bug that happens to work here) and the device ACCEPTS it. The app's
  3-position Route slider = this model's real route set — **the app's "Deep" and
  HA's `deep_plus` are the same route; `deep`/301 is vestigial on the a298 and was
  never applied successfully on either robot (first-ever away run was 2026-08-14).**
  Mitigation was: away profile mop mode = `deep_plus` (owner set 2026-08-17) —
  still the setting, now on 303. Belt-and-braces since 2026-09-03: `deep` removed
  from both mop_mode helpers and filtered in every card picker.
- **Automation TRACE retention is 5 runs (~2 days at this automation's firing
  rate).** The 08-14 away-run trace was already evicted by 08-17 — audit past runs
  via recorder history (selects + run_trigger + all_away), not traces.
- **SMARTPLAN HAZARD (live-verified).** While the device is in `smart_mode`
  (Roborock's "SmartPlan" / DirTect, set from the app), it **rejects individual mode
  commands** — `vacuum.set_fan_speed` and the mop selects both return 500, while
  unrelated writes (volume) succeed. Only the **app's mode carousel** can exit
  SmartPlan; HA cannot. App-started SmartPlan runs leave the device parked in smart,
  so the restore automation silently no-ops until the owner flips it back. Mop
  intensity also reads `unknown` in this state. Mitigations in place: `smart_mode`
  removed from all 4 profile helper option lists, filtered from the card's Config
  dropdowns, and `continue_on_error` on every set action in both automations.
  **A `smart_mode` Default profile is permanently off the table** — it can't be
  applied and it strands every restore.
- **Old dock-error latching lore (Q Revo) is UNVERIFIED here.** Treat it as history,
  not as current behavior — the dock error sensor exists since 2026-09-03 but no
  fault has occurred on it yet; the first real dock fault is the retest.
  Related observation (2026-08-20): a dock out-of-water fault surfaced only as a
  **3-second `error` transit** on the vacuum entity + status sensor
  (18:33:35→18:33:38) before settling to docked/charging — `vacuum_error` stayed
  `none`, `water_shortage` stayed `off`, nothing latched. A card-side fault latch
  off that transit was considered and REJECTED (stopgap for the real dock error
  sensor).
- Run-end signals verified working on this model: `last_clean_begin` /
  `last_clean_end` populate, status goes `charging`, `cleaning_area` reports.
- `sensor.qx_revo_ultra_2_status` can hold a stale `paused` after runs —
  deliberately ignored by the dock-activity mapping.
- `sensor.qx_revo_ultra_2_cleaning_progress` reports percent during a run.
  **Verified behavior (08-20 + 08-27 + 09-03): holds the mid-range percent
  through a mid-run recharge stall; reads 0 within seconds of a completed run's
  end.** Load-bearing in the restore automation's stall guard and the card's
  stall state. **PROGRESS-CEILING PATTERN (six-run recorder audit, 2026-09-03,
  runs 08-25 → 09-03, pre-map-edit):** on the two-sweep config the % is rigid
  and NEVER reaches 100 — vacuum pass ends at **26–27 %** (area ~59 m²), pads
  attach → jumps to 51–52, climbs to 53–55 over ~5 min of mopping, then
  **collapses to 37–39** (largest drop every run; speculation: the mop pass
  re-bases against a carpet-excluded denominator), then climbs to **60–62 % at
  run completion** (area 103–107 m²) — identical across Default/backstop, the
  away max/deep_plus run, the app-started run, and the 147-min-stall run.
  Other decreases are ±1–3 noise. WHY: the denominator is the WHOLE map, and
  ~30 % of the mapped floor is unreachable by design — the guest bedroom
  (pet gate) and the master bedroom (virtual wall across its door), plus
  phantom slivers behind mirrors/windows; a pixel count of the app's map put
  reachable rooms at ~70 % of mapped area, and furniture/no-go boxes account
  for the rest of the 61-vs-70 gap (~1 progress point ≈ 2 m²). So "61% done"
  immediately before "finished" is the robot's honest ratio, not a fault.
  **Owner is erasing the phantom regions with the app's map eraser
  (2026-09-03, `isMapEraserSupported` true) — the ceiling WILL move; re-measure
  on the next run before quoting 61 again.** Display options recorded, none
  built (owner: leave it for now): rescale by the ceiling (one YAML number,
  drifts on any map edit) or area-based progress from the card's own history
  (truthful, self-calibrating, a real feature).
- Guide images soften if dialogs exceed ~660px width (640px sources).
- Service intervals are **identical to the Q Revo's** (main 300 h, side 200 h,
  filter 150 h + rinse every 2 weeks, sensors 30 h, cleaning tray monthly, dust bag
  as needed) — verified against the Edge 2's own app diagrams.
- **The integration is cloud-polled** (active repair issue `cloud_api_used_*`).
  Explains the ~15–20 s lag between `vacuum.start` and the robot moving — the
  reason for v2.8's 30-s starting lock.
- **Integration repairs re-evaluate only on reload** (2026-09-03): after disabling
  the deprecated `binary_sensor.…_dock_mop_drying` the `deprecated_mop_drying`
  repair stayed listed until the Roborock config entry was reloaded. The robot
  chimes twice on a reload (two device connections) — normal.
- **Two "Mop drying" entities on the Dock page** — the Controls one is the switch
  (keep); the Diagnostic one was the deprecated binary sensor (disabled).

## Direct-device probe findings (2026-07-27) — THE SETTINGS MAP

Method that WORKS: `pip install "python-roborock[cli]"` on any PC →
`py -m roborock.cli login --email <roborock email>` (email code; the account has
2FA so password login fails with code 2031; agreement error 3006 = log out/in of
the phone app first) → `py -m roborock.cli list-devices` for the DUID →
`py -m roborock.cli command --device_id <DUID> --cmd <getter>`. Full procedure +
command list: `claude/roborock-settings-capture-checklist.md` (rewritten 2026-07-27;
the original HA-diagnostics-diff method there was DISPROVEN — app settings are not
in the blob HA polls, do not resurrect it).

Key results (all on fw 02.15.44):

- **`status.seq_type` = the mode carousel's sequential mode** (verified by toggle,
  twice): 0 = Vac & Mop, 1 = Vac followed by Mop. The other three carousel tabs are
  just fan/water combos HA can already set: Vacuum = mop intensity `off`
  (water_box_mode 200), Mop = fan `off_raise_main_brush` (fan_power 105),
  Vac & Mop = both active (fan 102 / water 235 at Default profile).
  **SETTER FOUND 2026-09-03 — `app_set_clean_sequence_type`** (credit: BlackRockCity's
  app capture on a Saros 10R in python-roborock#914, comment 2026-08-28; owner
  confirmed on the a298 the same day via `vacuum.send_command`): params
  `{type: 1, water_box_mode: 235, mop_mode: 300, fan_power: 102, repeat: 1}` →
  Vac followed by Mop; `{type: 0, water_box_mode: 235, mop_mode: 300, fan_power:
  102}` → Vac & Mop. Both accepted (no `-10005`), both reflected in the app
  carousel within seconds. Ruled out in July: `set_clean_sequence` (room order) and
  `set_switch_mop_mode` (not recognized). The library STILL drops `seq_type` on
  parse, so HA cannot read the mode back — and `select.qx_revo_ultra_2_cleaning_
  mode` is no readout either: it reads `unknown` in BOTH positions on this robot,
  because the Default water code 235 (`pure_water_flow_middle`) is the enum member
  python-roborock#931 shows collapsing, so the classifier can't place the device.
  OWNER DECISION 2026-09-03: tested, NOT built on — wait a few weeks for #914 to
  get a typed API (which would also give readable state); if it stalls, the
  two-`send_command` version (away branch `type: 1`, restore `type: 0`, plus a
  helper + card row) is a one-session job. Note 7.1.1's integration writes state
  only on change (last_reported stayed pinned across a `homeassistant.update_entity`
  call), so "no update" after a command is not evidence of failure.
- **Library drops raw status fields on parse:** `seq_type, cleaning_info, extra_time,
  monitor_status, exit_dock, dtof_status, pet_reminding, sub_error_code, sub_zone,
  user_privacy`. This is why HA-diagnostics diffing can't find these settings.
- **Five settings have NO command and NO status field** (each toggled; get_status
  byte-identical): Auto-Detach/Reinstall Mop Cloth Mounts
  (`isAutoTearDownMopSupported`), LiDAR Sensor Lowering (`isLdsLiftingSupported`),
  Cleaning Pattern (`isSupportFloorDirection`), Clean Areas Blocked by People/Pets
  (`isDynamicallyAddCleanZonesSupported`), Automatic Re-Mopping
  (`isDirtyReplenishCleanSupported`; `app_set_dirty_replenish_clean_status` exists
  as a setter but `status.replenish_mode` did NOT track the toggle).
- **The two carpet getters are inert on this model** (verified across the whole
  Carpet page incl. Carpet Boost off): `get_carpet_clean_mode` and `get_carpet_mode`
  return frozen values no matter what changes. Suspected: carpet config moved to map
  scope on this generation.
- **~19 getters DO work** and each reply is the payload shape its `set_*` twin takes
  (FlexiArm trio, Pet Area, obstacle avoidance, AI recognition, dryer, wash params,
  dust collection, wash temp, fluid delivery, camera bitfield, dock info, DND, etc.).
  `get_gap_deep_clean_status` verified end-to-end by toggle (0→1). These are all
  drivable from HA TODAY via `vacuum.send_command` — payload shapes in the checklist
  doc and the archived issue draft.
- **`app_get_clean_estimate_info`** returns the robot's own job plan:
  `total_battery: 186` (%) on the two-sweep config = the robot KNEW the job needed
  ~1.9 charges. Snapshot is stale between runs — read it shortly after a run starts.
  This is the one-number test for whether a config fits one charge.
- Not recognized by this device: `get_mop_motor_status`,
  `get_mop_template_params_summary`, `get_wash_towel_params`,
  `get_fan_motor_work_timeout`, `get_flow_led_status`, `set_switch_mop_mode`.
  Empty reply: `get_clean_sequence`, `get_customize_clean_mode`,
  `app_get_robot_setting`, `get_timer_summary`.
- **2026-08-17 addition — mop-route wire codes + the `deep`/301 rejection** (see the
  dedicated finding under Device/integration findings above).
- **Upstream issue RE-BASED 2026-09-03 and ready to post** —
  `claude/roborock-upstream-issue-draft.md`: dropped fields + seq_type + sections
  4–6 re-verified still valid against the v7.1.1 source (`StatusV2` has none of the
  10 fields); old section 7 (`deep`/301) replaced by a resolved note; NEW section 7
  = the `DeviceFeatures.from_dict` failure; asks renumbered; pre-submission fixes
  applied. Owner posts.
  **A SECOND, standalone issue was posted 2026-08-28:
  `Python-roborock/python-roborock#929` (RoborockInCleaning missing code 4)** —
  see the `in_cleaning` finding above; the held omnibus issue is unaffected.

## Run-duration baselines (runs 1–5) + current cleaning config

Measured so nobody re-diagnoses "the robot is too slow" as a fault:

- **Run 1 (2026-07-24, backstop, Default profile, two-sweep config):** pads OFF
  16:06 → ON 17:53 (`mop_attached` is the phase marker) — vacuum sweep then mop
  sweep, house covered twice. ~0.6 m²/min in BOTH sweeps; dock trips only ~12 min.
  Finished 19:36: **184 min cleaning, 99.2 m², 3h31m wall clock**. Battery
  ~0.45 %/min → a full two-sweep run cannot fit one charge.
- **Run 2 (2026-07-26, backstop, same config):** 3h14m to 58%, battery ~20% →
  docked 19:27 to recharge — and never resumed; job abandoned at 58%. (Run 3 later
  proved resume DOES work — run 2's abandonment remains unexplained, possibly the
  app-side config changes made that same evening interrupted the pending job.)
  Charge rate ≈ 0.37 %/min (nearly as slow as the drain).
- **Config changes 2026-07-26/27** (app-side, deliberate): mode
  carousel → **Vac & Mop** (seq_type 0, single pass); **Vacuum Carpet First → OFF**;
  **Auto-Detach Mop Mounts → OFF**. Trade-off accepted: damp pads can touch carpet.
  **SUPERSEDED 2026-08-20: owner set the carousel back to Vac followed by Mop
  (two-sweep)** — run areas since then read ~104–108 m² (double coverage) vs the
  single-pass 61 m². Two-sweep runs do not fit one charge; mid-run recharge
  stalls are EXPECTED behavior in this config, not a fault.
- **Run 3 (2026-08-14 14:26, LEAVE-TRIGGERED — the first real away run):**
  full stack verified: all_away ON 14:13:43 → leave trigger (10-min delay exact) →
  3-min Loud warning → start 14:26:44, record `leave … A:max|high|deep`. Away
  suction + intensity APPLIED (intensity medium→high at start, watched in recorder);
  **mop route `deep` FAILED SILENTLY** (the 301 bug above) — ran standard.
  **RECHARGE-AND-RESUME VERIFIED WORKING:** docked low 16:20 → resumed 18:54 →
  finished 19:26. **But the restore automation fired at 16:29 during the recharge
  stall** (charging-for-5-min catch), reverting the away profile — the resumed
  segment ran on Default. Also: all_away flipped back OFF at 14:27:04, 20 s after
  the start — owner hadn't returned that fast; presence FLAP suspected (fail-safe
  direction; watch for recurrence). Even at max suction the single-pass job needed
  one recharge — away profile is thirstier by design.
- **Run 4 (2026-08-16 16:08, backstop, Default profile): SINGLE-PASS CONFIG
  VERIFIED.** 16:08 → 18:17, **115.6 min cleaning, 61.4 m², one charge, no stall**
  (4 mid-run mop-wash dock visits, normal). The 61 vs 99 m² delta = single vs double
  coverage of the same floor. The July run-time complaint is CLOSED.
- **Run 6 (2026-09-03 16:08, backstop, Default profile, two-sweep — first run on
  v2.8/v2.8.1):** vacuum pass 16:08→17:52 (pads attached at the dock 17:52),
  mop pass 17:52→19:19; **174.6 min cleaning, 104.4 m², battery 100→24 %, NO
  recharge stall** — the first two-sweep run to fit one charge (run 1 needed
  184 min and didn't; 24 % is a thin margin). Four mid-run dock visits (bin
  empty 17:41; empty + attach pads + wash 17:50; washes 18:19, 18:53), post-run
  wash 19:21–19:25 then drying (2h 59m). Cord in the main brush at 16:38:
  `vacuum_error` read `main_brush_jammed` for 19 s → status `paused` 63 s →
  owner cleared it, resumed 16:39 — **robot-side errors DO reach the error
  sensor** (unlike the 08-20 dock water fault). Restore automation correctly
  did nothing (Default profile). Strainer 62→58 h.
- **Run 5 (2026-08-27 15:05, LEAVE-TRIGGERED away run, two-sweep config):**
  record `leave … A:max|high|deep_plus` — the deep_plus mitigation applied
  (intensity medium→high watched at start). Recharge stall 17:08–19:35, resumed,
  finished 21:21:15: **212 min cleaning, 105.5 m², 6h16m wall clock** — the run
  that exposed the card's 6h pairing cap (fixed, v2.7rev4) and re-triggered the
  restore-mid-recharge bug at 17:13:31 (fixed same day, see Fixed bugs).
  Presence worked end-to-end ON the Nabu Casa renewal date itself.
- The "1 min/m²" folk benchmark is a single vacuum-only pass in open rooms — never
  compare a mop-carrying 7-room run against it.

## App-side settings that explain observed behavior (not HA-visible)

State as of 2026-07-27 (probe session), except where dated:

- **Cleaning mode: Vac followed by Mop (two-sweep) — owner re-set 2026-08-20**
  (was Vac & Mop single-pass 07-26→08-20; originally Vac followed by Mop).
  Two-sweep runs need a mid-run recharge; see run baselines.
- **Vacuum Carpet First OFF, Auto-Detach Mop Mounts OFF** (both deliberately, see
  run baseline). **Carpet Boost ON** (restored after testing). Avoid-wires OFF,
  Automatic Re-Mopping OFF, LiDAR Lowering = Safe Clearance, FlexiArm Crevices OFF,
  Deep Carpet Cleaning OFF, Pet Area Deep Cleaning ON, Reactive Obstacle Avoidance
  ON (restored/confirmed post-testing).
- **Dock Settings:** Mop Wash Frequency = Smart, Washing Mode = Smart, Dustbin
  Auto-Empty = Balanced, Empty Mode = Smart, Drying = Auto / Standard. No plumbed
  water line — on-board tank with a manual drain utility (ran dry mid-run
  2026-08-20 — the dock fault that surfaced only as the 3-s `error` transit).
- Water Flow is a numeric scale in the app (15 = "Medium"); the seven HA intensity
  names are presets on that dial.
- "Connect to the Matter Network" exists on this model — unused escape hatch if the
  cloud dependency ever chafes.

## Presence / remote access — RESOLVED, and now LIVE-PROVEN

- **Root cause (found 2026-07-26):** phone GPS is the only tracker; HA's base URL was
  LAN-only and HA Cloud not logged in, so the companion app had NO route to HA off
  Wi-Fi unless the owner's on-demand Tailscale happened to be up. Fail-safe
  (under-trigger only).
- **Fix: Nabu Casa Cloud subscribed 2026-07-27**, verified same night from cellular
  (dashboard + command path). Certificate auto-renews (expires 2026-10-25);
  subscription renewed 2026-08-27 — a leave-triggered away run launched cleanly
  that same day, so the renewal rollover broke nothing.
- **FIRST REAL DEPARTURE VERIFIED 2026-08-14:** all_away ON at 14:13:43, leave
  trigger fired after the exact 10-min delay, away run launched. The presence fix
  works end to end. (Second clean leave-triggered run: 2026-08-27.)
- **Open wrinkle:** all_away flapped back OFF 20 s after the run start (14:27:04)
  while the owner was still out — a GPS flap. Fail-safe direction, but a flap
  DURING the 3-min warning window would abort a legitimate away run via the
  someone-returned check. Watch; if it recurs, consider the security chat's
  router-presence layer (person.ratman already carries the Deco tracker since
  2026-08-04 — see the 08-04 [security] changelog entry).
- HA outage 2026-07-25: power outage, owner shut the server down himself. Closed.

## Open items

- **v2.8/v2.8.1 LIVE WATCHES** (not exercised by run 6 — no stall, backstop
  start, no dock fault): (1) "Charging to resume" header on the next recharge
  stall; (2) the stall dock button = `vacuum.stop` (untested — press only to
  actually cancel a run); (3) "Starting…" lock on the next card-initiated
  start; (4) first real dock fault → tank issue rows + `⚠ dock` token + dock
  error row. VERIFIED by run 6: pit-stop/washing/emptying labels, elapsed time,
  title-line state word, `main_brush_jammed` issue path, drying hours unit.
- **Progress ceiling re-measure** after the owner's map-eraser edit (see the
  cleaning_progress finding) — expect the completion % to rise from ~61.
- **Post the re-based upstream issue** (`claude/roborock-upstream-issue-draft.md`,
  owner posts; optionally fill the exact July CLI version in the baseline) + a
  short "confirmed on a298" comment on #914 (draft in this chat, owner's call).
- **#914 watch (seq_type setter)** — if a typed `vac_then_mop` mode lands upstream
  and reaches HA, build the per-profile single-pass/two-sweep feature on it; if
  #914 stalls past ~October, revisit the raw `send_command` version. Also close
  #896 (fixed in 5.37.1, confirmed 2026.9.0) — owner housekeeping.
- **Upstream watches that touch this robot:** #931 (WaterModes 235 alias — why
  `cleaning_mode` reads unknown; may break the select's setter on the a298),
  #702 (dock "water empty" error latching in HA after refill — retest on the
  first real dock fault), #738 (maintainers' missing-V1-features checklist =
  where the section-6 typed-getter PR would go).
- **Upstream #929 watch** (`in_cleaning` code 4, posted 2026-08-28) — if the
  maintainer responds asking for captures, CLI-probe `get_status` during a
  recharge stall vs idle-docked; when the field becomes readable in HA, swap the
  restore automation's progress-gate condition to it.
- **Restore fix live test** — the 2026-08-27 stall-guard condition has NOT yet
  seen a real recharge stall; verify the away profile survives on the next long
  away run.
- **First maintenance loop** — replace side brush / wipe sensors, reset in app.
- **Dock-activity header vocabulary** — glance at the card during a dock mop wash.
- **Presence flap watch** — see the wrinkle above.

**CLOSED 2026-08-14/16/17:** first away run through the full stack ✓ (deep failure
diagnosed → mitigated) · first real departure ✓ · recharge-and-resume ✓ ·
single-pass run fits one charge ✓ · away mop mode → deep_plus set ✓.
**CLOSED 2026-08-27/28:** restore-mid-recharge fix shipped ✓ · card history 6h
pairing cap fixed (v2.7rev4) ✓ · away profile incl. deep_plus applied on a real
run ✓ · presence verified on renewal day ✓ · #929 posted ✓.
**CLOSED 2026-09-03 (dock-fix session):** python-roborock bump landed (7.1.1) ✓ ·
dock entities surveyed (14) ✓ · strainer re-added to the overdue notify ✓ · `⚠ Dock:
unknown.` guard fixed ✓ · card v2.8 shipped + byte-verified ✓ · `deep` dropped from
helpers ✓ · deprecated drying binary sensor disabled + repair cleared ✓ · `deep_plus`
(303) live-verified ✓ · issue draft re-based ✓.

**Do NOT re-offer:** folding the old Q Revo's run history into the card, the rev7
history sanitizer, or a `smart_mode` profile.

## v-NEXT wishlist (ideas only)

Shipped in v2.8 (2026-09-03) and removed from this list: elapsed run time,
recharge-stall header state, "Starting…" lock, post-code-38 rev (tank rows, empty
mode, dock actions), `deep` picker filter. Remaining, none owner-requested:

- **Area-based progress** ("58 m² · vac pass" / % of typical final area from
  the card's own history) replacing the robot's whole-map % — only if the ~61
  ceiling keeps bothering the owner after the map edit; the cheap alternative
  is a rescale-by-ceiling YAML number.
- "Skip next scheduled clean" one-shot toggle.
- Per-run map snapshot from a History row.
- `select.qx_revo_ultra_2_cleaning_mode` as a Config row once the library maps
  the "Vac followed by Mop" position (reads `unknown` on this robot today).
- Room-batch rotation via `app_segment_clean` (segments: 1 Hall, 2 Living room,
  3 Guest bedroom, 4 Master bedroom, 5 Bathroom, 6 Bathroom1, 7 Kitchen) — fallback
  if single-pass ever stops fitting one charge (moot while the owner runs
  two-sweep, see Run 5).
- Mop mode `standard` → `fast` in the Default profile (offered, declined for now).

## Fixed bugs (formerly Known open bugs)

- **`⚠ Dock: unknown.` IN EVERY WARNING NOTIFICATION — FIXED 2026-09-03.** Both
  notify branches guard `not in ['ok','unknown','unavailable']` now (config_hash
  `02d67387d8db6ec3` → `e951107809120179`; template rendered live: empty tail at
  `ok`, empty against a nonexistent sensor).
- **DOUBLE RUN-RECORD — FIXED 2026-09-03 (v2.8 starting lock).** Card-issued starts
  hide play/arm for 30 s or until the vacuum leaves docked/idle, so the 15–20 s
  cloud-poll gap can no longer take a second start.
- **DRYING REMAINING TIME UNIT — FIXED 2026-09-03 (v2.8).** 7.1.1 reports
  `_dock_mop_drying_remaining_time` in HOURS; v2.7 printed the raw number as
  "min left". The row now honors `unit_of_measurement` (h → ×60).
- **MOP-ROUTE `deep` (301) — FIXED UPSTREAM in 7.1.1**, see findings.

- **RESTORE-MID-RECHARGE — FIXED 2026-08-27** (found 2026-08-14; recurred
  2026-08-27 at 17:13:31, which prompted the owner to green-light shipping the
  fix ahead of the dock-fix session). The restore automation's
  `charging for 5 min` trigger could not distinguish post-run charging from a
  MID-RUN recharge stall. Fix: an AND-condition (native or-block) — the restore
  proceeds only when the trigger is `run_end` OR
  `sensor.qx_revo_ultra_2_cleaning_progress` reads
  0/0.0/100/100.0/unknown/unavailable. Config_hash `c0be0038cee1d29b` →
  `6dcb9192d8198459`; entity re-verified on; read-back verified. Residual edge
  (accepted): a run ending with NO clean record logged AND stuck mid-range
  progress skips the restore until the next run's end (one run on stale
  settings, self-heals). Live test pending (see Open items). Clean long-term
  fix = `in_cleaning` (#929).
- **CARD HISTORY 6-HOUR PAIRING CAP — FIXED 2026-08-27 (v2.7rev4).** `_parseHist`
  refused to pair a run begin with an end more than 6h later; run 5 (6h16m wall
  with its recharge stall) therefore showed NO duration, its END time as its
  time, and fell back to the default trigger label `manual` despite a correct
  leave record. Window widened to 12h; owner confirmed the row healed on
  install.

## Known open bugs (diagnosed, not fixed — owner deferring)

- None as of 2026-09-03. (The three that lived here — `deep`/301, the double
  run-record, `⚠ Dock: unknown.` — all moved to Fixed bugs.)

## Teardown order (if ever dismantling)

1. Automations (auto-clean, profile restore, maintenance notify)
2. Helpers with label `vacuum_auto` (14) — NOT `binary_sensor.household_all_away`
   (shared, `household_presence`)
3. Dashboard: card entry + the flat-vacuum-card resource
4. `/config/www/vacuum-guides/`
5. Android channels self-clean when the app's notifications are cleared
