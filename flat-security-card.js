/* flat-security-card v1.6
   v1.6: AUDIT PASS (2026-09-06). Armed/arming headers now say "N no signal" when a
   contact is unavailable (they used to claim "All closed"). The entry-delay /
   triggered cause comes from Alarmo's `open_sensors` attribute (latched card-side
   as a fallback) so the tripped door keeps its name and the single highlighted row
   after it is shut again. Alarmo's `bypassed_sensors` attribute is read: a bypassed
   window stays BYPASSED after someone closes it. Optimistic arming counts from the
   tap (no "0:00" flash) and a refused arm/disarm call drops the optimistic state at
   once. Re-render only when one of the card's own entities changed (tick keeps the
   ages and the camera still fresh; the still refreshes on its own `camera_refresh`
   cadence while expanded). `unknown` alarm state renders as unavailable; "camera
   idle" is only claimed while the occupancy sensor is live; interval never re-armed
   on a detached card; noopener on the Frigate link; version constant + dead code
   cleaned.
   v1.5: PACKAGE WAITING glyph. Optional `package:` = an input_boolean (or any on/off
   entity) that is ON while a delivery sits outside. While on, the header glyph slot
   shows a box icon + its age ("1h 12m") in the bypass orange, visible even collapsed;
   tap = that entity's more-info (clear it by hand if the door-contact clear ever
   misses). Off or unconfigured = nothing renders (absence is good news).

   Sentinel-row security card for Alarmo: a one-line collapsible header (shield,
   state word, summary, notable glyphs, countdown strip) that expands to a
   camera-forward monitoring body (live entry-cam view, ARM/DISARM strip,
   perimeter sensor list with open/guarding/bypassed/no-signal states,
   inline low-battery badges, last-person tap-through).

   HOW-TO:
   - This file ships as a base64 data: URL module resource
     (data:text/javascript;name=flat-security-card;base64,....) in the
     dashboard resource registry. Decode the base64 to read/edit; re-encode and
     replace the resource URL via the Card Manager card (preferred) or
     Settings > Dashboards > Resources. Stored in .storage/lovelace_resources,
     included in HA backups. Zero external dependencies.
   - Example card YAML (placeholder entity ids - use your own):

     type: custom:flat-security-card
     alarm: alarm_control_panel.alarmo
     camera: camera.entry_cam                        # optional
     frigate_url: https://frigate.local:8971         # optional - ENTRY CAM chip opens this
     occupancy: binary_sensor.entry_cam_person       # optional (PERSON chip, shown only when on)
     package: input_boolean.package_waiting          # optional (v1.5: header box glyph + age while on)
     last_person: image.entry_cam_person             # optional
     collapsed_default: false                        # true = sentinel row
     exit_delay: 60                                  # match Alarmo config
     entry_delay: 15
     sensors:
       - entity: binary_sensor.front_door
         name: Front Door
         icon: door
         battery: sensor.front_door_battery
       - entity: binary_sensor.patio_slider
         name: Patio Slider
         icon: slider
         battery: sensor.patio_slider_battery
       - entity: binary_sensor.window_left
         name: Big Left
         icon: window
         group: Big Windows
         battery: sensor.window_left_battery

   Behaviors: header zone toggles collapse (hover wash, chevron); shield icon
   taps through to the alarm more-info; camera view taps to camera more-info;
   the last-person stamp taps to the snapshot image entity; sensor rows tap to
   their own more-info. During the exit delay the strip splits into CANCEL +
   ARM NOW (alarmo.skip_delay service - cuts the running exit delay short so
   the panel arms immediately; open-sensor rules unchanged. NOTE: the arm
   service's field is skip_delay, SINGULAR - skip_delays is rejected with
   "extra keys not allowed"). ARM/DISARM strip uses press feedback and holds an
   optimistic state ~8s. Bypassed-while-armed renders dashed orange
   ("the silent bypass gap, made visible"). Unavailable sensors render as
   "no signal", never as closed. Triggered = slow surface pulse.
*/
(function () {
  "use strict";

  var CARD_VERSION = "1.6";

  /* hardcoded palette - theme primary is green and must not leak in */
  var C = {
    ink: "#e8e8e8",
    inkDim: "#9e9e9e",
    inkFaint: "#6b6c6e",
    track: "rgba(70,70,70,.3)",
    wash: "rgba(70,70,70,.22)",
    grey: "#9e9e9e",
    amber: "#ffc107",
    warn: "#ff9c4a",
    blue: "#2196f3",
    blueInk: "#bcdcf7",
    red: "#f44336",
    redInk: "#f6b6b1",
    green: "#4caf50",
    greenInk: "#9fe3a5"
  };

  var MDOT = " \u00b7 ";

  /* ---- inline SVG factories (stroke set per-state at update time) ---- */
  var SHIELD_BASE = 'M12 3l7 3v5c0 4.5-3 8.1-7 9.5C8 19.1 5 15.5 5 11V6l7-3z';
  function shieldSvg(cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke-width="1.4">' +
      '<path class="sh-base" d="' + SHIELD_BASE + '"/>' +
      '<path class="sh-check" d="M9 12l2 2 4-4" stroke-width="1.6"/>' +
      '<path class="sh-alert" d="M12 8v5M12 16v.5" stroke-width="1.8"/>' +
      '</svg>';
  }
  var SENSOR_ICONS = {
    door: '<rect x="6" y="3" width="12" height="18" rx="1"/><circle class="ic-dot" cx="15" cy="12" r="1"/>',
    slider: '<rect x="4" y="4" width="7" height="16" rx="1"/><rect x="13" y="4" width="7" height="16" rx="1"/>',
    window: '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/>',
    window2: '<rect x="5" y="5" width="14" height="14" rx="1"/>'
  };
  function sensorSvg(icon, cls) {
    var body = SENSOR_ICONS[icon] || SENSOR_ICONS.window2;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke-width="1.5">' + body + '</svg>';
  }
  var PERSON_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="' + C.green + '" stroke-width="1.6"><circle cx="12" cy="7" r="3"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>';
  var PKG_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="' + C.warn + '" stroke-width="1.6"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="' + C.ink + '" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 11V8a4 4 0 018 0v3"/><rect x="6" y="11" width="12" height="9" rx="1.5"/></svg>';
  var SHIELD_SMALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="' + SHIELD_BASE + '"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------------------------------------------------------------- */
  function fmtClock(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }
  function fmtAgoShort(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    if (h < 24) return (h + "h " + (m % 60 > 0 ? (m % 60) + "m" : "")).trim();
    return Math.floor(h / 24) + "d";
  }
  function fmtMMSS(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------------------------------------------------------------- */
  var STYLES =
    ':host{display:block;' +
      '--fsc-bg:var(--ha-card-background,var(--card-background-color,#1c1c1c));' +
      '--fsc-border:var(--ha-card-border-color,#343434);' +
      '--fsc-radius:var(--ha-card-border-radius,12px)}' +
    '.card{background:var(--fsc-bg);border-radius:var(--fsc-radius);overflow:hidden;' +
      'font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;color:' + C.ink + ';' +
      'border:1px solid var(--fsc-border);transition:border-color .35s cubic-bezier(.4,0,.2,1)}' +
    '@keyframes fsc-pulse{0%,100%{background:var(--fsc-bg)}50%{background:#2a1715}}' +
    '.card.triggered{animation:fsc-pulse 1.6s ease-in-out infinite;border-color:rgba(244,67,54,.4)}' +

    /* header */
    '.hd{display:flex;align-items:center;gap:11px;padding:13px 18px 13px 12px;cursor:pointer;user-select:none;-webkit-user-select:none}' +
    '@media (hover:hover){.hd:hover{background:' + C.wash + '}}' +
    '.sh{width:34px;height:34px;flex:none;cursor:pointer}' +
    '.sh svg{width:100%;height:100%}' +
    '.sh .sh-check,.sh .sh-alert{opacity:0;transition:opacity .35s cubic-bezier(.4,0,.2,1)}' +
    '.tx{flex:1;min-width:0}' +
    '.l1{font-size:22px;font-weight:400;letter-spacing:.3px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.l2{font-size:11.5px;color:' + C.inkDim + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.gl{display:flex;gap:10px;align-items:center;flex:none}' +
    '.gl svg{width:18px;height:18px}' +
    '.gl-pkg{display:none;align-items:center;gap:5px;color:' + C.warn + ';font-size:11px;letter-spacing:.3px;white-space:nowrap;cursor:pointer;padding:2px 4px;border-radius:5px}' +
    '@media (hover:hover){.gl-pkg:hover{background:' + C.wash + '}}' +
    '.chev{width:16px;height:16px;opacity:.4;transition:transform .35s cubic-bezier(.4,0,.2,1)}' +
    '.chev.up{transform:rotate(180deg)}' +
    '.hdbar{height:3px;background:' + C.track + '}' +
    '.hdbar i{display:block;height:100%;transition:width 1s linear}' +

    /* collapse machinery: grid-rows 0fr<->1fr (house convention) */
    '.wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.4,0,.2,1)}' +
    '.wrap.open{grid-template-rows:1fr}' +
    '.inner{overflow:hidden;min-height:0}' +
    '.bd{padding:14px 18px 16px}' +

    /* camera */
    '.camwrap{border-radius:9px;overflow:hidden;position:relative;aspect-ratio:16/9;background:' +
      'radial-gradient(120% 90% at 30% 10%,#33343a 0%,#232428 45%,#191a1d 100%);cursor:pointer;' +
      'transition:transform .12s ease}' +
    '.camwrap.pressed{transform:scale(.985)}' +
    '.camimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}' +
    '.camtl{position:absolute;top:9px;left:9px;display:flex;gap:6px}' +
    '.camchip{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.55);' +
      'border-radius:6px;padding:3px 9px;font-size:10.5px}' +
    '.camlive{letter-spacing:1px;color:#ddd}' +
    '.camlive .dot{width:7px;height:7px;border-radius:50%;background:' + C.green + '}' +
    '.camlive.dead .dot{background:' + C.inkFaint + '}' +
    '.camlive.link{cursor:pointer}' +
    '@media (hover:hover){.camlive.link:hover{background:rgba(0,0,0,.8);color:#fff}}' +
    '.camperson{letter-spacing:1px;color:' + C.greenInk + ';display:none}' +
    '.camperson .pd{width:7px;height:7px;border-radius:50%;background:' + C.green + '}' +
    '.camstamp{position:absolute;bottom:8px;right:10px;font-size:10px;color:rgba(255,255,255,.45);' +
      'cursor:pointer;padding:2px 4px;border-radius:4px}' +
    '@media (hover:hover){.camstamp:hover{background:rgba(0,0,0,.5);color:rgba(255,255,255,.8)}}' +

    /* arm strip */
    '.striprow{display:flex;gap:8px;margin-top:14px}' +
    '.armstrip{flex:1;height:42px;border-radius:8px;border:1px solid rgba(158,158,158,.35);' +
      'display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500;' +
      'letter-spacing:1.2px;color:' + C.inkDim + ';cursor:pointer;transition:transform .12s ease,background .12s ease;' +
      'user-select:none;-webkit-user-select:none}' +
    '.armstrip svg{width:18px;height:18px;opacity:.75}' +
    '.armstrip.pressed{transform:scale(.985);background:' + C.wash + '}' +
    '.armstrip.disarm{border-color:rgba(244,67,54,.5);color:' + C.redInk + '}' +
    '.armstrip.hot{border-color:rgba(244,67,54,.8);color:#ffcdd2}' +
    '.armstrip.ghost{opacity:.45;cursor:default}' +
    '.armstrip.now{border-color:rgba(33,150,243,.55);color:' + C.blueInk + ';display:none}' +

    /* perimeter list */
    '.plist{margin-top:12px;border-top:1px solid rgba(70,70,70,.35)}' +
    '.prow{display:flex;align-items:center;gap:12px;padding:9px 2px;border-bottom:1px solid rgba(70,70,70,.22);' +
      'font-size:13px;cursor:pointer;transition:transform .12s ease}' +
    '.prow.pressed{transform:scale(.985)}' +
    '.prow:last-child{border-bottom:none}' +
    '.prow svg{width:18px;height:18px;flex:none;fill:none;stroke:' + C.inkDim + '}' +
    '.prow .ic-dot{fill:currentColor;stroke:none}' +
    '.prow .nm{flex:1;color:' + C.inkDim + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.prow .lc{font-size:11px;color:' + C.inkFaint + ';flex:none}' +
    '.prow .st{font-size:11.5px;letter-spacing:.5px;color:' + C.inkFaint + ';flex:none}' +
    '.prow.open svg{stroke:' + C.amber + ';fill:rgba(255,193,7,.25)}' +
    '.prow.open .nm{color:' + C.ink + '}' +
    '.prow.open .st{color:' + C.amber + '}' +
    '.prow.bypassed svg{stroke:' + C.warn + ';stroke-dasharray:3 2;fill:none}' +
    '.prow.bypassed .nm{color:' + C.warn + '}' +
    '.prow.bypassed .st{color:' + C.warn + '}' +
    '.prow.cause svg{stroke:' + C.red + ';fill:rgba(244,67,54,.25)}' +
    '.prow.cause .nm{color:' + C.redInk + '}' +
    '.prow.cause .st{color:' + C.red + '}' +
    '.prow.unavail svg{stroke:' + C.inkFaint + ';stroke-dasharray:3 2;opacity:.6}' +
    '.prow.unavail .nm{color:' + C.inkFaint + '}' +
    '.bat{font-size:10px;font-weight:700;color:' + C.warn + ';border:1px solid rgba(255,156,74,.5);' +
      'border-radius:6px;padding:1px 5px;margin-left:7px;vertical-align:1px}';

  /* ---------------------------------------------------------------- */
  var FlatSecurityCard = function () {
    var el = Reflect.construct(HTMLElement, [], FlatSecurityCard);
    el._built = false;
    el._expanded = null;
    el._optUntil = 0;
    el._optState = null;
    el._tick = null;
    el._tickMs = 0;
    el._connected = false;
    el._camStamp = 0;
    el._optSetAt = 0;
    el._optActive = false;
    el._causeLatch = null;
    el._watchIds = [];
    return el;
  };
  FlatSecurityCard.prototype = Object.create(HTMLElement.prototype);
  FlatSecurityCard.prototype.constructor = FlatSecurityCard;
  Object.setPrototypeOf(FlatSecurityCard, HTMLElement);

  FlatSecurityCard.prototype.setConfig = function (cfg) {
    if (!cfg || !cfg.alarm) throw new Error("flat-security-card: 'alarm' entity is required");
    if (!cfg.sensors || !cfg.sensors.length) throw new Error("flat-security-card: 'sensors' list is required");
    this._cfg = Object.assign({
      exit_delay: 60,
      entry_delay: 15,
      collapsed_default: false,
      battery_low: 25,
      camera_refresh: 10
    }, cfg);
    this._built = false;
    this._watchIds = harvestIds(this._cfg);
  };

  /* every entity id anywhere in the config (any depth) - the render gate watches these */
  function harvestIds(v, out) {
    out = out || [];
    if (typeof v === "string") { if (/^[a-z_]+\.[a-z0-9_]+$/.test(v) && out.indexOf(v) < 0) out.push(v); }
    else if (Array.isArray(v)) v.forEach(function (x) { harvestIds(x, out); });
    else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { harvestIds(v[k], out); });
    return out;
  }

  FlatSecurityCard.prototype.getCardSize = function () {
    return this._expanded ? 8 : 1;
  };

  Object.defineProperty(FlatSecurityCard.prototype, "hass", {
    set: function (h) {
      var old = this._hass;
      this._hass = h;
      if (!this._built) { this._build(); this._update(); return; }
      /* render gate: skip pushes where none of the card's own entities changed identity */
      if (old && old.states && h && h.states) {
        var ids = this._watchIds, changed = false;
        for (var i = 0; i < ids.length; i++) { if (old.states[ids[i]] !== h.states[ids[i]]) { changed = true; break; } }
        if (!changed) return;
      }
      this._update();
    },
    get: function () { return this._hass; }
  });

  FlatSecurityCard.prototype.connectedCallback = function () {
    this._connected = true;
    this._startTick(this._tickMs || 30000);
    if (this._hass && this._built) this._update();
  };
  FlatSecurityCard.prototype.disconnectedCallback = function () {
    this._connected = false;
    this._stopTick();
  };
  FlatSecurityCard.prototype._startTick = function (ms) {
    if (!this._connected) { this._tickMs = ms; return; }
    if (this._tickMs === ms && this._tick) return;
    this._stopTick();
    this._tickMs = ms;
    var self = this;
    this._tick = setInterval(function () { if (self._hass) self._update(); }, ms);
  };
  FlatSecurityCard.prototype._stopTick = function () {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  };

  /* ------------------------- DOM build (once) ---------------------- */
  FlatSecurityCard.prototype._build = function () {
    var cfg = this._cfg;
    if (this._expanded === null) this._expanded = !cfg.collapsed_default;
    var root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = "";

    var style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    var card = document.createElement("div");
    card.className = "card";
    root.appendChild(card);
    this._elCard = card;

    /* header */
    var hd = document.createElement("div");
    hd.className = "hd";
    hd.innerHTML =
      '<div class="sh">' + shieldSvg("shsvg") + '</div>' +
      '<div class="tx"><div class="l1"></div><div class="l2"></div></div>' +
      '<div class="gl"><span class="gl-open"></span><span class="gl-person" style="display:none">' + PERSON_GLYPH + '</span><span class="gl-pkg">' + PKG_GLYPH + '<span class="gl-pkg-tx"></span></span>' + CHEV + '</div>';
    card.appendChild(hd);
    this._elHd = hd;
    this._elShield = hd.querySelector(".sh");
    this._elL1 = hd.querySelector(".l1");
    this._elL2 = hd.querySelector(".l2");
    this._elGlOpen = hd.querySelector(".gl-open");
    this._elGlPerson = hd.querySelector(".gl-person");
    this._elGlPkg = hd.querySelector(".gl-pkg");
    this._elGlPkgTx = hd.querySelector(".gl-pkg-tx");
    this._elChev = hd.querySelector(".chev");

    var bar = document.createElement("div");
    bar.className = "hdbar";
    bar.style.display = "none";
    bar.innerHTML = "<i></i>";
    card.appendChild(bar);
    this._elBar = bar;
    this._elBarFill = bar.querySelector("i");

    /* collapsible body */
    var wrap = document.createElement("div");
    wrap.className = "wrap";
    var inner = document.createElement("div");
    inner.className = "inner";
    var bd = document.createElement("div");
    bd.className = "bd";
    inner.appendChild(bd);
    wrap.appendChild(inner);
    card.appendChild(wrap);
    this._elWrap = wrap;

    /* camera */
    if (cfg.camera) {
      var cam = document.createElement("div");
      cam.className = "camwrap";
      cam.innerHTML =
        '<img class="camimg" alt="">' +
        '<div class="camtl">' +
          '<div class="camchip camlive"><span class="dot"></span><span class="camlbl">ENTRY CAM</span></div>' +
          '<div class="camchip camperson"><span class="pd"></span><span>PERSON</span></div>' +
        '</div>' +
        '<div class="camstamp"></div>';
      bd.appendChild(cam);
      this._elCam = cam;
      this._elCamImg = cam.querySelector(".camimg");
      this._elCamLive = cam.querySelector(".camlive");
      this._elCamPerson = cam.querySelector(".camperson");
      this._elCamStamp = cam.querySelector(".camstamp");
    }

    /* arm strip row: main action + ARM NOW (exit-delay skip, arming state only) */
    var striprow = document.createElement("div");
    striprow.className = "striprow";
    var strip = document.createElement("div");
    strip.className = "armstrip";
    strip.innerHTML = '<span class="as-ic"></span><span class="as-tx"></span>';
    striprow.appendChild(strip);
    var stripNow = document.createElement("div");
    stripNow.className = "armstrip now";
    stripNow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="' + SHIELD_BASE + '"/><path d="M9 12l2 2 4-4"/></svg><span>ARM NOW</span>';
    striprow.appendChild(stripNow);
    bd.appendChild(striprow);
    this._elStrip = strip;
    this._elStripIc = strip.querySelector(".as-ic");
    this._elStripTx = strip.querySelector(".as-tx");
    this._elStripNow = stripNow;

    /* perimeter list */
    var plist = document.createElement("div");
    plist.className = "plist";
    bd.appendChild(plist);
    this._elPlist = plist;
    this._rows = {};   /* key -> row element */

    this._wireEvents();
    this._applyExpanded();
    this._built = true;
  };

  /* ------------------------- events -------------------------------- */
  function pressable(el) {
    el.addEventListener("pointerdown", function () { el.classList.add("pressed"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      el.addEventListener(ev, function () { el.classList.remove("pressed"); });
    });
  }

  FlatSecurityCard.prototype._moreInfo = function (entityId) {
    var ev = new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: entityId } });
    this.dispatchEvent(ev);
  };

  FlatSecurityCard.prototype._wireEvents = function () {
    var self = this, cfg = this._cfg;

    this._elHd.addEventListener("click", function () {
      self._expanded = !self._expanded;
      self._applyExpanded();
      self._update();
    });
    this._elShield.addEventListener("click", function (e) {
      e.stopPropagation();
      self._moreInfo(cfg.alarm);
    });
    if (cfg.package) {
      this._elGlPkg.addEventListener("click", function (e) {
        e.stopPropagation();
        self._moreInfo(cfg.package);
      });
    }

    if (this._elCam) {
      pressable(this._elCam);
      this._elCam.addEventListener("click", function () { self._moreInfo(cfg.camera); });
      if (cfg.frigate_url) {
        this._elCamLive.classList.add("link");
        this._elCamLive.addEventListener("click", function (e) {
          e.stopPropagation();
          window.open(cfg.frigate_url, "_blank", "noopener");
        });
      }
      if (cfg.last_person) {
        this._elCamStamp.addEventListener("click", function (e) {
          e.stopPropagation();
          self._moreInfo(cfg.last_person);
        });
      }
    }

    pressable(this._elStrip);
    this._elStrip.addEventListener("click", function () { self._stripAction(); });
    pressable(this._elStripNow);
    this._elStripNow.addEventListener("click", function () {
      var a = self._alarmObj();
      if (!a || a.state !== "arming") return;
      self._setOptimistic("armed_away", a.state, self._hass.callService("alarmo", "skip_delay", { entity_id: self._cfg.alarm }));
    });
  };

  FlatSecurityCard.prototype._applyExpanded = function () {
    /* idempotent class toggling - never touch display (checklist #7) */
    if (this._expanded) {
      this._elWrap.classList.add("open");
      this._elChev.classList.add("up");
    } else {
      this._elWrap.classList.remove("open");
      this._elChev.classList.remove("up");
    }
  };

  FlatSecurityCard.prototype._stripAction = function () {
    var st = this._alarmState();
    var hass = this._hass, cfg = this._cfg;
    if (!hass || st === "unavailable") return;
    var a = this._alarmObj(), real = a ? a.state : undefined;
    if (st === "disarmed") {
      this._setOptimistic("arming", real, hass.callService("alarmo", "arm", { entity_id: cfg.alarm, mode: "away" }));
    } else {
      this._setOptimistic("disarmed", real, hass.callService("alarmo", "disarm", { entity_id: cfg.alarm }));
    }
  };

  /* optimistic hold: show `state` for ~8s or until hass moves; a rejected service
     call (Alarmo refused the arm, connection error) drops the hold immediately */
  FlatSecurityCard.prototype._setOptimistic = function (state, realAtSet, promise) {
    var self = this;
    this._optState = state;
    this._optRealAtSet = realAtSet;
    this._optSetAt = Date.now();
    this._optUntil = this._optSetAt + 8000;
    this._update();
    if (promise && typeof promise.then === "function") {
      promise.then(null, function () {
        if (self._optState === state) { self._optState = null; self._optActive = false; self._update(); }
      });
    }
  };

  /* ------------------------- state helpers -------------------------- */
  FlatSecurityCard.prototype._alarmObj = function () {
    return this._hass && this._hass.states[this._cfg.alarm];
  };
  FlatSecurityCard.prototype._alarmState = function () {
    var a = this._alarmObj();
    var real = a ? a.state : "unavailable";
    if (real === "unknown") real = "unavailable"; /* never render unknown as an armed mode */
    this._optActive = false;
    if (this._optState && Date.now() < this._optUntil) {
      /* hold optimistic state until hass catches up or window expires */
      if (real === this._optRealAtSet || real === undefined) { this._optActive = true; return this._optState; }
      this._optState = null; /* hass moved - trust it */
    }
    return real;
  };

  FlatSecurityCard.prototype._sensorInfo = function () {
    /* per-sensor computed state list, in config order */
    var hass = this._hass, cfg = this._cfg;
    var st = this._alarmState();
    var a = this._alarmObj();
    var byp = a && a.attributes && Array.isArray(a.attributes.bypassed_sensors) ? a.attributes.bypassed_sensors : [];
    var out = [];
    cfg.sensors.forEach(function (s) {
      var o = hass.states[s.entity];
      var info = {
        cfg: s,
        name: s.name || (o && o.attributes.friendly_name) || s.entity,
        icon: s.icon || "window2",
        avail: !!o && o.state !== "unavailable" && o.state !== "unknown",
        open: !!o && o.state === "on",
        last: o ? new Date(o.last_changed).getTime() : 0,
        battery: null,
        bypassed: false
      };
      if (s.battery && hass.states[s.battery]) {
        var b = parseFloat(hass.states[s.battery].state);
        if (!isNaN(b) && b < cfg.battery_low) info.battery = Math.round(b);
      }
      if (st === "armed_away" && (info.open || byp.indexOf(s.entity) >= 0)) {
        /* open while armed_away = bypassed (would have triggered otherwise); Alarmo's
           bypassed_sensors attr keeps a window bypassed after someone closes it */
        info.bypassed = true;
      }
      out.push(info);
    });
    return out;
  };

  FlatSecurityCard.prototype._causeSensor = function (infos, st) {
    /* the sensor that started pending/triggered. Alarmo records it in open_sensors
       ({entity_id: state}) for the whole pending/triggered span; fall back to the most
       recently opened sensor, then to the card-side latch (survives the door being shut) */
    var a = this._alarmObj();
    var focus = st === "pending" || st === "triggered";
    var os = a && a.attributes && a.attributes.open_sensors;
    var best = null;
    if (focus && os && typeof os === "object") {
      infos.forEach(function (i) { if (!best && Object.prototype.hasOwnProperty.call(os, i.cfg.entity)) best = i; });
    }
    if (!best) infos.forEach(function (i) { if (i.open && (!best || i.last > best.last)) best = i; });
    var latch = this._causeLatch;
    if (!focus) { this._causeLatch = null; return best; }
    if (best) {
      if (!latch || latch.entity !== best.cfg.entity) this._causeLatch = { entity: best.cfg.entity, at: best.last };
    } else if (latch) {
      infos.forEach(function (i) { if (i.cfg.entity === latch.entity) best = i; });
    }
    return best;
  };

  FlatSecurityCard.prototype._occupancyOn = function () {
    var cfg = this._cfg;
    if (!cfg.occupancy || !this._hass.states[cfg.occupancy]) return false;
    return this._hass.states[cfg.occupancy].state === "on";
  };
  FlatSecurityCard.prototype._occupancyLive = function () {
    var cfg = this._cfg, o = cfg.occupancy && this._hass.states[cfg.occupancy];
    return !!o && o.state !== "unavailable" && o.state !== "unknown";
  };

  /* ------------------------- render update -------------------------- */
  FlatSecurityCard.prototype._update = function () {
    if (!this._hass || !this._built) return;
    var cfg = this._cfg;
    var alarm = this._alarmObj();
    var st = this._alarmState();
    var infos = this._sensorInfo();
    var openInfos = infos.filter(function (i) { return i.open && i.avail; });
    var unavailInfos = infos.filter(function (i) { return !i.avail; });
    var now = Date.now();

    /* tick rate: 1s during countdowns; camera_refresh while the still is showing; 30s otherwise */
    var camLive = !!(this._elCam && this._expanded && this._hass.states[cfg.camera] && this._hass.states[cfg.camera].state !== "unavailable");
    this._startTick(st === "arming" || st === "pending" ? 1000 : (camLive ? Math.max(1, cfg.camera_refresh) * 1000 : 30000));

    /* ---- card surface ---- */
    if (st === "triggered") this._elCard.classList.add("triggered");
    else this._elCard.classList.remove("triggered");

    /* ---- shield ---- */
    var shieldColor = C.grey, showCheck = false, showAlert = false;
    if (st === "armed_away") { shieldColor = C.blue; showCheck = true; }
    else if (st === "arming") { shieldColor = C.amber; }
    else if (st === "pending") { shieldColor = C.warn; }
    else if (st === "triggered") { shieldColor = C.red; showAlert = true; }
    else if (st === "unavailable" || !alarm) { shieldColor = C.inkFaint; }
    var svg = this._elShield.querySelector("svg");
    if (svg.style.stroke !== shieldColor) svg.style.stroke = shieldColor;
    var chk = svg.querySelector(".sh-check"), alr = svg.querySelector(".sh-alert");
    if (chk.style.opacity !== (showCheck ? "1" : "0")) chk.style.opacity = showCheck ? "1" : "0";
    if (alr.style.opacity !== (showAlert ? "1" : "0")) alr.style.opacity = showAlert ? "1" : "0";

    /* ---- countdown ---- */
    var barPct = null, barColor = C.amber, remain = 0;
    if (alarm && (st === "arming" || st === "pending")) {
      var total = st === "arming" ? cfg.exit_delay : cfg.entry_delay;
      /* while the card is showing an optimistic "arming" that hass has not confirmed,
         count from the tap - alarm.last_changed still points at the old state */
      var startMs = this._optActive && st === "arming" ? this._optSetAt : new Date(alarm.last_changed).getTime();
      var elapsed = (now - startMs) / 1000;
      remain = Math.max(0, total - elapsed);
      barPct = Math.max(0, Math.min(100, (remain / total) * 100));
      barColor = st === "arming" ? C.amber : C.warn;
    }
    if (barPct !== null) {
      if (this._elBar.style.display !== "block") this._elBar.style.display = "block";
      this._elBarFill.style.width = barPct + "%";
      this._elBarFill.style.background = barColor;
    } else if (this._elBar.style.display !== "none") {
      this._elBar.style.display = "none";
    }

    /* ---- header text ---- */
    var l1 = "", l1c = C.ink, l2 = "", l2c = C.inkDim;
    var cause = this._causeSensor(infos, st);
    var openCount = openInfos.length;
    var occ = this._occupancyOn();
    var occLive = this._occupancyLive();
    var bypassed = infos.filter(function (i) { return i.bypassed; });
    var noSig = unavailInfos.length ? unavailInfos.length + " no signal" : "";

    if (!alarm || st === "unavailable") {
      l1 = "Unavailable"; l1c = C.inkFaint;
      l2 = "Alarmo is not responding";
    } else if (st === "disarmed") {
      l1 = "Disarmed"; l1c = C.ink;
      l2 = (openCount ? openCount + " open" : "All closed");
      if (occLive) l2 += MDOT + (occ ? "person in frame" : "camera idle");
      if (noSig) l2 = noSig + MDOT + l2;
    } else if (st === "arming") {
      l1 = "Arming"; l1c = C.amber;
      l2 = "Leave now" + MDOT + fmtMMSS(remain);
      if (noSig) { l2 = l2 + MDOT + noSig; l2c = C.warn; } /* before the bypass clause: it survives the ellipsis at 430px */
      if (openCount) l2 = l2 + MDOT + (openCount === 1 ? openInfos[0].name + " will be bypassed" : openCount + " will be bypassed");
    } else if (st === "armed_away") {
      l1 = "Armed Away"; l1c = C.blueInk;
      if (bypassed.length) {
        l2 = (bypassed.length === 1 ? bypassed[0].name : bypassed.length + " sensors") + " bypassed" + MDOT + "unguarded";
        l2c = C.warn;
      } else {
        l2 = "All closed" + MDOT + "watching since " + fmtClock(new Date(alarm.last_changed));
      }
      /* an unavailable contact while armed is unguarded - never fold it into "All closed" */
      if (noSig) { l2 = noSig + MDOT + l2; l2c = C.warn; }
    } else if (st === "pending") {
      l1 = "Entry Delay"; l1c = C.warn;
      l2 = (cause ? cause.name : "Entry") + MDOT + "disarm now" + MDOT + fmtMMSS(remain);
    } else if (st === "triggered") {
      l1 = "Triggered"; l1c = C.red;
      var when = cause ? fmtAgoShort(now - (this._causeLatch && this._causeLatch.entity === cause.cfg.entity ? this._causeLatch.at : cause.last)) : "";
      l2 = (cause ? cause.name : "Alarm") + (when ? MDOT + when + (when === "just now" ? "" : " ago") : "");
      l2c = C.redInk;
    } else {
      /* armed_home / vacation etc - render generically */
      l1 = st.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      l1c = C.blueInk;
      l2 = openCount ? openCount + " open" : "All closed";
      if (noSig) { l2 = noSig + MDOT + l2; l2c = C.warn; }
    }
    if (this._elL1.textContent !== l1) this._elL1.textContent = l1;
    if (this._elL1.style.color !== l1c) this._elL1.style.color = l1c;
    if (this._elL2.textContent !== l2) this._elL2.textContent = l2;
    if (this._elL2.style.color !== l2c) this._elL2.style.color = l2c;

    /* ---- header glyphs: up to 3 open-sensor icons (dashed if bypassed) ---- */
    var glyphHtml = "";
    openInfos.slice(0, 3).forEach(function (i) {
      var color = i.bypassed ? C.warn : C.amber;
      var dash = i.bypassed ? 'stroke-dasharray="3 2" ' : '';
      var body = SENSOR_ICONS[i.icon] || SENSOR_ICONS.window2;
      glyphHtml += '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" ' + dash + 'stroke-width="1.6" style="width:18px;height:18px;vertical-align:middle;margin-left:2px">' + body + '</svg>';
    });
    if (this._elGlOpen.innerHTML !== glyphHtml) this._elGlOpen.innerHTML = glyphHtml;
    var personShow = occ ? "inline-flex" : "none";
    if (this._elGlPerson.style.display !== personShow) this._elGlPerson.style.display = personShow;
    /* v1.5: package-waiting glyph + age (entity on = a delivery is sitting outside) */
    var pkg = cfg.package ? this._hass.states[cfg.package] : null;
    var pkgOn = !!(pkg && pkg.state === "on");
    var pkgShow = pkgOn ? "inline-flex" : "none";
    if (this._elGlPkg.style.display !== pkgShow) this._elGlPkg.style.display = pkgShow;
    if (pkgOn) {
      var ago = fmtAgoShort(now - new Date(pkg.last_changed).getTime());
      var pkgTx = ago === "just now" ? "<1m" : ago;
      if (this._elGlPkgTx.textContent !== pkgTx) this._elGlPkgTx.textContent = pkgTx;
    }

    /* ---- camera ---- */
    if (this._elCam) this._updateCamera(occ, now);

    /* ---- arm strip ---- */
    var stripCls = "armstrip", stripIc = SHIELD_SMALL, stripTx = "ARM AWAY", ghost = false;
    if (!alarm || st === "unavailable") { ghost = true; stripTx = "UNAVAILABLE"; stripIc = ""; }
    else if (st === "disarmed") { stripCls = "armstrip"; stripIc = SHIELD_SMALL; stripTx = "ARM AWAY"; }
    else if (st === "arming") { stripCls = "armstrip"; stripIc = XICON; stripTx = "CANCEL"; }
    else if (st === "pending") { stripCls = "armstrip disarm"; stripIc = LOCK; stripTx = "DISARM" + MDOT + fmtMMSS(remain); }
    else if (st === "triggered") { stripCls = "armstrip disarm hot"; stripIc = LOCK; stripTx = "DISARM"; }
    else { stripCls = "armstrip disarm"; stripIc = LOCK; stripTx = "DISARM"; }
    if (ghost) stripCls += " ghost";
    var nowShow = st === "arming" ? "flex" : "none";
    if (this._elStripNow.style.display !== nowShow) this._elStripNow.style.display = nowShow;
    /* keep pressed class across class rewrite */
    if (this._elStrip.classList.contains("pressed")) stripCls += " pressed";
    if (this._elStrip.className !== stripCls) this._elStrip.className = stripCls;
    if (this._elStripIc.innerHTML !== stripIc) this._elStripIc.innerHTML = stripIc;
    if (this._elStripTx.textContent !== stripTx) this._elStripTx.textContent = stripTx;

    /* ---- perimeter list ---- */
    this._updateList(infos, st, cause, now);
  };

  /* ---- camera sub-render ---- */
  FlatSecurityCard.prototype._updateCamera = function (occ, now) {
    var cfg = this._cfg, hass = this._hass;
    var cam = hass.states[cfg.camera];
    var alive = !!cam && cam.state !== "unavailable";

    if (alive) this._elCamLive.classList.remove("dead");
    else this._elCamLive.classList.add("dead");
    var lbl = this._elCamLive.querySelector(".camlbl");
    var lblTx = alive ? (cfg.camera_name || "ENTRY CAM") : "NO SIGNAL";
    if (lbl.textContent !== lblTx) lbl.textContent = lblTx;

    /* refresh still image every cfg.camera_refresh s while expanded */
    if (alive && this._expanded && cam.attributes.entity_picture) {
      if (now - this._camStamp > cfg.camera_refresh * 1000) {
        this._camStamp = now;
        var src = cam.attributes.entity_picture + "&fsc=" + now;
        this._elCamImg.src = src;
        if (this._elCamImg.style.display !== "block") this._elCamImg.style.display = "block";
      }
    } else if (!alive && this._elCamImg.style.display !== "none") {
      this._elCamImg.style.display = "none";
    }

    var pshow = occ ? "flex" : "none";
    if (this._elCamPerson.style.display !== pshow) this._elCamPerson.style.display = pshow;

    var stampTx = "";
    if (cfg.last_person && hass.states[cfg.last_person]) {
      if (occ) stampTx = "person now";
      else {
        var t = new Date(hass.states[cfg.last_person].state || hass.states[cfg.last_person].last_changed);
        if (!isNaN(t.getTime())) {
          var sameDay = new Date().toDateString() === t.toDateString();
          stampTx = "last person " + (sameDay ? fmtClock(t) : fmtAgoShort(now - t.getTime()) + " ago");
        }
      }
    }
    if (this._elCamStamp.textContent !== stampTx) this._elCamStamp.textContent = stampTx;
  };

  /* ---- perimeter list sub-render ---- */
  FlatSecurityCard.prototype._updateList = function (infos, st, cause, now) {
    var self = this;
    var focus = st === "pending" || st === "triggered";

    /* build render entries: focus mode shows only the cause; grouping merges
       quiet twins; open/bypassed/unavail always solo */
    var entries = [];
    if (focus && cause) {
      entries.push({ key: cause.cfg.entity, infos: [cause] });
    } else {
      var used = {};
      infos.forEach(function (i) {
        if (used[i.cfg.entity]) return;
        var quiet = i.avail && !i.open && !i.battery;
        var g = i.cfg.group;
        if (g && quiet) {
          var twins = infos.filter(function (o) {
            return o.cfg.group === g && o.avail && !o.open && !o.battery;
          });
          var allTwins = infos.filter(function (o) { return o.cfg.group === g; });
          if (twins.length === allTwins.length && twins.length > 1) {
            twins.forEach(function (o) { used[o.cfg.entity] = 1; });
            entries.push({ key: "g:" + g, infos: twins, groupName: g });
            return;
          }
        }
        used[i.cfg.entity] = 1;
        entries.push({ key: i.cfg.entity, infos: [i] });
      });
      /* sort: cause/red first, bypassed, open, closed, unavailable last */
      entries.sort(function (a, b) { return rank(a) - rank(b); });
    }
    function rank(e) {
      var i = e.infos[0];
      if (!i.avail) return 5;
      if (i.bypassed) return 1;
      if (i.open) return 2;
      return 3;
    }

    /* reconcile DOM: reuse rows by key, reorder via appendChild */
    var seen = {};
    entries.forEach(function (e) {
      var row = self._rows[e.key];
      if (!row) {
        row = document.createElement("div");
        row.className = "prow";
        row.innerHTML = '<span class="picwrap"></span><span class="nm"></span><span class="lc"></span><span class="st"></span>';
        pressable(row);
        (function (entry) {
          row.addEventListener("click", function () {
            self._moreInfo(entry.infos[0].cfg.entity);
          });
        })(e);
        self._rows[e.key] = row;
      }
      seen[e.key] = 1;
      self._renderRow(row, e, st, cause, now);
    });
    /* reconcile order: only touch rows that are out of place (a move is a DOM mutation) */
    entries.forEach(function (e, idx) {
      var row = self._rows[e.key];
      if (self._elPlist.children[idx] !== row) self._elPlist.insertBefore(row, self._elPlist.children[idx] || null);
    });
    Object.keys(this._rows).forEach(function (k) {
      if (!seen[k] && self._rows[k].parentNode) self._elPlist.removeChild(self._rows[k]);
    });
  };

  FlatSecurityCard.prototype._renderRow = function (row, entry, st, cause, now) {
    var i = entry.infos[0];
    var merged = entry.infos.length > 1;
    var armed = st === "armed_away";

    var cls = "prow";
    var stTx, name = merged ? entry.groupName : i.name, lcTx;

    if (!i.avail) { cls += " unavail"; stTx = "no signal"; }
    else if (st === "triggered" && cause && i.cfg.entity === cause.cfg.entity) { cls += " cause"; stTx = i.open ? "OPEN" : "TRIPPED"; }
    else if (st === "pending" && cause && i.cfg.entity === cause.cfg.entity) { cls += " open"; stTx = i.open ? "OPEN" : "TRIPPED"; }
    else if (i.bypassed) { cls += " bypassed"; stTx = "BYPASSED"; }
    else if (i.open) { cls += " open"; stTx = "OPEN"; }
    else { stTx = armed ? "guarding" : "closed"; }

    if (row.classList.contains("pressed")) cls += " pressed";
    if (row.className !== cls) row.className = cls;

    var newest = 0;
    entry.infos.forEach(function (o) { if (o.last > newest) newest = o.last; });
    var ago = fmtAgoShort(now - newest);
    if (i.bypassed && i.open) lcTx = "open " + (ago === "just now" ? "now" : ago);
    else lcTx = ago;

    var icw = row.querySelector(".picwrap");
    var wantIcon = i.icon;
    if (icw.getAttribute("data-ic") !== wantIcon) {
      icw.setAttribute("data-ic", wantIcon);
      icw.innerHTML = sensorSvg(wantIcon, "");
    }
    var nm = row.querySelector(".nm");
    var nmHtml = name + (i.battery !== null && !merged ? '<span class="bat">' + i.battery + '%</span>' : "");
    if (nm.innerHTML !== nmHtml) nm.innerHTML = nmHtml;
    var lc = row.querySelector(".lc");
    if (lc.textContent !== lcTx) lc.textContent = lcTx;
    var stEl = row.querySelector(".st");
    if (stEl.textContent !== stTx) stEl.textContent = stTx;
  };

  customElements.define("flat-security-card", FlatSecurityCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "flat-security-card",
    name: "Flat Security Card",
    description: "Collapsible Alarmo sentinel row + camera-forward security panel (v" + CARD_VERSION + ")"
  });
})();
