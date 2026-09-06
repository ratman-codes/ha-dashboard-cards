# flat-cat-card — notes (sanitized repo copy)

Consolidated household-cats card: one self-cleaning litter box + two camera
feeders (a pet-tech cloud integration) + per-cat stats. Headerless flat-card
family member. This copy is sanitized: names, prefixes, and ids are
placeholders; real values live only in the dashboard YAML inside HA.

## YAML shape

```yaml
type: custom:flat-cat-card
cats:
  - name: Cat1
    weight: number.cat1_weight
    last_use: sensor.cat1_last_use_date
    color: "#ffb74d"
  - name: Cat2
    weight: number.cat2_weight
    last_use: sensor.cat2_last_use_date
    color: "#ce93d8"
litter_prefix: my_litter_box        # entity id prefix from the integration
feeders:                            # list order = row AND camera order
  - label: Feeder 01
    owner: Cat1
    prefix: my_feeder_01
  - label: Feeder 02
    owner: Cat2
    prefix: my_feeder_02
portions: [5, 10, 20]
default_portion: 10
feed_both: true          # optional; false removes the Both row
camera_image: eat        # eat | visit | feed (global or per feeder)
avatars: auto            # auto (photo if available) | initials
trend_days: 90           # weight-trend window, 14-365
history: true            # false disables per-cat history panels
deep_deo_suffix: deep_deodorizing   # override when the integration exposes
                                    # duplicate deep-deodorizing switches and
                                    # the second one (_2) is the live entity
feeding_presets:         # optional (v1.21+): named full-plan presets
  - name: Home
    plans:
      my_feeder_01:      # feeder PREFIX -> its complete meal list
        - { time: "5:00p", name: Snack, amount: 10 }
      my_feeder_02:
        - { time: "5:00p", name: Snack, amount: 10 }
  - name: Traveling
    plans:
      my_feeder_01:
        - { time: "9:00a", name: Morning, amount: 20 }
        - { time: "5:00p", name: Afternoon, amount: 10 }
        - { time: "9:00p", name: Night, amount: 20 }
      my_feeder_02:      # days: selects weekdays (default all 7)
        - { time: "9:00a", name: Morning, amount: 20, days: [sun, tue, thu, sat] }
        - { time: "9:00a", name: Morning, amount: 10, days: [mon, wed, fri] }
        - { time: "5:00p", name: Afternoon, amount: 10 }
        - { time: "9:00p", name: Night, amount: 20 }
```

## Feature map

