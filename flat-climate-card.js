/* flat-climate-card v1.6.4 - custom Lovelace card for the main dashboard.
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
    const humPair = this._humPair();
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
        <div class="label">Humidity &mdash; 24h</div>
        <div class="xline"></div>
      </div>
      <div class="strip" id="strip">${cells}</div>`;
    // v1.6: tooltips are viewport-fixed and live at ha-card level (outside the
    // rows) so overflow:hidden cannot clip them and press-transforms cannot
    // break their positioning
    const avgPair = [{ name: 'in avg', color: AVG_IN }, { name: 'out avg', color: AVG_OUT }];
    this._el.tips.innerHTML = `
      <div class="tip" id="tip-hero"><div class="tt"></div>${tipRows(this._heroTipList)}</div>
      <div class="tip" id="tip-avg"><div class="tt"></div>${tipRows(avgPair)}</div>
      <div class="tip" id="tip-hum"><div class="tt"></div>${tipRows(humPair)}</div>`;
    this._wire();
    this._renderStates();
  }

  _humPair() {
    return [
      { entity: this._outdoor[0].humidity, name: 'Out', color: this._outdoor[0].color },
      { entity: this._indoor[0].humidity, name: 'In', color: this._indoor[0].color },
    ];
  }

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
      () => this._humPair().map(s => this._hist[s.entity] || []),
      { top: 42, bottom: ROW_H - 2, rowH: ROW_H, gH: ROW_G,
        dots: 2, colors: this._humPair().map(s => s.color) });
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
    // humidity reading
    const hp = this._humPair();
    const ho = this._num(hp[0].entity), hi = this._num(hp[1].entity);
    root.getElementById('ho').textContent = ho == null ? '--' : this._fmt(ho, 0);
    root.getElementById('hw').textContent =
      '% out \u00b7 ' + (hi == null ? '--' : this._fmt(hi, 0)) + '% in';
    root.getElementById('hum').classList.toggle('unavailable', ho == null && hi == null);
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
    const hp = this._humPair();
    const ids = this._series.map(r => r.entity).concat(hp.map(r => r.entity));
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

  /* shared-scale y assignment + smooth path */
  _scaleY(lists, gH, padT, padB) {
    let lo = Infinity, hi = -Infinity;
    lists.forEach(pts => pts.forEach(p => {
      if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v;
    }));
    if (!isFinite(lo)) return false;
    if (hi - lo < 1e-9) { hi += .5; lo -= .5; }
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

  _drawHum() {
    const root = this.shadowRoot;
    const hum = root.getElementById('hum');
    const svg = hum.querySelector('svg.g');
    const w = hum.clientWidth || 500;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + ROW_G);
    const hp = this._humPair();
    const lists = hp.map(s => this._hist[s.entity] || []);
    if (!this._scaleY(lists.filter(l => l.length), ROW_G, 26, 6)) { svg.innerHTML = ''; return; }
    let paths = '';
    hp.forEach((s, i) => {
      const pts = lists[i];
      if (!pts.length) return;
      paths += '<path d="' + this._path(pts, w) + '" fill="none" stroke="' + s.color +
        '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>';
    });
    svg.innerHTML = paths;
  }
}

customElements.define('flat-climate-card', FlatClimateCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-climate-card',
  name: 'Flat Climate Card',
  description: 'Indoor-vs-outdoor delta headline + all-rooms 24h temperature overlay, humidity and per-room strip behind a toggle',
});
