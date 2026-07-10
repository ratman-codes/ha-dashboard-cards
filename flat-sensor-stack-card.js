/* flat-sensor-stack-card v1.2 - custom Lovelace card for the main dashboard.
   Collapsible stack of compact sensor history graphs (default: desk temperature,
   CO2, humidity - 24h). Row 0 is always visible; its top-right label is the
   expand/collapse toggle (hover-highlighted pill, no chevron). Hovering a graph
   scrubs history: a floating value + time pill follows a dot along the curve
   (the live reading stays put top-left); mouse away hides it. Clicking
   anywhere else on a row opens the native more-info history dialog.
   Built 2026-07-10 by Claude for Ratman (design spec + lessons archived in the
   "NAS / Smart Home" Claude project, doc claude/ha-dashboard-notes.md; visual
   language matches the native sensor card this replaces and the sibling
   flat-thermostat / flat-treadmill / flat-weather cards).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-sensor-stack-card;base64,<blob>.
     There is no file on disk and no internet dependency - the code lives inside
     the URL itself, in HA's own config (.storage/lovelace_resources), and is
     included in every Home Assistant backup automatically. The ;name= parameter
     is only a human-readable label for the Resources page (RFC 2397).
   - To READ it: copy everything after "base64," and run it through any base64
     decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS (ASCII-only in strings; entities/escapes
     for special chars), run node --check, re-encode to base64, then in
     Settings > Dashboards > Resources replace this resource's URL with
     data:text/javascript;name=flat-sensor-stack-card;base64,<new blob>. Hard-refresh.
   - Used from the dashboard as:  type: custom:flat-sensor-stack-card
     (that single line is the whole card config - the desk sensor entity ids,
     names, colors and thresholds are defaults baked in below; override with:
     hours: 24, rows: [{entity, name, color, decimals, thresholds: [{value,color},...]}]
     - row 0 is the always-visible title row.)
   - History arrives over the websocket (history/history_during_period,
     hourly-averaged buckets like the native sensor card's detail:1), refreshed
     every 5 minutes; the last point is pinned to the live state.
   - v1.1: matched to measured native sensor-card values - reading weight 400,
     uom 16px, line stroke 2, fill opacity .10, graph top headroom so curves
     stay below the reading.
   - v1.2: more top headroom (26px); hover readout changed from swapping the
     reading to a floating value+time pill above the scrub dot (owner choice). */

const DEF_ROWS = [
  { entity: 'sensor.living_room_desk_meter_pro_co2_b98a_temperature',
    name: 'Desk Temp \u2014 24h', color: '#ff9800', decimals: 1 },
  { entity: 'sensor.living_room_desk_meter_pro_co2_b98a_carbon_dioxide',
    name: 'CO2 \u2014 24h', decimals: 0,
    thresholds: [ { value: 0, color: '#4caf50' }, { value: 800, color: '#ffc107' }, { value: 1200, color: '#f44336' } ] },
  { entity: 'sensor.living_room_desk_meter_pro_co2_b98a_humidity',
    name: 'Humidity \u2014 24h', color: '#2196f3', decimals: 0 },
];
const ROW_H = 116, GRAPH_H = 99, PAD_Y = 10;
const REFRESH_MS = 5 * 60 * 1000;

