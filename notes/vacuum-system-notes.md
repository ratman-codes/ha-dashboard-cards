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
- The integration registers **two devices**: the robot (~37 entities, incl. ~7
  disabled-by-default diagnostics) and a separate **"QX Revo Ultra 2 Dock"** device
  holding exactly **3** entities (mop drying, drying remaining time, child lock).
  *That count is the tripwire:* if the Dock device ever shows more than 3 entities
  after an HA update, the upstream dock fix has landed (see Dock type 38).
- Hardware notes: dual anti-tangle main brush; side brush is **screw-mounted**
  (owner-confirmed — the card's guide steps are correct as written).

## HA inventory (all labeled `vacuum_auto` unless noted)

**Automations**

- `automation.vacuum_auto_clean_opportunistic_backstop` (unique_id 1783947925268,
  config_hash `02d67387d8db6ec3`). Full rules live in its description field
  (append-only). Key semantics:
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
  - AWAY PROFILE: after the warning wait, if `binary_sensor.household_all_away` is
    ON *at action time* (deliberately not keyed to trigger id — backstops can fire
    while away), the full away profile is applied. All three set actions carry
    `continue_on_error` (see SmartPlan hazard), so a rejected mode command can never
    block the start.
  - NOTIFICATION LIFECYCLE: both warning sends carry tag `vacuum_warning`; the abort
    path clears the notification; after the start, a replacement on the same tag
    with `alert_once: true` silently becomes "Vacuum started".
  - RUN RECORD: right before starting, `input_text.vacuum_run_trigger` gets
    `"<trigger.id> <ISO> A:suction|mopi|mopm"` (away branch) or `"... D:..."`
    (default). The card's History group parses this.
- `automation.vacuum_suction_restore_default` "Vacuum: Profile Restore Default"
  (unique_id 1784341549589, config_hash `c0be0038cee1d29b`): restores the full
  Default profile (suction + mop intensity + mop mode from the `_default` helpers)
  whenever a run ends. Triggers: `last_clean_end` change (definitive run end) +
  status `charging` for 5 min (idle-docked catch). Deliberately NOT vacuum-state
  docked triggers — the vacuum entity reads `docked` during MID-RUN mop washes and
  would restore settings mid-clean. Condition: any of the three differs.
  `continue_on_error` on all three actions.
  DO NOT fold into the auto-clean automation as a wait-then-restore: a long-running
  automation + docked robot makes the card hallucinate a warning countdown.
- `automation.vacuum_maintenance_overdue_notify` (unique_id 1783954328760,
  config_hash `14604c43cd22718c`): one notification per counter per below-zero
  crossing, channel "Vacuum maintenance", mode queued max 5. **Four** counter
  triggers (main brush, side brush, filter, sensors). The dock strainer was removed
  from the trigger list — that entity does not exist on this device yet; re-add
  `sensor.qx_revo_ultra_2_dock_strainer_time_left` when it appears (also noted in
  the automation's own description).

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
- `input_datetime.vacuum_backstop_time`: 16:00.
- `input_select.vacuum_notify_mode` Off/Quiet/Loud. Tuned: Loud.
- `input_number.vacuum_notify_delay` 0.25–30 MIN, 0.25 step. Card slider soft-max 10
  (`notify_slider_max`); label-edit reaches 30. Tuned: 5.
- `input_text.vacuum_run_trigger` — run record (trigger + timestamp + profile). Do
  not repurpose. Card-armed manual starts also write it
  (`"manual <ISO> M:fan|mopi|mopm"` with LIVE device values).
- Six profile `input_select`s, options synced to the Edge 2's real lists:
  - `vacuum_suction_away` / `_default` — quiet, balanced, turbo, max, max_plus
  - `vacuum_mop_intensity_away` / `_default` — off, slight, low, medium, moderate,
    high, extreme (**7 levels** on this model, up from 4)
  - `vacuum_mop_mode_away` / `_default` — standard, deep, deep_plus, fast
  - Shipped values: **away = max_plus · high · deep**, **default = balanced · medium ·
    standard**. `extreme` intensity was considered and declined by the owner (soaks
    the pads and slows the robot); `max_plus` is free on an empty house.
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
- **Deployed: v2.7rev3, FNV-1a `ac4998d5`, 93,039 bytes** (owner-confirmed).
- Structure: status header + four accordion groups:
  - HEADER: warning-first amber prefix tokens (blocked > dock > water) ahead of
    state-colored text; "34% done"; current room while cleaning; dock-activity
    states (washing_the_mop / going_to_wash_the_mop / emptying_the_bin from
    `sensor.qx_revo_ultra_2_status`) render as run-in-progress with pause + dock +
    map controls (`charging` and stale `paused` deliberately excluded). Contextual
    controls: two-tap-arm play / warning Start+Abort / map+pause+dock; long-press =
    more-info. Map dialog 900px, live-refreshing via the image entity's
    entity_picture token.
  - AUTO-CLEAN: toggle + 7 setting rows + Away profile / Default profile rows
    (summary chips "max+ · high · deep ›"; tap → popup editor with segmented
    Suction / Mop intensity / Mop mode pickers, Save writes the helpers) +
    Presence row.
  - MAINTENANCE: conditional amber ISSUE ROWS at top (one per active problem:
    "Robot: <error>" blocks-hint / "Dock: <error>" warn-only / "Water low"; labels
    ellipsize — `flex:1 min-width:0`; tap → sensor more-info; group summary leads
    with the issue) + 7 counter rows **in Roborock app order: Filter, Main brush,
    Side brush, Sensors, Mop pads, Cleaning tray, Dust bag** with guide dialogs
    (480px, /local images, steps, intervals, app reset path) + runtime/reset
    captions.
  - CONFIG: **Suction → Mop intensity → Mop mode** dropdowns (order matches the
    summary grammar; summary reads "balanced · medium · standard", prettified,
    mirroring the profile chips), read-only dock empty mode, volume, DND, child
    lock, Mop drying status, Battery status.
  - HISTORY: last 4 runs (day · time · trigger · duration · area) with a settings
    second line — cyan = away profile (A:), dim = default (D:) or card-manual (M:),
    absent = app-started — aligned under the time text (61px), condensed rows,
    14-day strip. Websocket history fetch (4 entities, 14 days), 5-min cache,
    refresh on group open.
- **Design patterns introduced in v2.7 (reusable elsewhere):**
  - **DORMANT-ENTITY PATTERN** — rows whose entity is absent from `hass.states` hide
    themselves and wake automatically if the entity is ever created. Currently
    dormant: dock error row + amber dock token, Cleaning tray counter row,
    empty-mode Config row. Critically, an **absent dock error sensor means NO
    error**, never a permanent error.
  - **grid-template-rows 0fr/1fr collapse** — outer body + all four groups. Runtime
    `.gin` wrappers built in `_bind`; `_setGroup` is pure class toggling. **All
    hardcoded group height math is gone** (the old 332 / 330+36n / 335 / 170+12n
    constants and the `_histH`/`_issueCt` bookkeeping); groups open to exact content
    size and the animation matches the cat card's smoothness. Adding rows to any
    group now needs zero height maintenance.
  - `smart_mode` is **filtered out of the Config dropdowns' pickable options** while
    still displaying as the current value if the app parked the device there — it's
    a one-way door from HA (see SmartPlan hazard).
- Version history (FNV-1a): v1.0 2aed706c … v2.2 f83dc8fd → v2.3 (warning-first
  tokens, map, dock-activity) → v2.4 f6881983 → v2.4rev d8b6be72 → v2.4rev2 8cbac835
  (issue rows) → v2.5 6c4d7e99 (suction profiles) → v2.6 febc9840 (full profiles +
  popup editor) → rev 075bc5b5 → rev2 0788aa74 → rev3 953c811e → rev4 2ea335fc
  (config reorder + trio summary) → rev5 be21ccb3 → rev6 31a8077d (condensed
  history; last Q Revo build) → **v2.7 e146db5b (EDGE 2 MIGRATION: remap,
  vacuum.start, dormant entities, grid collapse, hover affordance)** → rev2 5622b1a9
  (smart_mode dropdown filter) → **rev3 ac4998d5 (maintenance rows in app order —
  SHIPPED)**.
  A rev7 `48405154` history "sanitizer" (hide sub-5-minute runs) was built and
  REVERTED the same day — the owner rejected display filtering; all runs show as
  recorded. Don't rebuild it.

## Device/integration findings (hard-won)

- **DOCK TYPE 38 — why dock entities are missing (settled root cause).** The Edge 2's
  Multifunctional Dock reports `RoborockDockTypeCode 38`, which `python-roborock`
  5.31.1 does not map. Log: `Missing RoborockDockTypeCode code: 38 - defaulting to
  'unknown'` (plus `Missing RoborockInCleaning code: 4`); diagnostics show
  `dockType: -9999` (unknown sentinel) while the raw dock status is perfectly
  healthy (`dockErrorStatus: 0`, `washStatus: 512`, `dss: 168`,
  `isHotWashTowelSupported` / `isDustCollectionSettingSupported` /
  `isCleanFluidDeliverySupported` all true). Unknown dock type → capability checks
  fail → no dock error sensor, no water tank binaries, no strainer counter, no
  empty-mode select.
  - **This is NOT** the HA core 2026.7 regression (core issue #175353 / PR #176686);
    that fix covers the **gen-1** Qrevo Edge dock, shipped in 2026.7.3, is installed,
    and is confirmed not applicable. Same symptom, different cause — don't re-run
    that diagnosis.
  - Upstream issue filed by the owner: **`Python-roborock/python-roborock#896`**
    (2026-07-22). Same class as their #864 (dock code 21, still open); PR #867
    reworked dock capabilities into `RoborockDockFeatures` but added neither code.
    Note the canonical repo is the **Python-roborock org**; `Lash-L/python-roborock`
    is a stale pre-org fork.
  - **Arrival signal:** the Dock device's entity count exceeding 3 after an HA core
    update (HA bumps the library; typically the next monthly). Then: dormant card
    rows wake by themselves, re-add the strainer to the maintenance-notify triggers,
    and survey the new entities (tank binaries are strong issue-row candidates;
    empty mode may finally be writable; wash/dry controls may appear) for ONE
    deliberate card rev.
  - Meanwhile dock faults reach the owner via Roborock's own app notifications.
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
- **Old dock-error latching lore (Q Revo) is UNVERIFIED here.** On the old unit the
  device latched functional dock errors until the next wash re-validated the tank.
  The Edge 2 exposes no dock error sensor yet, so none of that has been retested.
  Treat it as history, not as current behavior.
- Run-end signals verified working on this model: `last_clean_begin` /
  `last_clean_end` populate, status goes `charging`, `cleaning_area` reports.
- `sensor.qx_revo_ultra_2_status` can hold a stale `paused` after runs —
  deliberately ignored by the dock-activity mapping.
- Guide images soften if dialogs exceed ~660px width (640px sources).
- Service intervals are **identical to the Q Revo's** (main 300 h, side 200 h,
  filter 150 h + rinse every 2 weeks, sensors 30 h, cleaning tray monthly, dust bag
  as needed) — verified against the Edge 2's own app diagrams, so the card's dialog
  text needed no edits at migration.

## App-side settings that explain observed behavior (not HA-visible)

Recorded 2026-07-22 so nobody re-diagnoses these as bugs:

- **Carpet Boost ON** — suction auto-maxes on carpet regardless of profile. The
  profiles effectively govern hard-floor suction.
- **Auto-Detach/Reinstall Mop Cloth Mounts ON** — in Vacuum / Vacuum-Carpet-First
  modes the robot makes **mid-run dock visits** to shed and re-mount pads. Expected,
  not a fault.
- **Dock Settings:** Mop Wash Frequency = Smart Mop Wash, Washing Mode = Smart Mop
  Washing, Dustbin Auto-Empty = Balanced, Empty Mode = Smart, Drying = Auto /
  Standard. All cloud-managed; these are the controls that should surface as HA
  entities once dock type 38 is mapped. No plumbed water line — on-board tank with a
  manual "Drain On-Board Water Tank" utility.
- Water Flow is a **numeric scale** in the app (e.g. 15 = "Medium"); the seven HA
  intensity names are presets on that dial.
- "Connect to the Matter Network" exists on this model — a possible future **local**
  control path (basic start/stop/mode) alongside the cloud integration. Not pursued:
  it would duplicate entities and the Roborock integration carries all the rich data.
  Noted only because it's the escape hatch if the cloud dependency ever chafes.

## Open items — ALL passive, owner validates, NO ASSISTANT ACTION

- **Upstream #896** — awaiting a maintainer. GitHub notifies the owner (auto-
  subscribed as author). No chasing.
- **Dock-activity header vocabulary** — a five-second glance at the card header
  during a dock mop wash. "Washing mops" = the Edge 2 speaks the same status
  dialect, item closed. "Docked" while the dock is audibly washing = report it, it's
  a quick vocabulary patch.
- **First away-run through the full stack** — warning → started-morph, away profile
  applied (max_plus · high · deep), profile restored at dock, History row with a
  cyan settings line.
- **First maintenance loop** — replace side brush / wipe sensors, then reset the
  counter in the app.
- Byte-verify the deployed blob vs `ac4998d5` at a convenient browser session.

**Do NOT re-offer:** folding the old Q Revo's run history into the card (owner chose
a fresh start; the orphaned recorder rows age out on their own), the rev7 history
sanitizer, or a `smart_mode` profile.

## v-NEXT wishlist (ideas only)

- "Skip next scheduled clean" one-shot toggle.
- Per-run map snapshot from a History row.
- Post-code-38 card rev (tank binaries as issue rows, writable empty mode, wash/dry
  controls) — survey first, then one deliberate rev.

## Teardown order (if ever dismantling)

1. Automations (auto-clean, profile restore, maintenance notify)
2. Helpers with label `vacuum_auto` (14) — NOT `binary_sensor.household_all_away`
   (shared, `household_presence`)
3. Dashboard: card entry + the flat-vacuum-card resource
4. `/config/www/vacuum-guides/`
5. Android channels self-clean when the app's notifications are cleared

## Repo copy

Card source + a sanitized copy of this doc scan clean of identifiers (street / IP /
station / username / hostname / account email); the "Ratman" handle is allowed.
Guide images do NOT go to the repo. Batch-synced per the repo cadence rule — the
repo being a few revs behind between deliberate syncs is expected and fine.
