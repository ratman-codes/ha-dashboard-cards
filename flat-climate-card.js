/* flat-climate-card v2.1.1 - custom Lovelace card for the main dashboard.
   Whole-house climate card combining a derived headline with an all-rooms
   temperature overlay ("option 2+5"). Row 0 (always visible): big indoor-vs-
   outdoor delta reading ("7.3 F cooler outside") + an OPEN WINDOWS action chip
   (green only when action-relevant, hysteresis so it doesn't flicker), drawn
   over a 24h overlay of every room's temperature curve (5 series, legend
   bottom-left, outdoor pair direct-labeled). The title pill top-right toggles
   an expansion holding: a humidity row (outdoor vs indoor, 2 series) and a
   per-room "now" strip (temp + RH per room, tap for history). Hover-scrubbing
   either graph shows all series' values at that time in one tooltip; clicking
   a row/cell opens the native more-info history dialog.
   Built 2026-08-05 by Claude for Ratman (design mockups + decisions in the
   "NAS / Smart Home" Claude project; visual language matches the sibling
   flat-sensor-stack / flat-thermostat / flat-weather cards).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-climate-card;base64,<blob>.
     No file on disk, no internet dependency - the code lives inside the URL,
     in HA's own config (.storage/lovelace_resources), and is included in every
     Home Assistant backup automatically. The ;name= parameter is only a
     human-readable label for the Resources page (RFC 2397).
   - To READ it: copy everything after "base64," through any base64 decoder.
   - To MODIFY it: edit the decoded JS (ASCII-only in strings), node --check,
     re-encode, then replace this resource's URL via the Card Manager card or
     Settings > Dashboards > Resources. Hard-refresh after.
   - Used from the dashboard as:   type: custom:flat-climate-card
     (defaults below cover this house's five meters; override with e.g.
      hours: 24,
      indoor:  [{entity, humidity, name, color}, ...],
      outdoor: [{entity, humidity, name, color}, ...],
      chip: {on_delta: 3, off_delta: 1.5, label: OPEN WINDOWS}
     - example rooms use placeholder ids like sensor.room1_temperature.)
   - Headline math: delta = avg(available indoor temps) - avg(available
     outdoor temps); positive = cooler outside. Chip turns ON when
     delta >= on_delta; OFF when delta < off_delta (hysteresis band between).
     The chip is either green or absent - never a red nag (threshold-color
     house rule). NO humidity/dew-point gate (removed v1.4, see below).
   - Series colors are a CVD-validated 5-set for dark surfaces (not theme
     vars - the theme's green primary leaks): indoor #d95926/#c98500/#d55181,
     outdoor #3987e5/#199e70.
   - History arrives over the websocket (history/history_during_period,
     hourly-averaged buckets like the native sensor card), refreshed every
     5 minutes; each curve's last point is pinned to the live state.
   - Availability honesty: unavailable sensors show '--' and drop out of the
     averages; if ALL outdoor sensors drop, the headline goes '--', the chip
     hides, and the hero dims. Nothing is ever coerced to 0.
   - v1.1: hero condensed 224px -> 170px (owner request): one-line headline,
     graph bleeds up behind the reading (text stroke keeps it readable, same
     as flat-sensor-stack), chip relocated next to the legend bottom-left.
   - v1.2: chip+legend line hardened for narrow columns (owner's real width):
     nowrap chip, tighter chip/legend metrics so the line fits at ~400px.
   - v1.4: HUMIDITY GATE REMOVED from the chip (was: outdoor RH <= 70).
     4 days of history showed this house's outdoor dew point lives in a
     narrow 63-68 F band all summer (never crisp, never swampy), so any
     moisture gate is either always-blocking or barely-relevant - the chip
     now means exactly "it is on_delta F cooler outside", nothing else.
     If muggy-air regret ever occurs in practice, the right re-add is a
     DEW POINT gate (computable from T+RH via Magnus; dew point is immune
     to the patio sensor's solar heating - verified patio-vs-front dew
     agreement within ~0.6 F even during +11 F spikes), thresholded from
     the offending night's data, NOT an RH ceiling (cool coastal air is
     always high-RH; RH gates are permanently pessimistic here).
   - v2.1.1: the 3m tab's seasonal heatmap rows are WEEKS instead of months
     (owner request): ~13 Monday-aligned rows labeled by start date
     ("Aug 25"), so the shortest seasonal range shows week-to-week drift
     while 6m/1y keep calendar months (weekly rows there would be a
     scrolling wall of 7-day-noisy cells - trade-off discussed and kept).
   - v2.1: the two deferred pop-out items, owner-green-lit (the third - 24h
     per-room moisture overlays - was DECLINED by the owner: per-room
     moisture is not meaningful to him; do not re-propose).
     (a) SEASONAL HEATMAP: on the 3m/6m/1y tabs the venting heatmap rows
     become calendar MONTHS (chronological, oldest at top) instead of
     weekdays - the seasonal fingerprint of when free cooling exists at
     all. Data comes from hourly statistics fetched in 45-day CHUNKS (a
     year of hourly rows in one WS call is too heavy), cached 30 min.
     Months with no data yet render as empty cells - the map fills in
     honestly as the meters age (fleet history starts 2026-08).
     The last-30-days cap and its caption are gone from those tabs; the
     venting-offered tile now reflects the true range.
     (b) VS PRIOR PERIOD: the extremes tile gains one line - the same-length
     window immediately before this one, "vs prior month: out +1.3\u00b0"
     (outdoor sun-trimmed means compared; indoor omitted to keep the tile
     quiet). One extra statistics fetch per tab, cached 30 min; the line
     silently disappears when the prior window has no data.
   - v2.0.2: heatmap polish (owner request): every hour column labeled
     (12a 1 2 ... 11 12p ... 11), cells are true squares (aspect-ratio 1),
     and hovering a cell highlights it and shows the card-style tooltip with
     the cell's mean delta (replaces the old browser title= tooltip).
   - v2.0.1: pop-out polish off the owner's first live look. (a) SCRUB in the
     pop-out charts: hovering either chart shows the card-standard hairline +
     series-colored dots riding the curves + a graph-anchored tooltip listing
     every line's interpolated value at that time (averages, selected rooms,
     forecast); time label adapts to the range (clock, weekday+hour, date).
     (b) BAND CALMING: the min-max envelopes' edges are smoothed with a small
     rolling window (config band_smooth, default 1 bucket each side, 0 = raw)
     and drawn a touch fainter - the out-side band mixes two sensors on
     opposite building faces, so raw bucket-to-bucket edges were jagged.
     Tiles still report RAW extremes (smoothing is display-only).
   - v2.0: HISTORY POP-OUT. A "History & stats" strip at the bottom of the
     expansion opens a card-rendered full-screen overlay (position:fixed at
     the ha-card level, z above the HA header; Esc / X / backdrop-tap close;
     no browser_mod, no HA-side anything). Inside: range tabs 24h / 7d / 14d /
     1m / 3m / 6m / 1y. 24h reuses the card's raw history; 7d+ pull
     recorder/statistics_during_period (mean/min/max, zero-poisoned rows
     filtered - the PetKit statistics lesson) and draw the in/out averages as
     dashed means with translucent min-max envelope bands. Room picker chips
     overlay up to 3 individual sensors as SOLID lines (line grammar: solid =
     measured, dashed = computed, dotted = forecast). Moisture panel repeats
     the v1.7 humidity/dew toggle. A venting heatmap (mean delta by hour x
     weekday, hourly stats, capped at the last 30 days for long ranges) and
     four stat tiles: venting offered (+ share captured, from the window
     contact sensors, past 7d), range extremes (trim-aware), warmest room
     (or the selected room's stats), and muggy hours (share of time outdoor
     dew >= 65/60). 24h tab additionally extends 12h past "now" with the
     hourly forecast from the weather entity (dotted, outdoor only - never
     indoor), a predicted venting strip (forecast outdoor >= on_delta below
     current indoor), and window-open (green) / AC-running (blue) / heating
     (orange) shading columns from the contact sensors + thermostat
     hvac_action history (24h + 7d tabs only; longer ranges would smear).
     Config (all optional): popout: false removes the strip + popout;
     contacts: [binary_sensor ids] (window-open shading; [] disables);
     hvac_entity: climate id or false; forecast_entity: weather id or false.
   - v1.7: MOISTURE ROW REWORK (mockups claude/climate-moisture-mockup-v2 +
     climate-history-popout-mockup-v3 in the project). The humidity row's two
     raw sensors (Patio RH / Desk RH) are replaced by the in-average and
     out-average across ALL meters' humidity sensors (Hall joins the indoor
     side only when hall.in_average) - drawn DASHED (computed, same grammar
     as the temp averages row) in the row's own colors: in #e0834e (warm
     orange), out #38bfd8 (watery cyan) - deliberately distinct from the
     temp-average cream/pastel-blue pair so adjacent rows can't be confused.
     TAPPING THE ROW TITLE toggles Humidity <-> Dew point (dew computed
     per-sensor per-bucket via Magnus then averaged per side; dew is immune
     to the patio solar spike, so no trim needed). Dew mode: y-scale never
     spans less than 10 F (flat means flat - the marine-layer dew band is
     genuinely narrow), the reading gains a Delta (out - in), and dew values
     are threshold-colored on the weather card's window-flush scale (plain
     under 60, amber #ffc107 60-65, orange #ff9c4a 65+; RH stays plain ink).
     The chosen mode persists in localStorage (falls back to config
     moisture_mode: rh|dew, default rh). History call widened from 8 to 12
     entities (all six humidity sensors) to feed real averages.
   - v1.6: READABILITY PASS (owner feedback off the live v1.5 render).
     (a) TOOLTIP UNCLIPPED: the scrub tooltip is now viewport-anchored
     (position: fixed, clamped to screen edges, flips sides near the right
     edge) so it floats OVER the card instead of being cut by the card's
     overflow:hidden. Tooltips live at the ha-card level, outside the rows,
     so the humidity row's press-transform cannot break fixed positioning.
     (b) CALMER HERO: ALL on-chart text removed (Patio/Front direct labels
     + the avg end labels are gone) - headline, pill, legend only.
     (c) LEGEND TAP = SPOTLIGHT: legend items are tappable; tap a room to
     draw its line full-strength (2.5px) with a single on-chart label
     (name + current value) while every other line drops to 18% and the
     avg dashes to 12%; tap again (or another room) to release. Scrubbing
     is unaffected and works during spotlight.
     (d) AVERAGES ROW (expansion, between hero and humidity): in-avg and
     out-avg drawn full-visibility dashed with their own scrub, and REAL
     NUMBERS in the reading ("76.9 in - 75.1 out - D 1.8"); the D equals
     the headline by construction (same inT/outT/delta values). The hero
     keeps its quiet dashes as a hint.
     (e) The hero scrub tooltip gains "in avg"/"out avg" rows at the
     bottom, so the derived values are readable at any time point.
     (v1.6.1) Scrub is SCOPED to the graph band: it only arms while the
     pointer is vertically inside the zone where the lines live (hero:
     below the headline/chip, above the legend; rows: below the reading),
     so hovering the headline/legend/pill no longer summons the tooltip.
     (v1.6.2) GRAPH-ANCHORED READOUT (owner: the v1.6 cursor-chasing panel
     lost the pre-v1.6 feel): the tooltip is anchored to the top of the
     row's graph and slides only HORIZONTALLY with the scrub position
     (still viewport-fixed = unclipped, still flips near the screen edge),
     and every solid line gains a SCRUB DOT riding the curve at the read
     position - the flat-sensor-stack card's dot language, so the readout
     is visually tied to the lines, not the pointer.
     (v1.6.3) Dots restyled after the live render: 7px and COLORED to match
     their own line (six white 9px dots merged into a blob where the lines
     converge, and the raw-bucket placement visibly missed the SMOOTHED
     curve on spike edges - same-color dots absorb that ~1-2px deviation);
     during spotlight only the focused line keeps its dot.
     (v1.6.4) SCRUB INTERPOLATES instead of snapping to the nearest bucket.
     Root cause of the "dots don't align" report: sparse reporters (the
     Nest only posts on meaningful changes) leave hour-plus bucket gaps,
     so nearest-point snapping parked a dot far from the hairline AND fed
     the tooltip a value from that distant bucket. Now both the dot and
     the tooltip value are linearly interpolated between the two bracketing
     points at the hairline's exact time - every dot sits ON the hairline,
     on its line; a dot hides when the hairline is outside its line's data
     range. Config: scrub_dots: false removes the dots entirely (tooltip +
     hairline + interpolation stay).
   - v1.5: HALL (thermostat) LINE + TRANSLUCENT AVERAGE DASHES.
     (a) The thermostat's own temperature joins the overlay as a solid sixth
     line, seated IN THE INDOOR GROUP (legend/strip/tooltip order: indoor
     rooms, Hall, then outdoor). Color #a774d6 (violet) - measured as the
     most-distinct remaining hue vs the existing five (red candidates land
     ~2x closer to the orange/magenta pair). Hall is display-only by default:
     NOT in the indoor average (thermostat-embedded sensors run slightly
     warm; also keeps the headline's meaning stable). Config:
       hall: {entity, humidity, name, color, in_average: false}
     Set in_average: true to count it; hall: false removes the line.
     (b) Dashed translucent average lines (owner idea: dashed = computed,
     solid = measured): in-avg (warm #e6c193) + out-avg (cool #8fb8e8),
     2px dash, opacity 0.35 (config avg_opacity; 0 hides), end-labeled
     "in avg"/"out avg" at the right edge. The out-avg dash IS the
     sun-trimmed value the headline reports - the trim is visible where
     the dash refuses to follow the patio spike.
     (c) Chip relocated bottom-legend -> TOP-LEFT under the headline (its
     v1.0 home) - the legend line now carries six items and needed the room.
   - v1.3: title-graph tap-to-more-info REMOVED (fought mobile tap-scrubbing;
     humidity row + strip cells keep their taps). SUN-SPIKE TRIM added to the
     outdoor math: each outdoor temp is capped at (coolest outdoor + sun_cap,
     default 4 F) before averaging - a sensor cooking in reflected sun (the
     Juliet-balcony patio meter spikes +8..12 F over the front sensor on
     west-sun afternoons; real side-to-side difference measured ~2-4 F) stops
     dragging the headline/chip, while legitimate patio-side warmth up to the
     cap still counts. Graph lines stay RAW - the spike remains visible on the
     curve. Config: sun_cap (top level; 0 = pure min, large = pure average). */

