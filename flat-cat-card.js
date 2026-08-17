/* flat-cat-card v1.22
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
 * v1.12: whole-card hover affordance (superseded by v1.13 same day).
 * v1.13: expand/collapse is now confined to the cat-rows HEADER ZONE
 * (Party-Mode-title pattern, owner request): tapping blank space in
 * the cat-rows block toggles the card and that zone highlights on
 * hover (rgba .05, suppressed while a cat row or history panel is
 * hovered); the rest of the card body is inert - blank space in the
 * litter/feeder/camera areas no longer collapses the card, only the
 * controls there do their own jobs. Card-level tap now only closes
 * an open More panel. Cat-row taps still open history panels;
 * with history: false, header-zone taps (rows included) just toggle.
 * v1.14: header zone bleeds to the card edges (negative margins,
 * padding restored) so its hover highlight spans full card width
 * with the card's top corner radius - a true title strip like the
 * Party Mode overlay, not an inner box. When the alert strip is
 * visible the zone yields the top edge to it (.withalert class).
 * v1.15: condensed header zone (mockup option A, 28px avatars kept):
 * zone padding 12/6 -> 8/4, row padding 3 -> 1, camera-strip gap
 * 10 -> 8. ~16px less empty space above the cameras; text, avatar,
 * and tap-target sizes unchanged.
 * v1.16: animated expand/collapse. The litter/feeder section is a
 * CSS grid whose row animates 0fr <-> 1fr at the house timing
 * (.35s cubic-bezier(.4,0,.2,1)) - same smooth height slide as the
 * dashboard's expander cards, no display toggling (which would kill
 * transitions, checklist item 7) and no JS height measurement. The
 * inner wrapper carries overflow:hidden with margin/padding
 * compensation so the edge-to-edge dividers aren't clipped.
 * v1.17: the per-cat history panels animate with the same grid-rows
 * technique. Each panel sits in an overflow-hidden grid wrapper
 * (0fr <-> 1fr); the panel's own vertical padding and the wrapper's
 * margins transition in step so the bordered box grows/shrinks
 * smoothly with no resting hairline while closed.
 * v1.18: fix for v1.17's resting hairlines - a 0fr grid track cannot
 * shrink an item below its BORDER widths, so each closed panel left
 * a squashed 2px border line under its cat row. The panel border now
 * animates 0 -> 1px with the open state, making the closed panel
 * truly zero-height.
 * v1.19: litter SETTINGS panel + feeder SCHEDULE panel (mockup v6,
 * approved 2026-08-11). Litter stats row now shows Maint (starts
 * maintenance directly; Clean moved into More); More panel is an even
 * 2x2 grid with no subtext: Clean / Level litter / Pause / Settings.
 * Settings panel (groups CLEANING / DEEP CLEANING / DEODORIZING /
 * BOX) exposes the PetKit smart settings as instant-write controls:
 * toggles -> switch.turn_on/off (8s optimistic overlay), cleaning
 * delay stepper -> number.set_value (800ms debounce, 0-60 min),
 * repeat interval stepper + litter type chips -> select.select_option
 * (options read live from the select entity; interval walks the
 * non-Disabled options). Deep deodorizing wires switch._deep_deodorizing;
 * the integration exposes a duplicate _2 entity - override per card
 * config `deep_deo_suffix: deep_deodorizing_2` if flip-testing shows
 * the duplicate is the live one. Scheduled cleaning/deodorizing and
 * screen display are on/off only - their times are not exposed by the
 * integration (app-side). Feeder block gains a Plan row: per-feeder
 * tabbed schedule panel reading the weekly meal plan from
 * sensor._raw_distribution_data attributes (feed_daily_list; meals
 * grouped across identical days), with a meal editor (time in 15-min
 * steps, grams in 5g steps, per-weekday dots, add/remove). Edits are
 * LOCAL until Save plan - petkit.set_feeding_schedule REPLACES the
 * feeder's entire weekly plan (device_id from the raw sensor's
 * attributes), so the save bar only appears when dirty and Cancel
 * reverts to the live plan. Manual feeds are untouched.
 * v1.20: child panels reset with their parents (owner request).
 * Closing the More panel (More button, outside-tap, or starting
 * maintenance) also closes the Settings panel; collapsing the card
 * from the header zone closes Settings AND the feeder Plan panel
 * (and any open meal editor), so both always reopen fresh. Unsaved
 * schedule edits survive in the local model (dirty flag persists) -
 * only the panel's open state resets.
 * v1.21: FEEDING PRESETS (mockup v7). Card YAML may define
 * `feeding_presets`: a list of {name, plans} where plans maps a
 * feeder PREFIX to its full meal list [{time, name, amount, days?}].
 * time = "9:00a"/"5:00p" style or 24h "HH:MM"; days = list of
 * mon..sun (default all 7). A PRESET row renders at the top of the
 * schedule panel (above the tabs - presets span feeders): one chip
 * per preset + a state readout. The ACTIVE chip is detected by
 * comparing each feeder's LIVE parsed plan against the preset's
 * definition (set equality on time+name+amount+days) - app-side or
 * editor edits flip the readout to "custom", the highlight never
 * lies. Tapping an inactive preset opens an amber confirm bar
 * (replaces BOTH weekly plans; discards any unsaved local edit);
 * Apply fires one set_feeding_schedule per feeder in the preset.
 * After apply the chip holds an optimistic "applied - syncing" state
 * (up to 10 min) until the cloud-polled raw sensor catches up and
 * live comparison takes over. Presets whose prefixes don't match a
 * configured feeder are ignored.
 * v1.22: the schedule UI moves from an inline panel to a POPUP MODAL
 * (mockup v9; house precedent: the vacuum card's profile popups).
 * Plan opens a fixed-overlay modal in the card's shadow root: header
 * (title + always-visible truth readout + close X), PLAN chip row =
 * VIEW SWITCHER (Current + one chip per preset; highlight = what you
 * are viewing, a check suffix marks the ACTIVE preset - independent
 * signals, so v1.21's blind confirm bar is gone). With modal width,
 * BOTH feeders render as color-keyed stacked sections (color from the
 * owning cat's configured color) - the feeder tabs are removed.
 * Preset views are READ-ONLY previews (no carets/editors/add-meal,
 * inert day dots) with a dashed banner naming the view; Apply (shown
 * only on inactive presets) writes both feeders in one tap - you are
 * looking at exactly what will be applied. LOAD INTO EDITOR (any
 * preset view, active included) copies the preset's meals for its
 * feeders into the Current draft (dirty, amber "loaded from X" tag),
 * jumps to Current, and nothing touches hardware until Save plans -
 * which writes ONLY feeders whose drafts are dirty; Discard reverts
 * to live. Modal closes via X, scrim tap, or Escape; the v1.20
 * parent-reset rules still apply (card collapse closes it). The
 * inline schedule panel is gone; the Settings panel remains inline.
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
      this._setOpen = false;       // litter settings panel open
      this._optSet = {};           // entity_id -> {state, until} optimistic overlay
      this._delayPend = null;      // pending cleaning-delay value while debouncing
      this._delayTimer = null;
      this._schedOpen = false;     // schedule modal open
      this._schedView = 'current'; // 'current' or preset index (number)
      this._sched = {};            // per-feeder {model, dirty, saving, doneUntil}
      this._schedEdit = null;      // meal key with editor open ("fi:idx")
      this._schedLoaded = null;    // preset name loaded into the draft, or null
      this._schedSaving = false;   // save-all in flight
      this._schedDone = 0;         // saved-flash timestamp
      this._presetOpt = null;      // {idx, until} optimistic applied state
      this._presetBusy = false;    // apply in flight
    }

    disconnectedCallback() {
      if (this._escHandler) window.removeEventListener('keydown', this._escHandler);
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
      const deepDeo = config.deep_deo_suffix || 'deep_deodorizing';
      this._setEnts = {
        autoClean: 'switch.' + lp + '_auto_clean',
        delay: 'number.' + lp + '_cleaning_delay',
        schedClean: 'switch.' + lp + '_periodic_cleaning',
        avoidRepeat: 'switch.' + lp + '_avoid_repeat_cleaning',
        repeatIvl: 'select.' + lp + '_avoid_repeat_cleaning_interval',
        deepClean: 'switch.' + lp + '_deep_cleaning',
        litterSave: 'switch.' + lp + '_litter_saving',
        wasteCover: 'switch.' + lp + '_waste_covering',
        autoDeo: 'switch.' + lp + '_auto_deodorizing',
        schedDeo: 'switch.' + lp + '_periodic_deodorizing',
        deepDeo: 'switch.' + lp + '_' + deepDeo,
        rotation: 'switch.' + lp + '_continuous_rotation',
        display: 'switch.' + lp + '_display',
        litterType: 'select.' + lp + '_litter_type',
        dnd: 'switch.' + lp + '_do_not_disturb',
        childLock: 'switch.' + lp + '_child_lock',
        kitten: 'switch.' + lp + '_kitten_mode'
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
          camera: 'camera.' + p,
          raw: 'sensor.' + p + '_raw_distribution_data'
        };
      });
      // feeding presets (v1.21): normalize to per-feeder-index meal lists
      const DAYNAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const parseTime = (t) => {
        if (typeof t === 'number') return t;
        const s = String(t).trim().toLowerCase();
        let m = s.match(/^(\d{1,2}):(\d{2})\s*(a|p)m?$/);
        if (m) {
          let h = Number(m[1]) % 12;
          if (m[3] === 'p') h += 12;
          return h * 3600 + Number(m[2]) * 60;
        }
        m = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
        return null;
      };
      this._presets = (config.feeding_presets || []).map((p) => {
        const plans = {};
        Object.keys(p.plans || {}).forEach((prefix) => {
          const fi = config.feeders.findIndex((f) => f.prefix === prefix);
          if (fi === -1) return;
          const meals = (p.plans[prefix] || []).map((mm) => {
            const time = parseTime(mm.time);
            const days = [false, false, false, false, false, false, false];
            if (mm.days && mm.days.length) {
              mm.days.forEach((d) => {
                const di = DAYNAMES.indexOf(String(d).toLowerCase().slice(0, 3));
                if (di !== -1) days[di] = true;
              });
            } else {
              days.fill(true);
            }
            return {
              time, name: mm.name || 'Meal',
              amount: Number(mm.amount) || 0, days
            };
          }).filter((mm) => mm.time != null && mm.amount > 0)
            .sort((a, b) => a.time - b.time);
          plans[fi] = meals;
        });
        return { name: p.name || 'Preset', plans };
      }).filter((p) => Object.keys(p.plans).length);
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
        <div class="histwrap" id="cat${i}histwrap" data-noexpand="1">
          <div class="histpanel" id="cat${i}hist"></div>
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
        #catblock {
          margin: -12px -14px 0;
          padding: 8px 14px 4px;
          border-radius: var(--ha-card-border-radius, 12px);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        #catblock.withalert { margin-top: 0; padding-top: 4px; }
        @media (hover: hover) {
          #catblock { cursor: pointer; transition: background .12s ease; }
          #catblock:hover:not(:has(.cathit:hover, .histpanel:hover)) {
            background: rgba(255,255,255,.05);
          }
          .histpanel { cursor: default; }
        }
        .row { display: flex; align-items: center; gap: 10px; }
        .grow { flex: 1; min-width: 0; }
        .primary { font-size: 13.5px; font-weight: 500; color: var(--primary-text-color); }
        .second { font-size: 12px; color: var(--secondary-text-color); margin-top: 1px; }
        .tert { font-size: 11px; color: rgba(160,160,160,.7); font-weight: 400; }
        .catrow { padding: 1px 24px 1px 0; }
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
        .main {
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1);
        }
        .main.open { grid-template-rows: 1fr; }
        .maininner { overflow: hidden; min-height: 0; margin: 0 -14px; padding: 0 14px; }
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
        .maintbtn.on { background: rgba(255,193,7,.16); color: ${AMBER_TXT}; }
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
        .camstrip { display: flex; gap: 10px; margin-top: 8px; }
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
        .histwrap {
          display: grid; grid-template-rows: 0fr; overflow: hidden; margin: 0;
          transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1),
                      margin .35s cubic-bezier(.4,0,.2,1);
        }
        .histwrap.open { grid-template-rows: 1fr; margin: 5px 0 6px; }
        .histpanel {
          overflow: hidden; min-height: 0;
          border: 0 solid var(--divider-color, rgba(255,255,255,.1));
          background: rgba(255,255,255,.03);
          border-radius: 10px;
          padding: 0 12px;
          transition: padding .35s cubic-bezier(.4,0,.2,1),
                      border-width .35s cubic-bezier(.4,0,.2,1);
        }
        .histwrap.open .histpanel { padding: 11px 12px; border-width: 1px; }
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
        .setpanel {
          display: none; border: 1px solid var(--divider-color, rgba(255,255,255,.1));
          background: rgba(255,255,255,.03); border-radius: 10px;
          padding: 8px 11px 10px; margin-top: 9px;
        }
        .grouphead {
          font-size: 10.5px; color: rgba(120,120,120,.9); font-weight: 600;
          letter-spacing: .4px; margin: 10px 0 2px;
        }
        .grouphead:first-child { margin-top: 2px; }
        .setrow { display: flex; align-items: center; gap: 10px; padding: 4px 0; min-height: 30px; }
        .setrow .slbl { font-size: 12.5px; color: var(--primary-text-color); }
        .setrow .ssub { font-size: 10.5px; color: rgba(160,160,160,.7); margin-top: 1px; line-height: 1.3; }
        .setrow.unavail { pointer-events: none; }
        .tgl {
          width: 34px; height: 20px; border-radius: 10px; flex: 0 0 auto;
          background: rgba(255,255,255,.10); position: relative; cursor: pointer;
          transition: background .15s ease;
        }
        .tgl::after {
          content: ''; position: absolute; top: 3px; left: 3px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #9e9e9e; transition: left .15s ease, background .15s ease;
        }
        .tgl.on { background: rgba(255,193,7,.35); }
        .tgl.on::after { left: 17px; background: ${AMBER_TXT}; }
        .stepper { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; }
        .stepbtn {
          width: 26px; height: 26px; border-radius: 13px;
          background: rgba(255,255,255,.06); color: #bdbdbd;
          font-size: 14px; border: none; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .stepval { font-size: 12.5px; color: var(--primary-text-color); font-weight: 500; min-width: 46px; text-align: center; }
        .stepval span { font-size: 10.5px; color: rgba(160,160,160,.7); font-weight: 400; }
        .mealrow { padding: 7px 0 5px; border-top: 1px solid var(--divider-color, rgba(255,255,255,.08)); }
        .mealrow.first { border-top: none; padding-top: 2px; }
        .mealtime { font-size: 13px; font-weight: 500; color: var(--primary-text-color); width: 56px; flex: 0 0 auto; }
        .mealmeta { font-size: 11px; color: var(--secondary-text-color); }
        .daydots { display: flex; gap: 4px; }
        .ddot {
          width: 17px; height: 17px; border-radius: 50%;
          font-size: 8.5px; font-weight: 600; cursor: pointer; border: none;
          font-family: inherit; padding: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.06); color: rgba(160,160,160,.55);
        }
        .ddot.on { background: rgba(255,193,7,.16); color: ${AMBER_TXT}; }
        .mealed { margin-top: 8px; padding: 9px 10px; border: 1px solid var(--divider-color, rgba(255,255,255,.08)); border-radius: 8px; background: rgba(255,255,255,.02); }
        .edlabel { font-size: 10px; color: rgba(120,120,120,.9); font-weight: 600; letter-spacing: .4px; width: 44px; flex: 0 0 auto; }
        .dangerbtn {
          height: 26px; padding: 0 11px; border-radius: 13px;
          background: rgba(244,67,54,.12); color: #ef9a9a;
          font-size: 11.5px; border: none; cursor: pointer; font-family: inherit;
        }
        .addmeal {
          margin-top: 6px; width: 100%; height: 30px; border-radius: 8px;
          background: none; border: 1px dashed rgba(255,255,255,.15);
          color: rgba(160,160,160,.7); font-size: 11.5px; cursor: pointer; font-family: inherit;
        }
        .savebar {
          display: flex; align-items: center; gap: 8px; margin-top: 10px;
          padding-top: 10px; border-top: 1px solid var(--divider-color, rgba(255,255,255,.08));
        }
        .savebar .snote { font-size: 10px; color: rgba(160,160,160,.7); line-height: 1.3; }
        .scrim {
          position: fixed; inset: 0; background: rgba(0,0,0,.55);
          display: none; align-items: center; justify-content: center;
          z-index: 9; padding: 16px;
        }
        .scrim.open { display: flex; }
        .modal {
          width: 480px; max-width: 94vw; max-height: 86vh; overflow-y: auto;
          background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
          border: 1px solid var(--ha-card-border-color, #343434);
          border-radius: var(--ha-card-border-radius, 12px);
          padding: 14px 16px 16px;
        }
        .mhead { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .mtitle { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
        .xbtn {
          width: 28px; height: 28px; border-radius: 14px; flex: 0 0 auto;
          background: rgba(255,255,255,.06); color: #bdbdbd; border: none;
          cursor: pointer; font-size: 13px; font-family: inherit;
        }
        .planbar {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 10px; margin-bottom: 10px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.08));
        }
        .previewbar {
          margin-bottom: 10px; padding: 8px 11px; border-radius: 8px;
          border: 1px dashed rgba(255,255,255,.2);
        }
        .previewbar .pnote { font-size: 9.5px; color: rgba(160,160,160,.7); margin-top: 5px; }
        .loadbtn {
          height: 26px; padding: 0 12px; border-radius: 13px;
          background: rgba(255,255,255,.06); color: var(--primary-text-color);
          font-size: 12px; border: 1px solid rgba(255,255,255,.15); cursor: pointer;
          font-family: inherit; white-space: nowrap;
        }
        .fdrhead {
          display: flex; align-items: center; gap: 8px;
          font-size: 10.5px; font-weight: 600; letter-spacing: .4px;
          margin: 12px 0 2px;
        }
        .fdrhead .fdot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
        .fdrhead .fsub { font-weight: 400; letter-spacing: 0; color: rgba(160,160,160,.7); font-size: 10px; }
        .loadedtag {
          display: inline-flex; align-items: center; height: 18px; padding: 0 8px;
          border-radius: 9px; background: rgba(255,193,7,.12); color: ${AMBER_TXT};
          font-size: 9.5px; font-weight: 600; margin-bottom: 6px;
        }
        .medcaret { color: rgba(160,160,160,.45); font-size: 10px; cursor: pointer; border: none; background: none; font-family: inherit; padding: 4px 2px 4px 6px; }
      </style>
      <ha-card id="card">
        <div class="alertstrip" id="alerts"></div>
        <div id="catblock" style="position:relative;">
          ${catRows}
          <div class="occdot" id="occdotc" title="litter box occupied"></div>
        </div>
        <div class="main" id="main">
          <div class="maininner" id="maininner">
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
              <button class="ghostbtn" id="maintstartbtn" data-noexpand="1">&#128295; Maint</button>
              <button class="ghostbtn" id="morebtn" data-noexpand="1">&#8943; More</button>
            </div>
            <div class="morepanel" id="morepanel" data-noexpand="1">
              <div class="row" style="gap:8px;">
                <button class="maintbtn" id="cleanbtn"><span>&#10227; Clean</span></button>
                <button class="maintbtn" id="levelbtn"><span>&#9776; Level litter</span></button>
              </div>
              <div class="row" style="gap:8px; margin-top:8px;">
                <button class="maintbtn" id="pausebtn"><span id="pauselbl">&#10073;&#10073; Pause</span></button>
                <button class="maintbtn" id="setsbtn"><span>&#9881; Settings</span></button>
              </div>
            </div>
            <div class="setpanel" id="setpanel" data-noexpand="1"></div>
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
            <div class="row" style="margin-top:10px;" data-noexpand="1">
              <div class="tert grow" id="schedsum">--</div>
              <button class="ghostbtn" id="planbtn">&#9201; Plan</button>
            </div>
          </div>
          </div>
        </div>
        <div class="camstrip" id="camstrip">
          ${camTiles}
        </div>
        <div class="scrim" id="schedscrim" data-noexpand="1">
          <div class="modal" id="schedmodal"></div>
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
      // card-level tap: ONLY closes an open More panel (outside-tap).
      // The card body is otherwise inert - expand/collapse lives on the
      // cat-rows header zone alone (v1.13).
      this.$.card.addEventListener('click', (e) => {
        if (!this._moreOpen) return;
        const path = e.composedPath();
        for (const el of path) {
          if (el === this.$.card) break;
          if ((el.dataset && el.dataset.noexpand && el.dataset.noexpand !== 'lp') ||
              el.tagName === 'BUTTON') return;
        }
        this._moreOpen = false;
        this._setOpen = false;
        this._update();
      });

      // header zone (cat-rows block): tap blank area = expand/collapse
      this.$.catblock.addEventListener('click', (e) => {
        const path = e.composedPath();
        for (const el of path) {
          if (el === this.$.catblock) break;
          if (el.dataset && el.dataset.noexpand) {
            if (el.dataset.noexpand === 'lp') break; // cat rows fall through only when history is disabled
            return;
          }
          if (el.tagName === 'BUTTON') return;
        }
        this._expanded = !this._expanded;
        if (!this._expanded) {
          this._histOpen = -1;
          this._setOpen = false;
          this._schedOpen = false;
          this._schedEdit = null;
        }
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
        if (!this._moreOpen) this._setOpen = false;
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
        this._setOpen = false;
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

      // settings panel toggle + delegated controls (v1.19)
      this.$.setsbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setOpen = !this._setOpen;
        this._update();
      });
      this.$.setpanel.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = e.target.closest('[data-tgl],[data-step],[data-lt]');
        if (!t) return;
        if (t.dataset.tgl) this._tglSw(t.dataset.tgl);
        else if (t.dataset.step) this._setStep(t.dataset.step, Number(t.dataset.d));
        else if (t.dataset.lt) this._selOption(this._setEnts.litterType, t.dataset.lt);
      });

      // feeding-plans modal (v1.22): open/close + delegated controls
      this.$.planbtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._schedOpen = !this._schedOpen;
        if (!this._schedOpen) this._schedEdit = null;
        this._update();
      });
      this.$.schedscrim.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === this.$.schedscrim) {
          this._schedOpen = false; this._schedEdit = null; this._update();
        }
      });
      this._escHandler = (e) => {
        if (e.key === 'Escape' && this._schedOpen) {
          this._schedOpen = false; this._schedEdit = null; this._update();
        }
      };
      window.addEventListener('keydown', this._escHandler);
      this.$.schedmodal.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = e.target.closest(
          '[data-view],[data-vapply],[data-pload],[data-pclose],[data-medit],[data-mstep],[data-mday],[data-mdel],[data-madd],[data-msaveall],[data-mdiscard]');
        if (!t) return;
        const d = t.dataset;
        if (d.view !== undefined) {
          this._schedView = d.view === 'current' ? 'current' : Number(d.view);
          this._schedEdit = null;
        } else if (d.vapply !== undefined) {
          this._presetApply();
        } else if (d.pload !== undefined) {
          this._loadPreset();
        } else if (d.pclose !== undefined) {
          this._schedOpen = false; this._schedEdit = null;
        } else if (d.medit !== undefined) {
          this._schedEdit = this._schedEdit === d.medit ? null : d.medit;
        } else if (d.mstep !== undefined) {
          this._mealStep(d.mstep, Number(d.fi), Number(d.idx), Number(d.d));
        } else if (d.mday !== undefined) {
          this._mealDay(Number(d.fi), Number(d.idx), Number(d.mday));
        } else if (d.mdel !== undefined) {
          this._mealDel(Number(d.fi), Number(d.idx));
        } else if (d.madd !== undefined) {
          this._mealAdd(Number(d.fi));
        } else if (d.msaveall !== undefined) {
          this._schedSaveAll();
        } else if (d.mdiscard !== undefined) {
          this._schedDiscard();
        }
        this._update();
      });
    }

    /* ---------------- litter settings (v1.19) ---------------- */

    _setOn(ent) {
      const o = this._optSet[ent];
      if (o && Date.now() < o.until) return o.state === 'on';
      return this._isOn(ent);
    }

    _tglSw(ent) {
      const on = this._setOn(ent);
      this._optSet[ent] = { state: on ? 'off' : 'on', until: Date.now() + OPT_MS };
      this._hass.callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: ent });
      this._update();
    }

    _selOption(ent, opt) {
      this._optSet[ent] = { state: opt, until: Date.now() + OPT_MS };
      this._hass.callService('select', 'select_option', { entity_id: ent, option: opt });
      this._update();
    }

    _selVal(ent) {
      const o = this._optSet[ent];
      if (o && Date.now() < o.until) return o.state;
      return this._sv(ent);
    }

    _setStep(which, d) {
      if (which === 'delay') {
        const st = this._st(this._setEnts.delay);
        const min = st && st.attributes.min != null ? Number(st.attributes.min) : 0;
        const max = st && st.attributes.max != null ? Number(st.attributes.max) : 60;
        const cur = this._delayPend != null ? this._delayPend
          : (this._num(this._setEnts.delay) || 0);
        this._delayPend = Math.max(min, Math.min(max, cur + d));
        clearTimeout(this._delayTimer);
        this._delayTimer = setTimeout(() => {
          const v = this._delayPend;
          this._delayPend = null;
          if (v != null) {
            this._optSet[this._setEnts.delay] = { state: String(v), until: Date.now() + OPT_MS };
            this._hass.callService('number', 'set_value', {
              entity_id: this._setEnts.delay, value: v
            });
          }
        }, 800);
      } else if (which === 'repeat') {
        const st = this._st(this._setEnts.repeatIvl);
        const opts = (st && st.attributes.options
          ? st.attributes.options.filter((o) => o !== 'Disabled') : []);
        if (!opts.length) return;
        const cur = this._selVal(this._setEnts.repeatIvl);
        let idx = opts.indexOf(cur);
        if (idx === -1) idx = 0; else idx = Math.max(0, Math.min(opts.length - 1, idx + d));
        this._selOption(this._setEnts.repeatIvl, opts[idx]);
        return;
      }
      this._update();
    }

    _setRowHtml(lbl, sub, control, unavailable) {
      return '<div class="setrow' + (unavailable ? ' unavail' : '') + '">' +
        '<div class="grow"><div class="slbl">' + lbl + '</div>' +
        (sub ? '<div class="ssub">' + sub + '</div>' : '') + '</div>' + control + '</div>';
    }

    _tglHtml(ent) {
      const missing = !this._st(ent);
      return '<div class="tgl' + (this._setOn(ent) ? ' on' : '') +
        '" data-tgl="' + ent + '"' + (missing ? ' style="opacity:.3;"' : '') + '></div>';
    }

    _renderSetPanel() {
      const $ = this.$;
      const E = this._setEnts;
      const delayShow = this._delayPend != null ? this._delayPend
        : (this._selVal(E.delay) != null ? Math.round(Number(this._selVal(E.delay))) : null);
      const rep = this._selVal(E.repeatIvl) || '--';
      const lt = this._selVal(E.litterType);
      const ltSt = this._st(E.litterType);
      const ltOpts = ltSt && ltSt.attributes.options ? ltSt.attributes.options : [];
      const key = [delayShow, rep, lt,
        E.autoClean, this._setOn(E.autoClean), this._setOn(E.schedClean),
        this._setOn(E.avoidRepeat), this._setOn(E.deepClean), this._setOn(E.litterSave),
        this._setOn(E.wasteCover), this._setOn(E.autoDeo), this._setOn(E.schedDeo),
        this._setOn(E.deepDeo), this._setOn(E.rotation), this._setOn(E.display),
        this._setOn(E.dnd), this._setOn(E.childLock), this._setOn(E.kitten),
        ltOpts.join(',')].join('|');
      if ($.setpanel.dataset.render === key) return;
      $.setpanel.dataset.render = key;
      const stepperHtml = (which, valHtml) =>
        '<div class="stepper">' +
        '<button class="stepbtn" data-step="' + which + '" data-d="-1">&#8722;</button>' +
        '<div class="stepval">' + valHtml + '</div>' +
        '<button class="stepbtn" data-step="' + which + '" data-d="1">+</button></div>';
      const ltChips = '<div class="chips" style="flex:0 0 auto;">' +
        ltOpts.map((o) => '<button class="pchip' + (o === lt ? ' sel' : '') +
          '" data-lt="' + this._esc(o) + '">' + this._esc(o) + '</button>').join('') +
        '</div>';
      $.setpanel.innerHTML =
        '<div class="grouphead">CLEANING</div>' +
        this._setRowHtml('Auto clean', 'cycle after each visit', this._tglHtml(E.autoClean)) +
        this._setRowHtml('Cleaning delay', 'wait after cat exits',
          stepperHtml('delay', (delayShow == null ? '--' : delayShow) + ' <span>min</span>')) +
        this._setRowHtml('Scheduled cleaning', 'scheduled cycles &middot; times set in PetKit app',
          this._tglHtml(E.schedClean)) +
        this._setRowHtml('Avoid repeat cleaning', 'skip re-clean within interval',
          this._tglHtml(E.avoidRepeat)) +
        this._setRowHtml('Repeat interval', 'fixed steps: 5m&#8211;2h',
          stepperHtml('repeat', this._esc(rep))) +
        '<div class="grouphead">DEEP CLEANING</div>' +
        this._setRowHtml('Deep cleaning', 'extended sift cycle', this._tglHtml(E.deepClean)) +
        this._setRowHtml('Litter saving', 'use less litter per cycle', this._tglHtml(E.litterSave)) +
        this._setRowHtml('Waste covering', 'bury waste during the delay', this._tglHtml(E.wasteCover)) +
        '<div class="grouphead">DEODORIZING</div>' +
        this._setRowHtml('Auto deodorizing', 'spray cycle after cleans', this._tglHtml(E.autoDeo)) +
        this._setRowHtml('Scheduled deodorizing', 'scheduled runs &middot; times set in PetKit app',
          this._tglHtml(E.schedDeo)) +
        this._setRowHtml('Deep deodorizing', 'intensive deodorize cycle', this._tglHtml(E.deepDeo)) +
        '<div class="grouphead">BOX</div>' +
        this._setRowHtml('Uninterrupted rotation', 'no pause mid-cycle', this._tglHtml(E.rotation)) +
        this._setRowHtml('Screen display', 'on-box screen &middot; schedule set in PetKit app',
          this._tglHtml(E.display)) +
        this._setRowHtml('Litter type', '', ltChips) +
        this._setRowHtml('Do not disturb', 'quiet hours per app schedule', this._tglHtml(E.dnd)) +
        this._setRowHtml('Child lock', 'panel buttons disabled', this._tglHtml(E.childLock)) +
        this._setRowHtml('Kitten mode',
          '<span style="color:' + AMBER_TXT + ';">&#9888; disables all auto-cleaning</span>',
          this._tglHtml(E.kitten));
    }

    /* ---------------- feeder schedule (v1.19) ---------------- */

    _fmtSec(sec) {
      let h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
      const ap = h >= 12 ? 'p' : 'a';
      h = h % 12; if (h === 0) h = 12;
      return h + ':' + String(m).padStart(2, '0') + ap;
    }

    _parseSched(i) {
      const st = this._st(this._fdrs[i].raw);
      if (!st || !st.attributes.feed_daily_list) return null;
      const byKey = {};
      st.attributes.feed_daily_list.forEach((day) => {
        const d = Number(day.repeats) - 1;
        if (d < 0 || d > 6) return;
        (day.items || []).forEach((it) => {
          const key = it.time + '|' + (it.name || '') + '|' + it.amount;
          if (!byKey[key]) {
            byKey[key] = {
              time: Number(it.time), name: it.name || 'Meal',
              amount: Number(it.amount) || 0,
              days: [false, false, false, false, false, false, false]
            };
          }
          byKey[key].days[d] = true;
        });
      });
      const meals = Object.values(byKey).sort((a, b) => a.time - b.time);
      return { meals, deviceId: st.attributes.device_id };
    }

    _schedLocal(i) {
      let s = this._sched[i];
      if (!s || (!s.dirty && !s.saving)) {
        const live = this._parseSched(i);
        s = this._sched[i] = {
          model: live ? live.meals.map((m) => ({
            time: m.time, name: m.name, amount: m.amount, days: m.days.slice()
          })) : null,
          deviceId: live ? live.deviceId : null,
          dirty: (s && s.dirty) || false,
          saving: (s && s.saving) || false,
          doneUntil: (s && s.doneUntil) || 0
        };
      }
      return s;
    }

    _daysSum(days) {
      const n = days.filter(Boolean).length;
      if (n === 7) return 'daily';
      if (n === 5 && days[0] && days[1] && days[2] && days[3] && days[4]) return 'M&#8211;F';
      if (n === 2 && days[5] && days[6]) return 'weekends';
      return n + 'd/wk';
    }

    _mealStep(which, fi, idx, d) {
      const s = this._sched[fi];
      if (!s || !s.model || !s.model[idx]) return;
      const m = s.model[idx];
      if (which === 'time') m.time = (m.time + d * 900 + 86400) % 86400;
      else if (which === 'grams') m.amount = Math.max(5, Math.min(100, m.amount + d * 5));
      s.dirty = true;
    }

    _mealDay(fi, idx, day) {
      const s = this._sched[fi];
      if (!s || !s.model || !s.model[idx]) return;
      const m = s.model[idx];
      const n = m.days.filter(Boolean).length;
      if (m.days[day] && n <= 1) return; // keep at least one day
      m.days[day] = !m.days[day];
      s.dirty = true;
    }

    _mealDel(fi, idx) {
      const s = this._sched[fi];
      if (!s || !s.model) return;
      s.model.splice(idx, 1);
      s.dirty = true;
      this._schedEdit = null;
    }

    _mealAdd(fi) {
      const s = this._schedLocal(fi);
      if (!s.model) s.model = [];
      s.model.push({
        time: 28800, name: 'Meal', amount: 10,
        days: [true, true, true, true, true, true, true]
      });
      s.dirty = true;
      this._schedEdit = fi + ':' + (s.model.length - 1);
    }

    _schedDiscard() {
      this._sched = {};
      this._schedEdit = null;
      this._schedLoaded = null;
      this._schedErr = null;
    }

    _anyDirty() {
      return this._fdrs.some((f, i) => this._sched[i] && this._sched[i].dirty);
    }

    _schedSaveAll() {
      if (this._schedSaving) return;
      const jobs = [];
      this._fdrs.forEach((f, i) => {
        const s = this._sched[i];
        if (!s || !s.dirty || !s.model || s.deviceId == null) return;
        const list = [];
        for (let d = 1; d <= 7; d++) {
          list.push({
            repeats: d, suspended: 0,
            items: s.model.filter((m) => m.days[d - 1])
              .sort((a, b) => a.time - b.time)
              .map((m) => ({ time: m.time, name: m.name, amount: m.amount }))
          });
        }
        jobs.push({ s, call: () => this._hass.callService('petkit', 'set_feeding_schedule', {
          device_id: Number(s.deviceId), feed_daily_list: list
        }) });
      });
      if (!jobs.length) return;
      this._schedSaving = true;
      this._schedErr = null;
      this._update();
      Promise.all(jobs.map((j) => j.call())).then(() => {
        jobs.forEach((j) => { j.s.dirty = false; });
        this._schedSaving = false;
        this._schedDone = Date.now() + 1500;
        this._schedLoaded = null;
        this._schedEdit = null;
        setTimeout(() => this._update(), 1600);
        this._update();
      }).catch(() => {
        this._schedSaving = false;
        this._schedErr = 'save failed';
        this._update();
      });
    }

    _loadPreset() {
      const pi = this._schedView;
      const preset = this._presets[pi];
      if (typeof pi !== 'number' || !preset) return;
      Object.keys(preset.plans).forEach((fiStr) => {
        const fi = Number(fiStr);
        const live = this._parseSched(fi);
        this._sched[fi] = {
          model: preset.plans[fi].map((m) => ({
            time: m.time, name: m.name, amount: m.amount, days: m.days.slice()
          })),
          deviceId: live ? live.deviceId : null,
          dirty: true, saving: false, doneUntil: 0
        };
      });
      this._schedLoaded = preset.name;
      this._schedEdit = null;
      this._schedView = 'current';
    }

    _mealKey(m) {
      return m.time + '|' + m.name + '|' + m.amount + '|' +
        m.days.map((d) => (d ? 1 : 0)).join('');
    }

    _presetActive() {
      // optimistic window after an apply, until live data catches up
      if (this._presetOpt && Date.now() < this._presetOpt.until) {
        if (this._presetMatchesLive(this._presetOpt.idx)) {
          this._presetOpt = null; // live caught up - genuine from here
          return this._presetMatchesLiveIdx();
        }
        return this._presetOpt.idx;
      }
      return this._presetMatchesLiveIdx();
    }

    _presetMatchesLiveIdx() {
      for (let p = 0; p < this._presets.length; p++) {
        if (this._presetMatchesLive(p)) return p;
      }
      return -1;
    }

    _presetMatchesLive(p) {
      const preset = this._presets[p];
      if (!preset) return false;
      const idxs = Object.keys(preset.plans);
      for (const fi of idxs) {
        const live = this._parseSched(Number(fi));
        if (!live) return false;
        const a = live.meals.map((m) => this._mealKey(m)).sort();
        const b = preset.plans[fi].map((m) => this._mealKey(m)).sort();
        if (a.length !== b.length) return false;
        for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false;
      }
      return true;
    }

    _presetApply() {
      const pi = this._schedView;
      const preset = this._presets[pi];
      if (typeof pi !== 'number' || !preset || this._presetBusy) return;
      const jobs = [];
      Object.keys(preset.plans).forEach((fiStr) => {
        const fi = Number(fiStr);
        const live = this._parseSched(fi);
        if (!live || live.deviceId == null) return;
        const list = [];
        for (let d = 1; d <= 7; d++) {
          list.push({
            repeats: d, suspended: 0,
            items: preset.plans[fi].filter((m) => m.days[d - 1])
              .map((m) => ({ time: m.time, name: m.name, amount: m.amount }))
          });
        }
        jobs.push(this._hass.callService('petkit', 'set_feeding_schedule', {
          device_id: Number(live.deviceId), feed_daily_list: list
        }));
      });
      if (!jobs.length) { this._update(); return; }
      this._presetBusy = true;
      this._update();
      Promise.all(jobs).then(() => {
        this._presetBusy = false;
        this._presetOpt = { idx: pi, until: Date.now() + 600000 };
        // discard local schedule edits - the preset replaced the plans
        this._sched = {};
        this._schedEdit = null;
        this._schedLoaded = null;
        this._update();
      }).catch(() => {
        this._presetBusy = false;
        this._presetErr = 'preset apply failed';
        this._update();
      });
    }

    _catColorFor(f) {
      const c = this._cfg.cats.find((cc) =>
        f.owner && cc.name.toLowerCase() === f.owner.toLowerCase());
      return (c && c.color) || AMBER_TXT;
    }

    _mealRowsHtml(meals, fi, editable) {
      const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      if (!meals || !meals.length) {
        return '<div class="mealrow first"><div class="mealmeta">no meals scheduled</div></div>';
      }
      return meals.map((m, idx) => {
        const ek = fi + ':' + idx;
        const dots = '<div class="daydots"' + (editable ? '' : ' style="opacity:.75;"') + '>' +
          m.days.map((on, d) =>
            (editable && this._schedEdit === ek)
              ? '<button class="ddot' + (on ? ' on' : '') + '" data-mday="' + d +
                '" data-fi="' + fi + '" data-idx="' + idx + '">' + DL[d] + '</button>'
              : '<span class="ddot' + (on ? ' on' : '') + '">' + DL[d] + '</span>'
          ).join('') + '</div>';
        let ed = '';
        if (editable && this._schedEdit === ek) {
          ed = '<div class="mealed">' +
            '<div class="row" style="margin-bottom:8px;"><div class="edlabel">TIME</div>' +
            '<div class="stepper">' +
            '<button class="stepbtn" data-mstep="time" data-fi="' + fi + '" data-idx="' + idx + '" data-d="-1">&#8722;</button>' +
            '<div class="stepval" style="min-width:56px;">' + this._fmtSec(m.time) + '</div>' +
            '<button class="stepbtn" data-mstep="time" data-fi="' + fi + '" data-idx="' + idx + '" data-d="1">+</button></div>' +
            '<div class="tert">15-min steps</div></div>' +
            '<div class="row"><div class="edlabel">GRAMS</div>' +
            '<div class="stepper">' +
            '<button class="stepbtn" data-mstep="grams" data-fi="' + fi + '" data-idx="' + idx + '" data-d="-1">&#8722;</button>' +
            '<div class="stepval">' + m.amount + ' <span>g</span></div>' +
            '<button class="stepbtn" data-mstep="grams" data-fi="' + fi + '" data-idx="' + idx + '" data-d="1">+</button></div>' +
            '<div class="grow"></div>' +
            '<button class="dangerbtn" data-mdel="1" data-fi="' + fi + '" data-idx="' + idx + '">Remove</button></div>' +
            '</div>';
        }
        return '<div class="mealrow' + (idx === 0 ? ' first' : '') + '">' +
          '<div class="row">' +
          '<div class="mealtime">' + this._fmtSec(m.time) + '</div>' +
          '<div class="grow"><div class="mealmeta">' + this._esc(m.name) + ' &middot; ' +
          m.amount + ' g &middot; ' + this._daysSum(m.days) + '</div></div>' +
          dots +
          (editable ? '<button class="medcaret" data-medit="' + ek + '">' +
            (this._schedEdit === ek ? '&#9652;' : '&#9662;') + '</button>' : '') +
          '</div>' + ed + '</div>';
      }).join('');
    }

    _renderSched() {
      const $ = this.$;
      const view = this._schedView;
      const active = this._presets.length ? this._presetActive() : -1;
      const modelsKey = this._fdrs.map((f, i) => {
        const s = this._sched[i];
        return s ? JSON.stringify([s.model, s.dirty]) : 'live:' +
          JSON.stringify((this._parseSched(i) || {}).meals || null);
      }).join('~');
      const key = JSON.stringify([view, active, this._schedEdit, modelsKey,
        this._schedLoaded, this._schedSaving, this._schedDone > Date.now(),
        this._schedErr || '', this._presetBusy, this._presetErr || '']);
      if ($.schedmodal.dataset.render === key) return;
      $.schedmodal.dataset.render = key;

      const syncing = this._presetOpt && Date.now() < this._presetOpt.until &&
        !this._presetMatchesLive(this._presetOpt.idx);
      const stateTxt = this._presetErr ? this._presetErr
        : (this._schedErr ? this._schedErr
          : (active === -1
            ? 'custom'
            : this._esc(this._presets[active].name) +
              (syncing ? ' applied \u00b7 syncing' : ' active')));
      const stateFull = stateTxt +
        (this._anyDirty() && !this._schedSaving ? ' \u00b7 draft pending' : '');

      const head = '<div class="mhead">' +
        '<div class="mtitle">Feeding plans</div><div class="grow"></div>' +
        '<div class="tert">' + stateFull + '</div>' +
        '<button class="xbtn" data-pclose="1">&#10005;</button></div>';

      let planbar = '';
      if (this._presets.length) {
        planbar = '<div class="planbar">' +
          '<div class="grouphead" style="margin:0; flex:0 0 auto;">PLAN</div>' +
          '<div class="chips">' +
          '<button class="pchip' + (view === 'current' ? ' sel' : '') +
          '" data-view="current">Current</button>' +
          this._presets.map((p, j) =>
            '<button class="pchip' + (j === view ? ' sel' : '') + '" data-view="' + j + '">' +
            this._esc(p.name) + (j === active ? ' &#10003;' : '') + '</button>').join('') +
          '</div></div>';
      }

      let previewbar = '';
      if (typeof view === 'number' && this._presets[view]) {
        const pname = this._esc(this._presets[view].name);
        const isActive = view === active;
        previewbar = '<div class="previewbar">' +
          '<div class="row">' +
          '<div class="tert grow">Previewing <b style="color:var(--primary-text-color);">' +
          pname + '</b>' + (isActive ? ' \u00b7 ACTIVE \u2014 live plans match'
            : ' \u00b7 read-only') + '</div>' +
          '<button class="loadbtn" data-pload="1">&#9998; Load into editor</button>' +
          (isActive ? '' :
            '<button class="feedbtn" data-vapply="1"' + (this._presetBusy ? ' disabled' : '') +
            '>' + (this._presetBusy ? 'Applying&hellip;' : 'Apply') + '</button>') +
          '</div>' +
          '<div class="pnote">' + (isActive
            ? 'Load copies these meals into Current for tweaking'
            : 'Apply replaces BOTH feeders\' weekly plans' +
              (this._anyDirty() ? ' \u00b7 discards unsaved edits' : '') +
              ' \u00b7 Load copies these meals into Current for tweaking without applying') +
          '</div></div>';
      }

      let body = '';
      if (view === 'current' && this._schedLoaded) {
        body += '<div><span class="loadedtag">loaded from ' + this._esc(this._schedLoaded) +
          ' \u2014 not yet on feeders</span></div>';
      }
      this._fdrs.forEach((f, fi) => {
        const col = this._catColorFor(f);
        const ownerTxt = f.owner ? this._esc(f.owner.toUpperCase()) : this._esc(f.label.toUpperCase());
        body += '<div class="fdrhead"><span class="fdot" style="background:' + col + ';"></span>' +
          '<span style="color:' + col + ';">' + ownerTxt + '</span>' +
          '<span class="fsub">\u00b7 ' + this._esc(f.label) + '</span></div>';
        if (view === 'current') {
          const s = this._schedLocal(fi);
          if (!s.model) {
            body += '<div class="mealrow first"><div class="mealmeta">schedule unavailable \u00b7 raw sensor missing</div></div>';
          } else {
            body += this._mealRowsHtml(s.model, fi, true) +
              '<button class="addmeal" data-madd="1" data-fi="' + fi + '">+ Add meal</button>';
          }
        } else {
          const preset = this._presets[view];
          const meals = preset.plans[fi];
          if (!meals) {
            body += '<div class="mealrow first"><div class="mealmeta">not in this preset \u2014 unchanged</div></div>';
          } else {
            body += this._mealRowsHtml(meals, fi, false);
          }
        }
      });

      let savebar = '';
      if (view === 'current' &&
          (this._anyDirty() || this._schedSaving || this._schedDone > Date.now() || this._schedErr)) {
        const note = this._schedErr ? this._schedErr
          : (this._schedLoaded
            ? 'Loaded from ' + this._esc(this._schedLoaded) + ' \u2014 saving writes both feeders\' weekly plans'
            : 'Saving replaces each edited feeder\'s full weekly plan');
        const btnTxt = this._schedSaving ? 'Saving&hellip;'
          : (this._schedDone > Date.now() ? 'Saved &#10003;' : 'Save plans');
        savebar = '<div class="savebar">' +
          '<div class="snote grow">' + note + '</div>' +
          (this._anyDirty() && !this._schedSaving
            ? '<button class="ghostbtn" data-mdiscard="1">Discard</button>' : '') +
          '<button class="feedbtn" data-msaveall="1"' +
          ((this._schedSaving || !this._anyDirty()) ? ' disabled' : '') + '>' + btnTxt + '</button></div>';
      }

      $.schedmodal.innerHTML = head + planbar + previewbar + body + savebar;
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
        const wrap = $['cat' + i + 'histwrap'];
        if (wrap) wrap.classList.toggle('open', open);
        if (car && car.dataset.open !== String(open)) {
          car.dataset.open = String(open);
          car.innerHTML = open ? '&#9652;' : '&#9662;';
        }
        if (open) this._renderHist(i, panel);
      });

      /* expansion (grid-rows 0fr->1fr animates the height) */
      $.main.classList.toggle('open', this._expanded);

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

      /* settings panel (v1.19) */
      const sv = this._setOpen && this._moreOpen && !showMaint ? 'block' : 'none';
      if ($.setpanel.style.display !== sv) $.setpanel.style.display = sv;
      $.setsbtn.classList.toggle('on', this._setOpen);
      if (sv === 'block') this._renderSetPanel();

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

      /* feeder schedule (v1.19) */
      const todayIdx = (new Date().getDay() + 6) % 7; // Mon = 0
      const sumTxt = 'scheduled: ' + this._fdrs.map((f, j) => {
        const live = this._parseSched(j);
        if (!live) return (f.owner || f.label) + ' --';
        const todays = live.meals.filter((m) => m.days[todayIdx]);
        const g = todays.reduce((a, m) => a + m.amount, 0);
        return (f.owner || f.label) + ' ' + todays.length + 'x/' + g + 'g';
      }).join(' \u00b7 ');
      if ($.schedsum.textContent !== sumTxt) $.schedsum.textContent = sumTxt;
      $.schedscrim.classList.toggle('open', this._schedOpen);
      $.planbtn.classList.toggle('open', this._schedOpen);
      if (this._schedOpen) this._renderSched();

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
      $.catblock.classList.toggle('withalert', alerts.length > 0);
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
