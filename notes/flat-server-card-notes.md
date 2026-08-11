# flat-server-card — notes (sanitized repo copy)

NAS health + backup confidence card for an Unraid server that hosts the HA VM
itself. Answers "is the server okay and is my data safe?" in one card.
Operational values (entity ids, IPs, helper names) live in the private project
notes and the dashboard YAML — this copy documents the design and the plumbing
pattern.

## Current version

v1.5 — 35,092 B, FNV-1a `9c399239`. Header self-documents the full YAML shape
(placeholder entity ids) and per-version changelog.

## Data sources

- **ruaan-deysel/ha-unraid** (HACS; Unraid's official local GraphQL API, viewer-role
  API key): array state/usage, parity running/progress/valid, per-disk
  problem-class health sensors, pool usage, container switches, uptime,
  notifications count, container/OS update sensors, CPU temp, host RAM.
- **Core qBittorrent integration**: WebUI-truth connection state + torrent counts.
- **Core NUT integration**: UPS status/charge/load (+ battery_runtime, a
  disabled-by-default entity worth enabling).
- **whallil/ha-urbackup-monitor** (HACS custom repo): per-client last-backup
  timestamp + problem/online sensors.
- **HA native**: `sensor.backup_last_successful_automatic_backup`.
- **Core System Monitor integration**: the HA VM's own memory %/used and disk
  %/used (all four disabled by default — enable them).
- **Mounts (host-truth pattern)**: the hypervisor host's SMB mounts are invisible
  to the HA VM, so a tiny host-side cron script (~every 5 min) tests each mount's
  content subfolder (`test -d` with per-path timeout + flock) and POSTs
  `{"total":N,"up":N,"fail":["name",...]}` to a LAN-only webhook automation that
  stores it into two input_text helpers (JSON + last-report timestamp). The card
  renders per-mount status and goes amber when the heartbeat ages out — the
  reporter failing is itself visible, never a green lie.

## Design

Green-is-boring: collapsed = one quiet header row (house tile geometry: 36px
icon circle 10px from the border-box edge, text at 56px — remember your own
1px border when matching). Problems render as an alert strip (reds sorted
first) even while collapsed. Header tap = expand (grid-rows animation, no
toggle glyph); long-press any row = more-info; Array / torrent / backup-client
rows tap through to their web UIs (configurable urls). Sections: Storage /
Mounts / Services / System / Power / Backups. Alert-only checks (no row):
server notifications count, CPU temp (unit-aware default 85C/185F). Parity
next-due is derived from an `input_datetime` anchor (a companion automation
bumps it to today whenever a parity check completes, guarded on from-state
progress >= 98 so cancellations don't count). All thresholds are card YAML.
data_size sensors are unit-converted (B..TiB) for "used / total GB" labels.

Availability honesty: unavailable renders '--'/amber, never fake-green; the
backup client's image-backup sensors are ignored by design where image backups
are disabled.

## Companion automations (pattern)

- Webhook receiver: stores the mount JSON + `now()` into the two helpers.
- Parity anchor auto-bump: state trigger running on→off + progress guard.
- Problem notifications: once-per-crossing pushes (template triggers re-arm only
  after recovery) for mount down / monitor silent / disk flag / UPS on battery /
  backup stale or problem / parity overdue.

## Integration quirks worth knowing

- ha-unraid health/valid sensors are device_class `problem`: **off = healthy**.
- ha-unraid parity entities can serve a stale snapshot of the LAST check
  (e.g. "paused @ 97%") for a while after integration setup/restart — key
  health off `parity_valid`, activity off `parity_check_running` + progress.
- The NUT integration's battery_runtime and all System Monitor sensors ship
  disabled by default.