- Collapsed: cat rows (avatar / MEASURED weight / last litter visit; tap =
  history panel, long-press = more-info on the profile weight entity) +
  event-snapshot camera strip. Since v1.25 the row weight is the smoothed
  scale average the history panel calls "avg" (5-point moving average over
  zero-filtered daily long-term-statistics means, one statistics call for
  all cats at load, refetched when a cat's last_use changes); fallback =
  last scale reading, then "--". The profile `number.*_weight` is a value
  typed into the app, not a measurement, so it is never shown silently.
- Expanded: litter section + feeder rows.
- Litter: level bar (green / amber at 30% or below / red on problem), Maint button
  (starts maintenance directly), More = even 2x2 grid (Clean / Level litter /
  Pause / Settings). Maintenance mode is a guarded amber panel (Dump litter is
  hold-2s, explicit Done exit, app-side starts auto-detected).
- SETTINGS panel (v1.19): grouped CLEANING / DEEP CLEANING / DEODORIZING /
  BOX. Instant writes: toggles -> switch.turn_on/off, cleaning-delay stepper ->
  number.set_value (debounced 800ms), repeat-interval stepper + litter-type
  chips -> select.select_option. 8s optimistic overlay per control. The
  integration only exposes on/off for scheduled cleaning / scheduled
  deodorizing / screen display — the times-of-day stay app-side.
- Feeders: visits + dispensed/planned grams + bowl state, portion chips +
  Feed (writes the manual-feed text entity), optional Both row, 5s Undo via
  the cancel button entity.
- FEEDING PLANS POPUP (v1.22; replaced the v1.19 inline panel): Plan opens a
  fixed-overlay modal in the card's shadow root (theme-var chrome, closes on
  X / scrim tap / Escape; parent-collapse closes it too). Weekly meal plans
  parsed from the integration's raw-distribution sensor attributes
  (feed_daily_list, 7 weekday entries; meals grouped across identical days);
  BOTH feeders render stacked as color-keyed sections (owner-cat colors).
  Meal editor: time in 15-min steps, grams in 5g steps, weekday dots (min
  one day), remove; Add meal per feeder. Edits are LOCAL until Save plans —
  the integration's set_feeding_schedule service REPLACES a feeder's entire
  weekly plan (device_id read from the raw sensor's attributes), so Save
  writes ONLY feeders whose drafts are dirty; Discard reverts to live. The
  header carries a truth readout (active preset / custom / draft pending).
- FEEDING PRESETS (v1.21, popup-integrated v1.22): YAML-defined named plans
  spanning both feeders. The PLAN chip row is a VIEW SWITCHER: highlight =
  what you are viewing, a check marks the ACTIVE preset — detected by
  comparing live plans against each preset (set equality per feeder on
  time+name+amount+days; any drift reads "custom", the highlight never
  lies). Preset views are read-only previews; Apply (inactive presets only)
  writes both feeders in one informed tap, then holds an optimistic
  "applied/syncing" state (<=10 min) until the cloud-polled sensor catches
  up. LOAD INTO EDITOR (any preset view) copies the preset's meals into the
  Current draft ("loaded from X" tag) for tweaking — nothing touches the
  feeders until Save plans.
- History panels: visits/day bars (7 days, tap-to-filter), visit log with
  duration + scale weight (matched within +/-2 min), long-term weight trend
  from permanent statistics with a zero-poisoning filter (the integration
  writes literal 0 kg around reloads; daily means get poisoned — min>0 use
  mean, tainted-day use max, all-zero drop, below-half-median guard) and a
  drift-delta readout (amber at >=5% of body weight).
- Alert strip: litter low / sand-lack / bin full / hopper empty / device
  offline (device-reported; red bar) or UNAVAILABLE (HA has no reading —
  amber, rows dimmed; a single "unavailable" line when every device is
  unknown) / frequent-use health flag / maintenance reminder. Occupied dot.
  Availability rule (v1.23): unknown never renders as good — a missing or
  unavailable bin sensor prints "bin --", not "bin OK"; Settings rows whose
  entity is missing/unavailable dim with "--" and cannot fire a service.
- v1.20: child panels reset with their parents — closing More closes
  Settings; collapsing the card closes Settings + Plan + any open meal
  editor. Unsaved schedule edits persist in the local model (dirty flag);
  only the open state resets.

## Version trail (FNV-1a of source)

v1.0-v1.18: see repo history (v1.18 `364d76d9`, 67,018 B).
v1.19 `a5f1bf64` (92,551 B): settings + schedule panels, More-panel 2x2
restructure, Maint promoted to stats row.
v1.20 `949cde8e` (93,229 B): parent-collapse resets child panels.
v1.21 `be43bb09` (101,516 B): feeding presets (chip row, live-comparison
active detection, apply-to-both).
v1.22 `9240566b` (109,794 B): schedule UI moved to a popup modal; preset
previews + load-into-editor; both feeders stacked; save-only-dirty.
v1.23 `d2ab293b` (111,725 B): availability honesty (three-valued bin,
device online/offline/unknown, Settings rows dim when unreadable).
v1.24 `964371be` (117,555 B): audit bundle — plans-popup errors clear on the
next action; Apply disabled with a named reason / Save names an unwritten
feeder when a raw sensor is missing; inert `camera_mode` option removed;
`set hass` re-renders only when one of the card's own entities changed
identity (timed windows still render); Escape listener re-armed on
reconnect and de-duplicated; exiting-maintenance label times out; long-press
on the primary button only + user-select none on long-press zones; an open
history panel refetches on a new visit; quoted portions coerced; dead code
and header drift removed.
v1.25 `8cdbd3aa` (121,341 B): cat rows show measured weight (see Feature
map); row and panel share the statistics filter/smoothing/unit helpers.

## Audit (2026-09-06)

A full read of the v1.22 source against a code/robustness checklist
(availability handling, documented-but-inert options, config-shape
robustness, lifecycle, render cost, pointer handling, dead code). Every
behavioral finding was reproduced in a jsdom harness before it was reported
and fixed; no-visible-change items were bundled into one version and proven
by a render-identity check against the previous version. One finding was
parked by the owner: after Save plans the editor re-syncs to the live plan
and may briefly show the old plan until the cloud poll catches up — the fix
would display what was saved rather than what the feeders report, so it
waits on a live observation.

## Hosting

data-URL module resource (`data:text/javascript;name=flat-cat-card;base64,...`)
in the dashboard resource registry. Zero external dependencies, zero non-ASCII
bytes, zero helper entities. Edit -> node --check -> re-encode -> replace via
the Card Manager's guarded update flow -> hard refresh -> byte-verify.
