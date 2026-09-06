# flat-weather-card — sanitized notes

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-weather-card v1.6 (v1.2 dew line 2026-07-17; v1.3 chip delta 2026-07-19; v1.4 auto-fallback + v1.5 named backup tag 2026-08-04; v1.5.1 comment de-localization same day; v1.6 audit bundle 2026-09-06)
Merged weather card; all entity ids/URLs in YAML (source location-clean).
Header w/ station conditions + dew/humidity line (dew thresholds: plain <60°F,
#ffc107 60–65, #ff9c4a ≥65), forecast-vs-actual chip with signed delta, 12h
hourly SVG curve, 5-day strip, press feedback, configurable tap-throughs.
Forecast data via weather/subscribe_forecast (hourly + daily + fallback daily);
daily deduped, null-high days skipped except today's (kept with a `--` high
so the strip keeps its width after the source drops the day's high ~3pm, v1.6).

**Auto-fallback (v1.4/v1.5):** optional `fallback_entity` (a second weather
entity — the owner uses a nearby backup PWS) takes over the header current
conditions, today's H/L, and the 5-day strip whenever the primary station
entity reads unavailable/unknown; optional `fallback_dew_entity` keeps the dew
line honest (the primary's dew sensor was observed FREEZING at its last value
during station outages instead of going unavailable, so it is deliberately
ignored in backup mode); optional `fallback_name` labels the mode
"<name> (backup)" on the condition line (bare "Backup" if unset). Flips back
automatically when the primary reports again, and restarts the daily forecast
subscriptions on the unavailable→available transition so pushes resume. The
whole mechanism is card-side + YAML — no helpers or automations.
v1.5.1 is a comment-only sanitization fix (a header-comment example had named
a real neighborhood; scrubbed so the public copy stays location-clean while
remaining byte-identical to the deployed blob).

**v1.6 — 2026-09-06 source audit (code/robustness lens; one version, owner's
choice).** Timing: the hourly curve and the 5-day strip were push-only — with
no new forecast push the hour labels and "now" dot froze at the last push and
the strip's Today label stayed on yesterday after midnight; now both sections
re-evaluate against the clock on a once-a-minute tick piggybacked on `set hass`
(no timer), and forecast subscriptions restart when EITHER the daily or the
hourly entity comes back from missing/unavailable (was daily only — the two
sources are typically different integrations, and a subscribe made before the
hourly one loads failed silently and was never retried). Axis: hour labels are
absolutely positioned at each point's own x (they were a flex `space-between`
row, up to ~27 px off their points at a 430 px column); card height unchanged.
Wind: no compass point when calm or when the bearing is missing/non-numeric; a
cardinal string passes through (v1.5.1 printed `Wind 0 mph N` / `undefined`).
Staleness: the strip + today's H/L dim when the daily source AND the fallback
are both unavailable, the curve dims when the hourly source is — the last
forecast stays visible, dimmed, instead of full-strength stale numbers under an
"Unavailable" header. Pointer: long-press on the primary button only; cancel
listeners on the `ha-card` element (`pointerleave` doesn't bubble, so the old
shadow-root listener never cancelled a press dragged off the card);
`window.open(..., 'noopener')`; `.day:hover` inside `@media (hover: hover)`;
`user-select: none` on press zones. Render gate: `set hass` renders only when
one of the card's entity ids (harvested from the config) changed identity, plus
the minute tick. Lifecycle: a second `setConfig` ends the old subscriptions and
re-applies `accent`; `getStubConfig` is valid. Verified with a two-direction
jsdom harness (bug-mode on v1.5.1, fixed-mode on v1.6), a render-identity check
(header/chip/strip byte-identical in a healthy state) and a Chromium render at
430 px (label offsets → 0, height identical).
