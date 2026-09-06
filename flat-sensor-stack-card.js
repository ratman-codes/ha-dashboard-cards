/* flat-sensor-stack-card v1.4 - custom Lovelace card for the main dashboard.
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
     for special chars), run node --check, re-encode to base64, then replace the
     resource URL via the Card Manager card's row Update (or Settings > Dashboards
     > Resources) with
     data:text/javascript;name=flat-sensor-stack-card;base64,<new blob>. Hard-refresh.
   - Used from the dashboard as:  type: custom:flat-sensor-stack-card
     (that single line is the whole card config - the desk sensor entity ids,
     names, colors and thresholds are defaults baked in below; override with:
     hours: 24, rows: [{entity, name, color, decimals, thresholds: [{value,color},...]}]
     - row 0 is the always-visible title row. hours is coerced to a positive
     integer (quoted / fractional values accepted); the default row labels say
     "<hours>h".)
   - History arrives over the websocket (history/history_during_period,
     hourly-averaged buckets like the native sensor card's detail:1), refreshed
     every 5 minutes; the last point is pinned to the live state.
   - v1.1: matched to measured native sensor-card values - reading weight 400,
     uom 16px, line stroke 2, fill opacity .10, graph top headroom so curves
     stay below the reading.
   - v1.2: more top headroom (26px); hover readout changed from swapping the
     reading to a floating value+time pill above the scrub dot (owner choice).
   - v1.3 (2026-09-06 audit): the line colour (thresholds) and the curve's
     live-pinned end point now follow every state change instead of waiting for
     the 5-minute history refresh; an unavailable/unknown threshold row paints
     neutral grey, never the lowest threshold colour; the scrub dot sits ON the
     smoothed curve (the midpoint-quadratic path passes |d2|/8 inside each data
     point - the dot used to float above sharp peaks); hours coerced (a quoted
     "12" used to collapse history to two points, 12.5 threw every refresh);
     rows given as a bare string falls back to the defaults; a second setConfig
     (card editor) re-renders, refetches and collapses the stack; the refresh
     timer only starts while connected; a slow history response can no longer
     overwrite a newer one; dead row-0 press guard removed.
   - v1.4 (2026-09-06): threshold rows colour the line BY HEIGHT - a vertical
     SVG gradient with hard stops at each threshold's y position, so the curve
     is green where the value was green and red where it was red, instead of
     the whole 24h line wearing the colour of the current reading. Rows without
     thresholds are unchanged. An unavailable row keeps its history colours and
     relies on the 40% dim (the v1.3 neutral-grey line only applied to the
     current-value scheme). */

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
    config = config || {};
    let hours = parseInt(config.hours, 10);
    if (!(hours > 0)) hours = 24;
    this._config = Object.assign({}, config, { hours });
    const custom = Array.isArray(config.rows) && config.rows.length;
    this._rows = (custom ? config.rows : DEF_ROWS)
      .map(r => Object.assign({}, r, custom ? {} : { name: r.name.replace('24h', hours + 'h') }));
    this._open = false;
    this._hist = {};        // entity -> [{t, v, x, y, cx, cy}] (drawable)
    this._raw = {};         // entity -> {pts, t0, t1} (hourly buckets before the live pin)
    if (!this.shadowRoot) this._createDom();
    else this._buildRows();
    this._el.kids.style.maxHeight = '0px';
    if (this._hass) { this._renderStates(); this._fetchHistory(); }
  }

  getCardSize() { return 2; }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (this.isConnected && !this._fetchTimer) {
      this._fetchHistory();
      this._fetchTimer = setInterval(() => this._fetchHistory(), REFRESH_MS);
    }
    this._renderStates();
    // A changed row re-pins its live end point and re-evaluates its colour now,
    // instead of waiting for the next 5-minute history refresh.
    if (prev && this._rowEls) {
      this._rows.forEach((r, i) => {
        const raw = this._raw[r.entity];
        if (!raw || prev.states[r.entity] === hass.states[r.entity]) return;
        this._hist[r.entity] = this._finish(raw, r);
        this._drawGraph(i, r, this._hist[r.entity]);
      });
    }
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
      el.addEventListener('pointerdown', () => el.classList.add('pressed'));
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
      const dotY = ROW_H - GRAPH_H + p.cy;
      const px = p.cx * rect.width;
      els.tip.style.left = Math.max(60, Math.min(rect.width - 60, px)) + 'px';
      els.tip.style.top = Math.max(6, dotY - 32) + 'px';
      els.tip.style.visibility = 'visible';
      els.dot.style.left = (p.cx * 100) + '%';
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
    // rows without thresholds; threshold rows paint via _gradient()
    return r.color || '#ff9800';
  }

  /* ---------- history ---------- */
  async _fetchHistory() {
    if (!this._hass) return;
    const seq = this._seq = (this._seq || 0) + 1;
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
    if (!result || seq !== this._seq) return;  // a newer fetch already landed
    this._rows.forEach((r, i) => {
      const items = result[r.entity] || [];
      const raw = { pts: this._bucket(items, start.getTime(), hours), t0: start.getTime(), t1: end.getTime() };
      this._raw[r.entity] = raw;
      const pts = this._finish(raw, r);
      this._hist[r.entity] = pts;
      this._drawGraph(i, r, pts);
    });
  }

  _bucket(items, t0, hours) {
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
    return out;
  }

  _finish(raw, r) {
    // pin last point to the live state so the curve ends "now"
    const out = raw.pts.map(p => ({ t: p.t, v: p.v }));
    const t0 = raw.t0, t1 = raw.t1;
    const s = this._hass && this._hass.states[r.entity];
    const live = s && s.state !== 'unavailable' && s.state !== 'unknown' ? parseFloat(s.state) : NaN;
    if (!isNaN(live)) out.push({ t: t1, v: live });
    if (out.length < 2) return [];
    // normalized coords for drawing + scrubbing
    let lo = Infinity, hi = -Infinity;
    out.forEach(p => { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; });
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    const padT = 26, padB = 6; // headroom keeps curves below the reading (owner-tuned)
    const yOf = (v) => padT + (1 - (v - lo) / (hi - lo)) * (GRAPH_H - padT - padB);
    out.forEach(p => {
      p.x = (p.t - t0) / (t1 - t0);
      p.y = yOf(p.v);
    });
    out.yOf = yOf;  // value -> graph y, reused for the threshold gradient
    out.vOf = (y) => lo + (1 - (y - padT) / (GRAPH_H - padT - padB)) * (hi - lo);
    // where the drawn (midpoint-quadratic) curve actually passes for each point:
    // interior points sit at (P[k-1] + 6 P[k] + P[k+1]) / 8, ends are exact
    const n = out.length;
    out.forEach((p, k) => {
      if (k === 0 || k === n - 1) { p.cx = p.x; p.cy = p.y; return; }
      p.cx = (out[k - 1].x + 6 * p.x + out[k + 1].x) / 8;
      p.cy = (out[k - 1].y + 6 * p.y + out[k + 1].y) / 8;
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
    const grad = this._gradient(r, pts, 'ssg' + i);
    const c = grad ? 'url(#ssg' + i + ')' : this._color(r);
    els.svg.innerHTML = (grad || '') +
      '<path d="' + fill + '" fill="' + c + '" opacity="0.10"></path>' +
      '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"></path>';
  }

  // Threshold rows: paint by height. A vertical gradient in graph coordinates
  // with a hard stop at each threshold's y, so every part of the curve shows
  // the colour of its own value (the reading's colour is the row's number).
  _gradient(r, pts, id) {
    if (!(r.thresholds && r.thresholds.length) || !pts.yOf) return null;
    const th = r.thresholds.slice().sort((a, b) => a.value - b.value);
    const colorAt = (v) => { let c = th[0].color; for (const t of th) { if (v >= t.value) c = t.color; } return c; };
    const stops = [[0, colorAt(pts.vOf(0))]];         // colour at the graph's top edge
    for (let k = th.length - 1; k >= 0; k--) {
      const o = pts.yOf(th[k].value) / GRAPH_H;
      if (!(o > 0 && o < 1)) continue;             // threshold outside the drawn range
      const below = k > 0 ? th[k - 1].color : th[0].color;
      stops.push([o, th[k].color], [o, below]);
    }
    stops.push([1, colorAt(pts.vOf(GRAPH_H))]);      // colour at the bottom edge
    return '<defs><linearGradient id="' + id + '" gradientUnits="userSpaceOnUse"' +
      ' x1="0" y1="0" x2="0" y2="' + GRAPH_H + '">' +
      stops.map(s => '<stop offset="' + (s[0] * 100).toFixed(2) + '%" stop-color="' + s[1] + '"></stop>').join('') +
      '</linearGradient></defs>';
  }
}

customElements.define('flat-sensor-stack-card', FlatSensorStackCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-sensor-stack-card',
  name: 'Flat Sensor Stack Card',
  description: 'Collapsible stack of compact 24h sensor graphs with hover scrubbing',
});
