/* flat-cat-card v1.2
 * ------------------------------------------------------------------
 * One consolidated card for the household cats (PetKit litter box +
 * two Yumshare feeders + per-cat stats). Card #6 in the flat-card
 * family. Replaces five separate cards on the main dashboard.
 *
 * WHAT IT DOES
 *  - Headerless. Tap anywhere on the card body to expand/collapse
 *    (chevron on the right edge rotates). Collapsed = cat rows +
 *    camera strip. Expanded adds litter section + feeder rows.
 *  - Cat rows: avatar (photo from entity_picture when available),
 *    weight, last litter visit. Long-press -> more-info.
 *  - Litter: level bar (green / amber <30% / red on problem), stats,
 *    Clean button (scoop), More panel (Level / Pause / Start
 *    maintenance). Maintenance mode = amber panel with Dump litter
 *    (hold 2s) / Level / Done; auto-detected if started from the
 *    PetKit app; "parking..." until the box confirms.
 *  - Feeders: visits + dispensed/planned grams + bowl status, portion
 *    chips + Feed (writes the manual_feed text entity). Optional
 *    "Both feeders" row feeds both at once. 5s Undo window after any
 *    feed fires cancel_manual_feed (works while the drop is pending).
 *  - Camera strip (always visible): last-eat-event snapshot per
 *    feeder with timestamp; tap -> live stream more-info.
 *    camera_mode: live embeds live streams instead (experimental).
 *  - Alert strip (top, both states): litter low, bin full, hopper
 *    empty, device offline, frequent-litter-use health flag,
 *    maintenance-active reminder. Occupied dot pulses while a cat is
 *    in the box.
 *
 * HOW THIS IS HOSTED
 *  This source is base64-encoded into a data: URL module resource in
 *  the dashboard resource registry (Settings > Dashboards > Resources),
 *  labeled with ;name=flat-cat-card. Decode the base64 to read/edit.
 *  To update: edit source -> node --check -> re-encode -> replace the
 *  resource URL via the Card Manager card's guarded update flow (or
 *  Settings paste) -> hard-refresh the browser. Stored in
 *  .storage/lovelace_resources, included in HA backups.
 *  Authoritative archive: project doc claude/flat-cat-card.js.
 *
 * CARD YAML (example - placeholder names; real values live in the
 * dashboard YAML inside HA)
 *   type: custom:flat-cat-card
 *   cats:
 *     - name: Cat1
 *       weight: number.cat1_weight
 *       last_use: sensor.cat1_last_use_date
 *       color: "#ffb74d"
 *     - name: Cat2
 *       weight: number.cat2_weight
 *       last_use: sensor.cat2_last_use_date
 *       color: "#ce93d8"
 *   litter_prefix: my_litter_box        # entity id prefix from the PetKit integration
 *   feeders:                            # list order = row and camera display order
 *     - label: Feeder 01
 *       owner: Cat1
 *       prefix: my_feeder_01
 *     - label: Feeder 02
 *       owner: Cat2
 *       prefix: my_feeder_02
 *   portions: [5, 10, 20]
 *   default_portion: 10
 *   feed_both: true          # optional, default true; false removes the Both row
 *   camera_mode: snapshot    # snapshot (default) | live (experimental)
 *   camera_image: eat        # eat (default) | visit | feed - which event
 *                            # snapshot the tiles show; also settable
 *                            # per-feeder on a feeder entry. Labels follow:
 *                            # eat="last eat", visit="last seen", feed="last feed"
 *   avatars: auto            # auto (photo if available) | initials
 *
 * v1.1: header example genericized to placeholder names (no functional
 * change from v1.0).
 * v1.2: camera_image option (eat | visit | feed) selects which event
 * snapshot the camera tiles display, globally or per feeder.
 * ------------------------------------------------------------------
 */
