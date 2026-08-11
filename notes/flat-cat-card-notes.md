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
camera_mode: snapshot    # snapshot (default) | live (experimental)
camera_image: eat        # eat | visit | feed (global or per feeder)
avatars: auto            # auto (photo if available) | initials
trend_days: 90           # weight-trend window, 14-365
history: true            # false disables per-cat history panels
deep_deo_suffix: deep_deodorizing   # override when the integration exposes
                                    # duplicate deep-deodorizing switches and
                                    # the second one (_2) is the live entity
```

## Feature map

- Collapsed: cat rows (avatar / weight / last litter visit; tap = history
  panel, long-press = more-info) + event-snapshot camera strip.
- Expanded: litter section + feeder rows.
- Litter: level bar (green / amber <30% / red on problem), Maint button
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
- SCHEDULE panel (v1.19): per-feeder tabs; weekly meal plan parsed from the
  integration's raw-distribution sensor attributes (feed_daily_list, 7
  weekday entries; meals grouped across identical days). Meal editor: time in
  15-min steps, grams in 5g steps, weekday dots (min one day), remove; Add
  meal. Edits are LOCAL until Save plan — the integration's
  set_feeding_schedule service REPLACES the feeder's entire weekly plan
  (device_id read from the raw sensor's attributes), so the save bar only
  appears when dirty and Cancel reverts to the live plan.
- History panels: visits/day bars (7 days, tap-to-filter), visit log with
  duration + scale weight (matched within +/-2 min), long-term weight trend
  from permanent statistics with a zero-poisoning filter (the integration
  writes literal 0 kg around reloads; daily means get poisoned — min>0 use
  mean, tainted-day use max, all-zero drop, below-half-median guard) and a
  drift-delta readout (amber at >=5% of body weight).
- Alert strip: litter low / sand-lack / bin full / hopper empty / device
  offline / frequent-use health flag / maintenance reminder. Occupied dot.
- v1.20: child panels reset with their parents — closing More closes
  Settings; collapsing the card closes Settings + Plan + any open meal
  editor. Unsaved schedule edits persist in the local model (dirty flag);
  only the open state resets.

## Version trail (FNV-1a of source)

v1.0-v1.18: see repo history (v1.18 `364d76d9`, 67,018 B).
v1.19 `a5f1bf64` (92,551 B): settings + schedule panels, More-panel 2x2
restructure, Maint promoted to stats row.
v1.20 `949cde8e` (93,229 B): parent-collapse resets child panels.

## Hosting

data-URL module resource (`data:text/javascript;name=flat-cat-card;base64,...`)
in the dashboard resource registry. Zero external dependencies, zero non-ASCII
bytes, zero helper entities. Edit -> node --check -> re-encode -> replace via
the Card Manager's guarded update flow -> hard refresh -> byte-verify.
