# flat-music-card — design notes (sanitized repo copy)

Whole-home music control card for a Music Assistant sync group, in the flat-* card
family. Built + iterated to v1.21 in one session (2026-07-27); extended to v1.25
(2026-07-28: shared lock helper, follow-the-leader automation, mute-wins policy).
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
    title / group_label / start_open / show_progress / lock_default

## Known upstream context
Built against MA 2.9.9, whose sync groups are Sendspin-bridge based (AirPlay/
Cast bridges only - no Squeezelite bridge). Related upstream issue filed from
this project: music-assistant/support#5929 (stale cached AirPlay volume asserted
at session start + DACP feedback dropped); a companion HA guard automation
counters it until fixed.

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
