# flat-server-card — notes (sanitized repo copy)

NAS health + backup confidence card for an Unraid server that hosts the HA VM
itself. Answers "is the server okay and is my data safe?" in one card.
Operational values (entity ids, IPs, helper names, URLs) live in the private
project notes and the dashboard YAML — this copy documents the design and the
plumbing pattern.

## Current version

v1.7 — 40,360 B, FNV-1a `f50f9a37`. Header self-documents the full YAML shape
(placeholder entity ids) and per-version changelog.

v1.7 adds **live wattage to the Power → Load row**: with the realpower entities
configured the row reads `current / total W · load%` (the watts and the
separator dot dim, the percent normal); absent config falls back to the plain
`load%`. See the Power section below for the YAML keys.

v1.6 adds the **Outside** section: one row showing what an OFF-SITE uptime
monitor sees, so the card can also answer "is my monitoring alive and is the
house reachable from the internet?" — the two things nothing inside the house
can know about itself.

## Data sources

- **ruaan-deysel/ha-unraid** (HACS; Unraid's official local GraphQL API, viewer-role
  API key): array state/usage, parity running/progress/valid, per-disk
  problem-class health sensors, pool usage, container switches, uptime,
  notifications count, container/OS update sensors, CPU temp, host RAM.
- **Core qBittorrent integration**: WebUI-truth connection state + torrent counts.
- **Core NUT integration**: UPS status/charge/load (+ battery_runtime and, for
  the v1.7 wattage row, realpower / nominal-realpower — all disabled-by-default
  entities worth enabling; a nameplate literal can stand in for the total).
- **whallil/ha-urbackup-monitor** (HACS custom repo): per-client last-backup
  timestamp + problem/online sensors.
- **HA native**: `sensor.backup_last_successful_automatic_backup`.
- **Core System Monitor integration**: the HA VM's own memory %/used and disk
  %/used (all four disabled by default — enable them).
- **Core Uptime Kuma integration** (HA 2025.8+, no HACS) pointed at an
  Uptime Kuma instance running OFF-SITE (a free-tier cloud VPS that pings the
  house over a Tailscale tunnel and posts to Discord). Each Kuma monitor becomes
  a "Status" sensor (up / down / pending / maintenance) plus response-time and
  uptime-% sensors. When HA cannot reach Kuma at all the sensors go
  unavailable — the card reports that as "no data", which is the
  "outside observer itself died" signal.
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
toggle glyph); long-press any row = more-info; Array / torrent / backup-client /
Outside rows tap through to their web UIs (configurable urls). Sections:
Storage / Mounts / Services / System / Power / Backups / Outside. Alert-only
checks (no row): server notifications count, CPU temp (unit-aware default
85C/185F). Parity next-due is derived from an `input_datetime` anchor (a
companion automation bumps it to today whenever a parity check completes,
guarded on from-state progress >= 98 so cancellations don't count). All
thresholds are card YAML. data_size sensors are unit-converted (B..TiB) for
"used / total GB" labels.

Outside row (v1.6): `outside_monitors: [{name, entity}]` lists the Kuma status
sensors to show; the row reads `● Outside · VPS ok · Cloud ok · 40s ago`.
`outside_checked` names any sensor Kuma re-reports every poll (response time is
the natural pick) — its `last_updated` drives the "checked N ago" suffix, because
status sensors only change on transitions and would read stale while healthy.
Amber alerts: a monitor `down`, a monitor with no data, ALL monitors unavailable
("Outside monitor unreachable"), or the last check older than
`thresholds.outside_stale_min` (default 5). `pending` shows as text without
alerting (the monitor is retrying). `outside_url` = the row's tap-through.

Power → Load wattage (v1.7): `ups_realpower` names the live-watts sensor;
`ups_realpower_total` is either an entity id (a nominal/nameplate sensor) or a
literal number for the max VA/W. With `ups_realpower` present the Load row reads
`current / total W · load%` (watts + separator dim, percent normal); the total
is omitted if only `ups_realpower` is set; neither key = the original plain
`load%`. Values round to whole watts.

Availability honesty: unavailable renders '--'/amber, never fake-green; the
backup client's image-backup sensors are ignored by design where image backups
are disabled.

## Companion automations (pattern)

- Webhook receiver: stores the mount JSON + `now()` into the two helpers.
- Parity anchor auto-bump: state trigger running on→off + progress guard.
- Problem notifications: once-per-crossing pushes (template triggers re-arm only
  after recovery) for mount down / monitor silent / disk flag / UPS on battery /
  backup stale or problem / parity overdue.
- Container stopped: any container switch off for 15 min → message; off→on after
  a ≥15-min outage → "running again". The 15 min clears a nightly
  appdata-backup plugin's stop window and a delayed-autostart container, so
  neither false-alarms.

## Integration quirks worth knowing

- ha-unraid health/valid sensors are device_class `problem`: **off = healthy**.
- ha-unraid parity entities can serve a stale snapshot of the LAST check
  (e.g. "paused @ 97%") for a while after integration setup/restart — key
  health off `parity_valid`, activity off `parity_check_running` + progress.
- ha-unraid also creates switch/binary_sensor entities for Docker's random-named
  throwaway containers (one-shot `docker run --rm` jobs); ignore them and never
  list them in `containers:`.
- The NUT integration's battery_runtime and all System Monitor sensors ship
  disabled by default.
- Uptime Kuma status sensors' `last_updated` is not a freshness signal (they only
  change on transitions) — hence `outside_checked`.
