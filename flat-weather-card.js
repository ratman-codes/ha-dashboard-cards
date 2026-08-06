/* flat-weather-card v1.5.1 - custom Lovelace card for the main dashboard.
   v1.5.1: sanitization fix - this comment's example de-localized; no
   behavior change.
   v1.5: named backup tag - optional fallback_name labels backup mode with
   the backup station's name, e.g. "Sunny - Backup Station (backup)"
   instead of the bare "Backup" tag (owner request 2026-08-04).
   v1.4: automatic fallback - optional fallback_entity (a second weather
   entity; the owner uses a nearby backup PWS). When the primary station
   entity reads unavailable/unknown, the header current conditions and
   the 5-day strip switch to the fallback automatically and the condition
   line shows "... - Backup" (subtle tag, owner-approved 2026-08-04).
   The dew line switches to fallback_dew_entity if configured (same color
   thresholds), else drops to fallback humidity only - the primary dew
   sensor is deliberately ignored during outages because it freezes stale
   rather than going unavailable (observed 2026-08-03). The moment the
   primary reports again the card flips back on its own; daily forecast
   subscriptions are restarted on the unavailable->available transition
   so pushes resume. No helpers, no automations - the fallback lives
   entirely in this card.
   v1.3: chip delta - the forecast-vs-actual chip appends the signed
   difference, e.g. "77 deg called - 78 deg so far (+1)". Plain ink by
   design (the number speaks; no color).
   v1.2: dew point in the header - the humidity line becomes "Dew NN deg - RH%"
   when dew_entity is configured, with the dew value color-coded by the
   owner's window-flush thresholds: plain grey under 60F (crisp air),
   amber #ffc107 at 60-65F (noticeable), orange #ff9c4a at 65F+ (sticky,
   do not import). Falls back to the plain humidity line when the sensor
   is absent or unavailable.
   v1.1: press feedback - pressed section (header/chip/curve/day cell) dips
   to 98.5% scale with a faint wash for the duration of the press; no hover
   highlights on large areas by design (owner-approved trial 2026-07-10).
   One merged weather card: station current conditions (header), 12h forecast
   temperature curve (middle), 5-day strip (bottom), plus an optional
   "forecast vs actual" chip tied to the Forecast Lab experiment.
   Built 2026-07-10 by Claude for Ratman (design notes archived in the
   "NAS / Smart Home" Claude project, doc claude/ha-dashboard-notes.md).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-weather-card;base64,<blob>.
     No file on disk, no internet dependency - the code lives inside the URL,
     in HA's own config (.storage/lovelace_resources), and is included in
     every Home Assistant backup automatically.
   - To READ it: copy everything after "base64," and run it through any
     base64 decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS (ASCII only - use &deg; in innerHTML
     and unicode escapes in JS strings, never a literal degree sign),
     node --check it, re-encode to base64, then in
     Settings > Dashboards > Resources replace this resource's URL.
     Hard-refresh the browser.
   - All entity ids and tap-through URLs come from the card YAML on the
     dashboard (kept out of this source on purpose). Example shape:
       type: custom:flat-weather-card
       station_entity: weather.YOUR_PWS          # current conditions (required)
       hourly_entity:  weather.YOUR_HOURLY_SRC   # curve source (required)
       daily_entity:   weather.YOUR_DAILY_SRC    # 5-day source (required)
       name: Your Station Label                  # optional header caption
       station_url: https://...                  # tap: header block
       hourly_url:  https://...                  # tap: curve
       daily_url:   https://...                  # tap: day cells
       chip_forecast_entity: input_number...     # optional scoreboard chip
       chip_actual_entity:   input_number...
       chip_path: /your-lab-dashboard            # chip tap -> HA path
       dew_entity: sensor.YOUR_DEW_SENSOR        # optional: colored dew line
       fallback_entity: weather.YOUR_BACKUP      # optional: auto-backup when
                                                 #   the station is offline
       fallback_dew_entity: sensor.BACKUP_DEW    # optional: dew line source
                                                 #   while in backup mode
       fallback_name: Backup Station Label       # optional: backup-mode tag
                                                 #   reads "<name> (backup)"
       accent: "#ffc107"                         # curve color (optional)
       hours: 12   # curve span    days: 5       # strip length (optional)
   - Long-press anywhere on the card = native HA more-info for the section
     under your finger (header -> station, curve -> hourly, strip -> daily). */

