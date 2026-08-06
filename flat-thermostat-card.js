/* flat-thermostat-card v2.5.5 - custom Lovelace card for the main dashboard.
   Slim dual-handle flat thermostat: current temp left, dual/single-handle
   temperature track right, native-style mode strip below (with optional
   daily-runtime chip at its left), detached eco (leaf) toggle beside the
   strip.
   Built 2026-07-09, eco added 2026-07-20, runtime chip added 2026-07-23,
   by Claude for Ratman (design spec archived in the "NAS / Smart Home"
   Claude project, doc claude/ha-dashboard-notes.md).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;base64,<blob>. There is no
     file on disk and no internet dependency - the code lives inside the URL
     itself, in HA's own config (.storage/lovelace_resources), and is included
     in every Home Assistant backup automatically.
   - To READ it: copy everything after "base64," and run it through any
     base64 decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS, re-encode to base64, then in
     Settings > Dashboards > Resources replace this resource's URL with
     data:text/javascript;base64,<new blob>. Hard-refresh the browser.
   - Used from the dashboard as:  type: custom:flat-thermostat-card
                                  entity: climate.hall_nest_thermostat

   ECO (v2.3): Nest exposes eco as preset_mode none|eco. The leaf button is a
   separate rounded-rect NEXT TO the mode strip (not in it - eco overlays the
   hvac mode, it is not mutually exclusive with it). While eco is on:
   - leaf button goes Nest-green, status text shows green "Eco" when idle
   - the entity itself reports the ECO setpoints in temperature /
     target_temp_low/high (verified live 2026-07-20: cool 76 -> eco -> 80),
     so the track just renders what the entity says - in green, read-only
     (handles hidden, drag disabled: Nest rejects setpoint changes in eco).
   - button hides itself if the entity has no "eco" in preset_modes.

   RUNTIME CHIP (v2.4): optional chip at the LEFT of the bottom row showing
   today's ACTIVE HVAC time (compressor/furnace actually running, from
   hvac_action - not just mode-on time). Config:
     runtime_cooling: <entity>   e.g. sensor.nest_cooling_runtime_today
     runtime_heating: <entity>   e.g. sensor.nest_heating_runtime_today
   These are daily utility_meter entities counting HOURS, fed by Riemann
   integrals of 0/1 template signals on hvac_action (pipeline documented in
   project doc claude/hvac-runtime-tracking-notes.md). Behavior: cool mode
   shows the cooling meter, heat the heating meter, heat_cool both (two
   compact rows); configured meters for the active mode are ALWAYS shown,
   including at "0m" (owner choice, v2.4.1) - the chip hides only when
   unconfigured, mode off, or the thermostat is unavailable. Unavailable
   meter shows '--'. Tap = more-info history of the shown meter.
   v2.4.5 (owner request): NO resting background on the chip - it reads as
   a quiet stat, not a button; a subtle hover highlight (wrapped in
   media hover:hover so touch devices skip it, per house style) reveals
   that it is tappable.
   Layout (v2.5; evolved from the v2.4.4 two-row + slot structure):
   Row 1: temp/status block + track vertically centered beside it. Row 2:
   chip slot + mode strip + eco. v2.5 slims the left column from
   20%-of-card to a FIXED 96px so the track and strip extend further
   left, and centers the temp/status + chip on the TRUE center of the
   empty region: the region spans card edge -> track start (96px column
   + 8px track lead-in = 104px), so both column blocks carry
   padding-left 8px (box-sizing border-box) putting their content center
   v2.5.2 - THE CENTERING RULE, FINAL (owner-specified after two wrong
   attempts; do not re-litigate): the empty space is bounded by the
   CARD'S VISIBLE EDGE on the left (the 14px card padding COUNTS as
   empty space) and the track's left edge on the right. The full
   visible block - digits WITH the degree unit in normal flow, status
   text, chip - is centered in THAT span, so the gap from card edge to
   the block equals the gap from the block to the track. The math:
   with column width C and row gap / track padding both 8, the span
   runs -14 (card padding counts as space) to C+8, so its center is
   (C-6)/2 - which is exactly the content center of a border-box
   column with padding-right 6px, for ANY C. Both column blocks
   therefore carry padding-right 6px. v2.5.3 (owner's original ask):
   column slimmed 96 -> 76px and chip 80 -> 68px (still fits "9h 59m"
   + icon) so the track and mode strip gain 20px of width.
   v2.5.4 (owner-final): the DEGREE UNIT IS EXCLUDED from centering -
   sup is absolutely positioned off the digits' right edge (the
   original v1 design, briefly moved in-flow v2.5-v2.5.3). The owner's
   settled rule: the DIGITS must sit exactly over the status text and
   the chip on the shared axis; the small degree unit floats right and
   does not count as visual mass. So the axis carries: digits, status,
   chip; excluded adornments: degree unit. Alignment invariants kept:
   strip left edge == track left edge (C + 8 gap == C + 8 padding),
   track and eco flush right.

   OFF MODE (v2.5, owner request): the chip now stays visible in off
   mode, showing any meter with runtime today (cooling and/or heating);
   it hides only when both are zero - "the AC still ran today" must not
   vanish when the thermostat is switched off.

   RUNTIME GRAPH (v2.5, owner request + mockup-approved): tapping the
   chip no longer opens more-info - it expands an IN-CARD graph panel
   (house grid-rows animation, no popups, no browser_mod, no deps):
   last 14 days of daily runtime as bars from HA long-term statistics
   (recorder/statistics_during_period WS, period day, type change) for
   the active mode's series, today as a dashed live bar fed by the
   daily meter's state, dashed 7-day average line, peak direct label,
   per-bar hover/tap tooltip, and a today / 7-day avg / peak summary
   row. The summary tiles are TAP-THROUGHS to native more-info
   (v2.5.5): TODAY opens the daily meter; 7-DAY AVG and PEAK open the
   stats entity (the Riemann total with the full long-term history). Config: runtime_cooling_stats / runtime_heating_stats = the
   LONG-TERM stats entities (the Riemann totals, which carry the
   backfilled history); they default to the daily meter entities when
   unset. The temp/status block still opens native more-info. */

