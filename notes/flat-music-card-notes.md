# flat-music-card — design notes (sanitized repo copy)

Whole-home music control card for a Music Assistant sync group, in the flat-* card
family. Built + iterated to v1.21 in one session (2026-07-27); extended to v1.25
(2026-07-28: shared lock helper, follow-the-leader automation, mute-wins policy),
v1.26 (2026-07-30: anchored volume-scaling mode), v1.27 (2026-09-06: source
audit - availability honesty, mute-wins on the muted row, hygiene bundle) and
v1.28 (2026-09-06: dropped-member flag).
Deployed as a data-URL Lovelace resource via the Card Manager card; this repo copy is archive only.
Full private notes (real entity ids, inventory, upstream-bug forensics) live in the
"NAS / Smart Home" Claude project (`claude/flat-music-card-notes.md`).

## What it does
- Header = mini-player: album art, title/artist, prev/play/next. Whole header
  expands/collapses the body (amber hover, .35s grid-rows). Auto-expands at load
  when something is playing (load-time only, never auto-toggles afterward).
- The card follows the ACTIVE output: group playing wins, else a solo-playing
  room, else an armed selection.
- Expanded: source line (ACTIVE OUTPUT · APP, "LIVE" suffix for duration-less
  streams e.g. Spotify Connect / network-audio passthrough), shuffle / seek
  -30 / stop / +30 / repeat, scrubber progress line (click/drag seeks, hidden
  for LIVE), group master volume row above per-room rows.
- Room rows: tick = join/leave the sync group; label click = switch output there
  (music_assistant.transfer_queue while playing, arm-as-target when idle; live
  output green + note glyph); slider = volume; number tap = mute where the
  player supports it (amber M).
- Strip (order + labels YAML-configurable): MA-panel navigation chip, playlist
  picker chip (live list of MA-favorited playlists via the
  music_assistant.get_library action - hearts curate it; NOTE: the service 400s
  if given a pagination arg), balance split-chip (apply baselines | ratio-lock
  toggle | baseline editor), optional cast toggle chip (renders when
  cast_on_script is set; green when the active stream matches cast_match).
- Balance system: per-room baseline values live in input_number helpers
  (balance_entity per room) = single source of truth shared with automations.
  Ratio-lock: dragging one room slider scales the others to hold the baseline
  ratio. Baseline editor: draft-only steppers + typable values + "capture
  current volumes"; save (input_number.set_value) is the only write path,
  reset/close discards.
- Shared lock (v1.22): lock_entity binds the ratio-lock chip to an
  input_boolean the card reads/writes (optimistic hold, follows external
  toggles) - so an HA automation can share the same lock state. Companion
  pattern: a "follow the leader" automation that, while the lock helper is on
  and the group plays, scales the other rooms to the baseline ratio whenever
  the leader room's volume changes (the MA Companion desktop app syncs the
  PC's OS volume into its player, so OS volume keys drive the whole house).
  Cards only run while a dashboard is open - always-on behavior belongs in
  the automation; the helper is the shared state.
- Mute policy (v1.24/v1.25): MA quirk - volume_set on a muted player audibly
  un-mutes it while is_volume_muted stays true (stale mute UI). Policy: MUTE
  WINS on incidental writes (lock-scaling and the follow automation skip
  muted rooms; the group master slider switches to client-side proportional
  scaling of unmuted members while any member is muted, since MA's server-side
  fan-out cannot be intercepted); balance apply is the deliberate exception -
  it explicitly un-mutes (volume_mute false) then restores baselines.
  v1.27 extends mute-wins to the muted row itself: a muted room's slider (and
  the group slider while the group is muted) is inert - tap the mute number
  to un-mute first. Before v1.27 the drag went through, which audibly
  un-muted the room while the UI kept showing it muted.
- Anchored scaling mode (v1.26): equal slider RATIOS are not equal LOUDNESS -
  each device maps slider%->dB with its own taper, so linear ratio-lock only
  matches at the calibration point. Fix: mode_entity (an input_select,
  linear|anchored) + per-room low_entity/high_entity anchor helpers. Anchored
  mode moves rooms along per-room piecewise power curves through three
  ear-calibrated anchor rows (LOW / BASE / HIGH; BASE = the balance helpers,
  shared with linear mode) - each segment is linear in LOG space (knee at
  BASE): the follower travels the same ratio-fraction between its anchors as
  the leader does between its own. Extrapolates past the anchors, clamps
  0-100, falls back to linear per-room when anchors are missing. Gear panel
  gains a linear/anchored toggle (writes the input_select so companion
  automations flip in lockstep) and a 3x3 typable anchor grid: tap a column
  header to ARM it (arming exists solely to tell "capture current" which
  column receives the live room volumes), draft/save/reset rules unchanged.
  Lock-scaling inverts the dragged room's own anchors to a log-level, then
  maps every other room to that level. Companion-automation gotcha worth
  repeating: HA stores script `variables:` KEY-SORTED and evaluates them in
  that order - a variable template referencing a sibling that sorts later
  silently sees Undefined; make each variable template fully self-contained.