const ACCENT_DEFAULT = '#ffc107';
const GREY_TEXT = '#9e9e9e';
const COND_ICON = {
  'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy',
  fog: 'mdi:weather-fog', hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy', pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy', snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy', sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy',
  exceptional: 'mdi:alert-circle-outline',
};
/* hardcoded hexes - the dashboard theme primary is green and leaks through theme vars */
const COND_COLOR = {
  sunny: '#ffd54f', 'clear-night': '#b0bec5', partlycloudy: '#ffd54f',
  cloudy: '#b0bec5', fog: '#90a4ae', rainy: '#4fc3f7', pouring: '#4fc3f7',
  lightning: '#ffc107', 'lightning-rainy': '#ffc107', hail: '#4fc3f7',
  snowy: '#e1f5fe', 'snowy-rainy': '#e1f5fe', windy: '#b0bec5',
  'windy-variant': '#b0bec5', exceptional: '#ff6f22',
};
const COND_TEXT = {
  sunny: 'Sunny', 'clear-night': 'Clear', partlycloudy: 'Partly cloudy',
  cloudy: 'Cloudy', fog: 'Fog', rainy: 'Rain', pouring: 'Heavy rain',
  lightning: 'Thunderstorms', 'lightning-rainy': 'Thunderstorms', hail: 'Hail',
  snowy: 'Snow', 'snowy-rainy': 'Wintry mix', windy: 'Windy',
  'windy-variant': 'Windy', exceptional: 'Weather alert',
};
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

class FlatWeatherCard extends HTMLElement {
  static getStubConfig() { return { station_entity: '', hourly_entity: '', daily_entity: '' }; }

  setConfig(config) {
    ['station_entity', 'hourly_entity', 'daily_entity'].forEach(k => {
      if (!config[k]) throw new Error('flat-weather-card: "' + k + '" is required');
    });
    this._config = Object.assign({ hours: 12, days: 5, accent: ACCENT_DEFAULT, chip_path: '' }, config);
    this._hourly = null;
    this._daily = null;
    this._dailyFb = null;
    this._dOk = undefined;
    this._hourlyKey = '';
    this._dailyKey = '';
    this._subsStarted = false;
    if (!this.shadowRoot) this._createDom();
  }

  getCardSize() { return 4; }

  set hass(hass) {
    this._hass = hass;
    /* auto-heal: when the primary daily source comes back from an outage,
       restart the forecast subscriptions so its pushes resume cleanly */
    const dOk = !this._bad(this._st(this._config.daily_entity));
    if (this._dOk === false && dOk && this._subsStarted) this._restartSubs();
    this._dOk = dOk;
    this._startSubs();
    this._render();
  }

  connectedCallback() { this._startSubs(); }

  disconnectedCallback() { this._stopSubs(); }

  _stopSubs() {
    this._subsStarted = false;
    if (this._unsubH) { this._unsubH.then(u => u()).catch(() => {}); this._unsubH = null; }
    if (this._unsubD) { this._unsubD.then(u => u()).catch(() => {}); this._unsubD = null; }
    if (this._unsubF) { this._unsubF.then(u => u()).catch(() => {}); this._unsubF = null; }
  }

  _restartSubs() { this._stopSubs(); this._startSubs(); }

  _startSubs() {
    if (this._subsStarted || !this._hass || !this._config || !this.isConnected) return;
    this._subsStarted = true;
    const conn = this._hass.connection;
    const sub = (entity, type, cb) => conn.subscribeMessage(
      m => { cb(m.forecast || []); },
      { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entity }
    );
    this._unsubH = sub(this._config.hourly_entity, 'hourly', f => { this._hourly = f; this._renderHourly(); });
    this._unsubH.catch(() => { this._hourly = []; this._renderHourly(); });
    this._unsubD = sub(this._config.daily_entity, 'daily', f => { this._daily = f; this._renderDaily(); this._renderHeader(); });
    this._unsubD.catch(() => { this._daily = []; this._renderDaily(); });
    if (this._config.fallback_entity) {
      this._unsubF = sub(this._config.fallback_entity, 'daily', f => { this._dailyFb = f; this._renderDaily(); this._renderHeader(); });
      this._unsubF.catch(() => { this._dailyFb = []; });
    }
  }