class FlatSensorStackCard extends HTMLElement {
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = Object.assign({ hours: 24 }, config);
    this._rows = (config.rows && config.rows.length ? config.rows : DEF_ROWS)
      .map(r => Object.assign({}, r));
    this._open = false;
    this._hist = {};        // entity -> [{t, v}]
    if (!this.shadowRoot) this._createDom();
    else this._buildRows();
  }

  getCardSize() { return 2; }

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

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; overflow: hidden; }
        .row { position: relative; height: ${ROW_H}px; cursor: pointer;
          transition: transform .12s ease, background .12s ease; }
        .row.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .row + .row { border-top: 1px solid rgba(255,255,255,.05); }
        .row.unavailable .reading, .row.unavailable svg { opacity: .4; }
        svg.graph { position: absolute; left: 0; right: 0; bottom: 0;
          width: 100%; height: ${GRAPH_H}px; display: block; pointer-events: none; }
        .reading { position: absolute; top: ${PAD_Y}px; left: 16px; z-index: 1; pointer-events: none; }
        .val { font-size: 28px; font-weight: 400; line-height: 1.2;
          color: var(--primary-text-color);
          -webkit-text-stroke: 2px var(--card-background-color); paint-order: stroke fill; }
        .val .uom { font-size: 16px; font-weight: 400; color: var(--secondary-text-color);
          margin-left: 3px; }
        .tip { position: absolute; z-index: 3; padding: 3px 9px; border-radius: 6px;
          background: rgba(0,0,0,.85); font-size: 12px; color: var(--primary-text-color);
          pointer-events: none; white-space: nowrap; transform: translateX(-50%);
          visibility: hidden; }
        .tip .tt { color: var(--secondary-text-color); margin-left: 6px; font-size: 11px; }
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
        .toggle:hover { background: rgba(255,255,255,.08); }
        .toggle.pressed { transform: scale(.96); background: rgba(70,70,70,.3); }
        .dot { position: absolute; width: 9px; height: 9px; border-radius: 50%;
          background: #fff; border: 2px solid var(--card-background-color);
          transform: translate(-50%,-50%); z-index: 1; pointer-events: none;
          visibility: hidden; }
        .kids { overflow: hidden; max-height: 0;
          transition: max-height .3s cubic-bezier(.4,0,.2,1); }
      </style>
      <ha-card>
        <div id="title"></div>
        <div class="kids" id="kids"></div>
      </ha-card>
    `;
    this._el = { title: root.getElementById('title'), kids: root.getElementById('kids') };
    this._buildRows();
  }

  _buildRows() {
    if (!this._el) return;
    this._el.title.innerHTML = '';
    this._el.kids.innerHTML = '';
    this._rowEls = [];
    this._rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <svg class="graph" preserveAspectRatio="none"></svg>
        <div class="reading">
          <div class="val"><span class="v">--</span><span class="uom"></span></div>
        </div>
        <div class="tip"><span class="tv"></span><span class="tt"></span></div>
        ${i === 0 ? '<div class="toggle"></div>' : '<div class="label"></div>'}
        <div class="dot"></div>
      `;
      const els = {
        row, svg: row.querySelector('svg'),
        v: row.querySelector('.v'), uom: row.querySelector('.uom'),
        tip: row.querySelector('.tip'), tv: row.querySelector('.tv'),
        tt: row.querySelector('.tt'), dot: row.querySelector('.dot'),
        head: row.querySelector(i === 0 ? '.toggle' : '.label'),
      };
      els.head.textContent = r.name || r.entity;
      this._bindRow(els, r, i);
      (i === 0 ? this._el.title : this._el.kids).appendChild(row);
      this._rowEls.push(els);
    });
  }

  /* ---------- interactions ---------- */
  _bindRow(els, r, i) {
    // press feedback (house style: dip + wash, no hover wash on large regions)
    const press = (el) => {
      el.addEventListener('pointerdown', (e) => {
        if (i === 0 && e.composedPath().includes(els.head)) return;
        el.classList.add('pressed');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        el.addEventListener(ev, () => el.classList.remove('pressed')));
    };
    press(els.row);
    if (i === 0) {
      els.head.addEventListener('pointerdown', (e) => { e.stopPropagation(); els.head.classList.add('pressed'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        els.head.addEventListener(ev, () => els.head.classList.remove('pressed')));
      els.head.addEventListener('click', (e) => { e.stopPropagation(); this._toggle(); });
    }
    els.row.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: r.entity }, bubbles: true, composed: true,
      }));
    });
    // hover scrub
    els.row.addEventListener('pointermove', (e) => {
      const pts = (this._hist[r.entity] || []);
      if (!pts.length) return;
      const rect = els.row.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let best = 0, bd = Infinity;
      for (let k = 0; k < pts.length; k++) {
        const d = Math.abs(pts[k].x - f);
        if (d < bd) { bd = d; best = k; }
      }
      const p = pts[best];
      const s = this._hass && this._hass.states[r.entity];
      const uom = (s && s.attributes.unit_of_measurement) || '';
      els.tv.textContent = this._fmt(p.v, r) + (uom ? ' ' + uom : '');
      els.tt.textContent = this._fmtTime(p.t);
      const dotY = ROW_H - GRAPH_H + p.y;
      const px = p.x * rect.width;
      els.tip.style.left = Math.max(60, Math.min(rect.width - 60, px)) + 'px';
      els.tip.style.top = Math.max(6, dotY - 32) + 'px';
      els.tip.style.visibility = 'visible';
      els.dot.style.left = (p.x * 100) + '%';
      els.dot.style.top = dotY + 'px';
      els.dot.style.visibility = 'visible';
    });
    els.row.addEventListener('pointerleave', () => {
      els.tip.style.visibility = 'hidden';
      els.dot.style.visibility = 'hidden';
    });
  }

  _toggle() {
    this._open = !this._open;
    const kids = this._el.kids;
    kids.style.maxHeight = this._open ? ((this._rows.length - 1) * (ROW_H + 1)) + 'px' : '0px';
  }

  /* ---------- live state ---------- */
  _renderStates() {
    if (!this._hass || !this._rowEls) return;
    this._rows.forEach((r, i) => {
      const els = this._rowEls[i];
      const s = this._hass.states[r.entity];
      const bad = !s || s.state === 'unavailable' || s.state === 'unknown';
      els.row.classList.toggle('unavailable', bad);
      const v = bad ? null : parseFloat(s.state);
      els.v.textContent = (v == null || isNaN(v)) ? '--' : this._fmt(v, r);
      els.uom.textContent = (s && s.attributes.unit_of_measurement) || '';
    });
  }

  _fmt(v, r) {
    const d = r.decimals != null ? r.decimals : 1;
    return Number(v).toFixed(d);
  }
  _fmtTime(t) {
    const dte = new Date(t);
    let h = dte.getHours(); const m = dte.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
  _color(r) {
    if (r.thresholds && r.thresholds.length) {
      const s = this._hass && this._hass.states[r.entity];
      const v = s ? parseFloat(s.state) : NaN;
      let c = r.thresholds[0].color;
      if (!isNaN(v)) for (const t of r.thresholds) { if (v >= t.value) c = t.color; }
      return c;
    }
    return r.color || '#ff9800';
  }

  /* ---------- history ---------- */
  async _fetchHistory() {
    if (!this._hass) return;
    const hours = this._config.hours || 24;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600e3);
    const ids = this._rows.map(r => r.entity);
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
    this._rows.forEach((r, i) => {
      const items = result[r.entity] || [];
      const pts = this._bucket(items, start.getTime(), end.getTime(), hours, r);
      this._hist[r.entity] = pts;
      this._drawGraph(i, r, pts);
    });
  }

  _bucket(items, t0, t1, hours, r) {
    // hourly-averaged buckets like the native sensor card (detail: 1)
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
    // pin last point to the live state so the curve ends "now"
    const s = this._hass && this._hass.states[r.entity];
    const live = s && s.state !== 'unavailable' && s.state !== 'unknown' ? parseFloat(s.state) : NaN;
    if (!isNaN(live)) out.push({ t: t1, v: live });
    if (out.length < 2) return [];
    // normalized coords for drawing + scrubbing
    let lo = Infinity, hi = -Infinity;
    out.forEach(p => { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; });
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    const padT = 26, padB = 6; // headroom keeps curves below the reading (owner-tuned)
    out.forEach(p => {
      p.x = (p.t - t0) / (t1 - t0);
      p.y = padT + (1 - (p.v - lo) / (hi - lo)) * (GRAPH_H - padT - padB);
    });
    return out;
  }

  _drawGraph(i, r, pts) {
    const els = this._rowEls[i];
    if (!els) return;
    const w = els.row.clientWidth || 500;
    els.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + GRAPH_H);
    if (!pts.length) { els.svg.innerHTML = ''; return; }
    const P = pts.map(p => [p.x * w, p.y]);
    // smooth quadratic-through-midpoints, same shape language as the native sparkline
    let d = 'M ' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
    for (let k = 1; k < P.length; k++) {
      const mx = ((P[k - 1][0] + P[k][0]) / 2).toFixed(1);
      const my = ((P[k - 1][1] + P[k][1]) / 2).toFixed(1);
      d += ' Q ' + P[k - 1][0].toFixed(1) + ' ' + P[k - 1][1].toFixed(1) + ' ' + mx + ' ' + my;
    }
    d += ' L ' + P[P.length - 1][0].toFixed(1) + ' ' + P[P.length - 1][1].toFixed(1);
    const fill = d + ' L ' + w + ' ' + GRAPH_H + ' L 0 ' + GRAPH_H + ' Z';
    const c = this._color(r);
    els.svg.innerHTML =
      '<path d="' + fill + '" fill="' + c + '" opacity="0.10"></path>' +
      '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"></path>';
  }
}

customElements.define('flat-sensor-stack-card', FlatSensorStackCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-sensor-stack-card',
  name: 'Flat Sensor Stack Card',
  description: 'Collapsible stack of compact 24h sensor graphs with hover scrubbing',
});