## Source audit (v1.27, 2026-09-06)
Nine findings on the v1.26 source, each reproduced in a jsdom harness that runs in
both directions (bug-mode on v1.26, fixed-mode on v1.27) plus a render-identity
check (healthy states render byte-identical markup; anchored lock-drag issues
identical service calls). Shipped in one version:
1. Availability honesty: when the active target (group, or the armed room) is
   unavailable/unknown/missing, the header used to read "Idle" and prev/play/next
   still fired at the dead entity (lived once: the MA integration stuck in a setup
   error). Now "Unavailable" (amber) on the sub-line and source line; transport,
   shuffle, stop and repeat dim and inert. A solo-playing room still wins.
2. Muted-row slider inert (above). The group slider is also inert while the group
   entity is unavailable (room sliders already were).
3. Playlist picker: one failed get_library used to stick for the whole page session
   (reopen never retried); now reopen retries, and every open refreshes the list in
   the background behind the cached one (a quiet refresh that fails keeps the old
   list).
4. Root-level listeners are bound once - a second setConfig on a live element (the
   dashboard editor preview) used to double every tap; setConfig also resets
   picker/editor state.
5. set hass re-renders only when one of the card's own entities changed identity
   (ids harvested from the config at any depth); the 1 s tick repaints when an
   optimistic hold expires so a miss is bounded.
6. Baseline/anchor save: the saved draft is held until the helpers echo it (or 8 s),
   instead of snapping back to the old value if an unrelated state push lands first.
7. Lock chip dims (tap ignored) while lock_entity is unavailable, rather than
   reading as plain off.
8. Config shape: quoted numeric `balance: "70"` and `lock_default: "false"` honored;
   slider drags start on the primary pointer button only; strip labels HTML-escaped;
   dead code and a stale header intro cleaned.
Harness gotchas for the next edit: jsdom needs `runScripts: "outside-only"` for an
eval'd source to see HTMLElement; it has no PointerEvent (dispatch MouseEvents named
pointerdown/move/up with button 0); stub getBoundingClientRect on sliders;
MutationObserver records need takeRecords() before disconnect(); the render gate
compares state-object identity, so fixtures must keep untouched entities' objects.

## Dropped-member flag (v1.28)
Motivation: a flaky bridge member (a 2.4 GHz ESP32 endpoint) falling out of the
sync group mid-play used to leave no trace beyond a silently unticked row. Now a
room that was in the group and leaves it (or goes unavailable) while the group
keeps playing gets an amber "!" tick, amber name and a "dropped Nm" age on its row
(the row's name column widens, its slider shortens), and the album art shows an
amber corner dot so it is visible collapsed. Rules: shown only once the drop has
lasted `drop_show_s` (30 s - short drops that self-heal stay silent); cleared when
the room rejoins, when the group stops playing (a pause dissolves the group on
MA 2.10, so an episode never outlives playback), or after `drop_max_s` (600 s); a
room unticked from the card itself is never flagged (15 s grace); the first
observation is never a drop. Limits (by design): card-side memory only - it sees
drops that happen while a dashboard is open; it cannot tell a device dropout from
an unjoin done in the MA app; it cannot say why. `drop_show_s: 0` disables it.
Verified in jsdom (drop/heal/pause/pause-race/self-unjoin/unavailable/expiry/HA
restart/first-observation scenarios) and rendered in headless Chromium at 430 px.

## YAML shape (placeholders)
    type: custom:flat-music-card
    group_entity: media_player.my_sync_group
    config_entry_id: <music assistant config entry id>   # for the picker
    ma_path: /<ma panel path>
    rooms:
      - entity: media_player.room_a
        name: Room A
        balance_entity: input_number.balance_room_a   # or balance: 40
    cast_on_script: script.my_cast_script    # optional cast chip
    cast_off_script: script.my_uncast_script
    cast_label: pc / cast_match: vban_receiver
    labels: { ma: browse, playlists: music, balance: link, lock: hold }
    strip_order: [ma, playlists, cast, balance]
    lock_entity: input_boolean.my_music_lock   # shared ratio-lock state
    mode_entity: input_select.my_scaling_mode  # linear | anchored (v1.26)
    # per room (anchored mode): low_entity / high_entity input_numbers
    title / group_label / start_open / show_progress / lock_default
    drop_show_s: 30 / drop_max_s: 600   # dropped-member flag (v1.28; 0 = off)

## Known upstream context
Built against MA 2.9.9, whose sync groups are Sendspin-bridge based (AirPlay/
Cast bridges only - no Squeezelite bridge). Related upstream issue filed from
this project: music-assistant/support#5929 (stale cached AirPlay volume asserted
at session start + DACP feedback dropped); a companion HA guard automation
countered it until fixed.