  _st(id) { return this._hass && this._hass.states[id]; }
  _bad(s) { return !s || s.state === 'unavailable' || s.state === 'unknown'; }
  _fmt(v) { return (v == null || isNaN(v)) ? '--' : String(Math.round(v)); }

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 14px 16px 10px 16px; }
        .row { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .cicon { flex: 0 0 44px; }
        .cicon ha-icon { --mdc-icon-size: 40px; width: 44px; height: 44px; display: flex;
          align-items: center; justify-content: center; line-height: 0; }
        .cur { font-size: 32px; font-weight: 400; line-height: 1.05; position: relative;
          color: var(--primary-text-color); width: fit-content; }
        .cur sup { position: absolute; left: 100%; top: 2px; font-size: 14px;
          color: var(--secondary-text-color); font-weight: 400; }
        .cond { font-size: 12px; color: var(--secondary-text-color); margin-top: 3px; white-space: nowrap; }
        .right { margin-left: auto; text-align: right; font-size: 12px;
          color: var(--secondary-text-color); line-height: 1.55; }
        .right .hl { color: var(--primary-text-color); font-size: 13px; }
        .right .hl span { color: var(--secondary-text-color); }
        .chip { display: none; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 11.5px;
          color: var(--secondary-text-color); background: rgba(70,70,70,.22); border-radius: 8px;
          padding: 5px 10px; width: fit-content; cursor: pointer; }
        .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: ${ACCENT_DEFAULT}; }
        .chip b { color: var(--primary-text-color); font-weight: 500; }
        .hourly { margin: 12px 0 2px; cursor: pointer; }
        .hourly svg { display: block; width: 100%; height: auto; }
        .hx { display: flex; justify-content: space-between; font-size: 10.5px;
          color: #7d7d7d; padding: 2px 2px 0; }
        .daily { display: flex; margin-top: 10px; border-top: 1px solid rgba(70,70,70,.35);
          padding-top: 8px; }
        .day { flex: 1; text-align: center; cursor: pointer; border-radius: 8px; padding: 6px 0 4px;
          transition: background .15s; }
        .day:hover { background: rgba(70,70,70,.25); }
        .day .nm { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 3px; }
        .day ha-icon { --mdc-icon-size: 20px; width: 22px; height: 22px; display: flex;
          align-items: center; justify-content: center; line-height: 0; margin: 0 auto; }
        .day .hi { font-size: 12.5px; margin-top: 3px; color: var(--primary-text-color); }
        .day .lo { font-size: 11px; color: #7d7d7d; }
        .unavailable .cur, .unavailable .cond { opacity: .4; }
        .row, .chip, .hourly, .day { transition: transform .12s ease, background .12s ease; }
        .press { transform: scale(.985); background: rgba(70,70,70,.22); border-radius: 10px; }
        .chip.press { background: rgba(70,70,70,.38); }
      </style>
      <ha-card>
        <div class="row" id="hdr">
          <div class="cicon"><ha-icon id="cico" icon="mdi:weather-partly-cloudy"></ha-icon></div>
          <div>
            <div class="cur"><span id="curv">--</span><sup>&deg;</sup></div>
            <div class="cond" id="cond"></div>
          </div>
          <div class="right">
            <div class="hl"><span id="hi">--</span>&deg; <span id="losep">/ </span><span id="lo">--</span><span>&deg;</span></div>
            <div id="hum"></div>
            <div id="wind"></div>
          </div>
        </div>
        <div class="chip" id="chip"><span class="dot" id="chipdot"></span><span id="chiptxt"></span></div>
        <div class="hourly" id="hourly"></div>
        <div class="daily" id="daily"></div>
      </ha-card>
    `;
    this._el = {};
    ['hdr', 'cico', 'curv', 'cond', 'hi', 'lo', 'hum', 'wind', 'chip', 'chipdot', 'chiptxt', 'hourly', 'daily']
      .forEach(id => this._el[id] = root.getElementById(id));
    this._el.chipdot.style.background = this._config.accent;
    this._bindTaps();
  }

  /* ---------- taps: click = link-through, long-press = more-info ---------- */
  _bindTaps() {
    const el = this._el;
    const moreInfo = (entity) => this.dispatchEvent(new CustomEvent('hass-more-info',
      { detail: { entityId: entity }, bubbles: true, composed: true }));
    const openUrl = (url) => { if (url) window.open(url, '_blank'); };
    const navigate = (path) => {
      if (!path) return;
      history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('location-changed'));
    };
    const bind = (node, onClick) => {
      node.addEventListener('click', (e) => {
        if (this._lpFired) { this._lpFired = false; return; }
        onClick(e);
      });
    };
    bind(el.hdr, () => this._config.station_url
      ? openUrl(this._config.station_url) : moreInfo(this._config.station_entity));
    bind(el.hourly, () => this._config.hourly_url
      ? openUrl(this._config.hourly_url) : moreInfo(this._config.hourly_entity));
    bind(el.daily, () => this._config.daily_url
      ? openUrl(this._config.daily_url) : moreInfo(this._config.daily_entity));
    bind(el.chip, () => navigate(this._config.chip_path));
    /* press feedback: the pressed section dips while the pointer is down */
    const pressable = (node) => {
      node.addEventListener('pointerdown', (e) => {
        const t = node === el.daily ? (e.target.closest ? e.target.closest('.day') : null) : node;
        if (t) t.classList.add('press');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        node.addEventListener(ev, () => {
          node.classList.remove('press');
          if (node === el.daily) node.querySelectorAll('.day.press').forEach(d => d.classList.remove('press'));
        }));
    };
    [el.hdr, el.chip, el.hourly, el.daily].forEach(pressable);
    /* long-press -> more-info for the section under the pointer */
    let timer = null;
    const entityFor = (t) => el.hourly.contains(t) ? this._config.hourly_entity
      : el.daily.contains(t) ? this._config.daily_entity : this._config.station_entity;
    this.shadowRoot.addEventListener('pointerdown', (e) => {
      const ent = entityFor(e.target);
      this._lpFired = false;
      timer = setTimeout(() => { this._lpFired = true; moreInfo(ent); }, 550);
    });
    ['pointerup', 'pointermove', 'pointercancel', 'pointerleave'].forEach(ev =>
      this.shadowRoot.addEventListener(ev, (e) => {
        if (ev === 'pointermove' && timer === null) return;
        if (ev === 'pointermove') return; /* small moves shouldn't cancel; taps are quick anyway */
        clearTimeout(timer); timer = null;
      }));
  }

  /* ---------- rendering ---------- */
  _render() { if (this._el) { this._renderHeader(); this._renderChip(); } }

  _renderHeader() {
    const el = this._el; if (!el) return;
    let s = this._st(this._config.station_entity);
    let fb = false;
    if (this._bad(s) && this._config.fallback_entity) {
      const b = this._st(this._config.fallback_entity);
      if (!this._bad(b)) { s = b; fb = true; }
    }
    const bad = this._bad(s);
    el.hdr.classList.toggle('unavailable', bad);
    const a = (s && s.attributes) || {};
    el.curv.textContent = bad ? '--' : this._fmt(a.temperature);
    const condKey = s && s.state;
    el.cico.setAttribute('icon', COND_ICON[condKey] || 'mdi:weather-partly-cloudy');
    el.cico.style.color = COND_COLOR[condKey] || GREY_TEXT;
    const label = fb ? ' \u00b7 ' + (this._config.fallback_name
        ? this._config.fallback_name + ' (backup)' : 'Backup')
      : (this._config.name ? ' \u00b7 ' + this._config.name : '');
    el.cond.textContent = bad ? 'Unavailable' : ((COND_TEXT[condKey] || condKey || '') + label);
    const rhTxt = (a.humidity != null && !bad) ? Math.round(a.humidity) + '%' : '';
    /* in fallback mode the station's dew sensor is stale (it freezes rather
       than going unavailable during outages) - use the backup station's dew
       sensor instead when configured, else humidity only */
    const dewCfg = fb ? this._config.fallback_dew_entity : this._config.dew_entity;
    const dewS = dewCfg ? this._st(dewCfg) : null;
    const dew = (dewS && !this._bad(dewS)) ? parseFloat(dewS.state) : NaN;
    if (!isNaN(dew)) {
      /* flush thresholds: <60 plain grey, 60-65 amber, 65+ orange (owner strategy) */
      const dc = dew >= 65 ? '#ff9c4a' : dew >= 60 ? '#ffc107' : '';
      const html = '<span' + (dc ? ' style="color:' + dc + '"' : '') + '>Dew ' + Math.round(dew) +
        '&deg;</span>' + (rhTxt ? ' &middot; ' + rhTxt : '');
      if (this._humHtml !== html) { this._humHtml = html; el.hum.innerHTML = html; }
    } else {
      const txt = rhTxt ? 'Humidity ' + rhTxt : '';
      if (this._humHtml !== txt) { this._humHtml = txt; el.hum.textContent = txt; }
    }
    el.wind.textContent = (a.wind_speed != null && !bad)
      ? 'Wind ' + Math.round(a.wind_speed) + ' mph ' + COMPASS[Math.round(((a.wind_bearing || 0) % 360) / 45) % 8] : '';
    /* today's hi/lo from the daily source */
    const today = this._todayEntry();
    el.hi.textContent = today ? this._fmt(today.temperature) : '--';
    el.lo.textContent = today ? this._fmt(today.templow) : '--';
  }

  /* the daily list in force: primary while its entity is alive and has data,
     otherwise the fallback's - switches back automatically when primary heals */
  _activeDaily() {
    const p = this._daily || [], f = this._dailyFb || [];
    const primOk = !this._bad(this._st(this._config.daily_entity));
    if (primOk && p.length) return p;
    return f.length ? f : p;
  }

  _todayEntry() {
    const list = this._activeDaily();
    if (!list.length) return null;
    const now = new Date(); const key = now.toDateString();
    for (const e of list) {
      if (new Date(e.datetime).toDateString() === key) return e;
    }
    return list[0];
  }

  _renderChip() {
    const el = this._el; if (!el) return;
    const cf = this._config.chip_forecast_entity, ca = this._config.chip_actual_entity;
    const sf = cf && this._st(cf), sa = ca && this._st(ca);
    let show = false;
    if (sf && sa && !this._bad(sf) && !this._bad(sa)) {
      const f = parseFloat(sf.state), act = parseFloat(sa.state);
      if (!isNaN(f) && f > -50) {
        show = true;
        let actTxt = '';
        if (!isNaN(act) && act > -50) {
          const d = Math.round(act) - Math.round(f);
          const dTxt = ' (' + (d >= 0 ? '+' : '') + d + ')';
          actTxt = ' &middot; actual so far <b>' + Math.round(act) + '&deg;</b><b>' + dTxt + '</b>';
        }
        const html = 'Today: <b>' + Math.round(f) + '&deg;</b> called' + actTxt;
        if (this._chipHtml !== html) { this._chipHtml = html; el.chiptxt.innerHTML = html; }
      }
    }
    const disp = show ? 'flex' : 'none';
    if (el.chip.style.display !== disp) el.chip.style.display = disp;
  }

  _hourLabel(d) {
    let h = d.getHours();
    const ap = h >= 12 ? 'p' : 'a';
    h = h % 12; if (h === 0) h = 12;
    return h + ap;
  }

  _renderHourly() {
    const el = this._el; if (!el) return;
    const cutoff = Date.now() - 45 * 60 * 1000;
    const list = (this._hourly || [])
      .filter(e => new Date(e.datetime).getTime() >= cutoff && e.temperature != null)
      .slice(0, this._config.hours);
    const key = JSON.stringify(list.map(e => [e.datetime, e.temperature]));
    if (key === this._hourlyKey) return;
    this._hourlyKey = key;
    if (list.length < 2) { el.hourly.innerHTML = '<div class="hx">forecast unavailable</div>'; return; }
    const temps = list.map(e => Math.round(e.temperature));
    const W = 448, H = 74, padT = 16, padB = 12, padX = 8;
    const min = Math.min.apply(null, temps), max = Math.max.apply(null, temps);
    const x = i => padX + i * (W - 2 * padX) / (temps.length - 1);
    const y = t => padT + (max - t) * (H - padT - padB) / ((max - min) || 1);
    const pts = temps.map((t, i) => x(i).toFixed(1) + ',' + y(t).toFixed(1)).join(' ');
    const peak = temps.indexOf(max);
    const lastIdx = temps.length - 1;
    const peakLbl = (peak !== 0 && peak !== lastIdx)
      ? '<text x="' + x(peak).toFixed(1) + '" y="' + (y(max) - 6).toFixed(1) +
        '" fill="' + GREY_TEXT + '" font-size="11" text-anchor="middle">' + max + '&#176;</text>' : '';
    const svg =
      '<svg viewBox="0 0 ' + W + ' ' + H + '">' +
      '<line x1="' + padX + '" y1="' + y(max).toFixed(1) + '" x2="' + (W - padX) + '" y2="' + y(max).toFixed(1) +
        '" stroke="rgba(70,70,70,.3)" stroke-width="1"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + this._config.accent +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + x(0).toFixed(1) + '" cy="' + y(temps[0]).toFixed(1) + '" r="4" fill="#fff"/>' +
      '<text x="' + (x(0) + 8).toFixed(1) + '" y="' + (y(temps[0]) - 7).toFixed(1) +
        '" fill="' + GREY_TEXT + '" font-size="11">' + temps[0] + '&#176;</text>' +
      peakLbl +
      '<text x="' + x(lastIdx).toFixed(1) + '" y="' + (y(temps[lastIdx]) - 7).toFixed(1) +
        '" fill="' + GREY_TEXT + '" font-size="11" text-anchor="end">' + temps[lastIdx] + '&#176;</text>' +
      '</svg>';
    const labels = list.map((e, i) =>
      (i % 3 === 0 || i === lastIdx) ? '<span>' + this._hourLabel(new Date(e.datetime)) + '</span>' : '')
      .join('');
    el.hourly.innerHTML = svg + '<div class="hx">' + labels + '</div>';
  }

  _renderDaily() {
    const el = this._el; if (!el) return;
    const seen = new Set();
    const list = this._activeDaily().filter(e => {
      if (e.temperature == null) return false;
      const k = new Date(e.datetime).toDateString();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, this._config.days);
    const key = JSON.stringify(list.map(e => [e.datetime, e.temperature, e.templow, e.condition]));
    if (key === this._dailyKey) return;
    this._dailyKey = key;
    const todayKey = new Date().toDateString();
    el.daily.innerHTML = list.map(e => {
      const d = new Date(e.datetime);
      const nm = d.toDateString() === todayKey ? 'Today'
        : d.toLocaleDateString(undefined, { weekday: 'short' });
      const ic = COND_ICON[e.condition] || 'mdi:weather-partly-cloudy';
      const col = COND_COLOR[e.condition] || GREY_TEXT;
      return '<div class="day"><div class="nm">' + nm + '</div>' +
        '<ha-icon icon="' + ic + '" style="color:' + col + '"></ha-icon>' +
        '<div class="hi">' + this._fmt(e.temperature) + '&#176;</div>' +
        '<div class="lo">' + this._fmt(e.templow) + '&#176;</div></div>';
    }).join('');
  }
}

customElements.define('flat-weather-card', FlatWeatherCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-weather-card',
  name: 'Flat Weather Card',
  description: 'Merged station conditions + hourly temperature curve + 5-day strip, with forecast-vs-actual chip',
});
