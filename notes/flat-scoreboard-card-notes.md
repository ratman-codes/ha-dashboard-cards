# flat-scoreboard-card — sanitized notes (incl. Forecast Lab status)

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

### flat-scoreboard-card v1.1 (2026-09-06, source audit)
Seven findings from a full source audit (jsdom harness in both directions,
render byte-identical to v1.0 on a healthy card), shipped as one version:
- Trend strip honesty: a failed `recorder/statistics_during_period` call used to
  replace a good chart with the "statistics accumulate from Jul 19" text for an
  hour with no retry (the throttle was stamped before the call); now the throttle
  is stamped only on success, the last good chart is kept under a "Trend
  unavailable — statistics fetch failed, retrying." line, retry after 60 s, and a
  first push with unknown avg sensors no longer burns the hour.
- Printed values vs thresholds: `today`/`yday` print whole degrees while busted /
  orange-yday compared raw tenths (82° vs 77° with margin 5 unmarked; yday 7.6
  printed 8° not orange) — now compared on the rounded values.
- Trend x-axis is a shared day axis keyed on each row's `start` (a series missing
  a day was drawn shifted by index).
- No-data rows print a dash instead of a numeric rank; a source without an avg
  id no longer opens more-info for entity "undefined".
- Rows rebuild only when a printed value or mark changes (a tick of the running
  actual rebuilt all rows); days label guarded; re-setConfig refreshes the title
  and discards an in-flight fetch; press feedback primary-button only; unused
  constant removed; header maintenance text mentions the Card Manager.
Reviewed and sound: -99/unavailable/unknown handling, competition ranking with
ties, over-scale bar, quoted numeric options, lifecycle, statistics call shape.

### flat-scoreboard-card v1.0 (2026-07-19)
Forecast-experiment leaderboard: competition ranking w/ medal chips, avg-error
bars (leader amber, off-scale overflow fade), busted-call and yesterday-miss
highlighting, live actual chip, LTS trend strip (top sources' daily means,
hourly refresh). Sources/entities via YAML.

## Forecast Lab
Six-way daily forecast-accuracy experiment, permanent fixture as of 2026-07-19.
Verdict after 11 days: the TWC/Weather-Underground engine is the clear winner
(1.5° avg error) across marine-layer and heat-wave regimes; Open-Meteo second;
OWM far off-scale. Avg sensors carry `state_class: measurement` for permanent
long-term statistics. Scored nightly against the local station's actual high.
