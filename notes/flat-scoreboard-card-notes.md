# flat-scoreboard-card — sanitized notes (incl. Forecast Lab status)

*(Split out of the single sanitized notes file 2026-07-21 to mirror the private project's per-card doc structure — each card's notes file is updated only by ships of that card.)*

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