const DEF_HOURS = 24;
const DEF_INDOOR = [
  { entity: 'sensor.living_room_desk_meter_pro_co2_b98a_temperature',
    humidity: 'sensor.living_room_desk_meter_pro_co2_b98a_humidity',
    name: 'Desk', color: '#d95926' },
  { entity: 'sensor.meter_pro_40e0_temperature',
    humidity: 'sensor.meter_pro_40e0_humidity',
    name: 'Master', color: '#c98500' },
  { entity: 'sensor.guest_bed_guest_bed_meter_pro_421d_temperature',
    humidity: 'sensor.guest_bed_guest_bed_meter_pro_421d_humidity',
    name: 'Guest', color: '#d55181' },
];
const DEF_OUTDOOR = [
  { entity: 'sensor.living_room_patio_indoor_outdoor_meter_6133_temperature',
    humidity: 'sensor.living_room_patio_indoor_outdoor_meter_6133_humidity',
    name: 'Patio', color: '#3987e5' },
  { entity: 'sensor.indoor_outdoor_meter_7523_temperature',
    humidity: 'sensor.indoor_outdoor_meter_7523_humidity',
    name: 'Front', color: '#199e70' },
];
const DEF_CHIP = { on_delta: 3, off_delta: 1.5, label: 'OPEN WINDOWS' };
const DEF_HALL = { entity: 'sensor.hall_nest_thermostat_temperature',
                   humidity: 'sensor.hall_nest_thermostat_humidity',
                   name: 'Hall', color: '#a774d6', in_average: false };