MA 2.10.0 (stable, 2026-08-27) changed the ground under the card; nothing in the
card needed to change, but consumers should know:
- 2.10 rebuilt one bridged player instead of migrating it, so its HA entity id
  changed - search ALL of HA config for the old id (dashboards, automations,
  scripts), not just the card YAML. A script that targeted the old id kept
  "working" thanks to continue_on_error and silently skipped that room.
- #5929 is fixed on 2.10 stable (track skips no longer re-assert the volume);
  the guard automation is disabled and kept as a backup.
- The per-player AirPlay `sync_adjust` is LIVE on 2.10 (it was inert on 2.9's
  bridge path): negative = earlier, positive = later. All sync tuning can live
  in MA now; device-side audio delays can go to 0.
- Pause on a Sendspin-led sync group drops the AirPlay-bridge members without a
  stop/flush, so they keep playing until their buffers drain (~4-5 s); HA then
  reports the group and every member as `idle`, never `paused`. The card's
  active-target logic falls through to the group entity, which is correct
  (play re-forms the group). Filed as music-assistant/support#6195.
- Sync-group members "unticking themselves" on play now has three distinct
  causes: protocol ineligibility (the 2.9 lesson), a wedged group after
  protocol toggling (restart the MA add-on, then reload HA's MA config entry),
  or a bridge member whose AirPlay side MA has lost after a device dropout -
  2.10 does not re-discover it when the device returns; only an MA add-on
  restart re-registers the AirPlay protocol. None of these are the card.
- `volume_set` on a muted player still audibly un-mutes it on 2.10; the
  mute-wins policy stands.

## Version history (2026-07-27, sizes/FNV-1a as shipped)
v1.0 30378 6918cef5 initial · v1.1 30890 e664bd25 header mini-player, shuffle/
repeat, master-on-top, picker fix · v1.2 32886 470cc17a expand-anywhere, bigger
transport, ratio-lock · v1.3 34639 21714fe2 stop + seek · v1.4 41547 404ffd0f
retargeting + source line + label-pick + mute · v1.5 41649 0e5f8104 mute pill ·
v1.6 41872 c5d8c89c header hover · v1.7 43483 dc599639 scrubber · v1.8 43614
ca1bf7bc scrubber binding fix · v1.9 43939 865191de LIVE tag · v1.10 44629
a4a8ecda lock default on, amber hovers, auto-expand · v1.11 45032 504386b1
amber lock, white control hovers · v1.12 45783 98ac9018 balance_entity helpers ·
v1.13 55154 5e1a53be baseline editor · v1.14 55546 be5cf10f split-chip gear ·
v1.15 57634 d74d2bfc cast toggle · v1.16 58097 6aa7a471 configurable labels ·
v1.17 58199 46e797e9 lock into split chip · v1.18 58596 0c5af426 strip_order ·
v1.19 58759 31fcf4b7 zone stretch · v1.20 58884 5666dbe8 chip height fix ·
v1.21 60776 77091fde typable baseline values.

2026-07-28: v1.22 61890 ff5a98a5 lock_entity binding · v1.23 62074 7ba87d3c
labels.lock revived (dead since the v1.17 split-chip fold-in) · v1.24 62565
ef038953 balance apply un-mutes explicitly (stale-mute fix) · v1.25 64923
6058c37e mute-wins on all incidental volume paths.

2026-07-30: v1.26 78847 805dcf99 anchored scaling mode (mode toggle, 3x3
anchor grid with column-armed capture, log-space piecewise lock-scaling).

2026-09-06: v1.27 85752 8c395d58 source-audit pass (see "Source audit" above);
healthy-state render byte-identical to v1.26.

2026-09-06: v1.28 90004 3f9d956c dropped-member flag (amber row tag + art dot,
30 s grace, cleared on rejoin / pause / 10 min; drop_show_s / drop_max_s).
