/* flat-treadmill-card v2.11 - custom Lovelace card for the main dashboard.
   Slim treadmill controller for the Egofit M2 (via FTMS/HACS): live mph + status left,
   speed track (drag = native kph preview), play/stop, NOW/TODAY stats pill, daily
   distance progress bar vs input_number.treadmill_daily_mile_target, and a ~net kcal
   stat computed live from weight/hands helpers using the walking-calorie-calculator's
   ShapeSense/ACSM math at the deck's fixed 3% grade (tap the kcal cell to edit
   assumptions; tap the progress bar for the metric's history; tap the TODAY label to
   flip the bar between distance and time targets; tap the readout to edit the active
   target; the ledger site link lives in the assumptions dialog).
   Built 2026-07-09 by Claude for Ratman (design + state machine archived in the
   "NAS / Smart Home" Claude project; sibling of flat-thermostat-card).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-treadmill-card;base64,<blob>.
     There is no file on disk and no internet dependency - the code lives inside the
     URL itself, in HA's own config (.storage/lovelace_resources), and is included
     in every Home Assistant backup automatically. The ;name= parameter is only a
     human-readable label for the Resources page (RFC 2397 media-type param).
   - To READ it: copy everything after "base64," and run it through any base64
     decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS (ASCII-only in strings; entities/escapes for
     special chars), run node --check, re-encode to base64, then in
     Settings > Dashboards > Resources replace this resource's URL with
     data:text/javascript;name=flat-treadmill-card;base64,<new blob>. Hard-refresh.
     (Established workflow: Claude hands a .txt with the full data: URL; owner pastes.)
   - Used from the dashboard as:  type: custom:flat-treadmill-card
     (that single line is the whole card config - all entity ids and options have
     defaults baked in below; override via YAML keys if entities are ever renamed.)
   - COLOR SCHEME: amber (owner-chosen 2026-07-10). Back-pocket alternates, swap the
     three consts below to change: teal original ACCENT #00bcd4 / TEXT #4dd0e1 /
     ACTIVE #00838f; green ACCENT #9ccc65 / TEXT #c5e1a5 / ACTIVE #558b2f. The done
     state stays #4caf50 green in amber/teal schemes (collides in the green scheme -
     use amber #ffc107 done there instead).
   - HA-side dependencies (all labeled "Treadmill Dashboard Card" in HA): 3 daily
     utility meters + 3am reset automation, mile-target / weight input_numbers,
     hands input_select, treadmill template sensors from the FTMS integration. */

const ACCENT = '#ffc107';
const ACCENT_TEXT = '#ffd54f';
const ACTIVE_CELL = '#ffa000';
const KMH_PER_MPH = 1.609344;

