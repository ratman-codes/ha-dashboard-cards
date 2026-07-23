/* flat-thermostat-card v2.4.5 - custom Lovelace card for the main dashboard.
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
   Layout (v2.4.4 FINAL after owner iteration; supersedes the v2.4.2
   offset-row and v2.4.3 two-column attempts): original two-row structure.
   Row 1: temp/status block (20%, min 84px) + track vertically centered
   beside it (as in v2.2/v2.3). Row 2: chip slot (same 20%/84px basis,
   chip pinned 80px, centered under the temp block) + mode strip + eco.
   Alignment invariants: strip left edge == track left edge (slot width +
   8px row gap == temp-block width + 8px track left padding), and both
   track and eco run flush to the card's right padding edge (right-side
   track padding removed in v2.4.3; handle/label overhang at max temp
   spills harmlessly into the card padding). Chip hidden (mode off /
   unconfigured) leaves the empty slot so the strip never moves. */

const ICONS = { off: 'mdi:power', cool: 'mdi:snowflake', heat: 'mdi:fire', heat_cool: 'mdi:sun-snowflake-variant' };
const COLORS = { off: '#9e9e9e', cool: '#2196f3', heat: '#ff6f22', heat_cool: '#ffc107', eco: '#4caf50' };
const LABEL_COLORS = { heat: '#ff9c4a', cool: '#64b5f6', eco: '#81c784' };
const ACTION_TEXT = { cooling: 'Cooling', heating: 'Heating', idle: 'Idle', off: 'Off', fan: 'Fan', drying: 'Drying', preheating: 'Preheating' };

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
    this._rtEnt = null;
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
        ha-card { padding: 12px 14px 10px 14px; }
        .main { display: flex; gap: 0; align-items: center; padding: 4px 0 0 0; }
        .curblock { flex: 0 0 20%; min-width: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 0; cursor: pointer; }
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
        .chipslot { flex: 0 0 20%; min-width: 84px; display: flex; align-items: center; justify-content: center; }
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
        .rtchip { flex: 0 0 auto; box-sizing: border-box; width: 80px; height: 42px; border-radius: 12px;
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
      </ha-card>
    `;
    this._el = {};
    ['main','curblock','bar','fheat','fcool','fsingle','bfheat','bfcool','curdot','hlow','hhigh','blow','bhigh','offlbl','modes','ecobtn','rtchip','curval','unit','state']
      .forEach(id => this._el[id] = root.getElementById(id));
    this._el.bfheat.style.background = COLORS.heat;
    this._el.bfcool.style.background = COLORS.cool;
    this._bindDrag();
    this._el.ecobtn.addEventListener('click', () => this._toggleEco());
    // tapping the runtime chip opens more-info (history) for the shown meter
    this._el.rtchip.addEventListener('click', () => {
      if (!this._rtEnt) return;
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._rtEnt },
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
      { key: 'runtime_cooling', icon: this._config.icon_cool || ICONS.cool, color: LABEL_COLORS.cool, act: 'cooling' },
      { key: 'runtime_heating', icon: this._config.icon_heat || ICONS.heat, color: LABEL_COLORS.heat, act: 'heating' },
    ];
    const want = mode === 'cool' ? [defs[0]] : mode === 'heat' ? [defs[1]] : mode === 'heat_cool' ? defs : [];
    const rows = [];
    for (const d of want) {
      const ent = this._config[d.key];
      if (!ent) continue;
      const st = this._hass.states[ent];
      if (!st) continue;
      const num = parseFloat(st.state);
      const v = isNaN(num) ? null : num;
      // v2.4.1: configured meters for the active mode always show ("0m" included); '--' when unavailable
      rows.push({ ent: ent, icon: d.icon, color: d.color, v: v });
    }
    if (unavailable || !rows.length) {
      el.classList.add('gone');
      this._rtEnt = null;
      return;
    }
    el.classList.remove('gone');
    el.classList.toggle('two', rows.length > 1);
    const html = rows.map(r =>
      '<div class="rrow"><ha-icon icon="' + r.icon + '" style="color:' + r.color + '"></ha-icon>' + this._fmtRuntime(r.v) + '</div>'
    ).join('') + (rows.length === 1 ? '<div class="rcap">today</div>' : '');
    if (html !== this._rtHtml) { el.innerHTML = html; this._rtHtml = html; }
    this._rtEnt = rows[0].ent;
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
  description: 'Slim flat thermostat with dual-handle temperature track, native-style mode strip, eco toggle, and daily HVAC runtime chip',
});
