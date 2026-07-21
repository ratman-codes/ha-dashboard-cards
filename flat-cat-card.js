/* flat-cat-card v1.11
 * ------------------------------------------------------------------
 * One consolidated card for the household cats (PetKit litter box +
 * two Yumshare feeders + per-cat stats). Card #6 in the flat-card
 * family. Replaces five separate cards on the main dashboard.
 *
 * WHAT IT DOES
 *  - Headerless. Tap anywhere on the card body to expand/collapse
 *    (no glyph, house expander convention). Collapsed = cat rows +
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
 *   trend_days: 90           # weight-trend window in days (14-365);
 *                            # drawn from permanent long-term statistics
 *   history: true            # false disables the per-cat history panels
 *
 * v1.1: header example genericized to placeholder names (no functional
 * change from v1.0).
 * v1.2: camera_image option (eat | visit | feed) selects which event
 * snapshot the camera tiles display, globally or per feeder.
 * v1.3: per-cat litter history panels. Tapping a cat row opens that
 * cat's panel (collapsed card: expands AND opens in one tap; open
 * card: toggles; one panel open at a time; everything else still
 * expands/collapses the card as before). Panel shows visits-per-day
 * bars (7 days), a recent-visit log (time / duration / body weight
 * from the litter box scale), and a 10-day weight trend (raw scale
 * readings faded, smoothed line on top). Data is fetched live from
 * HA's recorder via the history/history_during_period websocket API
 * when a panel opens (cached ~5 min) - no helper entities created.
 * Recorder retention (~10 days default) bounds the window. Per-cat
 * duration/scale entities are derived from the last_use entity id
 * (_last_use_date -> _last_use_duration / _last_weight_measurement);
 * override per cat with `duration:` / `scale_weight:` keys.
 * Disable the whole feature with `history: false`.
 * v1.4: tap-target refinement. Only the avatar-through-text run of a
 * cat row (with its inline mini caret after the litter text) opens
 * that cat's history; the empty remainder of the row joins the
 * whole-card expand/collapse surface. The shared right-edge chevron
 * is vertically centered on the cat-rows block (measured live, so it
 * stays centered with any cat count or when the alert strip shows).
 * v1.5: cat tap opens ONLY that cat's history panel (no longer
 * auto-expands the litter/feeder sections - panels work inside the
 * collapsed card too). Visit log gains aligned column headers
 * (TIME / DUR / WEIGHED over their columns). Tap a day bar to filter
 * the log to that day (tap it again to go back to recent). Tap the
 * weight trend to open the scale sensor's full history via more-info.
 * "Both feeders" row restyled: amber outline removed, geometry now
 * identical to the individual feeder rows, gold title only.
 * v1.6: Both-feeders row given the same block height as the two-line
 * feeder rows (min-height 38px) so the three chip/Feed columns are
 * evenly spaced.
 * v1.7: history panel aligned full-width with the card content edges
 * (flush left with the avatars, matching the camera strip) instead of
 * indented under the text column.
 * v1.8: subtle hover highlight on the per-cat tap target (house-style
 * small-element hover, rgba(255,255,255,.05), pointer devices only
 * via the hover media query).
 * v1.9: weight trend now draws from HA's PERMANENT long-term
 * statistics (recorder/statistics_during_period, daily means) over a
 * configurable window - `trend_days: 90` default, clamp 14-365. Adds
 * faint month gridlines, a start/mid/today axis, and a delta readout
 * under the average (steady dot when < 0.15; amber when the smoothed
 * change exceeds ~5% of body weight - the drift-alert case). X axis
 * spans the FULL window, so sparse early data honestly clusters at
 * the right edge and fills in over time. Falls back to the old
 * 10-day raw-reading chart when fewer than 2 daily statistics exist.
 * The 10-day per-visit log is unchanged.
 * v1.10: zero-poisoning filter for the trend. The PetKit integration
 * writes literal 0s to the scale sensor around reloads/dropouts, and
 * HA's time-weighted daily means average them in (observed: a real
 * 5.9 kg day with a 0.41 kg mean -> a fictional +5 lb "trend"). Per
 * day: min > 0 -> trust the mean; zero-tainted day with a real
 * reading -> use that day's max; all-zero day -> dropped. A median
 * guard then discards any survivor below half the window median.
 * v1.11: shared right-edge chevron removed (matches the house
 * expander convention - whole card body toggles with no glyph; the
 * per-cat mini carets remain as the only affordance markers). The
 * live-measurement centering code went with it.
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
      this._histOpen = -1;         // index of the cat whose history panel is open
      this._hist = {};             // per-cat fetched history cache
      this._histDay = {};          // per-cat day-bar filter (dayKey string or null)
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
      this._histOn = config.history !== false;
      this._trendDays = Math.max(14, Math.min(365, Number(config.trend_days) || 90));
      this._built = false;
    }

    _catDuration(c) {
      return c.duration || (c.last_use
        ? c.last_use.replace('_last_use_date', '_last_use_duration') : null);
    }

    _catScale(c) {
      return c.scale_weight || (c.last_use
        ? c.last_use.replace('_last_use_date', '_last_weight_measurement') : null);
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
        <div class="row catrow">
          <div class="cathit pressable" id="cat${i}" data-noexpand="lp">
            <div class="avatar" id="cat${i}av"></div>
            <div class="cname" id="cat${i}nm"></div>
            <div class="cinfo" id="cat${i}in">--</div>
            <span class="rcaret" id="cat${i}car">&#9662;</span>
          </div>
          <div class="grow"></div>
        </div>
        <div class="histpanel" id="cat${i}hist" data-noexpand="1"></div>`).join('');

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
        .catrow { padding: 3px 24px 3px 0; }
        .cathit {
          display: flex; align-items: center; gap: 10px;
          min-width: 0; max-width: 100%;
          cursor: pointer; border-radius: 8px;
          padding: 2px 8px 2px 2px; margin-left: -2px;
        }
        .cathit .cinfo { flex: 0 1 auto; min-width: 0; }
        @media (hover: hover) {
          .cathit:hover { background: rgba(255,255,255,.05); }
        }
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
        .bothwrap { margin-top: 9px; }
        .bothwrap .row { min-height: 38px; }
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
        .rcaret { color: rgba(160,160,160,.45); font-size: 10px; flex: 0 0 auto; margin-left: 1px; }
        .histpanel {
          display: none;
          border: 1px solid var(--divider-color, rgba(255,255,255,.1));
          background: rgba(255,255,255,.03);
          border-radius: 10px;
          padding: 11px 12px;
          margin: 5px 0 6px 0;
        }
        .histhead { font-size: 11px; color: rgba(120,120,120,.9); margin-bottom: 8px; letter-spacing: .3px; }
        .histhead b { color: rgba(160,160,160,.9); font-weight: 600; }
        .hbars { display: flex; align-items: flex-end; gap: 7px; height: 46px; padding: 0 2px; }
        .hbcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; cursor: pointer; }
        .hbcol .hb { width: 100%; border-radius: 3px 3px 0 0; }
        .hbcol .hz { width: 100%; height: 2px; border-radius: 1px; background: rgba(255,255,255,.10); }
        .hbaxis { display: flex; gap: 7px; padding: 4px 2px 0; }
        .hbaxis span { flex: 1; text-align: center; font-size: 9.5px; color: rgba(120,120,120,.9); }
        .hlog { margin-top: 10px; border-top: 1px solid var(--divider-color, rgba(255,255,255,.08)); padding-top: 8px; }
        .hvrow { display: flex; gap: 8px; font-size: 11.5px; padding: 2.5px 0; }
        .hvrow .ht { color: var(--primary-text-color); width: 84px; flex: 0 0 auto; }
        .hvrow .hd { color: var(--secondary-text-color); width: 58px; flex: 0 0 auto; }
        .hvrow .hw { color: var(--primary-text-color); font-weight: 500; }
        .hvrow.hdr { padding-bottom: 5px; }
        .hvrow.hdr .ht, .hvrow.hdr .hd, .hvrow.hdr .hw {
          color: rgba(120,120,120,.9); font-weight: 600; font-size: 10.5px; letter-spacing: .3px;
        }
        .hspark { margin-top: 10px; border-top: 1px solid var(--divider-color, rgba(255,255,255,.08)); padding-top: 9px; cursor: pointer; }
        .hsparkrow { display: flex; align-items: center; gap: 10px; }
        .hsparklabel { font-size: 11px; color: rgba(120,120,120,.9); flex: 0 0 auto; width: 78px; line-height: 1.35; }
        .hsparklabel b { color: rgba(160,160,160,.9); font-weight: 600; display: block; font-size: 12px; }
        .hsparkval { flex: 0 0 auto; font-size: 12px; color: var(--primary-text-color); text-align: right; }
        .hsparkval span { font-size: 11px; color: rgba(120,120,120,.9); }
        .hdelta { font-size: 11px; margin-top: 2px; }
        .haxis {
          display: flex; justify-content: space-between;
          font-size: 9.5px; color: rgba(120,120,120,.9);
          padding: 3px 58px 0 88px;
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
        if (!this._expanded) this._histOpen = -1;
        this._update();
      });

      // cat rows: tap opens that cat's history panel (expands card first
      // if collapsed); one panel open at a time; tap again closes.
      if (this._histOn) {
        this._cfg.cats.forEach((c, i) => {
          this.$['cat' + i].addEventListener('click', (e) => {
            if (this._lpFired) return; // long-press already consumed this tap
            e.stopPropagation();
            this._toggleHist(i);
          });
          // inside the panel: day bars filter the log, weight trend
          // opens the scale sensor's full history
          const panel = this.$['cat' + i + 'hist'];
          panel.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = e.composedPath();
            for (const el of path) {
              if (el === panel) break;
              if (el.dataset && el.dataset.day !== undefined) {
                this._histDay[i] = this._histDay[i] === el.dataset.day
                  ? null : el.dataset.day;
                this._update();
                return;
              }
              if (el.classList && el.classList.contains('hspark')) {
                this._moreInfo(this._catScale(c));
                return;
              }
            }
          });
        });
      }

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

    /* ---------------- per-cat history ---------------- */

    _toggleHist(i) {
      if (this._histOpen === i) {
        this._histOpen = -1;
      } else {
        this._histOpen = i;
        this._histDay[i] = null;
        this._loadHist(i);
      }
      this._update();
    }

    _loadHist(i) {
      const cached = this._hist[i];
      if (cached && cached.data && Date.now() - cached.at < 300000) return;
      const c = this._cfg.cats[i];
      const ids = [c.last_use, this._catDuration(c), this._catScale(c)]
        .filter(Boolean);
      const end = new Date();
      const start = new Date(end.getTime() - 10 * 86400000);
      this._hist[i] = { at: Date.now(), loading: true };
      const histP = this._hass.callWS({
        type: 'history/history_during_period',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: ids,
        significant_changes_only: false,
        minimal_response: true,
        no_attributes: true
      });
      // long-term daily weight statistics for the trend window
      const scaleId = this._catScale(c);
      const statsP = scaleId ? this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: new Date(end.getTime() - this._trendDays * 86400000).toISOString(),
        end_time: end.toISOString(),
        statistic_ids: [scaleId],
        period: 'day',
        types: ['mean', 'min', 'max']
      }).catch(() => null) : Promise.resolve(null);
      Promise.all([histP, statsP]).then(([res, stats]) => {
        this._hist[i] = { at: Date.now(), data: res || {}, stats: stats || {} };
        this._update();
      }).catch((err) => {
        this._hist[i] = {
          at: Date.now(),
          error: String((err && err.message) || 'history unavailable')
        };
        this._update();
      });
    }

    _histRows(data, id) {
      return (data[id] || []).map((e) => ({
        s: e.s !== undefined ? e.s : e.state,
        t: e.lu !== undefined ? e.lu * 1000
          : Date.parse(e.last_updated || e.last_changed || 0)
      })).filter((e) => e.s != null && e.s !== '' &&
        String(e.s).toLowerCase() !== 'unavailable' &&
        String(e.s).toLowerCase() !== 'unknown');
    }

    _fmtVisit(d) {
      const now = new Date();
      let h = d.getHours();
      const ap = h >= 12 ? 'p' : 'a';
      h = h % 12; if (h === 0) h = 12;
      const t = h + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
      if (d.toDateString() === now.toDateString()) return 'Today ' + t;
      const y = new Date(now); y.setDate(now.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return 'Yest ' + t;
      const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      if (now - d < 7 * 86400000) return wk + ' ' + t;
      return MONTHS[d.getMonth()] + ' ' + d.getDate();
    }

    _fmtDur(n) {
      if (n < 60) return Math.round(n) + 's';
      const m = Math.floor(n / 60);
      return m + 'm ' + String(Math.round(n % 60)).padStart(2, '0') + 's';
    }

    _renderHist(i, panel) {
      const h = this._hist[i] || {};
      const key = (h.loading ? 'L' : h.error ? 'E' : 'D') + (h.at || 0) +
        '|' + (this._histDay[i] || '');
      if (panel.dataset.render === key) return;
      panel.dataset.render = key;
      if (h.loading || !h.data) {
        panel.innerHTML = '<div class="histhead" style="margin:0;">loading history&hellip;</div>';
        return;
      }
      if (h.error) {
        panel.innerHTML = '<div class="histhead" style="margin:0;">history unavailable &middot; ' +
          this._esc(h.error) + '</div>';
        return;
      }
      const c = this._cfg.cats[i];
      const col = c.color || AMBER_TXT;
      const data = h.data;

      // visits: each unique last_use_date VALUE is one visit; day-bucket
      // by the value itself (robust against window-edge duplicates)
      const seen = {};
      const visits = [];
      this._histRows(data, c.last_use).forEach((e) => {
        const d = new Date(String(e.s).replace(' ', 'T'));
        if (isNaN(d.getTime()) || seen[e.s]) return;
        seen[e.s] = true;
        visits.push({ d, t: e.t });
      });
      visits.sort((a, b) => b.d - a.d);

      const dayKey = (d) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      const counts = {};
      visits.forEach((v) => {
        const k = dayKey(v.d);
        counts[k] = (counts[k] || 0) + 1;
      });
      const WK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const WKL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = [];
      for (let o = 6; o >= 0; o--) {
        const d = new Date(); d.setDate(d.getDate() - o);
        days.push({
          label: WK[d.getDay()],
          pretty: (o === 0 ? 'Today' : WKL[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate()),
          k: dayKey(d),
          n: counts[dayKey(d)] || 0,
          today: o === 0
        });
      }
      const maxN = Math.max(3, ...days.map((d) => d.n));
      const avg = days.reduce((a, d) => a + d.n, 0) / 7;
      const filt = this._histDay[i] || null;

      const barsHtml = days.map((d) => {
        const sel = filt === d.k;
        const inner = d.n === 0
          ? '<div class="hz"' + (sel ? ' style="background:' + col + '; opacity:.6;"' : '') + '></div>'
          : '<div class="hb" style="height:' + Math.round(d.n / maxN * 100) +
            '%; background:' + col + '; opacity:' +
            (sel ? '1' : (filt ? '.35' : (d.today ? '1' : '.8'))) + ';"></div>';
        return '<div class="hbcol" data-day="' + d.k + '">' + inner + '</div>';
      }).join('');
      const axisHtml = days.map((d) =>
        '<span' + (filt === d.k ? ' style="color:' + col + '; font-weight:600;"' : '') +
        '>' + d.label + '</span>').join('');

      // duration + scale-weight rows, matched to visits by record time
      const durs = this._histRows(data, this._catDuration(c))
        .filter((e) => !isNaN(Number(e.s)));
      const wts = this._histRows(data, this._catScale(c))
        .filter((e) => !isNaN(Number(e.s)));
      const near = (arr, t) => {
        let best = null, bd = 120001;
        arr.forEach((x) => {
          const d = Math.abs(x.t - t);
          if (d < bd) { bd = d; best = x; }
        });
        return best;
      };
      const scaleSt = this._st(this._catScale(c));
      const scaleUnit = scaleSt && scaleSt.attributes.unit_of_measurement;
      const dispSt = this._st(c.weight);
      const dispUnit = (dispSt && dispSt.attributes.unit_of_measurement) || 'lb';
      const toDisp = (kg) => {
        let v = Number(kg);
        if (scaleUnit === 'kg' && dispUnit !== 'kg') v = v * 2.20462;
        return v;
      };

      const filtDay = filt ? days.find((d) => d.k === filt) : null;
      const logSrc = filt
        ? visits.filter((v) => dayKey(v.d) === filt)
        : visits;
      const logTitle = filt
        ? '<b>VISITS</b> &middot; ' + this._esc(filtDay ? filtDay.pretty : '') +
          ' <span style="font-weight:400;">&middot; tap day again for recent</span>'
        : '<b>RECENT VISITS</b>';
      const hdrRow = '<div class="hvrow hdr"><span class="ht">TIME</span>' +
        '<span class="hd">DUR</span><span class="hw">WEIGHED</span></div>';
      const logHtml = logSrc.slice(0, filt ? 8 : 5).map((v) => {
        const du = near(durs, v.t);
        const wt = near(wts, v.t);
        return '<div class="hvrow"><span class="ht">' + this._esc(this._fmtVisit(v.d)) +
          '</span><span class="hd">' + (du ? this._fmtDur(Number(du.s)) : '--') +
          '</span><span class="hw">' +
          (wt ? toDisp(wt.s).toFixed(1) + ' ' + this._esc(dispUnit) : '--') +
          '</span></div>';
      }).join('') || '<div class="hvrow"><span class="hd" style="width:auto;">' +
        (filt ? 'no attributed visits that day' : 'no visits in the last 10 days') +
        '</span></div>';

      // weight trend: long-term daily means (preferred), raw-reading fallback
      let sparkHtml;
      const stRows = (h.stats && h.stats[this._catScale(c)]) || [];
      // zero-poisoning filter: the integration writes 0s around
      // reloads/dropouts and they contaminate time-weighted means.
      let daily = stRows.map((r) => {
        const t = typeof r.start === 'number' ? r.start : Date.parse(r.start);
        let v = null;
        if (r.min != null && Number(r.min) > 0 && r.mean != null) {
          v = Number(r.mean);            // clean day: trust the mean
        } else if (r.max != null && Number(r.max) > 0) {
          v = Number(r.max);             // tainted day: use the real reading
        }
        return { t, v };
      }).filter((p) => p.v != null && p.v > 0 && !isNaN(p.v) && !isNaN(p.t))
        .sort((a, b) => a.t - b.t)
        .map((p) => ({ t: p.t, v: toDisp(p.v) }));
      if (daily.length >= 3) {
        const sorted = daily.map((p) => p.v).slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        daily = daily.filter((p) => p.v >= median * 0.5);
      }
      if (daily.length >= 2) {
        const nowMs = new Date().getTime();
        const w0 = nowMs - this._trendDays * 86400000;
        const vals = daily.map((p) => p.v);
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const vpad = Math.max((hi - lo) * 0.2, 0.15);
        lo -= vpad; hi += vpad;
        const X = (t) => 6 + Math.max(0, Math.min(1, (t - w0) / (nowMs - w0))) * 208;
        const Y = (v) => 28 - (v - lo) / (hi - lo) * 22;
        const sm = daily.map((p, j) => {
          const win = daily.slice(Math.max(0, j - 2), Math.min(daily.length, j + 3));
          return { t: p.t, v: win.reduce((a, q) => a + q.v, 0) / win.length };
        });
        let grid = '';
        const gd = new Date(w0);
        gd.setHours(0, 0, 0, 0); gd.setDate(1); gd.setMonth(gd.getMonth() + 1);
        while (gd.getTime() < nowMs) {
          const gx = X(gd.getTime()).toFixed(1);
          grid += '<line x1="' + gx + '" y1="3" x2="' + gx +
            '" y2="31" stroke="rgba(255,255,255,.07)" stroke-width="1"/>';
          gd.setMonth(gd.getMonth() + 1);
        }
        const rawLine = daily.map((p) => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
        const smLine = sm.map((p) => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
        const dots = daily.map((p, j) =>
          '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) +
          '" r="' + (j === daily.length - 1 ? 2.5 : 1.7) + '" fill="' +
          (j === daily.length - 1 ? '#ffffff' : col) + '" opacity="' +
          (j === daily.length - 1 ? '1' : '.4') + '"/>').join('');
        const mean = sm[sm.length - 1].v;
        const delta = mean - sm[0].v;
        let deltaHtml;
        if (Math.abs(delta) < 0.15) {
          deltaHtml = '<div class="hdelta" style="color: rgba(120,120,120,.9);">&#9679; steady</div>';
        } else {
          const warn = Math.abs(delta) >= 0.05 * mean;
          deltaHtml = '<div class="hdelta" style="color:' +
            (warn ? '#ffc107' : 'rgba(160,160,160,.9)') + ';">' +
            (delta > 0 ? '&#9650;' : '&#9660;') + ' ' + Math.abs(delta).toFixed(1) +
            ' / ' + this._trendDays + 'd</div>';
        }
        const axStart = new Date(w0);
        const axMid = new Date((w0 + nowMs) / 2);
        sparkHtml =
          '<div class="hsparkrow">' +
          '<div class="hsparklabel"><b>Weight</b>' + this._trendDays + '-day trend</div>' +
          '<svg class="grow" height="34" viewBox="0 0 220 34" preserveAspectRatio="none">' +
          grid +
          '<polyline points="' + rawLine + '" fill="none" stroke="' + col +
          '" stroke-width="1" opacity=".3"/>' +
          '<polyline points="' + smLine + '" fill="none" stroke="' + col +
          '" stroke-width="2" stroke-linecap="round"/>' + dots + '</svg>' +
          '<div class="hsparkval"><div>' + mean.toFixed(1) +
          ' <span>avg ' + this._esc(dispUnit) + '</span></div>' + deltaHtml + '</div></div>' +
          '<div class="haxis"><span>' + MONTHS[axStart.getMonth()] + ' ' + axStart.getDate() +
          '</span><span>' + MONTHS[axMid.getMonth()] + '</span><span>today</span></div>';
        // fallthrough skips the raw path below
      }
      const pts = daily.length >= 2 ? [] : wts.slice().sort((a, b) => a.t - b.t).slice(-12)
        .map((e) => ({ t: e.t, v: toDisp(e.s) }));
      if (daily.length >= 2) {
        // already built above
      } else if (pts.length < 2) {
        sparkHtml = '<div class="histhead" style="margin:0;">weight trend &middot; not enough data yet</div>';
      } else {
        const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
        const vals = pts.map((p) => p.v);
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = Math.max((hi - lo) * 0.2, 0.15);
        lo -= pad; hi += pad;
        const X = (t) => 8 + (t - t0) / Math.max(t1 - t0, 1) * 204;
        const Y = (v) => 26 - (v - lo) / (hi - lo) * 22;
        const raw = pts.map((p) => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
        const sm = pts.map((p, j) => {
          const win = pts.slice(Math.max(0, j - 1), Math.min(pts.length, j + 2));
          return { t: p.t, v: win.reduce((a, q) => a + q.v, 0) / win.length };
        });
        const smooth = sm.map((p) => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
        const dots = pts.map((p, j) =>
          '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) +
          '" r="' + (j === pts.length - 1 ? 2.5 : 2) + '" fill="' +
          (j === pts.length - 1 ? '#ffffff' : col) + '" opacity="' +
          (j === pts.length - 1 ? '1' : '.55') + '"/>').join('');
        const recent = vals.slice(-5);
        const mean = recent.reduce((a, v) => a + v, 0) / recent.length;
        sparkHtml =
          '<div class="hsparkrow">' +
          '<div class="hsparklabel"><b>Weight</b>10-day trend</div>' +
          '<svg class="grow" height="30" viewBox="0 0 220 30" preserveAspectRatio="none">' +
          '<polyline points="' + raw + '" fill="none" stroke="' + col +
          '" stroke-width="1.2" opacity=".3"/>' +
          '<polyline points="' + smooth + '" fill="none" stroke="' + col +
          '" stroke-width="2" stroke-linecap="round"/>' + dots + '</svg>' +
          '<div class="hsparkval">' + mean.toFixed(1) +
          ' <span>avg ' + this._esc(dispUnit) + '</span></div></div>';
      }

      panel.innerHTML =
        '<div class="histhead"><b>VISITS / DAY</b> &middot; past 7 days &middot; avg ' +
        avg.toFixed(1) + '</div>' +
        '<div class="hbars">' + barsHtml + '</div>' +
        '<div class="hbaxis">' + axisHtml + '</div>' +
        '<div class="hlog"><div class="histhead" style="margin-bottom:6px;">' + logTitle + '</div>' +
        hdrRow + logHtml + '</div>' +
        '<div class="hspark">' + sparkHtml + '</div>';
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

      /* per-cat history panels */
      this._cfg.cats.forEach((c, i) => {
        const panel = $['cat' + i + 'hist'];
        const car = $['cat' + i + 'car'];
        if (car) {
          const cv = this._histOn ? '' : 'none';
          if (car.style.display !== cv) car.style.display = cv;
        }
        if (!panel) return;
        const open = this._histOn && this._histOpen === i;
        const pv = open ? 'block' : 'none';
        if (panel.style.display !== pv) panel.style.display = pv;
        if (car && car.dataset.open !== String(open)) {
          car.dataset.open = String(open);
          car.innerHTML = open ? '&#9652;' : '&#9662;';
        }
        if (open) this._renderHist(i, panel);
      });

      /* expansion */
      const mainVis = this._expanded ? 'block' : 'none';
      if ($.main.style.display !== mainVis) $.main.style.display = mainVis;

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