const AVG_IN = '#e6c193', AVG_OUT = '#8fb8e8', DEF_AVG_OP = 0.35;
const MOIST_IN = '#e0834e', MOIST_OUT = '#38bfd8';    // v1.7 moisture pair
const DEW_AMBER = '#ffc107', DEW_ORANGE = '#ff9c4a';  // window-flush thresholds (weather card)
const LS_MOIST = 'flat-climate-card-moisture-mode';
const DEF_CONTACTS = ['binary_sensor.anything_open'];
const DEF_HVAC = 'climate.hall_nest_thermostat';
const DEF_FORECAST = 'weather.home'; // REPO COPY PLACEHOLDER: the deployed card's default
// is the household's hourly-capable weather entity (location-bearing id, sanitized here).
// Set forecast_entity in YAML to your own hourly weather entity, or false to disable.
const POP_R = {
  '24h': { days: 1, sub: 'past 24 hours \u00b7 raw history + 12h forecast' },
  '7d':  { days: 7,   period: 'hour', group: 4,  sub: 'past 7 days \u00b7 statistics' },
  '14d': { days: 14,  period: 'hour', group: 12, sub: 'past 14 days \u00b7 statistics' },
  '1m':  { days: 30,  period: 'day',  group: 1,  sub: 'past 30 days \u00b7 statistics' },
  '3m':  { days: 91,  period: 'day',  group: 2,  sub: 'past 3 months \u00b7 statistics', seasonal: true, hmWeeks: true },
  '6m':  { days: 182, period: 'day',  group: 4,  sub: 'past 6 months \u00b7 statistics', seasonal: true },
  '1y':  { days: 365, period: 'day',  group: 5,  sub: 'past 12 months \u00b7 statistics', seasonal: true },
};
const PREV_LBL = { '24h': 'yesterday', '7d': 'prior week', '14d': 'prior 2 weeks',
  '1m': 'prior month', '3m': 'prior 3 months', '6m': 'prior 6 months', '1y': 'prior year' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DEF_SUN_CAP = 4; // F; outdoor sensors count at most this far above the coolest one
const HERO_H = 170, HERO_G = 170, ROW_H = 116, ROW_G = 99;
const REFRESH_MS = 5 * 60 * 1000;
const HAIR = 'rgba(255,255,255,.05)';
const GOOD = '#4caf50';

class FlatClimateCard extends HTMLElement {
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = Object.assign({ hours: DEF_HOURS }, config);
    const mk = (list, defs) => (list && list.length ? list : defs).map(r => Object.assign({}, r));
    this._indoor = mk(config.indoor, DEF_INDOOR);
    this._outdoor = mk(config.outdoor, DEF_OUTDOOR);
    this._chipCfg = Object.assign({}, DEF_CHIP, config.chip || {});
    this._sunCap = (config.sun_cap != null) ? Number(config.sun_cap) : DEF_SUN_CAP;
    this._hall = (config.hall === false) ? null : Object.assign({}, DEF_HALL, config.hall || {});
    this._avgOp = (config.avg_opacity != null) ? Number(config.avg_opacity) : DEF_AVG_OP;
    this._scrubDots = config.scrub_dots !== false;
    // v1.7 moisture mode: localStorage wins, then config, then rh
    this._moistMode = (config.moisture_mode === 'dew') ? 'dew' : 'rh';
    try {
      const saved = window.localStorage.getItem(LS_MOIST);
      if (saved === 'rh' || saved === 'dew') this._moistMode = saved;
    } catch (e) { /* storage unavailable: config default stands */ }
    // v2.0 pop-out config
    this._popEnabled = config.popout !== false;
    this._contacts = Array.isArray(config.contacts) ? config.contacts.slice()
      : (config.contacts === false ? [] : DEF_CONTACTS.slice());
    this._hvacEnt = (config.hvac_entity === false) ? null : (config.hvac_entity || DEF_HVAC);
    this._fcEnt = (config.forecast_entity === false) ? null : (config.forecast_entity || DEF_FORECAST);
    this._bandSmooth = (config.band_smooth != null)
      ? Math.max(0, Math.round(Number(config.band_smooth))) : 1;
    this._pop = { open: false, cur: '24h', sel: [], cache: {}, el: null, seq: 0 };
    // display order: indoor rooms, Hall (indoor group), then outdoor
    this._series = this._indoor.concat(this._hall ? [this._hall] : [], this._outdoor);
    this._open = false;
    this._focus = null;       // v1.6 legend spotlight state
    this._chipOn = false;
    this._chipShown = null;   // last applied visibility (idempotent display writes)
    this._hist = {};          // entity -> [{t, v, x, y}]
    if (!this.shadowRoot) this._createDom();
    else this._buildDom();
  }

  getCardSize() { return 4; }

  set hass(hass) {
    this._hass = hass;
    if (!this._fetchTimer) {
      this._fetchHistory();
      this._fetchTimer = setInterval(() => this._fetchHistory(), REFRESH_MS);
    }
    this._renderStates();
  }

  disconnectedCallback() {
    if (this._fetchTimer) { clearInterval(this._fetchTimer); this._fetchTimer = null; }
    if (this._pop && this._pop.open) this._closePop(); // drop window listeners with the card
  }
  connectedCallback() {
    if (this._hass && !this._fetchTimer) {
      this._fetchHistory();
      this._fetchTimer = setInterval(() => this._fetchHistory(), REFRESH_MS);
    }
  }

  /* ---------------- DOM ---------------- */
  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; overflow: hidden; }
        .row { position: relative; cursor: pointer;
          transition: transform .12s ease, background .12s ease; }
        .row.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .row.unavailable .reading, .row.unavailable svg.g { opacity: .4; }
        .hero { height: ${HERO_H}px; cursor: default; }
        #avgrow { cursor: default; }
        .hrow { height: ${ROW_H}px; }
        svg.g { position: absolute; left: 0; right: 0; bottom: 0; width: 100%;
          display: block; pointer-events: none; }
        .hero svg.g { height: ${HERO_G}px; }
        .hrow svg.g { height: ${ROW_G}px; }
        .reading { position: absolute; top: 10px; left: 16px; z-index: 1; pointer-events: none; }
        .val { font-size: 28px; font-weight: 400; line-height: 1.2;
          color: var(--primary-text-color);
          -webkit-text-stroke: 2px var(--card-background-color); paint-order: stroke fill; }
        .val .uom { font-size: 16px; font-weight: 400; color: var(--secondary-text-color);
          margin-left: 4px; -webkit-text-stroke: 0; }
        .chipwrap { position: absolute; top: 47px; left: 16px; z-index: 2; pointer-events: none; }
        .chip { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex: none;
          padding: 2px 8px; border-radius: 999px; border: 1px solid ${GOOD};
          color: ${GOOD}; font-size: 10.5px; font-weight: 600; letter-spacing: .03em;
          background: color-mix(in srgb, var(--card-background-color) 75%, transparent); }
        .chip .cdot { width: 7px; height: 7px; border-radius: 50%; background: ${GOOD}; }
        .legend { position: absolute; left: 8px; right: 8px; bottom: 4px; z-index: 2;
          display: flex; align-items: center; gap: 2px; flex-wrap: nowrap;
          overflow: hidden; }
        .legend .it { display: flex; align-items: center; gap: 4px; font-size: 11px; flex: none;
          color: var(--secondary-text-color); padding: 4px 5px; border-radius: 6px;
          cursor: pointer; transition: background .15s;
          -webkit-text-stroke: 2px var(--card-background-color); paint-order: stroke fill; }
        @media (hover: hover) { .legend .it:hover { background: rgba(255,255,255,.07); } }
        .legend .it.on { background: rgba(255,255,255,.10); color: var(--primary-text-color); }
        .legend .dot { width: 7px; height: 7px; border-radius: 50%; -webkit-text-stroke: 0; }
        .label { position: absolute; top: 12px; right: 16px; z-index: 1;
          font-size: 16px; font-weight: 500; color: var(--secondary-text-color);
          -webkit-text-stroke: 2px var(--card-background-color); paint-order: stroke fill;
          pointer-events: none; white-space: nowrap; }
        .label.tgl { pointer-events: auto; cursor: pointer; z-index: 3;
          padding: 4px 10px; margin: -4px -10px; border-radius: 8px;
          transition: background .15s, transform .12s ease; }
        @media (hover: hover) { .label.tgl:hover { background: rgba(255,255,255,.08); } }
        .label.tgl.pressed { transform: scale(.96); background: rgba(70,70,70,.3); }
        .toggle { position: absolute; top: 8px; right: 8px; z-index: 2;
          height: 32px; padding: 0 12px; display: flex; align-items: center;
          border-radius: 8px; cursor: pointer; white-space: nowrap;
          font-size: 16px; font-weight: 500; color: var(--secondary-text-color);
          -webkit-text-stroke: 2px var(--card-background-color); paint-order: stroke fill;
          transition: background .15s, transform .12s ease; }
        @media (hover: hover) { .toggle:hover { background: rgba(255,255,255,.08); } }
        .toggle.pressed { transform: scale(.96); background: rgba(70,70,70,.3); }
        .sdot { position: absolute; width: 7px; height: 7px; border-radius: 50%;
          border: 1.5px solid var(--card-background-color);
          transform: translate(-50%,-50%); z-index: 2; pointer-events: none;
          visibility: hidden; }
        .xline { position: absolute; top: 0; bottom: 0; width: 1px;
          background: rgba(255,255,255,.25); z-index: 2; pointer-events: none;
          visibility: hidden; }
        .tip { position: fixed; left: 0; top: 0; z-index: 7; padding: 6px 10px; border-radius: 6px;
          background: rgba(0,0,0,.9); font-size: 12px; color: var(--primary-text-color);
          pointer-events: none; white-space: nowrap; visibility: hidden; }
        .tip .sep { border-top: 1px solid rgba(255,255,255,.15); margin: 4px 0 3px; }
        .tip .tt { color: var(--secondary-text-color); font-size: 11px; margin-bottom: 3px; }
        .tip .tr { display: flex; align-items: center; gap: 6px; line-height: 1.5; }
        .tip .td { width: 7px; height: 7px; border-radius: 50%; flex: none; }
        .tip .tn { color: var(--secondary-text-color); min-width: 52px; }
        .tip .tv { margin-left: auto; padding-left: 10px; }
        .kids { display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1); }
        .kids.open { grid-template-rows: 1fr; }
        .kidsin { overflow: hidden; min-height: 0;
          border-top: 0px solid ${HAIR}; transition: border-width .35s; }
        .kids.open .kidsin { border-top-width: 1px; }
        .strip { display: flex; border-top: 1px solid ${HAIR}; }
        .cell { flex: 1; padding: 10px 4px 12px; text-align: center; cursor: pointer;
          transition: transform .12s ease, background .12s ease; }
        .cell + .cell { border-left: 1px solid ${HAIR}; }
        @media (hover: hover) { .cell:hover { background: rgba(255,255,255,.04); } }
        .cell.pressed { transform: scale(.96); background: rgba(70,70,70,.22); }
        .cell .cv { font-size: 16px; color: var(--primary-text-color); }
        .cell .cv small { font-size: 11px; color: var(--secondary-text-color); }
        .cell .cn { font-size: 10.5px; color: var(--secondary-text-color); opacity: .75; margin-top: 2px; }
        .cell .ch { font-size: 10.5px; color: var(--secondary-text-color); }
        .cell.unavailable .cv { opacity: .4; }
        text.dlab { font-size: 10.5px; font-weight: 600;
          stroke: var(--card-background-color); stroke-width: 3px; paint-order: stroke fill; }
        /* ---- v2.0: history pop-out ---- */
        .hstrip { border-top: 1px solid ${HAIR}; padding: 9px 16px; text-align: center;
          font-size: 12.5px; font-weight: 500; letter-spacing: .02em;
          color: var(--secondary-text-color); cursor: pointer; transition: background .15s; }
        @media (hover: hover) { .hstrip:hover { background: rgba(255,193,7,.08);
          color: var(--primary-text-color); } }
        .hstrip.pressed { background: rgba(70,70,70,.22); }
        .pop { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,.55);
          overflow: auto; overscroll-behavior: contain; }
        .popin { max-width: 860px; margin: 24px auto; border-radius: 14px;
          background: var(--card-background-color, #1c1c1c);
          border: 1px solid rgba(255,255,255,.07); box-shadow: 0 12px 48px rgba(0,0,0,.7);
          padding: 14px 16px 16px; }
        @media (max-width: 900px) { .popin { margin: 10px; } }
        .pophead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .poptitle { font-size: 16px; font-weight: 500; margin-right: auto; }
        .popsub { display: block; font-size: 11.5px; font-weight: 400;
          color: var(--secondary-text-color); margin-top: 2px; }
        .ptabs { display: flex; gap: 3px; background: rgba(255,255,255,.05);
          border-radius: 8px; padding: 3px; }
        .ptab { border: none; background: none; color: var(--secondary-text-color);
          font: inherit; font-size: 12px; padding: 4px 8px; border-radius: 6px; cursor: pointer;
          transition: background .12s, color .12s; }
        @media (hover: hover) { .ptab:hover { background: rgba(255,193,7,.10);
          color: var(--primary-text-color); } }
        .ptab.on { background: rgba(255,255,255,.13); color: var(--primary-text-color); }
        .popx { border: none; background: none; color: var(--secondary-text-color);
          font-size: 18px; line-height: 1; cursor: pointer; padding: 5px 9px; border-radius: 6px; }
        @media (hover: hover) { .popx:hover { background: rgba(255,255,255,.08);
          color: var(--primary-text-color); } }
        .psect { margin-top: 14px; }
        .pshead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          margin-bottom: 5px; }
        .pstitle { font-size: 13.5px; font-weight: 500; }
        .pstitle.tgl { cursor: pointer; padding: 3px 8px; margin: -3px -8px; border-radius: 6px;
          transition: background .12s; }
        @media (hover: hover) { .pstitle.tgl:hover { background: rgba(255,255,255,.07); } }
        .pleg { font-size: 11px; color: var(--secondary-text-color); margin-left: auto; }
        .pleg i { display: inline-block; width: 14px; border-top: 2px dashed;
          vertical-align: middle; margin: 0 3px 2px 7px; }
        .pchips { display: flex; gap: 5px; flex-wrap: wrap; margin: 6px 0 4px; }
        .pchip { border: 1px solid rgba(255,255,255,.14); background: none; font: inherit;
          color: var(--secondary-text-color); font-size: 11.5px; padding: 2px 8px 2px 7px;
          border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 5px;
          transition: background .12s, color .12s, border-color .12s; }
        .pchip .dot { width: 7px; height: 7px; border-radius: 50%; }
        @media (hover: hover) { .pchip:hover { background: rgba(255,255,255,.07);
          color: var(--primary-text-color); } }
        .pchip.on { color: var(--primary-text-color); border-color: transparent; }
        .pchiphint { font-size: 10.5px; color: var(--secondary-text-color); opacity: .65;
          align-self: center; }
        .pchart { position: relative; background: rgba(0,0,0,.18); border-radius: 10px;
          overflow: hidden; }
        .pchart svg { display: block; width: 100%; }
        .pgrid { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1fr);
          gap: 12px; margin-top: 14px; }
        @media (max-width: 640px) { .pgrid { grid-template-columns: 1fr; } }
        .phm { background: rgba(0,0,0,.18); border-radius: 10px; padding: 10px 12px; }
        .phmg { display: grid; gap: 2px; margin-top: 6px; }
        .phml { font-size: 9.5px; color: var(--secondary-text-color); opacity: .7;
          text-align: right; padding-right: 3px; align-self: center; }
        .phmc { border-radius: 2px; aspect-ratio: 1 / 1; min-width: 0; }
        .phmc:hover { outline: 1px solid rgba(255,255,255,.45); outline-offset: -1px; }
        .phmx { font-size: 8.5px; color: var(--secondary-text-color); opacity: .7;
          text-align: center; white-space: nowrap; overflow: visible; }
        .phmcap { font-size: 10.5px; color: var(--secondary-text-color); margin-top: 6px;
          line-height: 1.4; }
        .ptiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
        .ptile { background: rgba(0,0,0,.18); border-radius: 10px; padding: 10px 12px;
          min-height: 76px; }
        .ptile .ptv { font-size: 19px; font-weight: 400; letter-spacing: -.3px;
          color: var(--primary-text-color); }
        .ptile .ptl { font-size: 10.5px; color: var(--secondary-text-color); margin-top: 2px;
          line-height: 1.35; }
        .ptile .pts2 { font-size: 10.5px; color: var(--secondary-text-color); opacity: .75;
          margin-top: 4px; line-height: 1.35; }
        .perr { padding: 18px; font-size: 12.5px; color: var(--secondary-text-color); }
        .ptip { z-index: 1300; }
        .pxline { position: absolute; top: 0; bottom: 14px; width: 1px;
          background: rgba(255,255,255,.25); pointer-events: none; visibility: hidden; }
        .pdot { position: absolute; width: 7px; height: 7px; border-radius: 50%;
          border: 1.5px solid var(--card-background-color);
          transform: translate(-50%,-50%); pointer-events: none; visibility: hidden; }
      </style>
      <ha-card>
        <div id="hero"></div>
        <div class="kids" id="kids"><div class="kidsin" id="kidsin"></div></div>
        <div id="tips"></div>
      </ha-card>
    `;
    this._el = { hero: root.getElementById('hero'), kids: root.getElementById('kids'),
                 kidsin: root.getElementById('kidsin'), tips: root.getElementById('tips') };
    this._buildDom();
  }

  _buildDom() {
    if (!this._el) return;
    const legend = this._series.map((s, i) =>
      `<span class="it" data-n="${s.name}"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`).join('');
    const tipRows = (list) => list.map((s, i) =>
      (s.sep ? '<div class="sep"></div>' : '') +
      `<div class="tr"><span class="td" style="background:${s.color}"></span>` +
      `<span class="tn">${s.name}</span><span class="tv" data-i="${i}">--</span></div>`).join('');
    this._heroTipList = this._series.map(s => ({ name: s.name, color: s.color }))
      .concat([{ name: 'in avg', color: AVG_IN, sep: true }, { name: 'out avg', color: AVG_OUT }]);
    this._el.hero.innerHTML = `
      <div class="row hero" id="hrow">
        <svg class="g" preserveAspectRatio="none"></svg>
        <div class="reading">
          <div class="val"><span id="dv">--</span><span class="uom" id="dw"></span></div>
        </div>
        <div class="chipwrap"><span class="chip" id="chip" style="display:none">
          <span class="cdot"></span><span id="chiplab"></span></span></div>
        <div class="legend" id="legend">${legend}</div>
        <div class="toggle" id="pill"></div>
        <div class="xline"></div>
      </div>`;
    const cells = this._series.map((s, i) =>
      `<div class="cell" data-i="${i}">
        <div class="cv"><span class="ct">--</span><small>&deg;</small></div>
        <div class="cn">${s.name}</div><div class="ch">--</div>
      </div>`).join('');
    this._el.kidsin.innerHTML = `
      <div class="row hrow" id="avgrow">
        <svg class="g" preserveAspectRatio="none"></svg>
        <div class="reading">
          <div class="val"><span id="avi">--</span><span class="uom" id="avw"></span></div>
        </div>
        <div class="label">Averages &mdash; 24h</div>
        <div class="xline"></div>
      </div>
      <div class="row hrow" id="hum">
        <svg class="g" preserveAspectRatio="none"></svg>
        <div class="reading">
          <div class="val"><span id="ho">--</span><span class="uom" id="hw"></span></div>
        </div>
        <div class="label tgl" id="humlab">Humidity &mdash; 24h</div>
        <div class="xline"></div>
      </div>
      <div class="strip" id="strip">${cells}</div>` +
      (this._popEnabled ? `<div class="hstrip" id="hstrip">History &amp; stats</div>` : '');
    // v1.6: tooltips are viewport-fixed and live at ha-card level (outside the
    // rows) so overflow:hidden cannot clip them and press-transforms cannot
    // break their positioning
    const avgPair = [{ name: 'in avg', color: AVG_IN }, { name: 'out avg', color: AVG_OUT }];
    // v1.7: the moisture tooltip reads the averaged pair (out first, like the reading)
    const moistPair = [{ name: 'out', color: MOIST_OUT }, { name: 'in', color: MOIST_IN }];
    this._el.tips.innerHTML = `
      <div class="tip" id="tip-hero"><div class="tt"></div>${tipRows(this._heroTipList)}</div>
      <div class="tip" id="tip-avg"><div class="tt"></div>${tipRows(avgPair)}</div>
      <div class="tip" id="tip-hum"><div class="tt"></div>${tipRows(moistPair)}</div>`;
    this._wire();
    this._renderStates();
  }

  /* v1.7: moisture sides - rooms whose humidity feeds each average
     (Hall joins the indoor side only when hall.in_average, same as temps) */
  _moistRooms() {
    const has = r => r && r.humidity;
    return {
      ins: this._indoor.filter(has)
        .concat(this._hall && this._hall.in_average && has(this._hall) ? [this._hall] : []),
      outs: this._outdoor.filter(has),
    };
  }
  /* Magnus dew point, degrees F in and out */
  _dewF(tF, rh) {
    if (tF == null || rh == null || rh <= 0) return null;
    const c = (tF - 32) * 5 / 9;
    const g = Math.log(rh / 100) + (17.62 * c) / (243.12 + c);
    return (243.12 * g / (17.62 - g)) * 9 / 5 + 32;
  }
  _dewCol(v) { return v >= 65 ? DEW_ORANGE : (v >= 60 ? DEW_AMBER : ''); }

  /* ---------------- interactions ---------------- */
  _wire() {
    const root = this.shadowRoot;
    const hrow = root.getElementById('hrow');
    const pill = root.getElementById('pill');
    const hum = root.getElementById('hum');
    pill.textContent = 'House Climate \u2014 24h';
    // press feedback (house style)
    const press = (el, guard) => {
      el.addEventListener('pointerdown', (e) => {
        if (guard && e.composedPath().includes(guard)) return;
        el.classList.add('pressed');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        el.addEventListener(ev, () => el.classList.remove('pressed')));
    };
    press(hum); // hero row: no press feedback - it is not tappable (v1.3)
    pill.addEventListener('pointerdown', (e) => { e.stopPropagation(); pill.classList.add('pressed'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      pill.addEventListener(ev, () => pill.classList.remove('pressed')));
    pill.addEventListener('click', (e) => { e.stopPropagation(); this._toggle(); });
    // more-info taps
    const info = (id) => this.dispatchEvent(new CustomEvent('hass-more-info',
      { detail: { entityId: id }, bubbles: true, composed: true }));
    // v1.3: NO click handler on the hero/title graph (tap only scrubs there)
    hum.addEventListener('click', () => info(this._outdoor[0].humidity));
    // v1.7: moisture-row title toggles Humidity <-> Dew point (persisted)
    const humlab = root.getElementById('humlab');
    humlab.addEventListener('pointerdown', (e) => { e.stopPropagation(); humlab.classList.add('pressed'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      humlab.addEventListener(ev, () => humlab.classList.remove('pressed')));
    humlab.addEventListener('click', (e) => {
      e.stopPropagation();
      this._setMoistMode(this._moistMode === 'rh' ? 'dew' : 'rh');
    });
    this._applyMoistLabel();
    // v2.0: history pop-out opener
    const hstrip = root.getElementById('hstrip');
    if (hstrip) {
      hstrip.addEventListener('pointerdown', () => hstrip.classList.add('pressed'));
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        hstrip.addEventListener(ev, () => hstrip.classList.remove('pressed')));
      hstrip.addEventListener('click', (e) => { e.stopPropagation(); this._openPop(); });
    }
    root.getElementById('strip').querySelectorAll('.cell').forEach(cell => {
      press(cell);
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        info(this._series[+cell.dataset.i].entity);
      });
    });
    // legend tap = spotlight (v1.6)
    const legendEl = root.getElementById('legend');
    legendEl.querySelectorAll('.it').forEach(it => {
      it.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = it.dataset.n;
        this._focus = (this._focus === n) ? null : n;
        legendEl.querySelectorAll('.it').forEach(el =>
          el.classList.toggle('on', el.dataset.n === this._focus));
        this._drawHero();
      });
    });
    // scrub layers (v1.6: resolver-based, viewport-fixed tooltips)
    this._bindScrub(hrow, root.getElementById('tip-hero'),
      () => this._series.map(s => this._hist[s.entity] || [])
        .concat([(this._avgHist && this._avgHist.i) || [], (this._avgHist && this._avgHist.o) || []]),
      { top: 52, bottom: HERO_H - 28, rowH: HERO_H, gH: HERO_G,
        dots: this._series.length, colors: this._series.map(s => s.color),
        dotOn: (i) => !this._focus || this._series[i].name === this._focus });
    this._bindScrub(root.getElementById('avgrow'), root.getElementById('tip-avg'),
      () => [(this._avgRowPts && this._avgRowPts.i) || [], (this._avgRowPts && this._avgRowPts.o) || []],
      { top: 42, bottom: ROW_H - 2, rowH: ROW_H, gH: ROW_G,
        dots: 2, colors: [AVG_IN, AVG_OUT] });
    this._bindScrub(hum, root.getElementById('tip-hum'),
      () => [(this._moistRowPts && this._moistRowPts.o) || [],
             (this._moistRowPts && this._moistRowPts.i) || []],
      { top: 42, bottom: ROW_H - 2, rowH: ROW_H, gH: ROW_G,
        dots: 2, colors: [MOIST_OUT, MOIST_IN] });
  }

  _applyMoistLabel() {
    const lab = this.shadowRoot.getElementById('humlab');
    if (lab) lab.innerHTML = (this._moistMode === 'dew' ? 'Dew point' : 'Humidity') + ' &mdash; 24h';
    const plab = this._pop && this._pop.el && this._pop.el.querySelector('#pmtitle');
    if (plab) plab.textContent = this._moistMode === 'dew' ? 'Dew point' : 'Humidity';
  }
  _setMoistMode(mode) {
    this._moistMode = mode;
    try { window.localStorage.setItem(LS_MOIST, mode); } catch (e) { /* best effort */ }
    this._applyMoistLabel();
    this._renderStates();
    this._drawHum();
    if (this._pop && this._pop.open) this._popRender();
  }

  _bindScrub(rowEl, tip, getLists, band) {
    const xline = rowEl.querySelector('.xline');
    const tt = tip.querySelector('.tt');
    const tvs = tip.querySelectorAll('.tv');
    // scrub dots riding the curves (stack-card language), one per plotted line
    const dots = [];
    for (let i = 0; i < (this._scrubDots ? band.dots : 0); i++) {
      const d = document.createElement('div');
      d.className = 'sdot';
      d.style.background = (band.colors && band.colors[i]) || '#fff';
      rowEl.appendChild(d);
      dots.push(d);
    }
    const hide = () => {
      xline.style.visibility = 'hidden';
      tip.style.visibility = 'hidden';
      dots.forEach(d => { d.style.visibility = 'hidden'; });
    };
    rowEl.addEventListener('pointermove', (e) => {
      const rect = rowEl.getBoundingClientRect();
      // v1.6.1: only arm inside the graph band (where the lines live)
      const oy = e.clientY - rect.top;
      if (oy < band.top || oy > band.bottom) { hide(); return; }
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let anyT = null;
      getLists().forEach((pts, i) => {
        if (!tvs[i]) return;
        const dot = dots[i];
        if (!pts.length) {
          tvs[i].textContent = '--';
          if (dot) dot.style.visibility = 'hidden';
          return;
        }
        // v1.6.4: interpolate between the bracketing points at the hairline
        const inRange = f >= pts[0].x && f <= pts[pts.length - 1].x;
        const fc = Math.max(pts[0].x, Math.min(pts[pts.length - 1].x, f));
        let k = 0;
        while (k < pts.length - 2 && pts[k + 1].x < fc) k++;
        const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
        const span = b.x - a.x;
        const t = span > 1e-9 ? (fc - a.x) / span : 0;
        const v = a.v + (b.v - a.v) * t;
        const y = (a.y != null && b.y != null) ? a.y + (b.y - a.y) * t : null;
        tvs[i].textContent = this._fmt(v, 1);
        if (dot) {
          const show = inRange && y != null && (!band.dotOn || band.dotOn(i));
          if (show) {
            dot.style.left = (fc * 100) + '%';
            dot.style.top = (band.rowH - band.gH + y) + 'px';
          }
          dot.style.visibility = show ? 'visible' : 'hidden';
        }
        if (anyT == null) anyT = a.t + (b.t - a.t) * t;
      });
      if (anyT == null) return;
      tt.textContent = this._fmtTime(anyT);
      const px = f * rect.width;
      xline.style.left = px + 'px';
      xline.style.visibility = 'visible';
      // v1.6.2: GRAPH-ANCHORED panel - fixed to the top of the row's graph,
      // sliding only horizontally with the scrub; viewport-fixed = unclipped,
      // flips to the left side of the scrub near the screen edge
      tip.style.visibility = 'hidden';
      const tw = tip.offsetWidth || 150, th = tip.offsetHeight || 60;
      let x = rect.left + px + 16;
      if (x + tw > window.innerWidth - 8) x = rect.left + px - 16 - tw;
      x = Math.max(8, x);
      let y = rect.top + band.top - 4;
      y = Math.max(8, Math.min(window.innerHeight - th - 8, y));
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      tip.style.visibility = 'visible';
    });
    ['pointerleave', 'pointercancel', 'pointerup'].forEach(ev =>
      rowEl.addEventListener(ev, (e) => {
        if (ev === 'pointerup' && e.pointerType === 'mouse') return; // mouse keeps hover
        hide();
      }));
  }

  _toggle() {
    this._open = !this._open;
    this._el.kids.classList.toggle('open', this._open);
  }

  /* ---------------- live state / headline ---------------- */
  _num(id) {
    const s = this._hass && this._hass.states[id];
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }
  _avg(list, key) {
    const vs = list.map(r => this._num(r[key])).filter(v => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  }

  _renderStates() {
    if (!this._hass || !this._el) return;
    const root = this.shadowRoot;
    const inList = this._indoor.concat(this._hall && this._hall.in_average ? [this._hall] : []);
    const inT = this._avg(inList, 'entity');
    // sun-spike trim: no outdoor sensor may count more than sun_cap above the coolest one
    const outVals = this._outdoor.map(r => this._num(r.entity)).filter(v => v != null);
    let outT = null;
    if (outVals.length) {
      const m = Math.min.apply(null, outVals);
      const trimmed = outVals.map(v => Math.min(v, m + this._sunCap));
      outT = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }
    const delta = (inT != null && outT != null) ? inT - outT : null;
    const dv = root.getElementById('dv'), dw = root.getElementById('dw');
    const hrow = root.getElementById('hrow');
    if (delta == null) {
      dv.textContent = '--'; dw.textContent = '';
      hrow.classList.add('unavailable');
    } else {
      hrow.classList.remove('unavailable');
      dv.textContent = this._fmt(Math.abs(delta), 1);
      dw.textContent = '\u00b0F ' + (delta >= 0 ? 'cooler' : 'warmer') + ' outside';
    }
    // chip with hysteresis; green or absent, never red; delta-only (v1.4)
    const c = this._chipCfg;
    if (delta == null) this._chipOn = false;
    else if (!this._chipOn && delta >= c.on_delta) this._chipOn = true;
    else if (this._chipOn && delta < c.off_delta) this._chipOn = false;
    if (this._chipShown !== this._chipOn) {           // idempotent display writes
      const chip = root.getElementById('chip');
      root.getElementById('chiplab').textContent = c.label;
      chip.style.display = this._chipOn ? 'inline-flex' : 'none';
      this._chipShown = this._chipOn;
    }
    // averages-row reading (v1.6): same inT/outT/delta as the headline
    const avgrow = root.getElementById('avgrow');
    if (inT == null || outT == null) {
      root.getElementById('avi').textContent = '--';
      root.getElementById('avw').textContent = '';
      avgrow.classList.add('unavailable');
    } else {
      avgrow.classList.remove('unavailable');
      root.getElementById('avi').textContent = this._fmt(inT, 1);
      root.getElementById('avw').textContent =
        '\u00b0 in \u00b7 ' + this._fmt(outT, 1) + '\u00b0 out \u00b7 \u0394 ' + this._fmt(delta, 1);
    }
    // moisture reading (v1.7): averaged sides, mode-aware
    const mr = this._moistRooms();
    const hoEl = root.getElementById('ho'), hwEl = root.getElementById('hw');
    let mOut = null, mIn = null;
    if (this._moistMode === 'dew') {
      const side = rooms => {
        const vs = rooms.map(r => this._dewF(this._num(r.entity), this._num(r.humidity)))
          .filter(v => v != null);
        return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
      };
      mOut = side(mr.outs); mIn = side(mr.ins);
      hoEl.textContent = mOut == null ? '--' : this._fmt(mOut, 1);
      hoEl.style.color = (mOut != null && this._dewCol(mOut)) || '';
      const inCol = (mIn != null && this._dewCol(mIn)) || '';
      const inStr = mIn == null ? '--'
        : '<span style="color:' + (inCol || 'inherit') + '">' + this._fmt(mIn, 1) + '&deg;</span>';
      hwEl.innerHTML = '&deg; out &middot; ' + inStr + ' in' +
        (mOut != null && mIn != null ? ' &middot; &Delta; ' + this._fmt(mOut - mIn, 1) : '');
    } else {
      mOut = this._avg(mr.outs, 'humidity'); mIn = this._avg(mr.ins, 'humidity');
      hoEl.textContent = mOut == null ? '--' : this._fmt(mOut, 0);
      hoEl.style.color = '';
      hwEl.textContent =
        '% out \u00b7 ' + (mIn == null ? '--' : this._fmt(mIn, 0)) + '% in';
    }
    root.getElementById('hum').classList.toggle('unavailable', mOut == null && mIn == null);
    // strip
    root.getElementById('strip').querySelectorAll('.cell').forEach(cell => {
      const s = this._series[+cell.dataset.i];
      const t = this._num(s.entity), h = this._num(s.humidity);
      cell.classList.toggle('unavailable', t == null);
      cell.querySelector('.ct').textContent = t == null ? '--' : this._fmt(t, 1);
      cell.querySelector('.ch').textContent = h == null ? '--' : this._fmt(h, 0) + '%';
    });
  }

  _fmt(v, d) { return Number(v).toFixed(d); }
  _fmtTime(t) {
    const dte = new Date(t);
    let h = dte.getHours(); const m = dte.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }

  /* ---------------- history ---------------- */
  async _fetchHistory() {
    if (!this._hass) return;
    const hours = this._config.hours || DEF_HOURS;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600e3);
    // v1.7: all six humidity sensors ride along (12 entities total)
    const ids = Array.from(new Set(
      this._series.map(r => r.entity)
        .concat(this._series.map(r => r.humidity).filter(Boolean))));
    let result = null;
    try {
      result = await this._hass.callWS({
        type: 'history/history_during_period',
        start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: ids, include_start_time_state: true,
        significant_changes_only: false, minimal_response: true, no_attributes: true,
      });
    } catch (e) {
      try { // REST fallback (older cores)
        const raw = await this._hass.callApi('GET',
          'history/period/' + start.toISOString() + '?filter_entity_id=' + ids.join(',') +
          '&end_time=' + encodeURIComponent(end.toISOString()) + '&minimal_response&no_attributes');
        result = {};
        (raw || []).forEach(list => {
          if (list && list.length) result[list[0].entity_id] =
            list.map(it => ({ s: it.state, lu: Date.parse(it.last_updated || it.last_changed) / 1000 }));
        });
      } catch (e2) { return; }
    }
    if (!result) return;
    this._t0 = start.getTime(); this._t1 = end.getTime();
    ids.forEach(id => {
      this._hist[id] = this._bucket(result[id] || [], start.getTime(), end.getTime(), hours, id);
    });
    this._drawHero();
    this._drawAvg();
    this._drawHum();
  }

  _bucket(items, t0, t1, hours, id) {
    const sums = new Array(hours).fill(0), counts = new Array(hours).fill(0);
    for (const it of items) {
      const v = parseFloat(it.s != null ? it.s : it.state);
      if (isNaN(v)) continue;
      let ts = it.lu != null ? it.lu * 1000 : Date.parse(it.last_updated || it.last_changed);
      if (!ts) continue;
      let b = Math.floor((ts - t0) / 3600e3);
      if (b < 0) b = 0;
      if (b >= hours) b = hours - 1;
      sums[b] += v; counts[b] += 1;
    }
    const out = [];
    for (let b = 0; b < hours; b++) {
      if (!counts[b]) continue;
      out.push({ t: t0 + (b + 0.5) * 3600e3, v: sums[b] / counts[b] });
    }
    const live = this._num(id);
    if (live != null) out.push({ t: t1, v: live });
    if (out.length < 2) return [];
    out.forEach(p => { p.x = (p.t - t0) / (t1 - t0); });
    return out;
  }

  /* shared-scale y assignment + smooth path
     (minSpan: optional floor on the value span - dew mode uses 10 F so the
      genuinely-flat marine dew band renders flat instead of auto-zoomed) */
  _scaleY(lists, gH, padT, padB, minSpan) {
    let lo = Infinity, hi = -Infinity;
    lists.forEach(pts => pts.forEach(p => {
      if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v;
    }));
    if (!isFinite(lo)) return false;
    if (hi - lo < 1e-9) { hi += .5; lo -= .5; }
    if (minSpan && hi - lo < minSpan) {
      const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2;
    }
    lists.forEach(pts => pts.forEach(p => {
      p.y = padT + (1 - (p.v - lo) / (hi - lo)) * (gH - padT - padB);
    }));
    return true;
  }
  _path(pts, w) {
    const P = pts.map(p => [p.x * w, p.y]);
    let d = 'M ' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
    for (let k = 1; k < P.length; k++) {
      const mx = ((P[k - 1][0] + P[k][0]) / 2).toFixed(1);
      const my = ((P[k - 1][1] + P[k][1]) / 2).toFixed(1);
      d += ' Q ' + P[k - 1][0].toFixed(1) + ' ' + P[k - 1][1].toFixed(1) + ' ' + mx + ' ' + my;
    }
    d += ' L ' + P[P.length - 1][0].toFixed(1) + ' ' + P[P.length - 1][1].toFixed(1);
    return d;
  }

  _avgPts(list, trim) {
    // average bucketed history across entities, aligned by bucket time
    const byT = new Map();
    list.forEach(r => (this._hist[r.entity] || []).forEach(p => {
      if (!byT.has(p.t)) byT.set(p.t, []);
      byT.get(p.t).push(p.v);
    }));
    const out = [];
    Array.from(byT.keys()).sort((a, b) => a - b).forEach(t => {
      let vs = byT.get(t);
      if (trim && vs.length > 1) {
        const m = Math.min.apply(null, vs);
        vs = vs.map(v => Math.min(v, m + this._sunCap));
      }
      out.push({ t: t, v: vs.reduce((a, b) => a + b, 0) / vs.length });
    });
    if (out.length < 2 || !this._t1) return [];
    out.forEach(p => { p.x = (p.t - this._t0) / (this._t1 - this._t0); });
    return out;
  }

  _drawHero() {
    const root = this.shadowRoot;
    const hrow = root.getElementById('hrow');
    const svg = hrow.querySelector('svg.g');
    const w = hrow.clientWidth || 500;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + HERO_G);
    const lists = this._series.map(s => this._hist[s.entity] || []);
    const inList = this._indoor.concat(this._hall && this._hall.in_average ? [this._hall] : []);
    const avgIn = this._avgOp > 0 ? this._avgPts(inList, false) : [];
    const avgOut = this._avgOp > 0 ? this._avgPts(this._outdoor, true) : [];
    // averages always computed for the tooltip + averages row, drawn per avg_opacity
    this._avgHist = { i: avgIn, o: avgOut };
    const all = lists.filter(l => l.length).concat([avgIn, avgOut].filter(l => l.length));
    if (!this._scaleY(all, HERO_G, 50, 30)) { svg.innerHTML = ''; return; }
    // v1.6: no on-chart text at rest; legend tap spotlights one line
    const focus = this._focus;
    let paths = '', labels = '';
    this._series.forEach((s, i) => {
      const pts = lists[i];
      if (!pts.length) return;
      const op = focus ? (s.name === focus ? 1 : 0.18) : 1;
      const wd = (focus && s.name === focus) ? 2.5 : 2;
      paths += '<path d="' + this._path(pts, w) + '" fill="none" stroke="' + s.color +
        '" stroke-width="' + wd + '" opacity="' + op +
        '" stroke-linecap="round" stroke-linejoin="round"></path>';
      if (focus && s.name === focus) {
        // single label on the spotlighted line: name + current value at its max
        let best = pts[0];
        pts.forEach(p => { if (p.v > best.v) best = p; });
        const live = this._num(s.entity);
        const txt = s.name + (live != null ? ' ' + this._fmt(live, 1) : '');
        const x = Math.max(30, Math.min(w - 30, best.x * w));
        const y = Math.min(HERO_G - 30, Math.max(58, best.y - 9));
        labels += '<text class="dlab" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
          '" fill="' + s.color + '" text-anchor="middle">' + txt + '</text>';
      }
    });
    // quiet dashed averages (hint only; the numbers live in the Averages row)
    let avgs = '';
    if (avgIn.length && avgOut.length && this._avgOp > 0) {
      const op = focus ? Math.min(this._avgOp, 0.12) : this._avgOp;
      avgs += '<path d="' + this._path(avgIn, w) + '" fill="none" stroke="' + AVG_IN +
        '" stroke-width="2" opacity="' + op + '" stroke-dasharray="6 5" stroke-linecap="round"></path>';
      avgs += '<path d="' + this._path(avgOut, w) + '" fill="none" stroke="' + AVG_OUT +
        '" stroke-width="2" opacity="' + op + '" stroke-dasharray="6 5" stroke-linecap="round"></path>';
    }
    svg.innerHTML = paths + avgs + labels;
  }

  _drawAvg() {
    const root = this.shadowRoot;
    const row = root.getElementById('avgrow');
    const svg = row.querySelector('svg.g');
    const w = row.clientWidth || 500;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + ROW_G);
    if (!this._avgHist) { svg.innerHTML = ''; return; }
    // fresh copies: the hero's scale pass owns the y of the shared arrays
    const cp = pts => pts.map(p => ({ t: p.t, v: p.v, x: p.x }));
    const ai = cp(this._avgHist.i), ao = cp(this._avgHist.o);
    if (!this._scaleY([ai, ao].filter(l => l.length), ROW_G, 26, 6)) { svg.innerHTML = ''; return; }
    this._avgRowPts = { i: ai, o: ao };  // row-scaled copies for the avg-row scrub dots
    let out = '';
    [[ai, AVG_IN, 'in', -6], [ao, AVG_OUT, 'out', 15]].forEach(([pts, c, txt, dy]) => {
      if (!pts.length) return;
      out += '<path d="' + this._path(pts, w) + '" fill="none" stroke="' + c +
        '" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round" stroke-linejoin="round"></path>';
      const y = Math.min(ROW_G - 6, Math.max(13, pts[pts.length - 1].y + dy));
      out += '<text class="dlab" x="' + (w - 6) + '" y="' + y.toFixed(1) +
        '" fill="' + c + '" text-anchor="end">' + txt + '</text>';
    });
    svg.innerHTML = out;
  }

  /* v1.7: averaged history per side; RH straight from the humidity hists,
     dew per-sensor per-bucket (Magnus) then averaged - both drawn DASHED */
  _moistAvgHist(rooms) {
    const byT = new Map();
    rooms.forEach(r => (this._hist[r.humidity] || []).forEach(p => {
      if (!byT.has(p.t)) byT.set(p.t, []);
      byT.get(p.t).push(p.v);
    }));
    return this._byTAvg(byT);
  }
  _dewAvgHist(rooms) {
    const byT = new Map();
    rooms.forEach(r => {
      const hs = this._hist[r.humidity] || [];
      const tMap = new Map((this._hist[r.entity] || []).map(p => [p.t, p.v]));
      hs.forEach(p => {
        const d = tMap.has(p.t) ? this._dewF(tMap.get(p.t), p.v) : null;
        if (d == null) return;
        if (!byT.has(p.t)) byT.set(p.t, []);
        byT.get(p.t).push(d);
      });
    });
    return this._byTAvg(byT);
  }
  _byTAvg(byT) {
    const out = [];
    Array.from(byT.keys()).sort((a, b) => a - b).forEach(t => {
      const vs = byT.get(t);
      out.push({ t: t, v: vs.reduce((a, b) => a + b, 0) / vs.length });
    });
    if (out.length < 2 || !this._t1) return [];
    out.forEach(p => { p.x = (p.t - this._t0) / (this._t1 - this._t0); });
    return out;
  }

  _drawHum() {
    const root = this.shadowRoot;
    const hum = root.getElementById('hum');
    const svg = hum.querySelector('svg.g');
    const w = hum.clientWidth || 500;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + ROW_G);
    const mr = this._moistRooms();
    const dew = this._moistMode === 'dew';
    const lo2 = dew ? this._dewAvgHist(mr.outs) : this._moistAvgHist(mr.outs);
    const li2 = dew ? this._dewAvgHist(mr.ins) : this._moistAvgHist(mr.ins);
    if (!this._scaleY([lo2, li2].filter(l => l.length), ROW_G, 26, 6, dew ? 10 : 0)) {
      this._moistRowPts = { o: [], i: [] };
      svg.innerHTML = ''; return;
    }
    this._moistRowPts = { o: lo2, i: li2 };  // scrub reads these (out, then in)
    let paths = '';
    [[lo2, MOIST_OUT], [li2, MOIST_IN]].forEach(([pts, c]) => {
      if (!pts.length) return;
      paths += '<path d="' + this._path(pts, w) + '" fill="none" stroke="' + c +
        '" stroke-width="2" stroke-dasharray="6 5"' +
        ' stroke-linecap="round" stroke-linejoin="round"></path>';
    });
    svg.innerHTML = paths;
  }

  /* ================= v2.0: history pop-out ================= */

  _openPop() {
    if (!this._popEnabled) return;
    if (!this._pop.el) this._popDom();
    this._pop.open = true;
    this._pop.el.style.display = '';
    this._popKey = (e) => { if (e.key === 'Escape') this._closePop(); };
    window.addEventListener('keydown', this._popKey);
    this._popRes = () => {
      clearTimeout(this._popResT);
      this._popResT = setTimeout(() => { if (this._pop.open) this._popRender(); }, 150);
    };
    window.addEventListener('resize', this._popRes);
    this._popRender();
  }
  _closePop() {
    this._pop.open = false;
    if (this._pop.el) this._pop.el.style.display = 'none';
    if (this._popKey) { window.removeEventListener('keydown', this._popKey); this._popKey = null; }
    if (this._popRes) { window.removeEventListener('resize', this._popRes); this._popRes = null; }
  }

  _popDom() {
    const card = this.shadowRoot.querySelector('ha-card');
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.display = 'none';
    const tabs = Object.keys(POP_R).map(k =>
      `<button class="ptab" data-k="${k}">${k}</button>`).join('');
    const chips = this._series.map(s =>
      `<button class="pchip" data-n="${s.name}">` +
      `<span class="dot" style="background:${s.color}"></span>${s.name}</button>`).join('');
    el.innerHTML = `
      <div class="popin">
        <div class="pophead">
          <div class="poptitle">House Climate<span class="popsub" id="psub"></span></div>
          <div class="ptabs" id="ptabs">${tabs}</div>
          <button class="popx" id="popx" title="Close">&#10005;</button>
        </div>
        <div class="psect">
          <div class="pshead">
            <div class="pstitle">Temperature</div>
            <div class="pleg" id="pleg1"></div>
          </div>
          <div class="pchips">${chips}<span class="pchiphint" id="pchiphint"></span></div>
          <div class="pchart" id="ptchart"></div>
        </div>
        <div class="psect">
          <div class="pshead">
            <div class="pstitle tgl" id="pmtitle">Humidity</div>
            <div class="pleg"><i style="border-color:${MOIST_IN}"></i>in` +
              `<i style="border-color:${MOIST_OUT}"></i>out</div>
          </div>
          <div class="pchart" id="pmchart"></div>
        </div>
        <div class="pgrid">
          <div class="phm">
            <div class="pstitle">When it's cooler outside</div>
            <div id="phmwrap"></div>
            <div class="phmcap" id="phmcap"></div>
          </div>
          <div class="ptiles" id="ptiles"></div>
        </div>
        <div class="pnote" style="font-size:10.5px;color:var(--secondary-text-color);opacity:.6;margin-top:10px" id="pnote"></div>
      </div>`;
    card.appendChild(el);
    this._pop.el = el;
    el.addEventListener('click', (e) => { if (e.target === el) this._closePop(); });
    el.querySelector('#popx').addEventListener('click', () => this._closePop());
    el.querySelector('#ptabs').addEventListener('click', (e) => {
      const b = e.target.closest('.ptab');
      if (!b) return;
      this._pop.cur = b.dataset.k;
      this._popRender();
    });
    el.querySelectorAll('.pchip').forEach(ch => ch.addEventListener('click', () => {
      const n = ch.dataset.n;
      const i = this._pop.sel.indexOf(n);
      if (i >= 0) this._pop.sel.splice(i, 1);
      else { this._pop.sel.push(n); if (this._pop.sel.length > 3) this._pop.sel.shift(); }
      this._popRender();
    }));
    const pm = el.querySelector('#pmtitle');
    pm.addEventListener('click', () =>
      this._setMoistMode(this._moistMode === 'rh' ? 'dew' : 'rh'));
    // v2.0.2: heatmap cell hover -> card-style tooltip (delegated)
    const hw = el.querySelector('#phmwrap');
    hw.addEventListener('pointermove', (e) => this._popHeatHover(e));
    ['pointerleave', 'pointercancel'].forEach(ev => hw.addEventListener(ev, () => {
      if (this._pop.tip) this._pop.tip.style.visibility = 'hidden';
    }));
    // v2.0.1: scrub on both pop-out charts (hairline + dots + anchored tooltip)
    const tip = document.createElement('div');
    tip.className = 'tip ptip';
    el.appendChild(tip);
    this._pop.tip = tip;
    ['ptchart', 'pmchart'].forEach(id => {
      const box = el.querySelector('#' + id);
      box.addEventListener('pointermove', (e) => this._popScrub(box, e));
      ['pointerleave', 'pointercancel'].forEach(ev =>
        box.addEventListener(ev, () => this._popScrubHide(box)));
    });
  }

  _popHeatHover(e) {
    const tip = this._pop.tip;
    if (!tip) return;
    const c = e.target && e.target.closest && e.target.closest('.phmc');
    if (!c) { tip.style.visibility = 'hidden'; return; }
    const v = c.dataset.v === '' ? null : Number(c.dataset.v);
    const dot = v == null ? '#666' : (v >= this._chipCfg.on_delta ? GOOD : '#8a8a8a');
    tip.innerHTML = '<div class="tt">' + c.dataset.l + '</div>' +
      '<div class="tr"><span class="td" style="background:' + dot + '"></span>' +
      '<span class="tn">mean \u0394</span><span class="tv">' +
      (v == null ? 'no data' : this._fmt(v, 1) + '\u00b0') + '</span></div>';
    tip.style.visibility = 'hidden';
    const r = c.getBoundingClientRect();
    const tw = tip.offsetWidth || 120, th = tip.offsetHeight || 44;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.style.visibility = 'visible';
  }

  _popScrubHide(box) {
    const line = box.querySelector('.pxline');
    if (line) line.style.visibility = 'hidden';
    (box._dots || []).forEach(d => { d.style.visibility = 'hidden'; });
    if (this._pop.tip) this._pop.tip.style.visibility = 'hidden';
  }
  _popFmtT(t, spanMs) {
    const d = new Date(t);
    if (spanMs <= 2.2 * 864e5) return this._fmtTime(t);
    if (spanMs <= 9 * 864e5) return DAYS[d.getDay()] + ' ' + this._fmtHr(t);
    return this._fmtDay(t);
  }
  _popScrub(box, e) {
    const sc = box._sc, tip = this._pop.tip;
    if (!sc || !tip) return;
    const rect = box.getBoundingClientRect();
    let line = box.querySelector('.pxline');
    if (!line) { line = document.createElement('div'); line.className = 'pxline'; box.appendChild(line); }
    if (!box._dots) box._dots = [];
    const span = rect.width - 2 * sc.PL;
    if (span <= 0) return;
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left - sc.PL) / span));
    let rows = '', di = 0, any = false;
    sc.lines.forEach(L => {
      const pts = L.pts;
      if (!pts || pts.length < 2) return;
      const inR = f >= pts[0].x && f <= pts[pts.length - 1].x;
      const fc = Math.max(pts[0].x, Math.min(pts[pts.length - 1].x, f));
      let k = 0;
      while (k < pts.length - 2 && pts[k + 1].x < fc) k++;
      const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
      const dx = b.x - a.x;
      const tt = dx > 1e-9 ? (fc - a.x) / dx : 0;
      const v = a.v + (b.v - a.v) * tt;
      let d = box._dots[di];
      if (!d) { d = document.createElement('div'); d.className = 'pdot'; box.appendChild(d); box._dots[di] = d; }
      di += 1;
      if (inR && this._scrubDots) {
        d.style.background = L.c;
        d.style.left = (sc.PL + fc * span) + 'px';
        d.style.top = sc.Y(v) + 'px';
        d.style.visibility = 'visible';
      } else d.style.visibility = 'hidden';
      rows += '<div class="tr"><span class="td" style="background:' + L.c + '"></span>' +
        '<span class="tn">' + L.name + '</span><span class="tv">' +
        (inR ? this._fmt(v, sc.unit === '%' ? 0 : 1) + sc.unit : '--') + '</span></div>';
      any = true;
    });
    for (let j = di; j < box._dots.length; j++) box._dots[j].style.visibility = 'hidden';
    if (!any) return;
    const t = sc.t0 + f * (sc.tEnd - sc.t0);
    tip.innerHTML = '<div class="tt">' + this._popFmtT(t, sc.tEnd - sc.t0) + '</div>' + rows;
    line.style.left = (sc.PL + f * span) + 'px';
    line.style.visibility = 'visible';
    tip.style.visibility = 'hidden';
    const tw = tip.offsetWidth || 140, th = tip.offsetHeight || 60;
    let x = rect.left + sc.PL + f * span + 16;
    if (x + tw > window.innerWidth - 8) x = rect.left + sc.PL + f * span - 16 - tw;
    x = Math.max(8, x);
    const y = Math.max(8, Math.min(window.innerHeight - th - 8, rect.top + 4));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.style.visibility = 'visible';
  }

  /* display-only calming of min-max band edges (rolling mean, radius r) */
  _smoothBand(pts, r) {
    if (!r || pts.length < 3) return pts;
    return pts.map((p, i) => {
      if (p.mn == null || p.mx == null) return p;
      let smn = 0, smx = 0, c = 0;
      for (let k = i - r; k <= i + r; k++) {
        const q = pts[Math.max(0, Math.min(pts.length - 1, k))];
        if (q.mn == null || q.mx == null) continue;
        smn += q.mn; smx += q.mx; c += 1;
      }
      return c ? Object.assign({}, p, { mn: smn / c, mx: smx / c }) : p;
    });
  }

  /* ---- data: statistics path (7d+) ---- */
  async _popStats(key) {
    const r = POP_R[key];
    const c = this._pop.cache[key];
    if (c && Date.now() - c.at < REFRESH_MS) return c;
    const end = new Date(), start = new Date(end.getTime() - r.days * 864e5);
    const ids = Array.from(new Set(
      this._series.map(s => s.entity)
        .concat(this._series.map(s => s.humidity).filter(Boolean))));
    const res = await this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: end.toISOString(),
      statistic_ids: ids, period: r.period, types: ['mean', 'min', 'max'],
    });
    const t0 = start.getTime(), t1 = end.getTime();
    const bMs = r.group * (r.period === 'hour' ? 3600e3 : 864e5);
    const gp = {}, hourly = {};
    ids.forEach(id => {
      const rows = (res[id] || []).map(row => {
        let t = row.start;
        if (typeof t === 'string') t = Date.parse(t);
        return { t: t, mean: row.mean,
                 min: row.min != null ? row.min : row.mean,
                 max: row.max != null ? row.max : row.mean };
      }).filter(row => row.t && row.mean != null &&
        !(row.mean === 0 && row.min === 0 && row.max === 0)); // zero-poisoning filter
      if (r.period === 'hour') hourly[id] = rows;
      const m = new Map();
      rows.forEach(row => {
        const b = Math.floor((row.t - t0) / bMs);
        if (!m.has(b)) m.set(b, { s: 0, c: 0, mn: Infinity, mx: -Infinity });
        const g = m.get(b);
        g.s += row.mean; g.c += 1;
        g.mn = Math.min(g.mn, row.min); g.mx = Math.max(g.mx, row.max);
      });
      gp[id] = Array.from(m.keys()).sort((a, b) => a - b).map(b => {
        const g = m.get(b);
        const t = t0 + (b + 0.5) * bMs;
        return { t: t, x: (t - t0) / (t1 - t0), v: g.s / g.c, mn: g.mn, mx: g.mx };
      });
    });
    const out = { at: Date.now(), t0: t0, t1: t1, gp: gp,
                  hourly: r.period === 'hour' ? hourly : null };
    this._pop.cache[key] = out;
    return out;
  }

  /* hourly temp stats for the heatmap: the range itself when it is hour-period,
     else a shared last-30-days fetch (a year of hourly rows is too heavy) */
  async _popHourly(key) {
    const r = POP_R[key];
    if (r.period === 'hour') {
      const d = await this._popStats(key);
      return { hourly: d.hourly, days: r.days, capped: false };
    }
    const c = this._pop.cache.hm30;
    if (c && Date.now() - c.at < REFRESH_MS) return c;
    const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
    const ids = this._series.map(s => s.entity);
    const res = await this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: end.toISOString(),
      statistic_ids: ids, period: 'hour', types: ['mean'],
    });
    const hourly = {};
    ids.forEach(id => {
      hourly[id] = (res[id] || []).map(row => {
        let t = row.start;
        if (typeof t === 'string') t = Date.parse(t);
        return { t: t, mean: row.mean };
      }).filter(row => row.t && row.mean != null && row.mean !== 0);
    });
    const out = { at: Date.now(), hourly: hourly, days: 30, capped: true };
    this._pop.cache.hm30 = out;
    return out;
  }

  /* v2.1: full-range hourly temps for the SEASONAL heatmap (3m/6m/1y),
     fetched in 45-day chunks - a year of hourly rows in one call is too
     heavy. Cached 30 min. Months without data simply render empty. */
  async _popHmSeasonal(key) {
    const c = this._pop.cache['hmR' + key];
    if (c && Date.now() - c.at < 30 * 60e3) return c;
    const r = POP_R[key];
    const t1 = Date.now(), t0 = t1 - r.days * 864e5;
    const ids = this._series.map(s => s.entity);
    const hourly = {};
    ids.forEach(id => { hourly[id] = []; });
    const CH = 45 * 864e5;
    for (let a = t0; a < t1; a += CH) {
      const b = Math.min(t1, a + CH);
      const res = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: new Date(a).toISOString(), end_time: new Date(b).toISOString(),
        statistic_ids: ids, period: 'hour', types: ['mean'],
      });
      ids.forEach(id => ((res && res[id]) || []).forEach(row => {
        let t = row.start;
        if (typeof t === 'string') t = Date.parse(t);
        if (t && row.mean != null && row.mean !== 0) hourly[id].push({ t: t, mean: row.mean });
      }));
    }
    const out = { at: Date.now(), hourly: hourly, days: r.days, capped: false,
                  seasonal: true, weekly: !!r.hmWeeks, t0: t0, t1: t1 };
    this._pop.cache['hmR' + key] = out;
    return out;
  }

  /* v2.1: the same-length window immediately before this one (extremes tile
     "vs prior <period>" line); outdoor sun-trimmed means compared. */
  async _popPrev(key) {
    const c = this._pop.cache['prev' + key];
    if (c && Date.now() - c.at < 30 * 60e3) return c;
    const r = POP_R[key];
    const end = new Date(Date.now() - r.days * 864e5);
    const start = new Date(end.getTime() - r.days * 864e5);
    const ids = this._series.map(s => s.entity);
    const res = await this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: end.toISOString(),
      statistic_ids: ids, period: r.period || 'hour', types: ['mean'],
    });
    const gp = {};
    ids.forEach(id => {
      gp[id] = ((res && res[id]) || []).map(row => {
        let t = row.start;
        if (typeof t === 'string') t = Date.parse(t);
        return { t: t, x: 0, v: row.mean, mn: row.mean, mx: row.mean };
      }).filter(p => p.t && p.v != null && p.v !== 0);
    });
    const inRooms = this._indoor.concat(this._hall && this._hall.in_average ? [this._hall] : []);
    const mean = pts => pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
    const out = { at: Date.now(),
      outMean: mean(this._popSideTemp(gp, this._outdoor, true)),
      inMean: mean(this._popSideTemp(gp, inRooms, false)) };
    this._pop.cache['prev' + key] = out;
    return out;
  }

  /* window contacts + hvac_action over the past 7 days (recorder history) */
  async _popBins() {
    const c = this._pop.cache.bins;
    if (c && Date.now() - c.at < REFRESH_MS) return c;
    const end = new Date(), start = new Date(end.getTime() - 7 * 864e5);
    const out = { at: Date.now(), t0: start.getTime(), t1: end.getTime(),
                  open: [], cool: [], heat: [] };
    try {
      if (this._contacts.length) {
        const res = await this._hass.callWS({
          type: 'history/history_during_period',
          start_time: start.toISOString(), end_time: end.toISOString(),
          entity_ids: this._contacts, include_start_time_state: true,
          significant_changes_only: false, minimal_response: true, no_attributes: true,
        });
        this._contacts.forEach(id => {
          let onT = null;
          ((res && res[id]) || []).forEach(it => {
            const t = (it.lu != null ? it.lu * 1000 : Date.parse(it.last_updated || it.last_changed));
            const st = it.s != null ? it.s : it.state;
            if (st === 'on') { if (onT == null) onT = t; }
            else if (onT != null) { out.open.push([onT, t]); onT = null; }
          });
          if (onT != null) out.open.push([onT, end.getTime()]);
        });
      }
    } catch (e) { /* contacts optional */ }
    try {
      if (this._hvacEnt) {
        const res = await this._hass.callWS({
          type: 'history/history_during_period',
          start_time: start.toISOString(), end_time: end.toISOString(),
          entity_ids: [this._hvacEnt], include_start_time_state: true,
          significant_changes_only: false, minimal_response: false, no_attributes: false,
        });
        let act = null, actT = null;
        ((res && res[this._hvacEnt]) || []).forEach(it => {
          const t = (it.lu != null ? it.lu * 1000 : Date.parse(it.last_updated || it.last_changed));
          const a = it.a || it.attributes;
          const next = a && a.hvac_action !== undefined ? a.hvac_action : act;
          if (next !== act) {
            if (act === 'cooling' && actT != null) out.cool.push([actT, t]);
            if (act === 'heating' && actT != null) out.heat.push([actT, t]);
            act = next; actT = t;
          }
        });
        if (act === 'cooling' && actT != null) out.cool.push([actT, end.getTime()]);
        if (act === 'heating' && actT != null) out.heat.push([actT, end.getTime()]);
      }
    } catch (e) { /* hvac optional */ }
    this._pop.cache.bins = out;
    return out;
  }

  /* hourly weather forecast (the weather card's own feed) - outdoor only */
  async _popForecast() {
    if (!this._fcEnt) return null;
    const c = this._pop.cache.fc;
    if (c && Date.now() - c.at < 15 * 60e3) return c.list;
    let list = null;
    try {
      list = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('fc timeout')), 6000);
        try {
          const p = this._hass.connection.subscribeMessage((msg) => {
            clearTimeout(to);
            resolve((msg && msg.forecast) || []);
            Promise.resolve(p).then(un => { try { un(); } catch (e) {} });
          }, { type: 'weather/subscribe_forecast', forecast_type: 'hourly',
               entity_id: this._fcEnt });
          Promise.resolve(p).catch(err => { clearTimeout(to); reject(err); });
        } catch (err) { clearTimeout(to); reject(err); }
      });
    } catch (e) {
      try {
        const r = await this._hass.callWS({
          type: 'call_service', domain: 'weather', service: 'get_forecasts',
          service_data: { type: 'hourly' }, target: { entity_id: this._fcEnt },
          return_response: true,
        });
        const resp = r && (r.response || r);
        list = resp && resp[this._fcEnt] && resp[this._fcEnt].forecast;
      } catch (e2) { list = null; }
    }
    if (!list) return null;
    const now = Date.now();
    const out = list.map(f => ({
      t: Date.parse(f.datetime), temp: f.temperature, hum: f.humidity,
    })).filter(f => f.t && f.t > now && f.temp != null).slice(0, 12);
    this._pop.cache.fc = { at: now, list: out };
    return out;
  }

  /* ---- series assembly ---- */
  _popSideTemp(gp, rooms, trim) {
    // align by bucket time; average means; envelope = avg(min)..avg(trimmed max)
    const byT = new Map();
    rooms.forEach(r => (gp[r.entity] || []).forEach(p => {
      if (!byT.has(p.t)) byT.set(p.t, []);
      byT.get(p.t).push(p);
    }));
    const out = [];
    Array.from(byT.keys()).sort((a, b) => a - b).forEach(t => {
      const ps = byT.get(t);
      let vs = ps.map(p => p.v), mns = ps.map(p => p.mn != null ? p.mn : p.v),
          mxs = ps.map(p => p.mx != null ? p.mx : p.v);
      if (trim && vs.length > 1) {
        const m = Math.min.apply(null, vs);
        vs = vs.map(v => Math.min(v, m + this._sunCap));
        const mm = Math.min.apply(null, mxs);
        mxs = mxs.map(v => Math.min(v, mm + this._sunCap));
      }
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      out.push({ t: t, x: ps[0].x, v: avg(vs), mn: avg(mns), mx: avg(mxs) });
    });
    return out;
  }
  _popSideMoist(gp, rooms, dew) {
    const byT = new Map();
    rooms.forEach(r => {
      const hs = gp[r.humidity] || [];
      const tm = new Map((gp[r.entity] || []).map(p => [p.t, p.v]));
      hs.forEach(p => {
        const v = dew ? (tm.has(p.t) ? this._dewF(tm.get(p.t), p.v) : null) : p.v;
        if (v == null) return;
        if (!byT.has(p.t)) byT.set(p.t, []);
        byT.get(p.t).push({ x: p.x, v: v });
      });
    });
    const out = [];
    Array.from(byT.keys()).sort((a, b) => a - b).forEach(t => {
      const ps = byT.get(t);
      out.push({ t: t, x: ps[0].x, v: ps.reduce((a, p) => a + p.v, 0) / ps.length });
    });
    return out;
  }

  /* ---- chart ---- */
  _popChart(el, opts) {
    const w = el.clientWidth || 820, H = opts.H;
    const PL = 8, PT = 10, PB = 16;
    let lo = Infinity, hi = -Infinity;
    opts.lines.forEach(L => L.pts.forEach(p => {
      const a = p.v, b = (L.band && p.mn != null) ? p.mn : p.v,
            c2 = (L.band && p.mx != null) ? p.mx : p.v;
      lo = Math.min(lo, a, b, c2); hi = Math.max(hi, a, b, c2);
    }));
    if (!isFinite(lo)) {
      el._sc = null;
      el.innerHTML = '<div class="perr">No data for this range.</div>';
      return;
    }
    let pad = (hi - lo) * 0.1 + 0.2; lo -= pad; hi += pad;
    if (opts.minSpan && hi - lo < opts.minSpan) {
      const mid = (hi + lo) / 2; lo = mid - opts.minSpan / 2; hi = mid + opts.minSpan / 2;
    }
    const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const X = x => PL + x * (w - 2 * PL);
    let svg = '<svg viewBox="0 0 ' + w + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px">';
    (opts.zones || []).forEach(z => {
      svg += '<rect x="' + X(z.x0).toFixed(1) + '" y="0" width="' +
        (X(z.x1) - X(z.x0)).toFixed(1) + '" height="' + (H - PB) + '" fill="' + z.fill + '"></rect>';
    });
    if (opts.fcX != null) {
      const xn = X(opts.fcX);
      svg += '<rect x="' + xn.toFixed(1) + '" y="0" width="' + (w - PL - xn).toFixed(1) +
        '" height="' + H + '" fill="rgba(255,255,255,.03)"></rect>' +
        '<line x1="' + xn.toFixed(1) + '" y1="0" x2="' + xn.toFixed(1) + '" y2="' + (H - PB) +
        '" stroke="rgba(255,255,255,.22)" stroke-width="1"></line>' +
        '<text x="' + (w - PL) + '" y="' + (PT + 8) +
        '" fill="rgba(150,150,150,.9)" font-size="9.5" text-anchor="end">forecast</text>';
    }
    opts.lines.forEach(L => {
      if (!L.band || L.pts.length < 2 || L.pts[0].mn == null) return;
      const hiP = L.pts.map(p => ({ x: p.x, y: Y(p.mx != null ? p.mx : p.v) }));
      const loP = L.pts.slice().reverse().map(p => ({ x: p.x, y: Y(p.mn != null ? p.mn : p.v) }));
      let d = this._path(hiP.map(p => ({ x: p.x, y: p.y })), w);
      loP.forEach(p => { d += ' L ' + (p.x * w).toFixed(1) + ' ' + p.y.toFixed(1); });
      d += ' Z';
      svg += '<path d="' + d + '" fill="' + L.c + '" opacity="' +
        (0.11 * (L.op != null ? L.op : 1)).toFixed(3) + '" stroke="none"></path>';
    });
    opts.lines.forEach(L => {
      if (L.pts.length < 2) return;
      const pts = L.pts.map(p => ({ x: p.x, y: Y(p.v) }));
      const dash = L.st === 'dash' ? ' stroke-dasharray="6 5"' :
                   L.st === 'dot' ? ' stroke-dasharray="0.5 6"' : '';
      svg += '<path d="' + this._path(pts, w) + '" fill="none" stroke="' + L.c +
        '" stroke-width="' + (L.st === 'solid' ? 2.2 : 2) + '"' + dash +
        ' stroke-linecap="round" stroke-linejoin="round" opacity="' +
        (L.op != null ? L.op : 1) + '"></path>';
    });
    (opts.strip || []).forEach(sg => {
      svg += '<rect x="' + X(sg.x0).toFixed(1) + '" y="' + (H - PB - 4) + '" width="' +
        Math.max(1, X(sg.x1) - X(sg.x0)).toFixed(1) +
        '" height="3.5" rx="1.5" fill="' + GOOD + '" opacity=".85"></rect>';
    });
    svg += '<text x="' + PL + '" y="' + (PT + 8) +
      '" fill="rgba(150,150,150,.9)" font-size="9.5">' + Math.round(hi) + opts.unit + '</text>' +
      '<text x="' + PL + '" y="' + (H - PB - 3) +
      '" fill="rgba(150,150,150,.9)" font-size="9.5">' + Math.round(lo) + opts.unit + '</text>';
    (opts.xl || []).forEach(L => {
      const anchor = L[0] > 0.95 ? 'end' : (L[0] < 0.05 ? 'start' : 'middle');
      svg += '<text x="' + X(L[0]).toFixed(0) + '" y="' + (H - 4) +
        '" fill="rgba(150,150,150,.9)" font-size="9.5" text-anchor="' + anchor + '">' +
        L[1] + '</text>';
    });
    // render into a child host so the scrub hairline/dots survive re-renders
    let host = el.querySelector('.pcs');
    if (!host) { el.innerHTML = '<div class="pcs"></div>'; host = el.querySelector('.pcs'); }
    host.innerHTML = svg + '</svg>';
    // v2.0.1: scrub metadata (named lines only)
    el._sc = {
      lines: opts.lines.filter(L => L.name && L.pts && L.pts.length > 1)
        .map(L => ({ name: L.name, c: L.c, pts: L.pts })),
      Y: Y, PL: PL, unit: opts.unit, t0: opts.t0, tEnd: opts.tEnd,
    };
  }

  _fmtHr(t) {
    const h = new Date(t).getHours();
    return (h % 12 || 12) + (h < 12 ? 'a' : 'p');
  }
  _fmtDay(t) {
    const d = new Date(t);
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  _popXL(key, t0, tEnd, fcX) {
    const out = [];
    if (key === '24h') {
      for (let f = 0; f <= 1.001; f += 0.25) {
        const t = t0 + f * (tEnd - t0);
        out.push([f, Math.abs(f - (fcX != null ? fcX : 1)) < 0.02 ? 'now'
          : (f > 0.999 && fcX != null ? '+12h' : this._fmtHr(t))]);
      }
      if (fcX != null && fcX < 0.98) out.push([fcX, 'now']);
      return out;
    }
    const months = POP_R[key].days > 45;
    for (let f = 0; f <= 1.001; f += 0.25) {
      const t = t0 + f * (tEnd - t0);
      out.push([f, f > 0.999 ? 'now'
        : (months ? MONTHS[new Date(t).getMonth()] : this._fmtDay(t))]);
    }
    return out;
  }

  /* ---- heatmap + tiles ---- */
  _popHeat(hd) {
    // per-hour house delta from hourly means: avg(in) - trimmed avg(out)
    const inRooms = this._indoor.concat(this._hall && this._hall.in_average ? [this._hall] : []);
    const byT = new Map();
    const put = (id, side) => (hd.hourly[id] || []).forEach(row => {
      if (!byT.has(row.t)) byT.set(row.t, { i: [], o: [] });
      byT.get(row.t)[side].push(row.mean);
    });
    inRooms.forEach(r => put(r.entity, 'i'));
    this._outdoor.forEach(r => put(r.entity, 'o'));
    const hours = [];
    byT.forEach((g, t) => {
      if (!g.i.length || !g.o.length) return;
      const m = Math.min.apply(null, g.o);
      const outs = g.o.map(v => Math.min(v, m + this._sunCap));
      hours.push({ t: t,
        d: g.i.reduce((a, b) => a + b, 0) / g.i.length -
           outs.reduce((a, b) => a + b, 0) / outs.length });
    });
    return hours;
  }
  _popHeatDom(hours, hd) {
    // v2.1: weekday rows normally; chronological MONTH rows on seasonal tabs
    const seasonal = !!(hd && hd.seasonal);
    let rows, rowOf;
    const weekly = seasonal && !!hd.weekly;
    if (weekly) {
      // v2.1.1 (3m tab): Monday-aligned week rows labeled by start date
      const d0 = new Date(hd.t0);
      const w0 = new Date(d0.getFullYear(), d0.getMonth(),
        d0.getDate() - ((d0.getDay() + 6) % 7));
      const list = [];
      for (let w = new Date(w0); w.getTime() <= hd.t1;
           w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
        list.push(MONTHS[w.getMonth()] + ' ' + w.getDate());
      }
      rows = list;
      rowOf = dd => {
        const mo = new Date(dd.getFullYear(), dd.getMonth(),
          dd.getDate() - ((dd.getDay() + 6) % 7));
        const i = Math.round((mo.getTime() - w0.getTime()) / 6048e5);
        return (i >= 0 && i < list.length) ? i : -1;
      };
    } else if (seasonal) {
      const list = [];
      const d0 = new Date(hd.t0), dE = new Date(hd.t1);
      let y = d0.getFullYear(), m = d0.getMonth();
      while (y < dE.getFullYear() || (y === dE.getFullYear() && m <= dE.getMonth())) {
        list.push({ y: y, m: m });
        m += 1; if (m > 11) { m = 0; y += 1; }
      }
      rows = list.map(x => MONTHS[x.m]);
      rowOf = dd => {
        for (let i = 0; i < list.length; i++) {
          if (list[i].y === dd.getFullYear() && list[i].m === dd.getMonth()) return i;
        }
        return -1;
      };
    } else {
      rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      rowOf = dd => (dd.getDay() + 6) % 7; // Mon first
    }
    const R = rows.length;
    const cell = [];
    for (let r = 0; r < R; r++) { cell.push(new Array(24).fill(null).map(() => ({ s: 0, c: 0 }))); }
    hours.forEach(h => {
      const dd = new Date(h.t);
      const row = rowOf(dd);
      if (row < 0) return;
      const g = cell[row][dd.getHours()];
      g.s += h.d; g.c += 1;
    });
    const col = v => v == null ? 'rgba(255,255,255,.04)'
      : v < 0 ? 'rgba(255,255,255,.04)'
      : v < 1.5 ? 'rgba(76,175,80,.14)'
      : v < this._chipCfg.on_delta ? 'rgba(76,175,80,.32)'
      : v < 4.5 ? 'rgba(76,175,80,.58)' : 'rgba(76,175,80,.85)';
    let html = '<div class="phmg" style="grid-template-columns:' +
      (weekly ? '42px' : '30px') + ' repeat(24,1fr)">';
    for (let r = 0; r < R; r++) {
      html += '<div class="phml">' + rows[r] + '</div>';
      for (let h = 0; h < 24; h++) {
        const g = cell[r][h];
        const v = g.c ? g.s / g.c : null;
        html += '<div class="phmc" style="background:' + col(v) + '" data-l="' + rows[r] + ' ' +
          (h % 12 || 12) + (h < 12 ? 'a' : 'p') +
          '" data-v="' + (v == null ? '' : v.toFixed(1)) + '"></div>';
      }
    }
    html += '<div></div>';
    for (let h = 0; h < 24; h++) {
      // v2.0.2: every hour labeled; only the 12s carry the a/p marker
      html += '<div class="phmx">' + (h % 12 || 12) +
        (h === 0 ? 'a' : (h === 12 ? 'p' : '')) + '</div>';
    }
    this._pop.el.querySelector('#phmwrap').innerHTML = html + '</div>';
    this._pop.el.querySelector('#phmcap').innerHTML =
      'Mean &Delta; (in &minus; out, sun-trimmed) by hour &times; ' +
      (weekly ? 'week (rows labeled by week start; empty cells = no data yet)'
        : seasonal ? 'month (empty cells = no data yet)' : 'weekday') +
      (hd && hd.capped ? ', last 30 days' : '') + '. Green = chip-on territory (&Delta; &ge; ' +
      this._chipCfg.on_delta + '&deg;).';
  }

  _ivOverlap(iv, t0, t1) {
    let s = 0;
    iv.forEach(seg => {
      const a = Math.max(seg[0], t0), b = Math.min(seg[1], t1);
      if (b > a) s += b - a;
    });
    return s;
  }

  /* ---- the orchestrator ---- */
  async _popRender() {
    const pop = this._pop, el = pop.el;
    if (!el || !this._hass) return;
    const key = pop.cur, r = POP_R[key];
    const seq = ++pop.seq;
    el.querySelectorAll('.ptab').forEach(b => b.classList.toggle('on', b.dataset.k === key));
    el.querySelectorAll('.pchip').forEach(ch => {
      const on = pop.sel.indexOf(ch.dataset.n) >= 0;
      ch.classList.toggle('on', on);
      const s = this._series.find(x => x.name === ch.dataset.n);
      ch.style.background = on && s ? s.color + '33' : '';
    });
    el.querySelector('#pchiphint').textContent = pop.sel.length
      ? 'solid = that sensor, measured' : 'tap up to 3 rooms to overlay real sensors';
    el.querySelector('#pmtitle').textContent = this._moistMode === 'dew' ? 'Dew point' : 'Humidity';
    el.querySelector('#psub').textContent = r.sub + ' \u00b7 loading\u2026';
    const dew = this._moistMode === 'dew';
    try {
      const is24 = key === '24h';
      const stats = is24 ? null : await this._popStats(key);
      if (seq !== pop.seq) return;
      const hd = r.seasonal ? await this._popHmSeasonal(key)
                            : await this._popHourly(is24 ? '7d' : key);
      if (seq !== pop.seq) return;
      let prev = null;
      try { prev = await this._popPrev(key); } catch (e) { prev = null; }
      if (seq !== pop.seq) return;
      const bins = await this._popBins();
      if (seq !== pop.seq) return;
      const fc = is24 ? await this._popForecast() : null;
      if (seq !== pop.seq) return;

      // domain
      let t0, t1, tEnd, gp;
      if (is24) {
        t0 = this._t0; t1 = this._t1;
        if (!t0 || !t1) { el.querySelector('#psub').textContent = r.sub; return; }
        tEnd = fc && fc.length ? t1 + 12 * 3600e3 : t1;
        const rx = pts => (pts || []).map(p => ({ t: p.t, v: p.v, x: (p.t - t0) / (tEnd - t0) }));
        gp = {};
        this._series.forEach(s => {
          gp[s.entity] = rx(this._hist[s.entity]);
          if (s.humidity) gp[s.humidity] = rx(this._hist[s.humidity]);
        });
      } else {
        t0 = stats.t0; t1 = stats.t1; tEnd = t1; gp = stats.gp;
      }
      const fcX = (is24 && tEnd > t1) ? (t1 - t0) / (tEnd - t0) : null;
      const band = !is24;
      const inRooms = this._indoor.concat(this._hall && this._hall.in_average ? [this._hall] : []);

      // temperature lines
      const inS = this._popSideTemp(gp, inRooms, false);
      const outS = this._popSideTemp(gp, this._outdoor, true);
      // v2.0.1: bands drawn from smoothed copies; tiles keep the raw extremes
      const inSd = this._smoothBand(inS, this._bandSmooth);
      const outSd = this._smoothBand(outS, this._bandSmooth);
      const dim = pop.sel.length ? 0.16 : 1;
      const lines = [
        { pts: inSd, c: AVG_IN, st: 'dash', band: band && !pop.sel.length, op: dim, name: 'in avg' },
        { pts: outSd, c: AVG_OUT, st: 'dash', band: band && !pop.sel.length, op: dim, name: 'out avg' },
      ];
      pop.sel.forEach(n => {
        const s = this._series.find(x => x.name === n);
        if (!s) return;
        lines.push({ pts: this._smoothBand(gp[s.entity] || [], this._bandSmooth),
          c: s.color, st: 'solid', band: band, name: s.name });
      });
      // forecast continuation (outdoor only) + predicted venting strip
      const strip = [];
      if (fcX != null && outS.length) {
        const last = outS[outS.length - 1];
        const fpts = [{ t: t1, v: last.v, x: fcX }].concat(fc.map(f => ({
          t: f.t, v: f.temp, x: (f.t - t0) / (tEnd - t0) })));
        lines.push({ pts: fpts, c: AVG_OUT, st: 'dot', name: 'forecast' });
        const inNow = inS.length ? inS[inS.length - 1].v : null;
        if (inNow != null) {
          fc.forEach(f => {
            if (inNow - f.temp >= this._chipCfg.on_delta) {
              const xa = (f.t - t0) / (tEnd - t0), xb = (f.t + 3600e3 - t0) / (tEnd - t0);
              strip.push({ x0: xa, x1: Math.min(1, xb) });
            }
          });
        }
      }
      // binary overlays (24h + 7d only; longer smears)
      const zones = [];
      if (key === '24h' || key === '7d') {
        const zt0 = t0, zt1 = t1;
        const push = (iv, fill) => iv.forEach(seg => {
          const a = Math.max(seg[0], zt0), b = Math.min(seg[1], zt1);
          if (b <= a) return;
          zones.push({ x0: (a - t0) / (tEnd - t0), x1: (b - t0) / (tEnd - t0), fill: fill });
        });
        push(bins.open, 'rgba(76,175,80,.07)');
        push(bins.cool, 'rgba(33,150,243,.09)');
        push(bins.heat, 'rgba(255,111,34,.09)');
      }
      const xl = this._popXL(key, t0, tEnd, fcX);
      this._popChart(el.querySelector('#ptchart'),
        { H: 200, unit: '\u00b0', minSpan: 6, lines: lines, xl: xl, zones: zones,
          strip: strip, fcX: fcX, t0: t0, tEnd: tEnd });
      el.querySelector('#pleg1').innerHTML =
        '<i style="border-color:' + AVG_IN + '"></i>in avg' +
        '<i style="border-color:' + AVG_OUT + '"></i>out avg' +
        (band ? ' \u00b7 band = min\u2013max' : '') +
        ((key === '24h' || key === '7d') ?
          ' \u00b7 <span style="color:' + GOOD + '">\u258e</span> window' +
          ' <span style="color:#5aa9f0">\u258e</span> AC' : '');

      // moisture lines (means only)
      const mr = this._moistRooms();
      const mo = is24
        ? (dew ? this._dewAvgHist(mr.outs) : this._moistAvgHist(mr.outs))
            .map(p => ({ t: p.t, v: p.v, x: (p.t - t0) / (tEnd - t0) }))
        : this._popSideMoist(gp, mr.outs, dew);
      const mi = is24
        ? (dew ? this._dewAvgHist(mr.ins) : this._moistAvgHist(mr.ins))
            .map(p => ({ t: p.t, v: p.v, x: (p.t - t0) / (tEnd - t0) }))
        : this._popSideMoist(gp, mr.ins, dew);
      const mlines = [
        { pts: mi, c: MOIST_IN, st: 'dash', op: dim, name: 'in' },
        { pts: mo, c: MOIST_OUT, st: 'dash', op: dim, name: 'out' },
      ];
      pop.sel.forEach(n => {
        const s = this._series.find(x => x.name === n);
        if (!s || !s.humidity) return;
        let pts;
        if (dew) {
          const tm = new Map((gp[s.entity] || []).map(p => [p.t, p.v]));
          pts = (gp[s.humidity] || []).map(p => {
            const v = tm.has(p.t) ? this._dewF(tm.get(p.t), p.v) : null;
            return v == null ? null : { t: p.t, x: p.x, v: v };
          }).filter(Boolean);
        } else pts = gp[s.humidity] || [];
        mlines.push({ pts: pts, c: s.color, st: 'solid', name: s.name });
      });
      if (fcX != null && fc && mo.length) {
        const last = mo[mo.length - 1];
        const fpts = [{ t: t1, v: last.v, x: fcX }].concat(fc.filter(f => f.hum != null).map(f => ({
          t: f.t, x: (f.t - t0) / (tEnd - t0),
          v: dew ? this._dewF(f.temp, f.hum) : f.hum,
        })).filter(p => p.v != null));
        if (fpts.length > 1) mlines.push({ pts: fpts, c: MOIST_OUT, st: 'dot', name: 'forecast' });
      }
      this._popChart(el.querySelector('#pmchart'),
        { H: 140, unit: dew ? '\u00b0' : '%', minSpan: dew ? 10 : 0,
          lines: mlines, xl: xl, fcX: fcX, t0: t0, tEnd: tEnd });

      // heatmap + tiles
      const hours = this._popHeat(hd);
      this._popHeatDom(hours, hd);
      const on = this._chipCfg.on_delta;
      const offered = hours.filter(h => h.d >= on);
      const ventFrac = hours.length ? offered.length / hours.length : 0;
      // captured: chip-on hours in the last 7d that had a window open
      const b7 = bins;
      let cap = null;
      const h7 = hours.filter(h => h.t >= b7.t0);
      const off7 = h7.filter(h => h.d >= on);
      if (off7.length && (this._contacts.length)) {
        let hit = 0;
        off7.forEach(h => {
          if (this._ivOverlap(b7.open, h.t, h.t + 3600e3) > 15 * 60e3) hit += 1;
        });
        cap = hit / off7.length;
      }
      // extremes from the temp side series
      const mx = a => a.length ? Math.max.apply(null, a) : null;
      const mn = a => a.length ? Math.min.apply(null, a) : null;
      const outHi = mx(outS.map(p => p.mx != null ? p.mx : p.v));
      const outLo = mn(outS.map(p => p.mn != null ? p.mn : p.v));
      const inHi = mx(inS.map(p => p.mx != null ? p.mx : p.v));
      const inLo = mn(inS.map(p => p.mn != null ? p.mn : p.v));
      // muggy: outdoor dew series for the range
      const dewOut = is24 ? this._dewAvgHist(mr.outs) : this._popSideMoist(gp, mr.outs, true);
      const m65 = dewOut.length ? dewOut.filter(p => p.v >= 65).length / dewOut.length : null;
      const m60 = dewOut.length ? dewOut.filter(p => p.v >= 60).length / dewOut.length : null;
      // room offsets vs their side average
      const sideMean = pts => pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
      const inMean = sideMean(inS), outMean = sideMean(outS);
      let warm = null;
      this._series.forEach(s => {
        const m = sideMean(gp[s.entity] || []);
        const ref = this._outdoor.indexOf(s) >= 0 ? outMean : inMean;
        if (m == null || ref == null) return;
        const off = m - ref;
        if (this._outdoor.indexOf(s) >= 0) return; // warmest ROOM = indoor story
        if (!warm || off > warm.off) warm = { s: s, off: off };
      });
      // tiles
      let t1h = '';
      if (is24 && fc && fc.length && inS.length) {
        const inNow = inS[inS.length - 1].v;
        const idx = fc.findIndex(f => inNow - f.temp >= on);
        const cnt = fc.filter(f => inNow - f.temp >= on).length;
        const dmax = mx(fc.filter(f => f.hum != null)
          .map(f => this._dewF(f.temp, f.hum)).filter(v => v != null));
        t1h = '<div class="ptile"><div class="ptv" style="color:' + GOOD + '">' +
          (idx < 0 ? 'none in view' : this._fmtHr(fc[idx].t) + ' \u2192') +
          '</div><div class="ptl">predicted venting window (forecast \u0394 \u2265 ' + on +
          '\u00b0)</div><div class="pts2">' + cnt + ' of the next ' + fc.length + ' h qualify' +
          (dmax == null ? '' : ' \u00b7 dew forecast peaks ' + this._fmt(dmax, 0) + '\u00b0' +
            (dmax >= 65 ? ' <span style="color:' + DEW_ORANGE + '">(sticky)</span>'
             : dmax >= 60 ? ' <span style="color:' + DEW_AMBER + '">(noticeable)</span>' : '')) +
          '</div></div>';
      } else {
        t1h = '<div class="ptile"><div class="ptv" style="color:' + GOOD + '">' +
          this._fmt(ventFrac * 24, 1) + '<span style="font-size:12px"> h/day</span></div>' +
          '<div class="ptl">venting offered (\u0394 \u2265 ' + on + '\u00b0' +
          (hd.capped ? ', last 30d' : '') + ')</div><div class="pts2">' +
          this._fmt(ventFrac * 100, 0) + '% of hours' +
          (cap == null ? '' : ' \u00b7 windows open for <b>' + this._fmt(cap * 100, 0) +
            '%</b> of them (past 7d)') + '</div></div>';
      }
      let t3h = '';
      const sel1 = pop.sel.length === 1 ? this._series.find(x => x.name === pop.sel[0]) : null;
      if (sel1 && (gp[sel1.entity] || []).length) {
        const pts = gp[sel1.entity];
        const m = sideMean(pts);
        const isOut = this._outdoor.indexOf(sel1) >= 0;
        const ref = isOut ? outMean : inMean;
        const rHi = mx(pts.map(p => p.mx != null ? p.mx : p.v));
        const rLo = mn(pts.map(p => p.mn != null ? p.mn : p.v));
        t3h = '<div class="ptile"><div class="ptv" style="color:' + sel1.color + '">' + sel1.name +
          (ref != null && m != null ? ' ' + (m - ref >= 0 ? '+' : '') + this._fmt(m - ref, 1) + '\u00b0' : '') +
          '</div><div class="ptl">vs ' + (isOut ? 'outdoor' : 'house') + ' avg \u00b7 this range</div>' +
          '<div class="pts2">high ' + (rHi == null ? '--' : this._fmt(rHi, 1) + '\u00b0') +
          ' \u00b7 low ' + (rLo == null ? '--' : this._fmt(rLo, 1) + '\u00b0') +
          (sel1.name === 'Patio' ? ' \u00b7 afternoon highs are sensor solar heating' : '') +
          '</div></div>';
      } else {
        t3h = '<div class="ptile"><div class="ptv">' +
          (warm ? warm.s.name + ' +' + this._fmt(warm.off, 1) + '\u00b0' : '--') +
          '</div><div class="ptl">warmest room vs house avg</div>' +
          '<div class="pts2">pick one room above to see its stats here</div></div>';
      }
      el.querySelector('#ptiles').innerHTML = t1h +
        '<div class="ptile"><div class="ptv">' +
        (outHi == null ? '--' : this._fmt(outHi, 1) + '\u00b0') +
        ' <span style="font-size:12px;color:var(--secondary-text-color)">/ ' +
        (outLo == null ? '--' : this._fmt(outLo, 1) + '\u00b0') + '</span></div>' +
        '<div class="ptl">outdoor high / low (sun-trimmed)</div>' +
        '<div class="pts2">indoor ' + (inHi == null ? '--' : this._fmt(inHi, 1) + '\u00b0') +
        ' / ' + (inLo == null ? '--' : this._fmt(inLo, 1) + '\u00b0') +
        (prev && prev.outMean != null && outMean != null
          ? ' \u00b7 vs ' + PREV_LBL[key] + ': out ' +
            (Math.abs(outMean - prev.outMean) < 0.05 ? '\u00b10.0'
              : (outMean - prev.outMean > 0 ? '+' : '') + this._fmt(outMean - prev.outMean, 1)) + '\u00b0'
          : '') + '</div></div>' +
        t3h +
        '<div class="ptile"><div class="ptv">' +
        (m65 == null ? '--' : '<span style="color:' +
          (m65 > 0.25 ? DEW_ORANGE : DEW_AMBER) + '">' + this._fmt(m65 * 100, 0) + '%</span>') +
        '</div><div class="ptl">hours with outdoor dew \u2265 65\u00b0 (sticky)</div>' +
        '<div class="pts2">' + (m60 == null ? '--' : this._fmt(m60 * 100, 0) + '% \u2265 60\u00b0') +
        ' \u00b7 the clammy-evening watch item, quantified</div></div>';

      el.querySelector('#psub').textContent = r.sub;
      el.querySelector('#pnote').textContent =
        'Line grammar: solid = measured sensor \u00b7 dashed = computed \u00b7 dotted = forecast. ' +
        'Statistics are hourly/daily min-mean-max from the recorder\u2019s long-term store.';
    } catch (err) {
      if (seq !== pop.seq) return;
      el.querySelector('#psub').textContent = r.sub;
      const tc = el.querySelector('#ptchart'), mc = el.querySelector('#pmchart');
      tc._sc = null; mc._sc = null;
      tc.innerHTML = '<div class="perr">Could not load this range (' +
        String(err && err.message ? err.message : err).slice(0, 120) + ')</div>';
      mc.innerHTML = '';
    }
  }
}

customElements.define('flat-climate-card', FlatClimateCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-climate-card',
  name: 'Flat Climate Card',
  description: 'Indoor-vs-outdoor delta headline + all-rooms 24h temperature overlay, humidity and per-room strip behind a toggle',
});
