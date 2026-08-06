# flat-security-card — notes (sanitized repo copy)

Collapsible Alarmo security card in the flat design language. Design lineage:
three mockup variants (status-hero / camera-forward "watchtower" / collapsible
"sentinel row"); shipped as the sentinel row wrapping the watchtower body.
Full working notes (real entity ids, deploy state, version hashes) live in the
private project archive — this copy is the spec.

## Anatomy

- **Header (the sentinel):** state-colored shield (grey disarmed / amber arming /
  orange entry-delay / blue+check armed / red+alert triggered), state word in the
  flat-hero type (22px, weight 400), summary sub-line, a notable-glyph slot
  (amber icons for open sensors — dashed when bypassed; green person glyph while
  camera occupancy is on; empty = all quiet), chevron. A 3px countdown strip
  pins to the header's bottom edge during exit/entry delays, so the collapsed
  row still shows the countdown. Header zone toggles collapse (edge-to-edge
  hover wash, 0fr↔1fr grid-rows animation); shield taps to the alarm more-info.
- **Camera block:** 16:9 still refreshed every `camera_refresh` s while
  expanded; top-left chip group = camera label chip (green dot = stream alive,
  "NO SIGNAL" when the entity is unavailable; taps through to `frigate_url`
  when configured) + PERSON chip (rendered only while occupancy is on).
  Top-right is deliberately left empty for the camera's own burned-in timestamp
  OSD. Bottom-right = last-person stamp, taps to the snapshot image entity.
  Surface taps to camera more-info.
- **ARM/DISARM strip:** 42px, press-state feedback, ~8s optimistic hold.
  Disarmed → arm away (normal exit delay); arming → the strip splits into
  CANCEL + ARM NOW (ARM NOW calls Alarmo's dedicated `skip_delay` service to
  cut the running exit delay short — note the `alarmo.arm` field is
  `skip_delay`, singular; the plural spelling is rejected outright);
  pending/armed/triggered → disarm. Ghosted when the alarm entity is
  unavailable.
- **Perimeter list:** per-sensor rows with icon (door/slider/window/window2),
  relative last-changed, and state: OPEN (amber, sorts up) · closed /
  "guarding" while armed · **BYPASSED** (dashed orange + open-duration — any
  open sensor while armed_away; Alarmo's silent all-session bypass made
  visible) · cause row red during pending/triggered (list collapses to the
  cause only) · "no signal" for unavailable (never rendered as closed).
  Quiet twins sharing a `group:` merge into one row; battery badge inline only
  below `battery_low` (default 25%).
- **Triggered:** whole card surface pulses (slow 1.6s breathe) with a red
  border — a debrief, not a strobe; the house alarm does the shouting.

## Config

`alarm` (required, Alarmo panel) · `sensors` (required: entity, name, icon,
optional battery, optional group) · `camera` / `occupancy` / `last_person` /
`frigate_url` (optional; camera block hidden without camera) ·
`collapsed_default` (false) · `exit_delay` / `entry_delay` (60/15 — countdowns
are computed card-side from the alarm's last_changed plus these values, since
Alarmo exposes no remaining time; keep in sync with the Alarmo config) ·
`battery_low` (25) · `camera_refresh` (10) · `camera_name` (chip label).

Two-placement pattern: the same card runs pre-expanded on a security view
(`collapsed_default: false`, replacing a stock alarm panel + sensor list +
camera cards) and as a collapsed one-line sentinel on the main dashboard.

## Conventions honored

Theme-chrome surface (background/border/radius from the theme's card variables
— surfaces follow the theme; only ACCENT hexes are hardcoded). Hardcoded state
accents. Press feedback over hover on large regions; hover wash only on the
header toggle zone and small chips. more-info tap-throughs everywhere.
Availability honesty (unavailable is never rendered as a safe state).
Idempotent DOM updates; 1s tick only during countdowns, 30s otherwise.
ASCII-clean source; zero dependencies; data-URL resource hosting.

## Version history (see project archive for hashes)

- v1.0 — initial build from the mockup; 9-state mock-hass harness verified in
  headless Chromium before delivery.
- v1.1 — owner feedback: state word restyled to the flat-hero type; "no person"
  chip removed (person chip now presence-only, top-left, keeping the camera's
  timestamp corner clear); `frigate_url` link chip added.
- v1.2 — chrome matched to the theme's cards exactly (bg/border/radius via
  theme variables, drop shadow removed, persistent header band removed —
  header is flush, hover-wash only).
- v1.3 — title weight 300→400; header icon/text offsets aligned to the
  dashboard's tile cards (icon center and text start match the neighboring
  mushroom tiles, measured from a live screenshot).
- v1.4 — ARM NOW: the strip splits into CANCEL + ARM NOW during the exit
  delay. Shipped calling `alarmo.arm` with `skip_delays: true` (plural) —
  Alarmo rejects the whole call ("extra keys not allowed"); the live test
  failed. Superseded same night.
- v1.4.1 — ARM NOW rebuilt on Alarmo's dedicated `alarmo.skip_delay` service
  (verified against the live service schema); live-tested working.