const ICONS = { off: 'mdi:power', cool: 'mdi:snowflake', heat: 'mdi:fire', heat_cool: 'mdi:sun-snowflake-variant' };
const COLORS = { off: '#9e9e9e', cool: '#2196f3', heat: '#ff6f22', heat_cool: '#ffc107', eco: '#4caf50' };
const LABEL_COLORS = { heat: '#ff9c4a', cool: '#64b5f6', eco: '#81c784' };
const ACTION_TEXT = { cooling: 'Cooling', heating: 'Heating', idle: 'Idle', off: 'Off', fan: 'Fan', drying: 'Drying', preheating: 'Preheating' };
const GRAPH_DAYS = 14;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class FlatThermostatCard extends HTMLElement {
  static getStubConfig() { return { entity: '' }; }

  setConfig(config) {
    if (!config.entity) throw new Error('flat-thermostat-card: "entity" is required');
    this._config = Object.assign({ modes: ['off', 'cool', 'heat', 'heat_cool'], gap: 2 }, config);
    this._drag = null;
    this._opt = {};
    this._optUntil = 0;
    this._optMode = null;
    this._optModeUntil = 0;
    this._optEco = null;
    this._optEcoUntil = 0;
    this._rtHtml = '';
    this._gOpen = false;
    this._gDef = null;
    this._gKey = null;
    this._gRows = null;
    this._gFetched = 0;
    this._gCache = '';
    this._gLoading = false;
    if (!this.shadowRoot) this._createDom();
    this._modesBuilt = false;
  }

  getCardSize() { return 2; }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _stateObj() { return this._hass && this._hass.states[this._config.entity]; }

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { display: block; padding: 12px 14px 10px 14px; }
        .main { display: flex; gap: 0; align-items: center; padding: 4px 0 0 0; }
        .curblock { flex: 0 0 76px; box-sizing: border-box; padding-right: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 0; cursor: pointer; }
        .cur::before { content: ''; position: absolute; width: 104px; height: 84px; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(closest-side, var(--glow, transparent) 0%, transparent 100%);
          opacity: .14; z-index: -1; pointer-events: none; }
        .cur { position: relative; z-index: 0; font-size: 32px; font-weight: 500; line-height: 1.05; color: var(--primary-text-color); }
        .cur sup { position: absolute; left: calc(100% + 1px); top: 2px; font-size: 14px; color: var(--secondary-text-color); font-weight: 400; }
        .st { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
        .bar-wrap { position: relative; flex: 1; min-width: 0; padding: 0 0 0 8px; }
        .bar { position: relative; height: 16px; border-radius: 8px; background: rgba(70,70,70,.3); touch-action: none; cursor: pointer; }
        .bar.ecolock { cursor: default; }
        .fill { position: absolute; top: 0; bottom: 0; pointer-events: none; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1); }
        .fill.heatf { left: 0; background: ${COLORS.heat}; opacity: .5; border-radius: 8px 0 0 8px; }
        .fill.coolf { right: 0; background: ${COLORS.cool}; opacity: .5; border-radius: 0 8px 8px 0; }
        .fill.brightf { opacity: 1; border-radius: 8px; z-index: 1; }
        .fill.singlef { left: 0; border-radius: 8px 0 0 8px; }
        .handle { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%;
          background: #fff; transform: translate(-50%,-50%); cursor: grab;
          z-index: 3; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .handle:active { cursor: grabbing; }
        .blabel { position: absolute; top: -28px; transform: translateX(-50%); font-size: 13px;
          font-weight: 600; white-space: nowrap; pointer-events: none; z-index: 4; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .blabel .deg { position: absolute; left: 100%; top: 0; }
        .curdot { position: absolute; top: 50%; width: 7px; height: 7px; border-radius: 50%;
          background: #a6a6a6;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 2; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .bar.dragging .fill, .bar.dragging .handle, .bar.dragging .blabel, .bar.dragging .curdot { transition: none; }
        .offlabel { position: absolute; top: -28px; left: 50%; transform: translateX(-50%);
          color: var(--secondary-text-color); font-size: 13px; display: none; }
        .bottom { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
        .chipslot { flex: 0 0 76px; box-sizing: border-box; padding-right: 6px; display: flex; align-items: center; justify-content: center; }
        .modes { flex: 1; min-width: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0,1fr); height: 42px;
          border-radius: 12px; background: rgba(255,255,255,.04); overflow: hidden; }
        .mode { display: flex; align-items: center; justify-content: center; border-radius: 12px;
          cursor: pointer; transition: background .15s; }
        .mode:hover { background: rgba(255,255,255,.07); }
        .mode ha-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; display: flex;
          align-items: center; justify-content: center; line-height: 0; color: var(--primary-text-color); }
        .mode.active ha-icon { color: #fff; }
        .ecobtn { flex: 0 0 46px; height: 42px; border-radius: 12px; background: rgba(255,255,255,.04);
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .ecobtn:hover { background: rgba(255,255,255,.07); }
        .ecobtn ha-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; display: flex;
          align-items: center; justify-content: center; line-height: 0; color: var(--primary-text-color); }
        .ecobtn.on { background: ${COLORS.eco}; }
        .ecobtn.on:hover { background: ${COLORS.eco}; }
        .ecobtn.on ha-icon { color: #fff; }
        .ecobtn.gone { display: none; }
        .rtchip { flex: 0 0 auto; box-sizing: border-box; width: 68px; height: 42px; border-radius: 12px;
          background: transparent; transition: background .15s;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 0 4px; gap: 1px; cursor: pointer; }
        @media (hover: hover) { .rtchip:hover { background: rgba(255,255,255,.07); } }
        .rtchip .rrow { font-size: 12px; font-weight: 600; color: var(--primary-text-color);
          line-height: 1.2; display: flex; align-items: center; gap: 4px; }
        .rtchip .rrow ha-icon { --mdc-icon-size: 12px; width: 12px; height: 12px; display: flex;
          align-items: center; justify-content: center; line-height: 0; }
        .rtchip .rcap { font-size: 8.5px; color: var(--secondary-text-color);
          text-transform: uppercase; letter-spacing: .6px; }
        .rtchip.two .rrow { font-size: 11px; }
        .rtchip.gone { display: none; }
        .rtchip.open { background: rgba(255,255,255,.07); }
        .gwrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1); }
        .gwrap.open { grid-template-rows: 1fr; }
        .gin { overflow: hidden; min-height: 0; }
        .gpanel { margin-top: 0; padding-top: 0; border-top: 0 solid rgba(255,255,255,.06);
          transition: margin-top .35s cubic-bezier(.4,0,.2,1), padding-top .35s cubic-bezier(.4,0,.2,1), border-top-width .35s cubic-bezier(.4,0,.2,1); }
        .gwrap.open .gpanel { margin-top: 10px; padding-top: 10px; border-top-width: 1px; }
        .gtitle-row { font-size: 11px; color: var(--secondary-text-color); letter-spacing: .3px;
          margin: 0 2px 8px; display: flex; justify-content: space-between; }
        .gtitle-row b { color: var(--primary-text-color); font-weight: 600; }
        .gplot { position: relative; height: 96px; margin: 0 2px; }
        .gline { position: absolute; left: 0; right: 26px; height: 1px; background: rgba(255,255,255,.06); }
        .ggtxt { position: absolute; right: 0; width: 22px; font-size: 9px; color: var(--secondary-text-color);
          opacity: .7; transform: translateY(-50%); }
        .gavg { position: absolute; left: 0; right: 26px; border-top: 1px dashed rgba(255,255,255,.28); }
        .gavgtxt { position: absolute; right: 0; width: 26px; font-size: 8.5px; color: var(--secondary-text-color);
          transform: translateY(-60%); }
        .gbars { position: absolute; left: 0; right: 26px; top: 0; bottom: 0; display: flex; align-items: flex-end; gap: 2px; }
        .gb { flex: 1; border-radius: 4px 4px 0 0; position: relative; min-height: 2px; cursor: pointer; }
        .gb.zero { background: rgba(255,255,255,.10); height: 2px; border-radius: 1px; }
        .gb.today { border-style: dashed; border-width: 1px; border-bottom: none; }
        .gdlab { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 3px;
          font-size: 9px; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; pointer-events: none; }
        .gxrow { display: flex; gap: 2px; margin: 4px 28px 0 2px; }
        .gxrow span { flex: 1; font-size: 8.5px; color: var(--secondary-text-color); opacity: .7; text-align: center; }
        .gtip { position: absolute; transform: translate(-50%, calc(-100% - 6px)); display: none;
          background: #2c2c2e; border: 1px solid rgba(255,255,255,.1); border-radius: 6px;
          padding: 4px 8px; font-size: 10px; color: var(--primary-text-color); white-space: nowrap; z-index: 5;
          box-shadow: 0 2px 6px rgba(0,0,0,.5); pointer-events: none; }
        .gstats { display: flex; gap: 8px; margin: 12px 2px 2px; }
        .gstat { flex: 1; text-align: center; cursor: pointer; border-radius: 8px; padding: 4px 0;
          transition: background .15s; }
        @media (hover: hover) { .gstat:hover { background: rgba(255,255,255,.05); } }
        .gstat .gv { font-size: 13px; font-weight: 600; color: var(--primary-text-color); }
        .gstat .gc { font-size: 8.5px; color: var(--secondary-text-color); text-transform: uppercase;
          letter-spacing: .6px; margin-top: 1px; }
        .gmsg { font-size: 11px; color: var(--secondary-text-color); text-align: center; padding: 20px 0; }
        .unavailable { opacity: .4; pointer-events: none; }
      </style>
      <ha-card>
        <div class="main" id="main">
          <div class="curblock" id="curblock">
            <div class="cur"><span id="curval">--</span><sup id="unit"></sup></div>
            <div class="st" id="state"></div>
          </div>
          <div class="bar-wrap">
            <div class="bar" id="bar">
              <div class="fill heatf" id="fheat"></div>
              <div class="fill coolf" id="fcool"></div>
              <div class="fill singlef" id="fsingle"></div>
              <div class="fill brightf" id="bfheat"></div>
              <div class="fill brightf" id="bfcool"></div>
              <div class="curdot" id="curdot"></div>
              <div class="handle" id="hlow"></div>
              <div class="handle" id="hhigh"></div>
              <div class="blabel" id="blow"></div>
              <div class="blabel" id="bhigh"></div>
              <div class="offlabel" id="offlbl">Off</div>
            </div>
          </div>
        </div>
        <div class="bottom">
          <div class="chipslot"><div class="rtchip gone" id="rtchip"></div></div>
          <div class="modes" id="modes"></div>
          <div class="ecobtn gone" id="ecobtn"><ha-icon icon="mdi:leaf"></ha-icon></div>
        </div>
        <div class="gwrap" id="gwrap"><div class="gin">
          <div class="gpanel">
            <div class="gtitle-row"><span id="gtitle"></span><span>hours/day</span></div>
            <div class="gplot" id="gplot"></div>
            <div class="gxrow" id="gxrow"></div>
            <div class="gstats" id="gstats"></div>
          </div>
        </div></div>
      </ha-card>
    `;
    this._el = {};
    ['main','curblock','bar','fheat','fcool','fsingle','bfheat','bfcool','curdot','hlow','hhigh','blow','bhigh','offlbl','modes','ecobtn','rtchip','gwrap','gtitle','gplot','gxrow','gstats','curval','unit','state']
      .forEach(id => this._el[id] = root.getElementById(id));
    this._el.bfheat.style.background = COLORS.heat;
    this._el.bfcool.style.background = COLORS.cool;
    this._bindDrag();
    this._el.ecobtn.addEventListener('click', () => this._toggleEco());
    // tapping the runtime chip toggles the in-card runtime graph (v2.5)
    this._el.rtchip.addEventListener('click', () => this._toggleGraph());
    // summary tiles tap through to native more-info (v2.5.5, delegated)
    this._el.gstats.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.gstat') : null;
      const ent = t && t.dataset.ent;
      if (!ent) return;
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: ent },
        bubbles: true,
        composed: true,
      }));
    });
    // clicking the current temp / status area opens the native more-info dialog
    this._el.curblock.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      }));
    });
  }

  /* ---------- helpers ---------- */
  _attrs() { const s = this._stateObj(); return s ? s.attributes : {}; }
  _min() { return this._config.min_temp != null ? this._config.min_temp : (this._attrs().min_temp != null ? this._attrs().min_temp : 50); }
  _max() { return this._config.max_temp != null ? this._config.max_temp : (this._attrs().max_temp != null ? this._attrs().max_temp : 90); }
  _step() { return this._config.step != null ? this._config.step : (this._attrs().target_temp_step || 1); }
  _pct(v) { return (v - this._min()) / (this._max() - this._min()) * 100; }
  _fmt(v) { if (v == null) return '--'; return (v % 1 === 0) ? String(v) : v.toFixed(1); }

  _vals() {
    const a = this._attrs();
    const useOpt = this._drag || Date.now() < this._optUntil;
    return {
      low:    (useOpt && this._opt.low    != null) ? this._opt.low    : a.target_temp_low,
      high:   (useOpt && this._opt.high   != null) ? this._opt.high   : a.target_temp_high,
      single: (useOpt && this._opt.single != null) ? this._opt.single : a.temperature,
    };
  }

  _mode() {
    const s = this._stateObj();
    if (!s) return 'off';
    if (this._optMode && Date.now() < this._optModeUntil) return this._optMode;
    return s.state;
  }

  _ecoSupported() { return (this._attrs().preset_modes || []).includes('eco'); }

  _ecoOn() {
    if (Date.now() < this._optEcoUntil) return this._optEco;
    return this._attrs().preset_mode === 'eco';
  }

  /* ---------- rendering ---------- */
  _render() {
    const s = this._stateObj();
    if (!s || !this._el) return;
    const el = this._el;
    const unavailable = s.state === 'unavailable' || s.state === 'unknown';
    el.main.classList.toggle('unavailable', unavailable);

    const a = s.attributes;
    el.curval.textContent = this._fmt(a.current_temperature);
    el.unit.textContent = (this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || '\u00b0F';

    const mode = this._mode();
    const eco = this._ecoOn();
    const act = a.hvac_action;
    // status text: eco replaces "Idle" only - active heating/cooling still wins
    let action;
    if (unavailable) action = 'Unavailable';
    else if (mode === 'off') action = 'Off';
    else if (eco && act !== 'cooling' && act !== 'heating') action = 'Eco';
    else action = ACTION_TEXT[act] || (act ? act : '');
    el.state.textContent = action;
    const glow = act === 'cooling' ? COLORS.cool : act === 'heating' ? COLORS.heat : 'transparent';
    el.curblock.style.setProperty('--glow', glow);
    el.state.style.color = act === 'cooling' ? LABEL_COLORS.cool : act === 'heating' ? LABEL_COLORS.heat : (action === 'Eco' ? LABEL_COLORS.eco : '');

    el.ecobtn.classList.toggle('gone', !this._ecoSupported());
    el.ecobtn.classList.toggle('on', eco);
    el.bar.classList.toggle('ecolock', eco);

    this._buildModes();
    this._updateModes(mode);
    this._updateBar(mode);
    this._updateRuntime(mode, act, unavailable);
  }

  /* ---------- runtime chip (v2.4) ---------- */
  _fmtRuntime(v) {
    if (v == null) return '--';
    let h = Math.floor(v);
    let m = Math.round((v - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  _updateRuntime(mode, act, unavailable) {
    const el = this._el.rtchip;
    const defs = [
      { key: 'runtime_cooling', icon: this._config.icon_cool || ICONS.cool, color: LABEL_COLORS.cool, bar: COLORS.cool, name: 'Cooling', act: 'cooling' },
      { key: 'runtime_heating', icon: this._config.icon_heat || ICONS.heat, color: LABEL_COLORS.heat, bar: COLORS.heat, name: 'Heating', act: 'heating' },
    ];
    const want = mode === 'cool' ? [defs[0]] : mode === 'heat' ? [defs[1]] : (mode === 'heat_cool' || mode === 'off') ? defs : [];
    let rows = [];
    for (const d of want) {
      const ent = this._config[d.key];
      if (!ent) continue;
      const st = this._hass.states[ent];
      if (!st) continue;
      const num = parseFloat(st.state);
      const v = isNaN(num) ? null : num;
      // active modes always show their configured meters ("0m" included, v2.4.1); '--' when unavailable
      rows.push({ ent: ent, icon: d.icon, color: d.color, v: v, def: d });
    }
    // off mode (v2.5): only meters that actually ran today - hide when nothing ran
    if (mode === 'off') rows = rows.filter(r => r.v != null && r.v > 0);
    if (unavailable || !rows.length) {
      el.classList.add('gone');
      this._gDef = null;
      if (this._gOpen) this._closeGraph();
      return;
    }
    el.classList.remove('gone');
    el.classList.toggle('two', rows.length > 1);
    const html = rows.map(r =>
      '<div class="rrow"><ha-icon icon="' + r.icon + '" style="color:' + r.color + '"></ha-icon>' + this._fmtRuntime(r.v) + '</div>'
    ).join('') + (rows.length === 1 ? '<div class="rcap">today</div>' : '');
    if (html !== this._rtHtml) { el.innerHTML = html; this._rtHtml = html; }
    this._gDef = rows[0].def;
    this._graphTick();
  }

  /* ---------- runtime graph (v2.5) ---------- */
  _toggleGraph() {
    if (this._gOpen) { this._closeGraph(); return; }
    if (!this._gDef) return;
    this._gOpen = true;
    this._el.gwrap.classList.add('open');
    this._el.rtchip.classList.add('open');
    this._loadGraph();
  }

  _closeGraph() {
    this._gOpen = false;
    this._el.gwrap.classList.remove('open');
    this._el.rtchip.classList.remove('open');
  }

  _statsEntity() {
    // LTS source for the bars: *_stats override (the Riemann total, which carries
    // backfilled history) - falls back to the daily meter entity itself
    if (!this._gDef) return null;
    return this._config[this._gDef.key + '_stats'] || this._config[this._gDef.key];
  }

  _graphTick() {
    // called from every render; cheap no-op unless the panel is open and something changed
    if (!this._gOpen || this._gLoading) return;
    const key = this._gDef ? this._gDef.key : null;
    if (key !== this._gKey || Date.now() - this._gFetched > 900000) { this._loadGraph(); return; }
    if (this._gRows) this._renderGraph();
  }

  _loadGraph() {
    const ent = this._statsEntity();
    if (!ent || !this._hass) { this._graphMsg('No runtime meter configured'); return; }
    this._gKey = this._gDef.key;
    this._gLoading = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (GRAPH_DAYS - 1));
    this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: [ent],
      period: 'day',
      types: ['change'],
    }).then((resp) => {
      this._gLoading = false;
      this._gRows = (resp && resp[ent]) || [];
      this._gFetched = Date.now();
      this._gCache = '';
      this._renderGraph();
    }).catch(() => {
      this._gLoading = false;
      this._gRows = null;
      this._graphMsg('History unavailable');
    });
  }

  _graphMsg(text) {
    this._el.gtitle.innerHTML = '<b>' + (this._gDef ? this._gDef.name : 'Runtime') + ' runtime</b> &middot; last ' + GRAPH_DAYS + ' days';
    this._el.gplot.innerHTML = '<div class="gmsg">' + text + '</div>';
    this._el.gxrow.innerHTML = '';
    this._el.gstats.innerHTML = '';
    this._gCache = '';
  }

  _graphDays() {
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = GRAPH_DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      days.push({ t: d.getTime(), d: d, v: 0 });
    }
    (this._gRows || []).forEach((r) => {
      const rd = new Date(r.start); rd.setHours(0, 0, 0, 0);
      const hit = days.find((x) => x.t === rd.getTime());
      if (hit && r.change != null && r.change > 0) hit.v = r.change;
    });
    // live "today" from the daily meter state (fresher than the hourly-compiled stats)
    const st = this._hass.states[this._config[this._gDef.key]];
    const live = st ? parseFloat(st.state) : NaN;
    if (!isNaN(live)) days[days.length - 1].v = live;
    return days;
  }

  _renderGraph() {
    if (!this._gDef) return;
    const days = this._graphDays();
    const cache = this._gDef.key + '|' + days.map((x) => x.v.toFixed(3)).join(',');
    if (cache === this._gCache) return;
    this._gCache = cache;

    const el = this._el;
    el.gtitle.innerHTML = '<b>' + this._gDef.name + ' runtime</b> &middot; last ' + GRAPH_DAYS + ' days';

    const H = 96;
    const maxV = Math.max.apply(null, days.map((x) => x.v));
    const scale = Math.max(1, maxV * 1.08);
    const step = scale <= 3 ? 1 : scale <= 8 ? 2 : 4;
    const plot = el.gplot;
    plot.innerHTML = '';
    for (let v = step; v < scale; v += step) {
      const y = H - (v / scale) * H;
      const g = document.createElement('div'); g.className = 'gline'; g.style.top = y + 'px'; plot.appendChild(g);
      const t = document.createElement('div'); t.className = 'ggtxt'; t.style.top = y + 'px'; t.textContent = v + 'h'; plot.appendChild(t);
    }
    const last7 = days.slice(-7);
    const avg = last7.reduce((s, x) => s + x.v, 0) / last7.length;
    if (avg > 0) {
      const y = H - (avg / scale) * H;
      const a = document.createElement('div'); a.className = 'gavg'; a.style.top = y + 'px'; plot.appendChild(a);
      const at = document.createElement('div'); at.className = 'gavgtxt'; at.style.top = y + 'px'; at.textContent = 'avg'; plot.appendChild(at);
    }
    const tip = document.createElement('div'); tip.className = 'gtip'; plot.appendChild(tip);
    const bars = document.createElement('div'); bars.className = 'gbars'; plot.appendChild(bars);
    // peak is a HISTORICAL stat - exclude the still-counting today so the
    // summary row never shows today's number twice under two captions
    let peakIdx = -1;
    days.forEach((x, i) => { if (i < days.length - 1 && x.v > 0 && (peakIdx < 0 || x.v > days[peakIdx].v)) peakIdx = i; });
    days.forEach((x, i) => {
      const b = document.createElement('div'); b.className = 'gb';
      const isToday = i === days.length - 1;
      if (x.v <= 0) b.classList.add('zero');
      else {
        b.style.height = Math.max(2, (x.v / scale) * H) + 'px';
        if (isToday) { b.classList.add('today'); b.style.background = this._gDef.bar + '59'; b.style.borderColor = this._gDef.color; }
        else b.style.background = this._gDef.bar;
      }
      if (i === peakIdx && !isToday) {
        const l = document.createElement('div'); l.className = 'gdlab'; l.textContent = this._fmtRuntime(x.v); b.appendChild(l);
      }
      const show = () => {
        const r = b.getBoundingClientRect(); const pr = plot.getBoundingClientRect();
        tip.style.left = (r.left - pr.left + r.width / 2) + 'px';
        tip.style.top = (r.top - pr.top) + 'px';
        tip.innerHTML = WEEKDAYS[x.d.getDay()] + ' ' + MONTHS[x.d.getMonth()] + ' ' + x.d.getDate() +
          ' &middot; <b style="color:' + this._gDef.color + '">' + this._fmtRuntime(x.v) + '</b>' + (isToday ? ' so far' : '');
        tip.style.display = 'block';
      };
      b.addEventListener('pointerenter', show);
      b.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
      b.addEventListener('click', (e) => { e.stopPropagation(); show(); });
      bars.appendChild(b);
    });
    el.gxrow.innerHTML = days.map((x, i) => '<span>' + (i % 2 === 0 ? x.d.getDate() : '') + '</span>').join('');
    const todayD = days[days.length - 1];
    const peak = peakIdx >= 0 ? days[peakIdx] : null;
    const meterEnt = this._config[this._gDef.key];
    const statsEnt = this._statsEntity();
    el.gstats.innerHTML =
      '<div class="gstat" data-ent="' + meterEnt + '"><div class="gv">' + this._fmtRuntime(todayD.v) + '</div><div class="gc">today</div></div>' +
      '<div class="gstat" data-ent="' + statsEnt + '"><div class="gv">' + this._fmtRuntime(avg) + '</div><div class="gc">7-day avg</div></div>' +
      (peak ? '<div class="gstat" data-ent="' + statsEnt + '"><div class="gv">' + this._fmtRuntime(peak.v) + '</div><div class="gc">peak &middot; ' + MONTHS[peak.d.getMonth()] + ' ' + peak.d.getDate() + '</div></div>' : '');
  }

  _buildModes() {
    if (this._modesBuilt) return;
    const avail = this._attrs().hvac_modes || [];
    const list = this._config.modes.filter(m => avail.includes(m));
    (list.length ? list : avail).forEach(m => {
      const d = document.createElement('div');
      d.className = 'mode';
      d.dataset.mode = m;
      const ic = document.createElement('ha-icon');
      ic.setAttribute('icon', this._config['icon_' + m] || ICONS[m] || 'mdi:thermostat');
      d.appendChild(ic);
      d.addEventListener('click', () => this._setMode(m));
      this._el.modes.appendChild(d);
    });
    this._modesBuilt = true;
  }

  _updateModes(mode) {
    this._el.modes.querySelectorAll('.mode').forEach(d => {
      const active = d.dataset.mode === mode;
      d.classList.toggle('active', active);
      d.style.background = active ? (COLORS[d.dataset.mode] || 'var(--primary-color)') : '';
    });
  }

  _updateBar(mode) {
    const el = this._el;
    const a = this._attrs();
    const v = this._vals();
    const eco = this._ecoOn();
    const ALL = ['fheat','fcool','fsingle','bfheat','bfcool','hlow','hhigh','blow','bhigh','curdot','offlbl'];
    const used = new Set();
    const show = (k) => { if (el[k].style.display !== 'block') el[k].style.display = 'block'; used.add(k); };

    // eco recolors the faded fills green; setpoints are the entity-reported eco temps
    el.fheat.style.background = eco ? COLORS.eco : COLORS.heat;
    el.fcool.style.background = eco ? COLORS.eco : COLORS.cool;

    const cur = a.current_temperature;
    const curC = cur != null ? Math.min(this._max(), Math.max(this._min(), cur)) : null;
    if (curC != null && mode !== 'off') {
      show('curdot');
      el.curdot.style.left = this._pct(curC) + '%';
    }

    const label = (k, val, kind) => {
      show(k);
      el[k].style.left = this._pct(val) + '%';
      el[k].style.color = eco ? LABEL_COLORS.eco : LABEL_COLORS[kind];
      el[k].innerHTML = this._fmt(val) + '<span class="deg">&deg;</span>';
    };
    const handle = (k, val) => {
      if (eco) return; // read-only in eco: no handles
      show(k);
      el[k].style.left = this._pct(val) + '%';
    };
    // bright segment: extends 8px past each endpoint so round caps surround handle & dot (native line-cap look).
    // from === to draws a 16px cap centered on the handle - native always renders this (zero-length round-cap stroke).
    // suppressed entirely in eco (no handle, no work-zone emphasis on a read-only track).
    const bright = (k, from, to) => {
      if (eco) return false;
      if (from == null || to == null || to < from) return false;
      show(k);
      el[k].style.left = 'calc(' + this._pct(from) + '% - 8px)';
      el[k].style.width = 'calc(' + (this._pct(to) - this._pct(from)) + '% + 16px)';
      return true;
    };
    let dotOnBright = false;

    if (mode === 'heat_cool' && v.low != null && v.high != null) {
      show('fheat'); el.fheat.style.width = this._pct(v.low) + '%';
      show('fcool'); el.fcool.style.width = (100 - this._pct(v.high)) + '%';
      if (curC != null && curC < v.low) { bright('bfheat', curC, v.low); dotOnBright = true; }
      else bright('bfheat', v.low, v.low);
      if (curC != null && curC > v.high) { bright('bfcool', v.high, curC); dotOnBright = true; }
      else bright('bfcool', v.high, v.high);
      handle('hlow', v.low);
      handle('hhigh', v.high);
      label('blow', v.low, 'heat');
      label('bhigh', v.high, 'cool');
    } else if (mode === 'heat' && v.single != null) {
      show('fheat'); el.fheat.style.width = this._pct(v.single) + '%';
      if (curC != null && curC < v.single) { bright('bfheat', curC, v.single); dotOnBright = true; }
      else bright('bfheat', v.single, v.single);
      handle('hlow', v.single);
      label('blow', v.single, 'heat');
    } else if (mode === 'cool' && v.single != null) {
      show('fcool'); el.fcool.style.width = (100 - this._pct(v.single)) + '%';
      if (curC != null && curC > v.single) { bright('bfcool', v.single, curC); dotOnBright = true; }
      else bright('bfcool', v.single, v.single);
      handle('hlow', v.single);
      label('blow', v.single, 'cool');
    }
    // off mode: bar stays empty - the status text under the temp already says "Off" (offlbl removed in v2.2)

    if (used.has('curdot')) {
      // native darkens the current-temp dot when it sits on the bright fill so it stays visible
      el.curdot.style.background = dotOnBright ? 'rgba(0,0,0,.5)' : '#a6a6a6';
    }

    ALL.forEach(k => { if (!used.has(k)) el[k].style.display = 'none'; });
  }

  /* ---------- interactions ---------- */
  _valFromX(clientX) {
    const r = this._el.bar.getBoundingClientRect();
    let f = (clientX - r.left) / r.width;
    f = Math.max(0, Math.min(1, f));
    const step = this._step();
    const raw = this._min() + f * (this._max() - this._min());
    return Math.min(this._max(), Math.max(this._min(), Math.round(raw / step) * step));
  }

  _bindDrag() {
    const el = this._el;
    const down = (e) => {
      const mode = this._mode();
      if (mode === 'off' || this._ecoOn() || !this._stateObj()) return; // eco: Nest rejects setpoint changes
      const v = this._vals();
      const gap = this._config.gap;
      this._opt = { low: v.low, high: v.high, single: v.single };
      if (mode === 'heat_cool') {
        const x = this._valFromX(e.clientX);
        if (e.target === el.hlow) this._drag = 'low';
        else if (e.target === el.hhigh) this._drag = 'high';
        else this._drag = (Math.abs(x - v.low) <= Math.abs(x - v.high)) ? 'low' : 'high';
      } else {
        this._drag = 'single';
      }
      el.bar.setPointerCapture && el.bar.setPointerCapture(e.pointerId);
      e.preventDefault();
      move(e);
    };
    const move = (e) => {
      if (!this._drag) return;
      const x = this._valFromX(e.clientX);
      const gap = this._config.gap;
      if (this._drag === 'low') this._opt.low = Math.min(x, this._opt.high - gap);
      else if (this._drag === 'high') this._opt.high = Math.max(x, this._opt.low + gap);
      else this._opt.single = x;
      this._updateBar(this._mode());
    };
    const up = () => {
      if (!this._drag) return;
      this._drag = null;
      el.bar.classList.remove('dragging');
      this._commit();
    };
    el.bar.addEventListener('pointerdown', down);
    el.hlow.addEventListener('pointerdown', down);
    el.hhigh.addEventListener('pointerdown', down);
    const moveWin = (e) => { if (!this._drag) return; el.bar.classList.add('dragging'); move(e); };
    window.addEventListener('pointermove', moveWin);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _commit() {
    const s = this._stateObj();
    if (!s || !this._hass) return;
    const mode = this._mode();
    const data = { entity_id: this._config.entity };
    if (mode === 'heat_cool') {
      if (this._opt.low == null || this._opt.high == null) return;
      data.target_temp_low = this._opt.low;
      data.target_temp_high = this._opt.high;
    } else {
      if (this._opt.single == null) return;
      data.temperature = this._opt.single;
    }
    this._optUntil = Date.now() + 8000;
    this._hass.callService('climate', 'set_temperature', data);
  }

  _setMode(m) {
    if (!this._hass) return;
    this._optMode = m;
    this._optModeUntil = Date.now() + 8000;
    this._updateModes(m);
    this._updateBar(m);
    this._hass.callService('climate', 'set_hvac_mode', { entity_id: this._config.entity, hvac_mode: m });
  }

  _toggleEco() {
    if (!this._hass || !this._ecoSupported()) return;
    const on = this._ecoOn();
    this._optEco = !on;
    this._optEcoUntil = Date.now() + 8000;
    this._render();
    this._hass.callService('climate', 'set_preset_mode', { entity_id: this._config.entity, preset_mode: on ? 'none' : 'eco' });
  }
}

customElements.define('flat-thermostat-card', FlatThermostatCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-thermostat-card',
  name: 'Flat Thermostat Card',
  description: 'Slim flat thermostat with dual-handle temperature track, native-style mode strip, eco toggle, and daily HVAC runtime chip with expanding 14-day runtime graph',
});
