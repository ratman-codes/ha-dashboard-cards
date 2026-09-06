# flat-sensor-stack-card — sanitized notes

*(Created 2026-09-06 with the card's first source audit; the card had no per-card notes file before. Mirrors the private project's per-card doc — updated only by ships of this card.)*

## What it is
Collapsible stack of compact sensor history graphs on the main dashboard (default rows:
desk temperature, CO2, humidity over 24 h from one SwitchBot Meter Pro CO2). Row 0 is
always visible; its top-right label is the expand/collapse toggle. Hovering a graph
scrubs history (floating value + time pill above a dot on the curve); tapping a row
opens the native more-info dialog. Zero external dependencies; no HA entities created.

## Config
The whole live config is `type: custom:flat-sensor-stack-card` (the default rows and
CO2 thresholds — 0 green / 800 amber / 1200 red — are baked into `DEF_ROWS`). Optional
keys: `hours` (default 24; coerced to a positive integer since v1.3, default row labels
read "<hours>h") and `rows` (`[{entity, name, color, decimals, thresholds: [{value,
color}, ...]}]`; row 0 is the title row; a non-array value falls back to the defaults).

## Design notes
- History: one `history/history_during_period` WS call for all rows (compressed `{s, lu}`
  rows; REST `history/period` fallback), hourly-averaged buckets like the native sensor
  card's `detail: 1`, refreshed every 5 minutes while connected; the last point is pinned
  to the live state so the curve ends "now". Since v1.3 the pin and the line colour are
  re-evaluated on every state change of that row (one path redraw for the changed row).
- Colour (v1.4): rows with `thresholds` paint the line and fill BY HEIGHT — one vertical
  `<linearGradient>` in graph coordinates (`gradientUnits="userSpaceOnUse"`) with a hard
  stop pair at each threshold's y, end colours taken from the value at the graph's top and
  bottom edges, thresholds outside the drawn range skipped. The curve is green where it
  was green and red where it was red; the fill's band edges faintly mark the threshold
  levels. Rows without thresholds keep their fixed colour; unavailability is carried by
  the 40 % row dim (v1.3's neutral-grey line belonged to the current-value scheme).
- Curve: quadratic-through-midpoints (the native sparkline's shape). That path passes
  `(P[k-1] + 6 P[k] + P[k+1]) / 8` at each interior data point; the scrub dot is placed
  there (v1.3) so it sits on the drawn line, while the tooltip shows the true bucket value.
- Lifecycle: refresh timer starts in `connectedCallback` (or in `set hass` while
  connected) and clears in `disconnectedCallback`; `_fetchHistory` carries a sequence
  guard so a slow response never overwrites a newer one; a second `setConfig` (card
  editor) re-renders, refetches and collapses the stack.
- Availability: unavailable/unknown reads `--` with the row dimmed; non-numeric history
  rows are skipped; a lone bucket with no live pin draws nothing; a failed refresh keeps
  the previous curve silently (audit item 5, left as-is by owner decision).

## 2026-09-06 source audit (v1.2 → v1.3)
Six findings, jsdom harness in both directions (28 cases bug-mode on v1.2, 28 fixed-mode
on v1.3), healthy-card shadow DOM byte-identical between versions, Chromium render at
430 px; shipped as one version:
1. Line colour + live end point only refreshed every 5 min (a CO2 jump past a threshold
   kept the old colour and the curve end lagged the big number; unavailable painted green)
   — fixed.
2. `hours` as a quoted string collapsed history to two points (`new Array("12")`); a
   fractional value threw every refresh; `rows` as a bare string threw in `setConfig` —
   coerced / tolerated.
3. Scrub dot floated above sharp peaks (16.8 px on a one-hour 400→1200→400 spike) — dot
   on the smoothed curve.
4. Second `setConfig` left readings `--`, graphs blank for up to 5 min, and the
   expand state desynced — fixed.
5. Failed refresh keeps the old curve with no indicator — note only, owner declined a
   marker.
6. Timer re-armed by a hass push on a detached element; overlapping fetches unguarded;
   redundant press guard; pre-Card-Manager header text — hygiene, fixed.
Reviewed and sound: availability display, timer cleanup/re-arm, WS + REST parsing, one
shared coordinate mapping for path/dot/tip, toggle propagation, press feedback, render
cost (three `textContent` writes per push), escaping.

## Version history
- **v1.4 (2026-09-06)** — threshold rows colour by height (post-audit design revisit; the
  owner's one pick of three ideas). Non-threshold rows byte-identical to v1.3.
- **v1.3 (2026-09-06)** — audit bundle above; healthy-card render identical to v1.2.
- **v1.2 (2026-07-10)** — more top headroom (26 px); hover readout became a floating
  value + time pill above the scrub dot.
- **v1.1 (2026-07-10)** — matched to measured native sensor-card values (reading weight
  400, uom 16 px, stroke 2, fill opacity .10, graph headroom).
- **v1.0 (2026-07-10)** — initial build replacing the native sensor cards.