(() => {
  'use strict';

  const AMBER = '#ffc107';
  const AMBER_TXT = '#ffd54f';
  const GREEN = '#9ccc65';
  const RED = '#f44336';
  const HOLD_MS = 2000;
  const LONGPRESS_MS = 550;
  const UNDO_MS = 5000;
  const OPT_MS = 8000;
  const MAINT_PENDING_TIMEOUT_MS = 90000;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  class FlatCatCard extends HTMLElement {

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._built = false;
      this._expanded = false;
      this._moreOpen = false;
      this._maintPending = 0;      // timestamp when Start pressed, 0 = none
      this._exitPending = 0;       // timestamp when Done pressed
      this._sel = {};              // portion selection per feeder index / 'both'
      this._undo = null;           // {until, ids, grams, key}
      this._undoTimer = null;
      this._optCleanUntil = 0;
      this._holdTimer = null;
      this._holdFired = false;
      this._lpTimer = null;
      this._lpFired = false;
    }

    /* ---------------- config ---------------- */

    setConfig(config) {
      if (!config.cats || !Array.isArray(config.cats) || !config.cats.length) {
        throw new Error('flat-cat-card: "cats" list is required');
      }
      if (!config.litter_prefix) {
        throw new Error('flat-cat-card: "litter_prefix" is required');
      }
      if (!config.feeders || !Array.isArray(config.feeders) || !config.feeders.length) {
        throw new Error('flat-cat-card: "feeders" list is required');
      }
      this._cfg = config;
      const lp = config.litter_prefix;
      this._lit = {
        level: 'sensor.' + lp + '_litter_level',
        weight: 'sensor.' + lp + '_litter_weight',
        state: 'sensor.' + lp + '_state',
        lastBy: 'sensor.' + lp + '_last_used_by',
        timesUsed: 'sensor.' + lp + '_times_used',
        devStatus: 'sensor.' + lp + '_device_status',
        sandLack: 'binary_sensor.' + lp + '_sand_lack',
        binFull: 'binary_sensor.' + lp + '_wastebin_filled',
        occupied: 'binary_sensor.' + lp + '_toilet_occupied',
        frequent: 'binary_sensor.' + lp + '_frequent_use_detection',
        scoop: 'button.' + lp + '_scoop',
        level_btn: 'button.' + lp + '_level_litter',
        dump: 'button.' + lp + '_dump_litter',
        maintStart: 'button.' + lp + '_maintenance_start',
        maintExit: 'button.' + lp + '_maintenance_exit',
        pause: 'button.' + lp + '_action_pause',
        cont: 'button.' + lp + '_action_continue'
      };
      const CAM_IMAGES = {
        eat: ['last_eat_event', 'last eat'],
        visit: ['last_visit_event', 'last seen'],
        feed: ['last_feed_event', 'last feed']
      };
      this._fdrs = config.feeders.map((f) => {
        const p = f.prefix;
        const cam = CAM_IMAGES[f.camera_image || config.camera_image] || CAM_IMAGES.eat;
        return {
          label: f.label || p,
          owner: f.owner || '',
          camWord: cam[1],
          feed: 'text.' + p + '_manual_feed',
          cancel: 'button.' + p + '_cancel_manual_feed',
          eaten: 'sensor.' + p + '_times_eaten',
          dispensed: 'sensor.' + p + '_total_dispensed',
          planned: 'sensor.' + p + '_total_planned',
          bowl: 'sensor.' + p + '_food_bowl_fill',
          devStatus: 'sensor.' + p + '_device_status',
          hopper: 'binary_sensor.' + p + '_food_level',
          image: 'image.' + p + '_' + cam[0],
          camera: 'camera.' + p
        };
      });
      this._portions = (config.portions && config.portions.length)
        ? config.portions.slice(0, 4) : [5, 10, 20];
      const def = config.default_portion != null
        ? config.default_portion
        : this._portions[Math.min(1, this._portions.length - 1)];
      this._fdrs.forEach((f, i) => {
        if (this._sel[i] == null) this._sel[i] = def;
      });
      if (this._sel.both == null) this._sel.both = def;
      this._feedBoth = config.feed_both !== false && this._fdrs.length > 1;
      this._camLive = config.camera_mode === 'live';
      this._built = false;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) this._build();
      this._update();
    }

    getCardSize() { return this._expanded ? 9 : 4; }

    static getStubConfig() {
      return { cats: [], litter_prefix: '', feeders: [] };
    }

    /* ---------------- helpers ---------------- */

    _st(id) { return (this._hass && this._hass.states[id]) || null; }

    _sv(id) {
      const s = this._st(id);
      if (!s) return null;
      const v = s.state;
      if (v === 'unavailable' || v === 'unknown') return null;
      return v;
    }

    _num(id) {
      const v = this._sv(id);
      if (v == null) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }

    _isOn(id) { return this._sv(id) === 'on'; }

    _offline(devStatusId) {
      const s = this._st(devStatusId);
      if (!s) return false;
      const v = s.state.toLowerCase();
      return v === 'unavailable' || v === 'offline';
    }

    _fmtWhen(str) {
      if (!str) return '--';
      const d = new Date(String(str).replace(' ', 'T'));
      if (isNaN(d.getTime())) return '--';
      const now = new Date();
      let h = d.getHours();
      const ap = h >= 12 ? 'p' : 'a';
      h = h % 12; if (h === 0) h = 12;
      const t = h + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
      if (d.toDateString() === now.toDateString()) return t;
      const y = new Date(now); y.setDate(now.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return 'yest ' + t;
      return MONTHS[d.getMonth()] + ' ' + d.getDate();
    }

    _moreInfo(entityId) {
      if (!entityId) return;
      const ev = new CustomEvent('hass-more-info', {
        bubbles: true, composed: true, detail: { entityId }
      });
      this.dispatchEvent(ev);
    }

    _press(entityId) {
      this._hass.callService('button', 'press', { entity_id: entityId });
    }

    _maintActive() {
      const v = this._sv(this._lit.state);
      return v != null && v.toLowerCase().indexOf('mainten') !== -1;
    }

    /* ---------------- build ---------------- */

    _build() {
      const catRows = this._cfg.cats.map((c, i) => `
        <div class="row catrow pressable" id="cat${i}" data-noexpand="lp">
          <div class="avatar" id="cat${i}av"></div>
          <div class="cname" id="cat${i}nm"></div>
          <div class="cinfo grow" id="cat${i}in">--</div>
        </div>`).join('');

      const feederRows = this._fdrs.map((f, i) => `
        <div class="frow" id="fdr${i}">
          <div class="row">
            <div class="grow pressable lpzone" id="fdr${i}lp" data-noexpand="lp">
              <div class="primary">${this._esc(f.label)}<span class="tert" id="fdr${i}own"></span></div>
              <div class="second" id="fdr${i}sub">--</div>
            </div>
            <div class="row chips" id="fdr${i}chips" data-noexpand="1"></div>
            <button class="feedbtn" id="fdr${i}feed" data-noexpand="1">Feed</button>
          </div>
        </div>`).join('');

      const bothRow = this._feedBoth ? `
        <div class="bothwrap" id="bothrow" data-noexpand="1">
          <div class="row">
            <div class="primary grow" style="color:${AMBER_TXT};">Both feeders</div>
            <div class="row chips" id="bothchips"></div>
            <button class="feedbtn" id="bothfeed">Feed</button>
          </div>
        </div>` : '';

      const camTiles = this._fdrs.map((f, i) => `
        <div class="camth grow pressable" id="cam${i}" data-noexpand="1">
          <span class="glyph" id="cam${i}g">&#128444;</span>
          <img class="camimg" id="cam${i}img" style="display:none" alt="">
          <span class="camlabel" id="cam${i}lb">--</span>
        </div>`).join('');

      this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 14px; position: relative; overflow: hidden; }
        .row { display: flex; align-items: center; gap: 10px; }
        .grow { flex: 1; min-width: 0; }
        .primary { font-size: 13.5px; font-weight: 500; color: var(--primary-text-color); }
        .second { font-size: 12px; color: var(--secondary-text-color); margin-top: 1px; }
        .tert { font-size: 11px; color: rgba(160,160,160,.7); font-weight: 400; }
        .catrow { padding: 3px 20px 3px 0; cursor: pointer; }
        .avatar {
          width: 28px; height: 28px; border-radius: 50%; flex: 0 0 auto;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; overflow: hidden;
          background-size: cover; background-position: center;
        }
        .cname { font-size: 13.5px; font-weight: 500; }
        .cinfo {
          font-size: 12px; color: var(--secondary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cinfo b { color: var(--primary-text-color); font-weight: 500; }
        .chev {
          position: absolute; right: 8px; top: 14px; width: 20px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          color: rgba(160,160,160,.55); font-size: 12px;
          transition: transform .25s cubic-bezier(.4,0,.2,1);
        }
        .chev.open { transform: rotate(180deg); }
        .occdot {
          position: absolute; right: 12px; top: 74px;
          width: 8px; height: 8px; border-radius: 50%;
          background: ${AMBER}; display: none;
          animation: fccpulse 1.6s ease-in-out infinite;
        }
        @keyframes fccpulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        .alertstrip {
          display: none; align-items: center; gap: 6px;
          margin: -2px 0 8px; padding: 5px 10px; border-radius: 8px;
          background: rgba(255,193,7,.16); color: ${AMBER_TXT};
          font-size: 11.5px; font-weight: 600;
        }
        .divider { height: 1px; background: var(--divider-color, rgba(255,255,255,.08)); margin: 11px -14px; }
        .main { display: none; }
        .bar {
          height: 8px; border-radius: 4px; background: rgba(70,70,70,.3);
          overflow: hidden; position: relative;
        }
        .bar > i {
          position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px;
          transition: width .35s cubic-bezier(.4,0,.2,1);
        }
        .ghostbtn {
          height: 28px; padding: 0 12px; border-radius: 14px;
          background: rgba(255,255,255,.06); color: #bdbdbd;
          font-size: 12px; border: none; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
        }
        .ghostbtn.open { background: rgba(255,255,255,.12); color: var(--primary-text-color); }
        .chips { gap: 5px; }
        .pchip {
          height: 26px; padding: 0 11px; border-radius: 13px;
          background: rgba(255,255,255,.06); color: #bdbdbd;
          font-size: 12px; border: none; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center;
        }
        .pchip.sel { background: rgba(255,193,7,.16); color: ${AMBER_TXT}; font-weight: 600; }
        .feedbtn {
          height: 26px; padding: 0 13px; border-radius: 13px;
          background: rgba(255,193,7,.16); color: ${AMBER_TXT};
          font-size: 12.5px; font-weight: 600; font-family: inherit;
          border: 1px solid rgba(255,193,7,.3); cursor: pointer;
          display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
        }
        .feedbtn.flash {
          background: rgba(124,179,66,.15); color: #aed581;
          border-color: rgba(124,179,66,.3);
        }
        .feedbtn.flash .u { color: ${AMBER_TXT}; text-decoration: underline; text-underline-offset: 2px; }
        .frow { margin-top: 9px; }
        .frow:first-child { margin-top: 0; }
        .bothwrap {
          border: 1px solid rgba(255,193,7,.3); border-radius: 10px;
          padding: 8px 10px; margin-top: 10px;
        }
        .morepanel {
          display: none; border: 1px solid var(--divider-color, rgba(255,255,255,.1));
          background: rgba(255,255,255,.03); border-radius: 10px;
          padding: 10px 11px; margin-top: 9px;
        }
        .maintpanel {
          display: none; border: 1px solid rgba(255,193,7,.35);
          background: rgba(255,193,7,.05); border-radius: 10px;
          padding: 11px 12px; margin-top: 2px;
        }
        .maintbtn {
          height: 34px; border-radius: 10px; width: 100%;
          background: rgba(255,255,255,.06); color: var(--primary-text-color);
          font-size: 12.5px; font-weight: 500; border: none; cursor: pointer;
          font-family: inherit; position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .maintbtn .bsub { font-size: 10.5px; color: rgba(160,160,160,.7); font-weight: 400; }
        .maintbtn[disabled] { opacity: .4; cursor: default; }
        .maintbtn .holdfill {
          position: absolute; left: 0; top: 0; bottom: 0; width: 0;
          background: rgba(255,193,7,.25); border-radius: 10px;
        }
        .maintbtn.holding .holdfill { width: 100%; transition: width ${HOLD_MS}ms linear; }
        .exitbtn {
          height: 34px; border-radius: 10px; width: 100%;
          background: rgba(255,193,7,.16); color: ${AMBER_TXT};
          font-size: 12.5px; font-weight: 600; font-family: inherit;
          border: 1px solid rgba(255,193,7,.3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .mdot {
          width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
          background: ${AMBER}; animation: fccpulse 1.6s ease-in-out infinite;
        }
        .camstrip { display: flex; gap: 10px; margin-top: 10px; }
        .camth {
          border-radius: 8px; height: 92px; position: relative; overflow: hidden;
          background: linear-gradient(135deg, #23282c 0%, #191d20 60%, #141719 100%);
          border: 1px solid var(--divider-color, rgba(255,255,255,.08));
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .camimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .glyph { font-size: 22px; opacity: .35; }
        .camlabel {
          position: absolute; left: 8px; bottom: 6px; z-index: 1;
          font-size: 10.5px; color: rgba(255,255,255,.78); font-weight: 500;
          -webkit-text-stroke: 2px rgba(0,0,0,.6); paint-order: stroke fill;
        }
        .dimmed { opacity: .45; pointer-events: none; }
        .pressable { transition: transform .12s ease, background .12s ease; border-radius: 8px; }
        .pressable.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .unavail { opacity: .5; }
      </style>
      <ha-card id="card">
        <div class="alertstrip" id="alerts"></div>
        <div id="catblock" style="position:relative;">
          ${catRows}
          <div class="chev" id="chev">&#9660;</div>
          <div class="occdot" id="occdotc" title="litter box occupied"></div>
        </div>
        <div class="main" id="main">
          <div class="divider"></div>
          <div id="litnormal">
            <div class="primary pressable lpzone" id="littitle" data-noexpand="lp">
              Litter box <span class="tert" id="litsub"></span><span class="mdot" id="occdote" style="display:none; margin-left:7px; vertical-align:middle;"></span>
            </div>
            <div class="row" style="gap:9px; margin-top:8px;">
              <div class="bar grow"><i id="litbar"></i></div>
              <div class="second" id="litpct" style="flex:0 0 auto; color: var(--primary-text-color);">--</div>
            </div>
            <div class="row" style="margin-top:7px;">
              <div class="tert grow" id="litstats">--</div>
              <button class="ghostbtn" id="cleanbtn" data-noexpand="1">&#10227; Clean</button>
              <button class="ghostbtn" id="morebtn" data-noexpand="1">&#8943; More</button>
            </div>
            <div class="morepanel" id="morepanel" data-noexpand="1">
              <div class="row" style="gap:8px;">
                <button class="maintbtn" id="levelbtn"><span>&#9776; Level litter</span><span class="bsub">smooth the bed</span></button>
                <button class="maintbtn" id="pausebtn"><span id="pauselbl">&#10073;&#10073; Pause</span><span class="bsub">current cycle</span></button>
              </div>
              <div class="row" style="gap:8px; margin-top:8px;">
                <button class="maintbtn" id="maintstartbtn"><span>&#128295; Start maintenance</span><span class="bsub">parks drum for bag &amp; refill</span></button>
              </div>
            </div>
          </div>
          <div class="maintpanel" id="maintpanel" data-noexpand="1">
            <div class="row" style="margin-bottom:10px;">
              <div class="mdot"></div>
              <div class="primary" style="color:${AMBER_TXT};" id="maintlbl">Maintenance mode</div>
              <div class="grow"></div>
              <div class="tert" id="maintsub">auto-clean paused &middot; safe to open</div>
            </div>
            <div class="row" style="gap:8px;">
              <button class="maintbtn" id="dumpbtn"><span class="holdfill"></span><span style="position:relative;">&#128465; Dump litter</span><span class="bsub" style="position:relative;">hold</span></button>
              <button class="maintbtn" id="mlevelbtn"><span>&#9776; Level</span><span class="bsub">after refill</span></button>
            </div>
            <div class="row" style="gap:8px; margin-top:8px;">
              <button class="exitbtn" id="maintexitbtn">&#10003; Done &mdash; exit maintenance</button>
            </div>
          </div>
          <div class="divider"></div>
          <div id="feedblock">
            ${feederRows}
            ${bothRow}
          </div>
        </div>
        <div class="camstrip" id="camstrip">
          ${camTiles}
        </div>
      </ha-card>`;

      this.$ = {};
      this.shadowRoot.querySelectorAll('[id]').forEach((el) => { this.$[el.id] = el; });

      this._buildChips();
      this._wire();
      this._built = true;
    }

    _esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _buildChips() {
      const mk = (key, host) => {
        host.innerHTML = '';
        this._portions.forEach((g) => {
          const b = document.createElement('button');
          b.className = 'pchip';
          b.textContent = String(g);
          b.dataset.g = String(g);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            this._sel[key] = g;
            this._update();
          });
          host.appendChild(b);
        });
      };
      this._fdrs.forEach((f, i) => mk(i, this.$['fdr' + i + 'chips']));
      if (this._feedBoth) mk('both', this.$.bothchips);
    }

    /* ---------------- wiring ---------------- */

    _wire() {
      // body tap: close More if open, else toggle expand.
      this.$.card.addEventListener('click', (e) => {
        const path = e.composedPath();
        for (const el of path) {
          if (el === this.$.card) break;
          if (el.dataset && el.dataset.noexpand) {
            if (el.dataset.noexpand === 'lp') break; // long-press zones still expand on tap
            return;
          }
          if (el.tagName === 'BUTTON') return;
        }
        if (this._moreOpen) { this._moreOpen = false; this._update(); return; }
        this._expanded = !this._expanded;
        this._update();
      });

      // press feedback on pressable zones
      this.shadowRoot.querySelectorAll('.pressable').forEach((el) => {
        el.addEventListener('pointerdown', () => el.classList.add('pressed'));
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
          el.addEventListener(ev, () => el.classList.remove('pressed')));
      });

      // long-press -> more-info
      const lp = (el, entityFn) => {
        if (!el) return;
        el.addEventListener('pointerdown', () => {
          this._lpFired = false;
          clearTimeout(this._lpTimer);
          this._lpTimer = setTimeout(() => {
            this._lpFired = true;
            this._moreInfo(entityFn());
          }, LONGPRESS_MS);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
          el.addEventListener(ev, () => clearTimeout(this._lpTimer)));
        el.addEventListener('click', (e) => {
          if (this._lpFired) { e.stopPropagation(); e.preventDefault(); }
        }, true);
      };
      this._cfg.cats.forEach((c, i) => lp(this.$['cat' + i], () => c.weight));
      lp(this.$.littitle, () => this._lit.level);
      this._fdrs.forEach((f, i) => lp(this.$['fdr' + i + 'lp'], () => f.dispensed));

      // buttons
      this.$.cleanbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._press(this._lit.scoop);
        this._optCleanUntil = Date.now() + OPT_MS;
        this._update();
      });
      this.$.morebtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._moreOpen = !this._moreOpen;
        this._update();
      });
      this.$.levelbtn.addEventListener('click', (e) => {
        e.stopPropagation(); this._press(this._lit.level_btn);
      });
      this.$.mlevelbtn.addEventListener('click', (e) => {
        e.stopPropagation(); this._press(this._lit.level_btn);
      });
      this.$.pausebtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const st = (this._sv(this._lit.state) || '').toLowerCase();
        this._press(st.indexOf('paus') !== -1 ? this._lit.cont : this._lit.pause);
      });
      this.$.maintstartbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._press(this._lit.maintStart);
        this._maintPending = Date.now();
        this._moreOpen = false;
        this._update();
      });
      this.$.maintexitbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._press(this._lit.maintExit);
        this._exitPending = Date.now();
        this._update();
      });

      // dump: hold to confirm
      const dump = this.$.dumpbtn;
      dump.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (dump.disabled) return;
        this._holdFired = false;
        dump.classList.add('holding');
        this._holdTimer = setTimeout(() => {
          this._holdFired = true;
          dump.classList.remove('holding');
          this._press(this._lit.dump);
        }, HOLD_MS);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
        dump.addEventListener(ev, () => {
          clearTimeout(this._holdTimer);
          dump.classList.remove('holding');
        }));
      dump.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });

      // feed buttons
      this._fdrs.forEach((f, i) => {
        this.$['fdr' + i + 'feed'].addEventListener('click', (e) => {
          e.stopPropagation();
          this._onFeedClick(String(i), [i]);
        });
      });
      if (this._feedBoth) {
        this.$.bothfeed.addEventListener('click', (e) => {
          e.stopPropagation();
          this._onFeedClick('both', this._fdrs.map((f, i) => i));
        });
      }

      // cameras -> live more-info
      this._fdrs.forEach((f, i) => {
        this.$['cam' + i].addEventListener('click', (e) => {
          e.stopPropagation();
          this._moreInfo(f.camera);
        });
      });
    }

    /* ---------------- feeding + undo ---------------- */

    _onFeedClick(key, idxs) {
      // if an undo window is showing on this button, the click means Undo
      if (this._undo && this._undo.key === key && Date.now() < this._undo.until) {
        this._undo.ids.forEach((i) => this._press(this._fdrs[i].cancel));
        this._undo = null;
        clearInterval(this._undoTimer);
        this._update();
        return;
      }
      const selKey = key === 'both' ? 'both' : Number(key);
      const g = this._sel[selKey];
      idxs.forEach((i) => {
        this._hass.callService('text', 'set_value', {
          entity_id: this._fdrs[i].feed, value: String(g)
        });
      });
      this._undo = { key, ids: idxs, grams: g, until: Date.now() + UNDO_MS };
      clearInterval(this._undoTimer);
      this._undoTimer = setInterval(() => {
        if (!this._undo || Date.now() >= this._undo.until) {
          clearInterval(this._undoTimer);
          // keep a brief plain "Fed" flash for 1.5s after countdown ends
          if (this._undo) {
            this._undo.doneUntil = Date.now() + 1500;
            this._undo.until = 0;
            setTimeout(() => { this._undo = null; this._update(); }, 1500);
          }
        }
        this._update();
      }, 250);
      this._update();
    }

    _feedBtnLabel(key, btn) {
      const u = this._undo;
      if (u && u.key === key) {
        if (u.until && Date.now() < u.until) {
          const s = Math.ceil((u.until - Date.now()) / 1000);
          btn.classList.add('flash');
          btn.innerHTML = 'Fed ' + u.grams + ' g &#10003; &nbsp;<span class="u">Undo &middot; ' + s + '</span>';
          return;
        }
        if (u.doneUntil && Date.now() < u.doneUntil) {
          btn.classList.add('flash');
          btn.innerHTML = 'Fed &#10003;';
          return;
        }
      }
      btn.classList.remove('flash');
      btn.textContent = 'Feed';
    }

    /* ---------------- update ---------------- */

    _update() {
      if (!this._built || !this._hass) return;
      const $ = this.$;

      /* cats */
      this._cfg.cats.forEach((c, i) => {
        const av = $['cat' + i + 'av'];
        const ws = this._st(c.weight);
        const pic = (this._cfg.avatars !== 'initials') && ws &&
          ws.attributes.entity_picture ? ws.attributes.entity_picture : null;
        if (pic) {
          if (av.dataset.pic !== pic) {
            av.dataset.pic = pic;
            av.style.backgroundImage = 'url("' + pic + '")';
            av.textContent = '';
          }
        } else {
          av.style.backgroundImage = '';
          av.textContent = c.name.charAt(0).toUpperCase();
          const col = c.color || AMBER_TXT;
          av.style.color = col;
          av.style.background = 'rgba(255,255,255,.07)';
        }
        $['cat' + i + 'nm'].textContent = c.name;
        const w = this._num(c.weight);
        const unit = ws && ws.attributes.unit_of_measurement ? ws.attributes.unit_of_measurement : 'lb';
        const when = this._fmtWhen(this._sv(c.last_use));
        $['cat' + i + 'in'].innerHTML =
          '<b>' + (w == null ? '--' : w.toFixed(1) + ' ' + this._esc(unit)) + '</b>' +
          ' &middot; litter ' + this._esc(when);
      });

      /* expansion */
      const mainVis = this._expanded ? 'block' : 'none';
      if ($.main.style.display !== mainVis) $.main.style.display = mainVis;
      $.chev.classList.toggle('open', this._expanded);

      /* occupied */
      const occ = this._isOn(this._lit.occupied);
      const cdot = occ && !this._expanded ? 'block' : 'none';
      if ($.occdotc.style.display !== cdot) $.occdotc.style.display = cdot;
      const edot = occ && this._expanded ? 'inline-block' : 'none';
      if ($.occdote.style.display !== edot) $.occdote.style.display = edot;

      /* maintenance state machine */
      const maintActive = this._maintActive();
      if (maintActive) { this._maintPending = 0; }
      if (this._maintPending && Date.now() - this._maintPending > MAINT_PENDING_TIMEOUT_MS) {
        this._maintPending = 0;
      }
      if (!maintActive && this._exitPending) {
        this._exitPending = 0;
      }
      const showMaint = maintActive || !!this._maintPending;
      const mp = showMaint ? 'block' : 'none';
      if ($.maintpanel.style.display !== mp) $.maintpanel.style.display = mp;
      const ln = showMaint ? 'none' : 'block';
      if ($.litnormal.style.display !== ln) $.litnormal.style.display = ln;
      if (showMaint) {
        const pending = !maintActive;
        const exiting = maintActive && !!this._exitPending;
        $.maintlbl.textContent = pending ? 'Maintenance \u2014 parking\u2026'
          : (exiting ? 'Maintenance \u2014 exiting\u2026' : 'Maintenance mode');
        $.maintsub.textContent = pending ? 'waiting for the box\u2026'
          : 'auto-clean paused \u00b7 safe to open';
        $.dumpbtn.disabled = pending;
        $.mlevelbtn.disabled = pending;
      }
      $.feedblock.classList.toggle('dimmed', showMaint);
      $.camstrip.classList.toggle('dimmed', showMaint);

      /* litter section */
      const lvl = this._num(this._lit.level);
      const sandLack = this._isOn(this._lit.sandLack);
      const binFull = this._isOn(this._lit.binFull);
      const litOffline = this._offline(this._lit.devStatus);
      let stateTxt = this._sv(this._lit.state) || '--';
      if (Date.now() < this._optCleanUntil &&
          stateTxt.toLowerCase() === 'idle') stateTxt = 'cleaning\u2026';
      const lastBy = this._sv(this._lit.lastBy);
      const lastCat = this._cfg.cats.find(
        (c) => lastBy && c.name.toLowerCase() === lastBy.toLowerCase());
      const lastWhen = lastCat ? this._fmtWhen(this._sv(lastCat.last_use)) : null;
      $.litsub.innerHTML = '&middot; ' + this._esc(stateTxt) +
        (lastBy ? ' &middot; last: ' + this._esc(this._capitalize(lastBy)) +
          (lastWhen && lastWhen !== '--' ? ' ' + this._esc(lastWhen) : '') : '');
      if (occ) $.litsub.innerHTML = '&middot; occupied';
      const barCol = (sandLack || litOffline) ? RED : (lvl != null && lvl <= 30 ? AMBER : GREEN);
      $.litbar.style.background = barCol;
      $.litbar.style.opacity = '.85';
      $.litbar.style.width = (lvl == null ? 0 : Math.max(0, Math.min(100, lvl))) + '%';
      $.litpct.textContent = lvl == null ? '--' : lvl + '%';
      const kg = this._num(this._lit.weight);
      const uses = this._sv(this._lit.timesUsed);
      $.litstats.textContent =
        (kg == null ? '--' : kg.toFixed(1) + ' kg') +
        ' \u00b7 ' + (uses == null ? '--' : uses) + ' uses today' +
        ' \u00b7 ' + (binFull ? 'bin FULL' : 'bin OK');
      $.littitle.classList.toggle('unavail', litOffline);

      /* more panel */
      const mv = this._moreOpen && !showMaint ? 'block' : 'none';
      if ($.morepanel.style.display !== mv) $.morepanel.style.display = mv;
      $.morebtn.classList.toggle('open', this._moreOpen);
      const st = (this._sv(this._lit.state) || '').toLowerCase();
      $.pauselbl.innerHTML = st.indexOf('paus') !== -1
        ? '&#9654; Resume' : '&#10073;&#10073; Pause';

      /* feeders */
      this._fdrs.forEach((f, i) => {
        $['fdr' + i + 'own'].textContent = f.owner ? ' \u00b7 ' + f.owner + "'s" : '';
        const eaten = this._sv(f.eaten);
        const disp = this._num(f.dispensed);
        const plan = this._num(f.planned);
        const bowl = this._num(f.bowl);
        const bowlTxt = bowl == null ? 'bowl --'
          : (bowl > 0 ? 'bowl ' + bowl + '%' : 'bowl empty');
        $['fdr' + i + 'sub'].textContent =
          (eaten == null ? '--' : eaten) + ' visits \u00b7 ' +
          (disp == null ? '--' : disp) + ' / ' + (plan == null ? '--' : plan) +
          ' g today \u00b7 ' + bowlTxt;
        $['fdr' + i].classList.toggle('unavail', this._offline(f.devStatus));
        // chips
        $['fdr' + i + 'chips'].querySelectorAll('.pchip').forEach((b) => {
          b.classList.toggle('sel', Number(b.dataset.g) === this._sel[i]);
        });
        this._feedBtnLabel(String(i), $['fdr' + i + 'feed']);
        // camera tile
        const img = $['cam' + i + 'img'];
        const glyph = $['cam' + i + 'g'];
        const ist = this._st(f.image);
        const url = ist && ist.attributes.entity_picture ? ist.attributes.entity_picture : null;
        if (url) {
          if (img.dataset.src !== url) { img.dataset.src = url; img.src = url; }
          if (img.style.display !== 'block') img.style.display = 'block';
          if (glyph.style.display !== 'none') glyph.style.display = 'none';
        } else {
          if (img.style.display !== 'none') img.style.display = 'none';
          if (glyph.style.display !== '') glyph.style.display = '';
        }
        const when = ist ? this._fmtWhen(ist.state) : '--';
        $['cam' + i + 'lb'].textContent =
          (f.owner ? f.owner + "'s" : f.label) + ' \u00b7 ' + f.camWord + ' \u00b7 ' + when;
      });
      if (this._feedBoth) {
        $.bothchips.querySelectorAll('.pchip').forEach((b) => {
          b.classList.toggle('sel', Number(b.dataset.g) === this._sel.both);
        });
        this._feedBtnLabel('both', $.bothfeed);
      }

      /* alerts */
      const alerts = [];
      if (maintActive && !this._expanded) alerts.push('\u{1F527} Maintenance active');
      if (this._isOn(this._lit.frequent)) alerts.push('Frequent litter use');
      if (lvl != null && lvl <= 30) alerts.push('Litter ' + lvl + '%');
      if (sandLack && (lvl == null || lvl > 30)) alerts.push('Litter low');
      if (binFull) alerts.push('Bin full');
      this._fdrs.forEach((f) => {
        if (this._isOn(f.hopper)) {
          alerts.push((f.owner ? f.owner + "'s" : f.label) + ' hopper empty');
        }
        if (this._offline(f.devStatus)) {
          alerts.push((f.owner ? f.owner + "'s" : f.label) + ' feeder offline');
        }
      });
      if (litOffline) alerts.push('Litter box offline');
      if (alerts.length) {
        const txt = '\u26a0 ' + alerts.join(' \u00b7 ');
        if ($.alerts.textContent !== txt) $.alerts.textContent = txt;
        if ($.alerts.style.display !== 'flex') $.alerts.style.display = 'flex';
      } else if ($.alerts.style.display !== 'none') {
        $.alerts.style.display = 'none';
      }
    }

    _capitalize(s) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }
  }

  customElements.define('flat-cat-card', FlatCatCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'flat-cat-card',
    name: 'Flat Cat Card',
    description: 'Consolidated cats card: PetKit litter box, feeders, cameras.'
  });
})();
