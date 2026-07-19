/* flat-party-card v1.3
   Bespoke party-mode control card for the main dashboard's Party Mode expander.
   v1.1: Govee effect chips wrap onto multiple lines instead of clipping in a
   horizontal scroller (mouse-wheel scrolling was unusable on desktop).
   v1.2: per-row pencil edits the fixture's chip list against its FULL native
   effect catalog (read live from the light entity's effect_list); Save
   persists via the admin WebSocket API (input_select/update - survives HA
   restarts, admin users only). "None" is pinned and cannot be edited away.
   v1.3: the editor is now a popup dialog (mockup-approved): fixture title +
   selected count, live search filter, scrollable catalog cloud, Cancel /
   "Save N chips" footer, backdrop-tap cancels. Rendered inside the card's
   shadow DOM as a fixed overlay - zero dependencies, no browser_mod.
   Controls the party_mode system: color swatches + inline hue/sat wheel, motion
   chips (Static/Pulse/Cycle/Chase), per-fixture Govee native-effect overrides,
   party brightness, room freeze pills, and Reset.

   HOW-TO (hosting/update):
   - This source ships as a base64 data: URL module in the dashboard resource
     registry: data:text/javascript;name=flat-party-card;base64,<blob>
     (stored in .storage/lovelace_resources, included in HA backups).
   - To read/edit: decode the base64, edit, re-encode, then update the resource
     via the Card Manager card's guarded update flow (preferred) or
     Settings > Dashboards > Resources (paste the new data: URL).
   - The card renders with NO ha-card wrapper (transparent, borderless) so it
     blends into an expander-card children grid without card_mod.

   Card YAML (all keys optional - defaults target the party_mode helpers):
     type: custom:flat-party-card
     # color_entity: input_text.lighting_party_mode_color
     # motion_entity: input_select.lighting_party_mode_motion
     # brightness_entity: input_number.lighting_party_mode_brightness
     # set_color_script: script.lighting_party_mode_set_color
     # reset_script: script.lighting_party_mode_reset_rooms_to_schedule
     # swatches: [{n: Purple, h: 291, s: 78}, {n: Sunset, h: 20, s: 95}]
     # govee:
     #   - {name: K Bars, entity: input_select.lighting_party_mode_govee_bars}
     # rooms:
     #   - {name: Living Rm, entity: input_boolean.lighting_party_mode_lr}
*/
(function () {
  'use strict';

  var ACCENT = '#ba68c8';               /* party purple (theme primary is green - never theme vars) */
  var CHIP_ON_BG = 'rgba(186,104,200,.16)';
  var CHIP_ON_BD = 'rgba(186,104,200,.25)';
  var CHIP_ON_TX = '#e5c1f0';
  var TRACK_BG = 'rgba(70,70,70,.3)';
  var PRESS_WASH = 'rgba(70,70,70,.22)';
  var OPT_MS = 8000;                    /* optimistic hold */
  var LP_MS = 550;                      /* long-press for more-info */

  var DEFAULTS = {
    color_entity: 'input_text.lighting_party_mode_color',
    motion_entity: 'input_select.lighting_party_mode_motion',
    brightness_entity: 'input_number.lighting_party_mode_brightness',
    set_color_script: 'script.lighting_party_mode_set_color',
    reset_script: 'script.lighting_party_mode_reset_rooms_to_schedule',
    swatches: [
      { n: 'Purple', h: 291, s: 78 },
      { n: 'Sunset', h: 20, s: 95 },
      { n: 'Ocean', h: 190, s: 90 },
      { n: 'Crimson', h: 0, s: 90 },
      { n: 'Lime', h: 130, s: 85 }
    ],
    govee: [
      { name: 'K Bars', entity: 'input_select.lighting_party_mode_govee_bars', light: 'light.kitchen_govee_light_bars' },
      { name: 'Floor', entity: 'input_select.lighting_party_mode_govee_floor', light: 'light.living_room_govee_floor_lamp' },
      { name: 'Desk', entity: 'input_select.lighting_party_mode_govee_desk', light: 'light.living_room_govee_desk_lamp' }
    ],
    rooms: [
      { name: 'Living Rm', entity: 'input_boolean.lighting_party_mode_lr' },
      { name: 'Kitchen', entity: 'input_boolean.lighting_party_mode_kitchen' },
      { name: 'Guest', entity: 'input_boolean.lighting_party_mode_guest_bed' }
    ]
  };

  var MOTIONS = ['Static', 'Pulse', 'Cycle', 'Chase'];

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function hslCss(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + (l == null ? 50 : l) + '%)'; }

  var CardClass = function () {
    var self = Reflect.construct(HTMLElement, [], CardClass);
    self._opt = {};       /* key -> {v, until} */
    self._built = false;
    self._wheelOpen = false;
    self._drag = null;
    return self;
  };
  CardClass.prototype = Object.create(HTMLElement.prototype);
  CardClass.prototype.constructor = CardClass;
  Object.setPrototypeOf(CardClass, HTMLElement);

  CardClass.prototype.setConfig = function (config) {
    var c = {};
    for (var k in DEFAULTS) c[k] = (config && config[k] !== undefined) ? config[k] : DEFAULTS[k];
    this._cfg = c;
  };

  CardClass.prototype.getCardSize = function () { return 7; };

  Object.defineProperty(CardClass.prototype, 'hass', {
    set: function (hass) {
      this._hass = hass;
      if (!this._cfg) return;
      if (!this._built) this._build();
      this._update();
    },
    get: function () { return this._hass; }
  });

  /* ---------- state helpers ---------- */

  CardClass.prototype._st = function (eid) {
    var s = this._hass && this._hass.states[eid];
    return s ? s.state : null;
  };

  CardClass.prototype._optGet = function (key, live) {
    var o = this._opt[key];
    if (o && Date.now() < o.until) return o.v;
    return live;
  };

  CardClass.prototype._optSet = function (key, v) {
    this._opt[key] = { v: v, until: Date.now() + OPT_MS };
  };

  CardClass.prototype._hs = function () {
    var raw = this._optGet('color', this._st(this._cfg.color_entity) || '291,78');
    var p = String(raw).split(',');
    var h = parseFloat(p[0]); var s = parseFloat(p[1]);
    if (isNaN(h)) h = 291; if (isNaN(s)) s = 78;
    return [((h % 360) + 360) % 360, Math.max(0, Math.min(100, s))];
  };

  CardClass.prototype._motion = function () {
    return this._optGet('motion', this._st(this._cfg.motion_entity) || 'Off');
  };

  CardClass.prototype._bri = function () {
    var v = parseFloat(this._optGet('bri', this._st(this._cfg.brightness_entity)));
    return isNaN(v) ? 80 : v;
  };

  /* ---------- service calls ---------- */

  CardClass.prototype._setColor = function (h, s) {
    this._optSet('color', h.toFixed(0) + ',' + s.toFixed(0));
    this._optSet('motion', 'Static');
    this._hass.callService('script', 'turn_on', {
      entity_id: this._cfg.set_color_script,
      variables: { color: h.toFixed(1) + ',' + s.toFixed(1) }
    });
    this._update();
  };

  CardClass.prototype._selectOption = function (eid, opt, optKey) {
    if (optKey) this._optSet(optKey, opt);
    this._hass.callService('input_select', 'select_option', { entity_id: eid, option: opt });
    this._update();
  };

  /* ---------- press feedback + long-press ---------- */

  CardClass.prototype._press = function (elem, tapFn, moreInfoEid) {
    var self = this;
    var lpTimer = null; var lpFired = false;
    function clear() { elem.classList.remove('pressed'); if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }
    elem.addEventListener('pointerdown', function () {
      elem.classList.add('pressed');
      lpFired = false;
      if (moreInfoEid) {
        lpTimer = setTimeout(function () {
          lpFired = true;
          var ev = new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: moreInfoEid } });
          self.dispatchEvent(ev);
        }, LP_MS);
      }
    });
    elem.addEventListener('pointerup', function () {
      var fired = lpFired; clear();
      if (!fired) tapFn();
    });
    elem.addEventListener('pointercancel', clear);
    elem.addEventListener('pointerleave', clear);
  };

  /* ---------- build ---------- */

  CardClass.prototype._build = function () {
    var cfg = this._cfg;
    var self = this;
    this._built = true;

    var root = this.attachShadow({ mode: 'open' });
    var style = el('style', null, root);
    style.textContent =
      ':host { display: block; }' +
      '.wrap { padding: 2px 14px 14px; display: flex; flex-direction: column; gap: 12px;' +
      '  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); color: #e1e1e1; }' +
      '.lbl { font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; color: #787878; margin: 2px 0 -6px 1px; }' +
      '.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }' +
      '.swatch { width: 34px; height: 34px; border-radius: 50%; border: 2px solid transparent;' +
      '  box-sizing: border-box; cursor: pointer; flex: none; transition: transform .12s ease; }' +
      '.swatch.sel { border-color: #fff; }' +
      '.wheelbtn { display: flex; align-items: center; justify-content: center;' +
      '  background: conic-gradient(#f44336,#ff9800,#ffeb3b,#4caf50,#00bcd4,#3f51b5,#9c27b0,#f44336); }' +
      '.wheelbtn ha-icon { display: flex; align-items: center; justify-content: center; line-height: 0;' +
      '  color: rgba(0,0,0,.55); --mdc-icon-size: 17px; }' +
      '.chip { height: 30px; border-radius: 15px; background: rgba(255,255,255,.06); border: 1px solid transparent;' +
      '  color: #bdbdbd; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px;' +
      '  cursor: pointer; user-select: none; box-sizing: border-box; transition: transform .12s ease; }' +
      '.chip.on { background: ' + CHIP_ON_BG + '; border-color: ' + CHIP_ON_BD + '; color: ' + CHIP_ON_TX + '; font-weight: 600; }' +
      '.pressed { transform: scale(.985); background-color: ' + PRESS_WASH + ' !important; }' +
      '.gv { display: flex; align-items: flex-start; gap: 8px; }' +
      '.gv .nm { font-size: 12px; color: #9b9b9b; width: 46px; flex: none; padding-top: 6px; }' +
      '.gv .strip { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0; min-width: 0; }' +
      '.gv .chip { flex: none; height: 26px; border-radius: 13px; font-size: 12px; padding: 0 10px; }' +
      '.gv .pen { flex: none; width: 26px; height: 26px; border-radius: 13px; display: flex; align-items: center;' +
      '  justify-content: center; cursor: pointer; color: #787878; background: rgba(255,255,255,.04); margin-top: 2px;' +
      '  transition: transform .12s ease; }' +
      '.gv .pen ha-icon { display: flex; align-items: center; justify-content: center; line-height: 0; --mdc-icon-size: 14px; }' +
      '.gv .pen.on { color: ' + CHIP_ON_TX + '; background: ' + CHIP_ON_BG + '; }' +
      '.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: none; align-items: center;' +
      '  justify-content: center; padding: 16px; z-index: 9999; }' +
      '.overlay.open { display: flex; }' +
      '.dlg { background: #1c1c1c; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; width: 100%;' +
      '  max-width: 380px; max-height: min(520px, 85vh); display: flex; flex-direction: column; overflow: hidden;' +
      '  box-shadow: 0 12px 40px rgba(0,0,0,.6); }' +
      '.dlg-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; flex: none; }' +
      '.dlg-head .t { font-size: 14px; font-weight: 600; }' +
      '.dlg-head .c { font-size: 11.5px; color: #9b9b9b; margin-left: auto; white-space: nowrap; }' +
      '.search { margin: 0 16px 10px; display: flex; align-items: center; gap: 8px; height: 34px; border-radius: 17px;' +
      '  background: rgba(255,255,255,.06); padding: 0 12px; color: #9b9b9b; flex: none; }' +
      '.search ha-icon { display: flex; align-items: center; justify-content: center; line-height: 0; --mdc-icon-size: 16px; }' +
      '.search input { background: none; border: none; outline: none; color: #e1e1e1; font-size: 13px; width: 100%; }' +
      '.cloud { padding: 2px 16px 12px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 7px; align-content: flex-start; }' +
      '.cloud .chip { height: 30px; border-radius: 15px; font-size: 13px; padding: 0 13px; flex: none; cursor: pointer; }' +
      '.cloud .empty { font-size: 12px; color: #787878; padding: 4px 0; }' +
      '.dlg-foot { display: flex; gap: 8px; padding: 12px 16px 14px; border-top: 1px solid rgba(255,255,255,.06); flex: none; }' +
      '.btn { flex: 1; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;' +
      '  font-size: 13px; background: rgba(255,255,255,.06); color: #bdbdbd; cursor: pointer; user-select: none;' +
      '  transition: transform .12s ease; }' +
      '.btn.primary { background: ' + CHIP_ON_BG + '; border: 1px solid ' + CHIP_ON_BD + '; color: ' + CHIP_ON_TX + '; font-weight: 600; }' +
      '.wheel { display: none; flex-direction: column; gap: 10px; padding: 10px 2px 2px; }' +
      '.wheel.open { display: flex; }' +
      '.sl { position: relative; height: 16px; border-radius: 8px; cursor: pointer; }' +
      '.sl .hd { position: absolute; top: 2.5px; width: 11px; height: 11px; border-radius: 50%; background: #fff;' +
      '  transform: translateX(-50%); pointer-events: none; }' +
      '.bri-track { position: relative; height: 16px; border-radius: 8px; background: ' + TRACK_BG + '; cursor: pointer; flex: 1; }' +
      '.bri-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; background: ' + ACCENT + '; opacity: .5; }' +
      '.bri-hd { position: absolute; top: 2.5px; width: 11px; height: 11px; border-radius: 50%; background: #fff;' +
      '  transform: translateX(-50%); }' +
      '.bri-val { font-size: 12px; color: #9b9b9b; width: 34px; text-align: right; flex: none; }' +
      '.pill { flex: 1; height: 34px; border-radius: 17px; display: flex; align-items: center; justify-content: center;' +
      '  gap: 6px; font-size: 12.5px; background: rgba(255,255,255,.06); color: #bdbdbd; border: 1px solid transparent;' +
      '  cursor: pointer; user-select: none; box-sizing: border-box; transition: transform .12s ease; }' +
      '.pill.on { background: ' + CHIP_ON_BG + '; border-color: ' + CHIP_ON_BD + '; color: ' + CHIP_ON_TX + '; font-weight: 600; }' +
      '.pill ha-icon { display: flex; align-items: center; justify-content: center; line-height: 0; --mdc-icon-size: 14px; }' +
      '.pill.on ha-icon { color: ' + ACCENT + '; }' +
      '.reset { height: 38px; border-radius: 10px; background: rgba(255,255,255,.06); display: flex; align-items: center;' +
      '  justify-content: center; gap: 8px; font-size: 13px; color: #bdbdbd; cursor: pointer; user-select: none;' +
      '  transition: transform .12s ease; }' +
      '.reset ha-icon { display: flex; align-items: center; justify-content: center; line-height: 0; --mdc-icon-size: 17px; }' +
      '.unavail { opacity: .4; pointer-events: none; }';

    var wrap = el('div', 'wrap', root);

    /* COLOR */
    el('div', 'lbl', wrap).textContent = 'Color';
    var swRow = el('div', 'row', wrap);
    this._swEls = [];
    cfg.swatches.forEach(function (sw) {
      var d = el('div', 'swatch', swRow);
      d.style.background = hslCss(sw.h, sw.s);
      d.title = sw.n || '';
      self._press(d, function () { self._setColor(sw.h, sw.s); }, cfg.color_entity);
      self._swEls.push({ el: d, h: sw.h, s: sw.s });
    });
    var wb = el('div', 'swatch wheelbtn', swRow);
    el('ha-icon', null, wb).setAttribute('icon', 'mdi:palette');
    this._wheelBtn = wb;
    this._press(wb, function () {
      self._wheelOpen = !self._wheelOpen;
      self._update();
    }, cfg.color_entity);

    /* inline wheel */
    var wheel = el('div', 'wheel', wrap);
    this._wheelEl = wheel;
    var hueSl = el('div', 'sl', wheel);
    hueSl.style.background = 'linear-gradient(to right,' +
      'hsl(0,90%,50%),hsl(60,90%,50%),hsl(120,90%,50%),hsl(180,90%,50%),hsl(240,90%,50%),hsl(300,90%,50%),hsl(360,90%,50%))';
    this._hueHd = el('div', 'hd', hueSl);
    var satSl = el('div', 'sl', wheel);
    this._satSl = satSl;
    this._satHd = el('div', 'hd', satSl);
    this._bindSlider(hueSl, function (f) { return { h: f * 360 }; });
    this._bindSlider(satSl, function (f) { return { s: f * 100 }; });

    /* MOTION */
    el('div', 'lbl', wrap).textContent = 'Motion';
    var moRow = el('div', 'row', wrap);
    this._moEls = {};
    MOTIONS.forEach(function (m) {
      var c = el('div', 'chip', moRow);
      c.textContent = m;
      self._press(c, function () { self._selectOption(cfg.motion_entity, m, 'motion'); }, cfg.motion_entity);
      self._moEls[m] = c;
    });

    /* GOVEE EFFECTS */
    el('div', 'lbl', wrap).textContent = 'Govee Effects';
    this._gvRows = [];
    cfg.govee.forEach(function (g) {
      var row = el('div', 'gv', wrap);
      el('div', 'nm', row).textContent = g.name;
      var strip = el('div', 'strip', row);
      var pen = el('div', 'pen', row);
      el('ha-icon', null, pen).setAttribute('icon', 'mdi:pencil-outline');
      var rec = { cfg: g, strip: strip, chips: null, row: row, pen: pen };
      self._press(pen, function () { self._dlgOpen(rec); }, g.entity);
      self._gvRows.push(rec);
    });

    /* BRIGHTNESS */
    el('div', 'lbl', wrap).textContent = 'Brightness';
    var brRow = el('div', 'row', wrap);
    var track = el('div', 'bri-track', brRow);
    this._briTrack = track;
    this._briFill = el('div', 'bri-fill', track);
    this._briHd = el('div', 'bri-hd', track);
    this._briVal = el('div', 'bri-val', brRow);
    this._bindBrightness(track);

    /* ROOMS */
    el('div', 'lbl', wrap).textContent = 'Rooms';
    var rmRow = el('div', 'row', wrap);
    this._rmEls = [];
    cfg.rooms.forEach(function (r) {
      var p = el('div', 'pill', rmRow);
      var ic = el('ha-icon', null, p);
      var tx = el('span', null, p);
      tx.textContent = r.name;
      self._press(p, function () {
        var cur = self._optGet('rm:' + r.entity, self._st(r.entity));
        var next = cur === 'on' ? 'off' : 'on';
        self._optSet('rm:' + r.entity, next);
        self._hass.callService('input_boolean', next === 'on' ? 'turn_on' : 'turn_off', { entity_id: r.entity });
        self._update();
      }, r.entity);
      self._rmEls.push({ el: p, ic: ic, cfg: r });
    });

    /* RESET */
    var rs = el('div', 'reset', wrap);
    el('ha-icon', null, rs).setAttribute('icon', 'mdi:restore');
    el('span', null, rs).textContent = 'Reset Rooms to Schedule';
    this._press(rs, function () {
      self._hass.callService('script', 'turn_on', { entity_id: cfg.reset_script });
      self._optSet('motion', 'Off');
      self._update();
    }, cfg.reset_script);

    /* EFFECT EDITOR DIALOG (hidden until a pencil opens it) */
    var ov = el('div', 'overlay', wrap);
    this._ov = ov;
    var dlg = el('div', 'dlg', ov);
    var head = el('div', 'dlg-head', dlg);
    this._dlgTitle = el('div', 't', head);
    this._dlgCount = el('div', 'c', head);
    var search = el('div', 'search', dlg);
    el('ha-icon', null, search).setAttribute('icon', 'mdi:magnify');
    this._dlgInput = el('input', null, search);
    this._dlgInput.setAttribute('placeholder', 'Filter effects...');
    this._dlgInput.addEventListener('input', function () { self._dlgRefresh(); });
    this._dlgCloud = el('div', 'cloud', dlg);
    var foot = el('div', 'dlg-foot', dlg);
    var cancel = el('div', 'btn', foot);
    cancel.textContent = 'Cancel';
    this._press(cancel, function () { self._dlgClose(); }, null);
    this._dlgSaveBtn = el('div', 'btn primary', foot);
    this._press(this._dlgSaveBtn, function () { self._dlgSave(); }, null);
    ov.addEventListener('pointerdown', function (ev) {
      if (ev.target === ov) self._dlgClose();
    });
  };

  /* hue / sat slider binding: live handle, commit color on release */
  CardClass.prototype._bindSlider = function (slider, mapFn) {
    var self = this;
    function frac(ev) {
      var r = slider.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    }
    function apply(ev, commit) {
      var m = mapFn(frac(ev));
      var hs = self._hs();
      var h = (m.h !== undefined) ? m.h : hs[0];
      var s = (m.s !== undefined) ? m.s : hs[1];
      self._optSet('color', h.toFixed(0) + ',' + s.toFixed(0));
      if (commit) self._setColor(h, s);
      self._update();
    }
    slider.addEventListener('pointerdown', function (ev) {
      slider.setPointerCapture(ev.pointerId);
      self._drag = slider;
      apply(ev, false);
    });
    slider.addEventListener('pointermove', function (ev) {
      if (self._drag === slider) apply(ev, false);
    });
    slider.addEventListener('pointerup', function (ev) {
      if (self._drag === slider) { self._drag = null; apply(ev, true); }
    });
    slider.addEventListener('pointercancel', function () { self._drag = null; });
  };

  CardClass.prototype._bindBrightness = function (track) {
    var self = this;
    function frac(ev) {
      var r = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    }
    function level(ev) { return Math.round((10 + frac(ev) * 90) / 5) * 5; }
    function show(ev) { self._optSet('bri', level(ev)); self._update(); }
    track.addEventListener('pointerdown', function (ev) {
      track.setPointerCapture(ev.pointerId);
      self._drag = track;
      show(ev);
    });
    track.addEventListener('pointermove', function (ev) { if (self._drag === track) show(ev); });
    track.addEventListener('pointerup', function (ev) {
      if (self._drag === track) {
        self._drag = null;
        var v = level(ev);
        self._optSet('bri', v);
        self._hass.callService('input_number', 'set_value', { entity_id: self._cfg.brightness_entity, value: v });
        self._update();
      }
    });
    track.addEventListener('pointercancel', function () { self._drag = null; });
  };

  /* ---------- govee effect-list editor ---------- */

  CardClass.prototype._catalog = function (rec) {
    var lt = rec.cfg.light && this._hass.states[rec.cfg.light];
    return (lt && lt.attributes && lt.attributes.effect_list) || [];
  };

  CardClass.prototype._dlgOpen = function (rec) {
    var self = this;
    var st = this._hass.states[rec.cfg.entity];
    var opts = (st && st.attributes && st.attributes.options) || [];
    this._dlgRec = rec;
    this._dlgPending = {};
    opts.forEach(function (o) { if (o !== 'None') self._dlgPending[o] = true; });
    this._dlgCat = this._catalog(rec);
    this._dlgTitle.textContent = rec.cfg.name + ' - effect chips';
    this._dlgInput.value = '';
    this._dlgCloud.textContent = '';
    this._dlgChips = {};
    this._dlgCat.forEach(function (o) {
      var c = el('div', 'chip', self._dlgCloud);
      c.textContent = o;
      self._press(c, function () {
        self._dlgPending[o] = !self._dlgPending[o];
        self._dlgRefresh();
      }, null);
      self._dlgChips[o] = c;
    });
    if (!this._dlgCat.length) {
      el('div', 'empty', this._dlgCloud).textContent = 'No effect list available for this fixture.';
    }
    this._dlgRefresh();
    this._ov.classList.add('open');
    rec.pen.classList.add('on');
  };

  CardClass.prototype._dlgRefresh = function () {
    if (!this._dlgRec) return;
    var self = this;
    var n = 0;
    for (var k in this._dlgPending) { if (this._dlgPending[k]) n++; }
    this._dlgCount.textContent = n + ' of ' + this._dlgCat.length + ' selected';
    this._dlgSaveBtn.textContent = 'Save ' + n + ' chip' + (n === 1 ? '' : 's');
    var q = this._dlgInput.value.trim().toLowerCase();
    this._dlgCat.forEach(function (o) {
      var c = self._dlgChips[o];
      var on = !!self._dlgPending[o];
      if (c.classList.contains('on') !== on) c.classList.toggle('on', on);
      var show = !q || o.toLowerCase().indexOf(q) !== -1;
      var want = show ? '' : 'none';
      if (c.style.display !== want) c.style.display = want;
    });
  };

  CardClass.prototype._dlgClose = function () {
    this._ov.classList.remove('open');
    if (this._dlgRec) this._dlgRec.pen.classList.remove('on');
    this._dlgRec = null;
    this._dlgPending = null;
  };

  CardClass.prototype._dlgSave = function () {
    if (!this._dlgRec) return;
    var rec = this._dlgRec;
    var pending = this._dlgPending;
    var options = ['None'];
    this._dlgCat.forEach(function (e) { if (pending[e]) options.push(e); });
    this._hass.callWS({
      type: 'input_select/update',
      input_select_id: rec.cfg.entity.split('.')[1],
      options: options
    }).catch(function (err) { console.error('[flat-party-card] effect-list save failed:', err); });
    rec.chips = null;
    this._dlgClose();
    this._update();
  };

  /* ---------- idempotent refresh ---------- */

  CardClass.prototype._update = function () {
    if (!this._built || !this._hass) return;
    var cfg = this._cfg;
    var self = this;
    var hs = this._hs();
    var motion = this._motion();

    /* swatch selection: nearest match within tolerance */
    var anySel = false;
    this._swEls.forEach(function (sw) {
      var dh = Math.abs(((sw.h - hs[0]) % 360 + 540) % 360 - 180);
      var sel = dh <= 4 && Math.abs(sw.s - hs[1]) <= 6;
      if (sel) anySel = true;
      if (sw.el.classList.contains('sel') !== sel) sw.el.classList.toggle('sel', sel);
    });
    var wbSel = !anySel && motion !== 'Off';
    if (this._wheelBtn.classList.contains('sel') !== wbSel) this._wheelBtn.classList.toggle('sel', wbSel);

    /* wheel */
    if (this._wheelEl.classList.contains('open') !== this._wheelOpen) {
      this._wheelEl.classList.toggle('open', this._wheelOpen);
    }
    if (this._wheelOpen) {
      this._hueHd.style.left = (hs[0] / 360 * 100) + '%';
      this._satHd.style.left = hs[1] + '%';
      this._satSl.style.background = 'linear-gradient(to right, #fff, ' + hslCss(hs[0], 100) + ')';
    }

    /* motion chips */
    MOTIONS.forEach(function (m) {
      var on = motion === m;
      var c = self._moEls[m];
      if (c.classList.contains('on') !== on) c.classList.toggle('on', on);
    });

    /* govee rows: chips from live options; editing happens in the popup dialog */
    this._gvRows.forEach(function (row) {
      var st = self._hass.states[row.cfg.entity];
      var avail = !!st && st.state !== 'unavailable';
      if (row.row.classList.contains('unavail') !== !avail) row.row.classList.toggle('unavail', !avail);
      if (!avail) return;
      var opts = (st.attributes && st.attributes.options) || ['None'];
      var key = opts.join('|');
      if (row.chips !== key) {
        row.chips = key;
        row.strip.textContent = '';
        row.els = {};
        opts.forEach(function (o) {
          var c = el('div', 'chip', row.strip);
          c.textContent = o;
          self._press(c, function () { self._selectOption(row.cfg.entity, o, 'gv:' + row.cfg.entity); }, row.cfg.entity);
          row.els[o] = c;
        });
      }
      var cur = self._optGet('gv:' + row.cfg.entity, st.state);
      opts.forEach(function (o) {
        var on = o === cur && o !== 'None';
        var c = row.els[o];
        if (c && c.classList.contains('on') !== on) c.classList.toggle('on', on);
      });
    });

    /* brightness */
    var bri = this._bri();
    var f = (bri - 10) / 90;
    this._briFill.style.width = (f * 100) + '%';
    this._briHd.style.left = 'max(6px, min(calc(100% - 6px), ' + (f * 100) + '%))';
    this._briVal.textContent = bri.toFixed(0) + '%';

    /* room pills */
    this._rmEls.forEach(function (r) {
      var st = self._optGet('rm:' + r.cfg.entity, self._st(r.cfg.entity));
      var on = st === 'on';
      if (r.el.classList.contains('on') !== on) r.el.classList.toggle('on', on);
      var want = on ? 'mdi:snowflake' : 'mdi:snowflake-off';
      if (r.ic.getAttribute('icon') !== want) r.ic.setAttribute('icon', want);
    });
  };

  customElements.define('flat-party-card', CardClass);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'flat-party-card',
    name: 'Flat Party Card',
    description: 'Party mode control: color swatches + wheel, motion chips, Govee effect overrides, brightness, room freeze pills, reset.'
  });
})();