// --- walking-calorie-calculator math, ported verbatim from ratman-codes.github.io ---
// ShapeSense cubic coefficients per integer grade, -5..+5. kcal/kg/hr = a*v^3+b*v^2+c*v+d (v in km/h)
const POLY = {
  '-5': [0.0251, -0.2157, 0.7888, 1.2957],
  '-4': [0.0244, -0.2079, 0.8053, 1.3281],
  '-3': [0.0237, -0.2000, 0.8217, 1.3605],
  '-2': [0.0230, -0.1922, 0.8382, 1.3929],
  '-1': [0.0222, -0.1844, 0.8546, 1.4253],
   '0': [0.0215, -0.1765, 0.8710, 1.4577],
   '1': [0.0171, -0.1062, 0.6080, 1.8600],
   '2': [0.0184, -0.1134, 0.6566, 1.9200],
   '3': [0.0196, -0.1205, 0.7053, 1.9800],
   '4': [0.0208, -0.1277, 0.7539, 2.0400],
   '5': [0.0221, -0.1349, 0.8025, 2.1000],
};
function polyRate(kph, g) { const c = POLY[String(g)]; return c[0]*kph**3 + c[1]*kph**2 + c[2]*kph + c[3]; }
function acsmRate(kph, gradePct) {
  const mpm = kph * 1000 / 60;
  return (0.1 * mpm + 1.8 * mpm * (gradePct / 100) + 3.5) * 60 * 5 / 1000;
}
function grossRate(kph, grade) {
  if (grade <= 5) {
    const lo = Math.max(-5, Math.floor(grade)), hi = Math.min(5, Math.ceil(grade));
    if (lo === hi) return polyRate(kph, lo);
    const t = (grade - lo) / (hi - lo);
    return polyRate(kph, lo) * (1 - t) + polyRate(kph, hi) * t;
  }
  if (grade >= 6) return acsmRate(kph, grade);
  const t = grade - 5;
  return polyRate(kph, 5) * (1 - t) + acsmRate(kph, 6) * t;
}
const HANDS_DISCOUNT = { 'Free swing': 0, 'Typing at desk': 0.08, 'Leaning on desk': 0.20 };
// net kcal per mile at given weight/grade/hands, 1-MET resting baseline (weight-based)
function netPerMile(lb, grade, disc, kph) {
  const kg = lb / 2.2046226;
  const netPerHr = Math.max(0, grossRate(kph, grade) * kg - kg * 1.05) * (1 - disc);
  return netPerHr / (kph / KMH_PER_MPH);
}

