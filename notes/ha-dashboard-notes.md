# Home Assistant Dashboard Notes (sanitized archive copy)

Sanitized copy of the working notes for the bespoke cards in this repo. Real
operational values (dashboard url_path, LAN address, weather-station id, pet
names, local paths) live in the private "NAS / Smart Home" Claude project, which
is where these cards are iterated. Restructured 2026-07-21: per-card
specs and debug lessons split into sibling files under notes/ (see the index
below), mirroring the private project's per-card doc structure.

## Owner workflow rules
- No changes to Home Assistant unless the owner explicitly asks; propose YAML
  first. Card resource installs/updates are done BY THE OWNER — Claude hands a
  .txt containing the full data: URL; the owner installs it via the Card Manager
  card's guarded flow or by pasting at Settings > Dashboards > Resources.
- Track everything built; delete nothing without express permission.
- No personal details in code, headers, entity naming, docs, or archives that
  leave the house; keep repo copies freshly sanitized and grep-scanned.

## Custom-card build checklist
1. **Hosting:** zero external dependencies. Data-URL module in the dashboard
   resource registry, labeled: `data:text/javascript;name=<card-name>;base64,...`.
   Never any CDN or relay-hosted resource. `node --check` before encoding.
2. **Self-documenting header**, with the card name + version directly after the
   `/*` on the FIRST line (`/* <card-name> v<X.Y>`) — the Card Manager's header
   regex requires it; a multi-line pretty opener fails validation.
   Example YAML in headers uses placeholder names (Cat1/Cat2, my_feeder_01).
3. **ASCII-safe source:** no literal non-ASCII in strings — `&deg;` in innerHTML,
   escape sequences in JS. Aim for zero bytes > 127 anywhere.
4. **Hardcode accent hexes** — the theme primary is green and leaks through
   theme vars. Measured HA state colors: heat #ff6f22, cool #2196f3,
   heat_cool #ffc107, off #9e9e9e.
5. **Match native visual language** (measure the live dashboard, don't guess):
   track rgba(70,70,70,.3); faded fill = accent opacity .5; bright = accent
   opacity 1 with round caps extending ±8px (rendered even at zero length);
   white handle ~0.7× track height; mode strip 42px, 20px icons.
6. **ha-icon centering:** `display:flex; align-items:center;
   justify-content:center; line-height:0` or the svg sags ~1.3px.
7. **Animations:** show elements idempotently (`display` flips reset
   transitions); transition-suppressing class on pointermove, never pointerdown;
   .35s cubic-bezier(.4,0,.2,1) matches native.
8. **Optimistic UI:** hold user-set values ~8s past commit.
9. **No redundant text:** state shown once.
10. **more-info access:** hass-more-info CustomEvent (bubbles+composed).
11. **Availability honesty:** '--' never 0; key availability off the entity that
    reflects real device state; utility meters may need `always_available: true`.
12. **Verify in the browser before claiming done**, including persistence
    (stale dashboard-edit sessions can silently clobber saves).
13. **Archive after sign-off** and byte-verify deployed blob vs archive
    (imul-based FNV-1a — crypto.subtle is unavailable on http:// LAN origins).
14. Some HA write tooling requires a best-practices acknowledgement key that
    rotates hourly — re-read it, don't replay.

## Debug lessons (MOVED)
Now in `notes/debug-lessons.md` (append-only).

## House styles
- **Dropdowns (expander-card):** padding 0, title-card-button-overlay, mushroom
  title card stripped via card_mod, children in gap-0 grid, whole header
  toggles.
- **Press feedback:** no hover on large clickable regions; pressed section dips
  scale(.985) + rgba(70,70,70,.22) wash, .12s ease. Small repeated elements may
  keep subtle :hover.
- **Threshold coloring:** color only numbers that need translation (dew point);
  temperature/RH stay plain ink; recessive until action-relevant. Scoreboard
  extension: busted calls / blowup misses in #ff9c4a (settled facts); off-scale
  bars overflow with a fade.

## Card notes index
Per-card sanitized notes now live beside this file (split 2026-07-21):

- `notes/flat-thermostat-card-notes.md` — thermostat (v2.3 spec incl. eco toggle)
- `notes/flat-weather-card-notes.md` — weather card (v1.3 spec)
- `notes/flat-scoreboard-card-notes.md` — scoreboard + Forecast Lab status
- `notes/flat-treadmill-card-notes.md` — treadmill deep notes
- `notes/vacuum-system-notes.md` — vacuum card + system notes
- `notes/debug-lessons.md` — general debug lessons (append-only)

## Card specs (cards without their own notes file)

### flat-treadmill-card v2.11 (2026-07-09)
Walking-pad control/stats card (FTMS). Deep notes:
`notes/flat-treadmill-card-notes.md`.

### flat-sensor-stack-card v1.2
Collapsible stack of compact 24h sensor graphs; row 0 always visible.

### flat-vacuum-card v2.6
Roborock control card; see `notes/vacuum-system-notes.md`.

### flat-party-card v1.3
Party-mode control card for the dashboard's Party Mode expander (multi-line
effect chips, scene controls).

### flat-cat-card v1.18
Consolidated cats card (litter box + two camera feeders + per-cat rows);
tap-to-expand, guarded litter maintenance, portion-chip feeds w/ undo,
configurable event-snapshot camera tiles, alert strip. Entities via YAML
(cat list + entity prefixes; placeholder names in the header example).
Iterating rapidly — see the private project for the current spec.

### card-manager-card v1.2 (2026-07-18)
Admin card managing all of the above — see the README entry for the full
description. PIN lives only in the owner's dashboard YAML.