class FlatTreadmillCard extends HTMLElement {
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = Object.assign({
      entity: 'number.treadmill_speed',
      speed_sensor: 'sensor.treadmill_speed',
      time_sensor: 'sensor.treadmill_time_elapsed',
      distance_sensor: 'sensor.treadmill_distance_total',
      steps_sensor: 'sensor.treadmill_steps',
      start_button: 'button.treadmill_start_resume',
      stop_button: 'button.treadmill_stop',
      status_sensor: 'sensor.treadmill_status',
      daily_distance_sensor: 'sensor.living_room_treadmill_daily_distance',
      daily_time_sensor: 'sensor.living_room_treadmill_daily_time',
      target_entity: 'input_number.treadmill_daily_mile_target',
      time_target_entity: 'input_number.treadmill_daily_time_target',
      steps_per_mile: 2250,
      weight_entity: 'input_number.treadmill_weight',
      hands_entity: 'input_select.treadmill_hands',
      grade: 3,
      net_ref_speed_kph: 4.8,
      net_history_sensor: 'sensor.treadmill_daily_net_kcal',
      ledger_url: 'https://ratman-codes.github.io/walking-calorie-calculator/',
    }, config);
    this._drag = false;
    this._opt = null;
    this._optUntil = 0;
    this._scope = 'session';
    this._barMode = 'distance';
    if (!this.shadowRoot) this._createDom();
  }

  getCardSize() { return 2; }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _st(id) { return this._hass && this._hass.states[id]; }
  _num(id) {
    const s = this._st(id);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 14px 10px 14px; }
        .main { display: flex; align-items: center; padding: 4px 0 0 0; }
        .curblock { flex: 0 0 22%; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; cursor: pointer; }
        .curwrap { display: inline-block; }
        .cur { font-size: 32px; font-weight: 500; line-height: 1.05; color: var(--primary-text-color); white-space: nowrap; }
        .cur .unit { font-size: 14px; color: var(--secondary-text-color); font-weight: 400; vertical-align: top; }
        .st { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; text-align: center; }
        .bar-wrap { position: relative; flex: 1; padding: 0 10px; }
        .bar { position: relative; height: 16px; border-radius: 8px; background: rgba(70,70,70,.3); touch-action: none; cursor: pointer; }
        .fill { position: absolute; left: 0; top: 0; bottom: 0; background: ${ACCENT}; opacity: .5;
          border-radius: 8px 0 0 8px; pointer-events: none;
          transition: width .35s cubic-bezier(.4,0,.2,1), opacity .35s; }
        .cap { position: absolute; top: 0; bottom: 0; width: 16px; background: ${ACCENT};
          border-radius: 8px; pointer-events: none; transform: translateX(-50%);
          transition: left .35s cubic-bezier(.4,0,.2,1), opacity .35s; }
        .handle { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%;
          background: #fff; transform: translate(-50%,-50%); cursor: grab; z-index: 2;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .handle:active { cursor: grabbing; }
        .bar.dragging .fill, .bar.dragging .cap, .bar.dragging .handle { transition: none; }
        .btns { display: flex; gap: 6px; flex: none; padding-right: 2px; }
        .btn { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,.06);
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .btn:hover { background: rgba(255,255,255,.12); }
        .btn ha-icon { --mdc-icon-size: 17px; width: 17px; height: 17px; display: flex;
          align-items: center; justify-content: center; line-height: 0; color: var(--secondary-text-color); }
        .statswrap { display: flex; height: 42px; border-radius: 12px; background: rgba(255,255,255,.04);
          margin-top: 10px; align-items: stretch; cursor: pointer; overflow: hidden; }
        .modetag { flex: none; width: 22px; display: flex; align-items: center; justify-content: center;
          border-right: 1px solid rgba(255,255,255,.06); transition: background .15s; }
        .modetag span { font-size: 9px; color: var(--secondary-text-color); letter-spacing: 1px;
          writing-mode: vertical-rl; transform: rotate(180deg); }
        .modetag.today { background: rgba(255,193,7,.08); }
        .modetag.today span { color: ${ACCENT_TEXT}; }
        .statswrap:hover:not(:has(.cellkcal:hover)) .modetag { background: rgba(255,255,255,.08); }
        .statswrap:hover:not(:has(.cellkcal:hover)) .modetag.today { background: rgba(255,193,7,.16); }
        .stats { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0,1fr); align-items: center; }
        .stat { text-align: center; font-size: 13px; color: var(--primary-text-color); white-space: nowrap; min-width: 0; overflow: hidden; line-height: 1.2; }
        .stat .lbl { display: block; font-size: 10px; color: var(--secondary-text-color); letter-spacing: .3px; }
        .prow { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 0 2px; }
        .plabel { font-size: 10px; color: var(--secondary-text-color); letter-spacing: .4px; flex: none;
          cursor: pointer; padding: 8px 6px; margin: -8px -6px; border-radius: 6px; transition: background .15s; }
        .plabel:hover { background: rgba(255,255,255,.07); }
        .pbar { position: relative; flex: 1; height: 8px; border-radius: 4px; background: rgba(70,70,70,.35);
          overflow: hidden; cursor: pointer; transition: background .15s; }
        .pbar:hover { background: rgba(70,70,70,.55); }
        .pprev { position: absolute; left: 0; top: 0; bottom: 0; background: ${ACCENT}; opacity: .45; transition: width .35s cubic-bezier(.4,0,.2,1); }
        .psess { position: absolute; top: 0; bottom: 0; background: ${ACCENT}; transition: left .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1); }
        .pbar.done .pprev { background: #4caf50; opacity: 1; }
        .pbar.done .psess { background: #4caf50; }
        .ptext { font-size: 12px; color: var(--primary-text-color); flex: none; white-space: nowrap;
          cursor: pointer; padding: 6px 8px; margin: -6px -8px; border-radius: 6px; transition: background .15s; }
        .ptext:hover { background: rgba(255,255,255,.06); }
        .ptext .dim { color: var(--secondary-text-color); }
        .btn.active { background: ${ACTIVE_CELL}; }
        .btn.active ha-icon { color: #fff; }
        .btn.lit ha-icon { color: ${ACCENT_TEXT}; }
        .btn.dim ha-icon { color: rgba(255,255,255,.25); }
        .cellkcal { cursor: pointer; border-radius: 8px; transition: background .15s; align-self: stretch;
          display: flex; flex-direction: column; justify-content: center; }
        .cellkcal:hover { background: rgba(255,255,255,.07); }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: none;
          align-items: center; justify-content: center; z-index: 9999; }
        .overlay.open { display: flex; }
        .dlg { background: #1c1c1c; border: 1px solid rgba(255,255,255,.1); border-radius: 14px;
          padding: 18px; width: 300px; max-width: calc(100vw - 40px); box-shadow: 0 8px 32px rgba(0,0,0,.5); }
        .dhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;
          font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
        .dclose { width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,.06);
          display: flex; align-items: center; justify-content: center; color: var(--secondary-text-color);
          cursor: pointer; font-size: 13px; }
        .dlbl { font-size: 10px; color: var(--secondary-text-color); letter-spacing: .4px; margin: 12px 0 5px 0; }
        .dlbl .note { color: #666; letter-spacing: 0; }
        .wrow { display: flex; align-items: center; gap: 8px; }
        .wbtn { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,.06);
          display: flex; align-items: center; justify-content: center; color: var(--primary-text-color);
          font-size: 16px; cursor: pointer; user-select: none; }
        .wbtn:hover { background: rgba(255,255,255,.12); }
        .wval { flex: 1; text-align: center; font-size: 18px; color: var(--primary-text-color); }
        .wval small { font-size: 12px; color: var(--secondary-text-color); }
        .hset { display: flex; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.04); }
        .hset div { flex: 1; padding: 7px 0; text-align: center; font-size: 11px;
          color: var(--secondary-text-color); cursor: pointer; }
        .hset div.sel { background: ${ACTIVE_CELL}; color: #fff; }
        .gsel { width: 100%; padding: 7px 10px; border-radius: 8px; background: rgba(255,255,255,.06);
          color: var(--primary-text-color); font-size: 12px; border: none; outline: none; }
        .gsel option { background: #1c1c1c; }
        .dout { border-radius: 10px; background: rgba(255,193,7,.07); border: 1px solid rgba(255,193,7,.15);
          padding: 10px 12px; margin-top: 12px; }
        .drow { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .dout .big { font-size: 16px; color: ${ACCENT_TEXT}; font-weight: 600; white-space: nowrap; }
        .dout .big small { font-size: 11px; font-weight: 400; }
        .dout .sub { font-size: 10px; color: var(--secondary-text-color); margin-top: 2px; }
        .dlink { font-size: 11px; color: ${ACCENT_TEXT}; margin-top: 10px; cursor: pointer; text-align: center; }
        .dlink:hover { text-decoration: underline; }
        .dbtns { display: flex; gap: 8px; margin-top: 14px; }
        .dbtn { flex: 1; padding: 9px 0; text-align: center; border-radius: 9px; font-size: 12px; cursor: pointer; }
        .dbtn.cancel { background: rgba(255,255,255,.06); color: var(--secondary-text-color); }
        .dbtn.save { background: ${ACTIVE_CELL}; color: #fff; }
        .unavailable { opacity: .4; pointer-events: none; }
      </style>
      <ha-card>
        <div class="main" id="main">
          <div class="curblock" id="curblock">
            <div class="curwrap">
              <div class="cur"><span id="curval">--</span><span class="unit" id="unit"> mph</span></div>
              <div class="st" id="state"></div>
            </div>
          </div>
          <div class="bar-wrap">
            <div class="bar" id="bar">
              <div class="fill" id="fill"></div>
              <div class="cap" id="cap"></div>
              <div class="handle" id="handle"></div>
            </div>
          </div>
          <div class="btns">
            <div class="btn" id="bstart"><ha-icon icon="mdi:play"></ha-icon></div>
            <div class="btn" id="bstop"><ha-icon icon="mdi:stop"></ha-icon></div>
          </div>
        </div>
        <div class="statswrap" id="statswrap">
          <div class="modetag" id="modetag"><span id="modetxt">NOW</span></div>
          <div class="stats">
            <div class="stat"><span id="vtime">--</span><span class="lbl">time</span></div>
            <div class="stat"><span id="vdist">--</span><span class="lbl">miles</span></div>
            <div class="stat"><span id="vsteps">--</span><span class="lbl">steps</span></div>
            <div class="stat cellkcal" id="cellkcal"><span id="vkcal">--</span><span class="lbl">net kcal</span></div>
          </div>
        </div>
        <div class="prow">
          <div class="plabel" id="plabel">TODAY</div>
          <div class="pbar" id="pbar"><div class="pprev" id="pprev"></div><div class="psess" id="psess"></div></div>
          <div class="ptext" id="ptext"><span id="pval">--</span><span class="dim" id="ptarget"></span></div>
        </div>
      </ha-card>
      <div class="overlay" id="overlay">
        <div class="dlg">
          <div class="dhead"><span>Net calorie assumptions</span><span class="dclose" id="dclose">&#10005;</span></div>
          <div class="dlbl">YOUR BODY WEIGHT</div>
          <div class="wrow">
            <div class="wbtn" id="dwminus">&minus;</div>
            <div class="wval"><span id="dwval">--</span> <small>lb</small></div>
            <div class="wbtn" id="dwplus">+</div>
          </div>
          <div class="dlbl">HANDS</div>
          <div class="hset" id="dhands">
            <div data-h="Free swing">Free swing</div>
            <div data-h="Typing at desk">Typing</div>
            <div data-h="Leaning on desk">Leaning</div>
          </div>
          <div class="dlbl">GRADE <span class="note">(deck is fixed 3% &mdash; preview only)</span></div>
          <select class="gsel" id="dgrade"></select>
          <div class="dout">
            <div class="drow">
              <div class="big"><span id="drate">--</span> <small>net / mi</small></div>
              <div class="big"><span id="dday2">--</span> <small>net / day</small></div>
            </div>
            <div class="sub" id="dday"></div>
          </div>
          <div class="dlink" id="dlink">Open full calculator &#8599;</div>
          <div class="dbtns">
            <div class="dbtn cancel" id="dcancel">Cancel</div>
            <div class="dbtn save" id="dsave">Save</div>
          </div>
        </div>
      </div>
    `;
    this._el = {};
    ['main','curblock','curval','unit','state','bar','fill','cap','handle','bstart','bstop','vtime','vdist','vsteps','vkcal','statswrap','modetag','modetxt','pbar','pprev','psess','pval','ptarget','ptext','plabel','cellkcal','overlay','dclose','dwminus','dwplus','dwval','dhands','dgrade','drate','dday','dday2','dcancel','dsave','dlink']
      .forEach(id => this._el[id] = root.getElementById(id));
    this._bindDrag();
    this._el.bstart.addEventListener('click', () => this._press(this._config.start_button));
    this._el.bstop.addEventListener('click', () => this._press(this._config.stop_button));
    this._el.statswrap.addEventListener('click', () => {
      this._scope = this._scope === 'session' ? 'today' : 'session';
      this._render();
    });
    this._el.ptext.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._barMode === 'time' ? this._config.time_target_entity : this._config.target_entity },
        bubbles: true, composed: true,
      }));
    });
    this._el.cellkcal.addEventListener('click', (e) => { e.stopPropagation(); this._openDialog(); });
    this._el.dclose.addEventListener('click', () => this._closeDialog());
    this._el.dcancel.addEventListener('click', () => this._closeDialog());
    this._el.overlay.addEventListener('click', (e) => { if (e.target === this._el.overlay) this._closeDialog(); });
    this._el.dwminus.addEventListener('click', () => this._dlgAdjWeight(-1));
    this._el.dwplus.addEventListener('click', () => this._dlgAdjWeight(1));
    this._el.dhands.querySelectorAll('div').forEach(d =>
      d.addEventListener('click', () => { if (this._dlgState) { this._dlgState.hands = d.dataset.h; this._renderDialog(); } }));
    for (let g = -5; g <= 15; g++) {
      const o = document.createElement('option');
      o.value = String(g);
      o.textContent = (g > 0 ? '+' : '') + g + '%' + (g === 0 ? ' (flat)' : (g === 3 ? ' (deck)' : ''));
      this._el.dgrade.appendChild(o);
    }
    this._el.dgrade.addEventListener('change', () => {
      if (this._dlgState) { this._dlgState.grade = parseFloat(this._el.dgrade.value); this._renderDialog(); }
    });
    this._el.dsave.addEventListener('click', () => this._saveDialog());
    this._el.dlink.addEventListener('click', () => {
      if (this._config.ledger_url) window.open(this._config.ledger_url, '_blank', 'noopener');
    });
    this._el.pbar.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._barMode === 'time' ? this._config.daily_time_sensor : this._config.net_history_sensor },
        bubbles: true, composed: true,
      }));
    });
    this._el.plabel.addEventListener('click', () => {
      this._barMode = this._barMode === 'distance' ? 'time' : 'distance';
      this._render();
    });
    this._el.curblock.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._config.speed_sensor }, bubbles: true, composed: true,
      }));
    });
  }

  /* ---------- helpers ---------- */
  _attrs() { const s = this._st(this._config.entity); return s ? s.attributes : {}; }
  _min() { return this._attrs().min != null ? this._attrs().min : 1.0; }
  _max() { return this._attrs().max != null ? this._attrs().max : 5.0; }
  _step() { return this._attrs().step || 0.1; }
  _pct(v) { return (v - this._min()) / (this._max() - this._min()) * 100; }

  _target() {
    if (this._drag || Date.now() < this._optUntil) {
      if (this._opt != null) return this._opt;
    }
    return this._num(this._config.entity);
  }

  /* ---------- rendering ---------- */
  _render() {
    if (!this._hass || !this._el) return;
    const el = this._el;
    // availability keys off the STATUS sensor (the card's source of truth), NOT the
    // speed number: after an integration reload, number.treadmill_speed sits at
    // 'unknown' until the deck reports a target speed, and must not ghost a live card.
    const stAvail = this._st(this._config.status_sensor);
    const unavailable = !stAvail || stAvail.state === 'unavailable' || stAvail.state === 'unknown';
    el.main.classList.toggle('unavailable', unavailable);
    el.bstart.classList.toggle('unavailable', unavailable);
    el.bstop.classList.toggle('unavailable', unavailable);

    const statusRaw = (this._st(this._config.status_sensor) || {}).state || '';
    const walking = statusRaw === 'manual_mode';
    const starting = statusRaw === 'pre_workout';
    const active = walking || starting;
    const STATUS_TEXT = { idle: 'Idle', pre_workout: 'Starting', manual_mode: 'Walking', post_workout: 'Stopping', paused: 'Paused' };
    const statusText = STATUS_TEXT[statusRaw] ||
      (statusRaw ? statusRaw.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '--');

    const speed = this._num(this._config.speed_sensor);
    if (this._drag && this._opt != null) {
      el.curval.textContent = this._opt.toFixed(1);
      el.unit.textContent = ' kph';
    } else {
      el.unit.textContent = ' mph';
      if (unavailable) {
        el.curval.textContent = '--';
      } else if (walking) {
        el.curval.textContent = speed != null ? speed.toFixed(1) : '--';
      } else {
        el.curval.textContent = '0.0';
      }
    }
    el.state.textContent = unavailable ? 'Unavailable' : statusText;
    el.state.style.color = active ? ACCENT_TEXT : '';
    el.state.style.paddingRight = el.unit.offsetWidth + 'px';

    const t = this._target();
    if (t != null) {
      const p = this._pct(Math.min(this._max(), Math.max(this._min(), t)));
      el.fill.style.width = p + '%';
      el.cap.style.left = p + '%';
      el.handle.style.left = p + '%';
      el.fill.style.opacity = active ? '.5' : '.35';
      el.cap.style.opacity = active ? '1' : '.85';
      el.fill.style.display = 'block'; el.cap.style.display = 'block'; el.handle.style.display = 'block';
    } else {
      el.fill.style.display = 'none'; el.cap.style.display = 'none'; el.handle.style.display = 'none';
    }

    el.bstart.classList.toggle('active', active);
    el.bstart.classList.toggle('lit', !active && !unavailable);
    el.bstop.classList.toggle('dim', !active && statusRaw !== 'post_workout');

    const today = this._scope === 'today';
    el.modetag.classList.toggle('today', today);
    el.modetxt.textContent = today ? 'TODAY' : 'NOW';
    const dailyFt = this._num(this._config.daily_distance_sensor);
    const dailyMi = dailyFt != null ? dailyFt / 5280 : null;
    if (today) {
      el.vtime.textContent = this._fmtTime(this._num(this._config.daily_time_sensor));
      el.vdist.textContent = dailyMi != null ? dailyMi.toFixed(2) : '--';
      el.vsteps.textContent = dailyMi != null ? Math.round(dailyMi * this._config.steps_per_mile).toLocaleString() : '--';
      const netC = this._netConstant();
      el.vkcal.textContent = (netC != null && dailyMi != null) ? '\u2248' + Math.round(dailyMi * netC) : '--';
    } else {
      el.vtime.textContent = this._fmtTime(this._num(this._config.time_sensor));
      const ft = this._num(this._config.distance_sensor);
      el.vdist.textContent = ft != null ? (ft / 5280).toFixed(2) : '--';
      const steps = this._num(this._config.steps_sensor);
      el.vsteps.textContent = steps != null ? Math.round(steps).toLocaleString() : '--';
      const netC = this._netConstant();
      const ftk = this._num(this._config.distance_sensor);
      el.vkcal.textContent = (netC != null && ftk != null) ? '\u2248' + Math.round((ftk / 5280) * netC) : '--';
    }

    let dVal, sessVal, target, valTxt, tgtTxt;
    if (this._barMode === 'time') {
      dVal = this._num(this._config.daily_time_sensor);
      sessVal = this._num(this._config.time_sensor) || 0;
      const tH = this._num(this._config.time_target_entity);
      target = (tH != null && tH > 0) ? tH * 3600 : null;
      valTxt = dVal != null ? this._fmtHM(dVal) : '--';
      tgtTxt = target != null ? ' / ' + this._fmtHM(target) : '';
    } else {
      dVal = dailyMi;
      const sessFt = this._num(this._config.distance_sensor);
      sessVal = sessFt != null ? sessFt / 5280 : 0;
      target = this._num(this._config.target_entity);
      if (target != null && target <= 0) target = null;
      valTxt = dVal != null ? dVal.toFixed(1) : '--';
      tgtTxt = target != null ? ' / ' + target.toFixed(1) + ' mi' : '';
    }
    if (target != null && dVal == null) {
      // daily meter unavailable/unknown: show target context but never a false zero
      el.pbar.classList.remove('done');
      el.pprev.style.width = '0%'; el.psess.style.width = '0%';
      el.pval.textContent = '--'; el.ptarget.textContent = tgtTxt;
    } else if (target != null) {
      const done = dVal >= target;
      const prev = Math.max(0, dVal - sessVal);
      const fPrev = Math.min(1, prev / target);
      const fAll = Math.min(1, dVal / target);
      el.pbar.classList.toggle('done', done);
      if (done) {
        el.pprev.style.width = '100%';
        el.psess.style.left = '0%';
        el.psess.style.width = '0%';
      } else {
        el.pprev.style.width = (fPrev * 100) + '%';
        el.psess.style.left = (fPrev * 100) + '%';
        el.psess.style.width = ((fAll - fPrev) * 100) + '%';
      }
      el.pval.textContent = valTxt;
      el.ptarget.textContent = tgtTxt;
    } else {
      el.pbar.classList.remove('done');
      el.pprev.style.width = '0%'; el.psess.style.width = '0%';
      el.pval.textContent = valTxt; el.ptarget.textContent = '';
    }
  }

  _fmtHM(sec) {
    const m = Math.floor(sec / 60);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  /* ---------- net-calorie assumptions dialog ---------- */
  _netConstant() {
    const lb = this._num(this._config.weight_entity);
    if (lb == null) return null;
    const hs = this._st(this._config.hands_entity);
    const disc = hs && HANDS_DISCOUNT[hs.state] != null ? HANDS_DISCOUNT[hs.state] : 0.08;
    return netPerMile(lb, this._config.grade, disc, this._config.net_ref_speed_kph);
  }

  _dlgAdjWeight(d) {
    if (!this._dlgState) return;
    this._dlgState.w = Math.min(300, Math.max(80, this._dlgState.w + d));
    this._renderDialog();
  }

  _openDialog() {
    const w = this._num(this._config.weight_entity);
    const hs = this._st(this._config.hands_entity);
    this._dlgState = {
      w: w != null ? Math.round(w) : 150,
      hands: hs && HANDS_DISCOUNT[hs.state] != null ? hs.state : 'Typing at desk',
      grade: this._config.grade,
    };
    this._el.dgrade.value = String(this._dlgState.grade);
    this._el.overlay.classList.add('open');
    this._renderDialog();
  }

  _closeDialog() {
    this._el.overlay.classList.remove('open');
    this._dlgState = null;
  }

  _renderDialog() {
    const s = this._dlgState;
    if (!s) return;
    const el = this._el;
    el.dwval.textContent = s.w;
    el.dhands.querySelectorAll('div').forEach(d => d.classList.toggle('sel', d.dataset.h === s.hands));
    const c = netPerMile(s.w, s.grade, HANDS_DISCOUNT[s.hands] || 0, this._config.net_ref_speed_kph);
    el.drate.textContent = '\u2248 ' + Math.round(c);
    const t = this._num(this._config.target_entity);
    el.dday2.textContent = (t != null && t > 0) ? '\u2248 ' + Math.round(c * t) : '--';
    el.dday.textContent = (t != null && t > 0) ? 'at your ' + t.toFixed(1) + ' mi target' : '';
  }

  _saveDialog() {
    if (!this._hass || !this._dlgState) return;
    this._hass.callService('input_number', 'set_value',
      { entity_id: this._config.weight_entity, value: this._dlgState.w });
    this._hass.callService('input_select', 'select_option',
      { entity_id: this._config.hands_entity, option: this._dlgState.hands });
    this._closeDialog();
  }

  _fmtTime(sec) {
    if (sec == null) return '--';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  /* ---------- interactions ---------- */
  _press(id) {
    if (!this._hass) return;
    this._hass.callService('button', 'press', { entity_id: id });
  }

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
      if (!this._st(this._config.entity)) return;
      this._drag = true;
      this._opt = this._valFromX(e.clientX);
      el.bar.setPointerCapture && el.bar.setPointerCapture(e.pointerId);
      e.preventDefault();
      this._render();
    };
    const move = (e) => {
      if (!this._drag) return;
      el.bar.classList.add('dragging');
      this._opt = this._valFromX(e.clientX);
      this._render();
    };
    const up = () => {
      if (!this._drag) return;
      this._drag = false;
      el.bar.classList.remove('dragging');
      this._commit();
    };
    el.bar.addEventListener('pointerdown', down);
    el.handle.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _commit() {
    if (!this._hass || this._opt == null) return;
    this._optUntil = Date.now() + 8000;
    this._hass.callService('number', 'set_value', {
      entity_id: this._config.entity,
      value: Math.round(this._opt * 10) / 10,
    });
  }
}

customElements.define('flat-treadmill-card', FlatTreadmillCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-treadmill-card',
  name: 'Flat Treadmill Card',
  description: 'Slim flat treadmill card with speed track, start/stop, and session stats',
});
