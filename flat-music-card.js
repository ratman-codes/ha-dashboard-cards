/* flat-music-card v1.26
   Whole-home music control card for Music Assistant sync groups.
   Flat-family bespoke card. Header row is a mini-player: album art,
   title/artist, prev/play/next - always visible, fixed ~60px.
   The card follows the ACTIVE output: group playing wins, else a
   solo-playing room, else the armed selection. Expanding reveals:
   a source line (which output + which app), shuffle / seek / stop /
   repeat, a progress line, group master volume ("Everywhere") above
   per-room group toggles + volume sliders (level-matchers), and an
   action strip: MA / playlists / balance / lock.
   Row interactions: tick = join/leave the sync group; label click =
   switch output there (transfer_queue while playing, arm when idle);
   number click = mute toggle (where supported); slider = volume.

   v1.2: header tap always expands; bigger transport; lock mode.
   v1.3: extras row gains stop and seek -30s/+30s.
   v1.4: active-output retargeting (header/transport/progress follow
   whatever is actually playing); source line (output name + app,
   derived from app_name or the media_content_id scheme); label-click
   output switching via music_assistant.transfer_queue; number-tap
   mute with hover affordance (hidden when player lacks mute).
   v1.5: mute hover pill centered on the number (fixed-width,
   center-aligned pct column).
   v1.6: header hover highlight (edge-to-edge, house convention);
   app label underscores rendered as spaces.
   v1.7: progress bar is a scrubber - click/drag seeks (tall
   invisible hit zone, line thickens on hover, optimistic hold
   after release).
   v1.8: fix - scrub zone was never bound to the pointer handler
   (selector missed .progzone), so clicks did nothing.
   v1.9: source line appends LIVE for duration-less streams
   (Spotify Connect / VBAN passthrough) so the missing progress
   bar is self-explanatory.
   v1.10: lock defaults ON (config lock_default: false to disable);
   hover washes on header + room labels switched to amber for
   visibility; card auto-expands on load when something is playing
   (load-time only - it never pops open/closed on its own after).
   v1.11: active lock chip styled amber; transport/extras buttons
   get a neutral white hover wash (distinct from the amber
   header/label hovers).
   v1.12: rooms accept balance_entity (an input_number entity id)
   as a live source for the balance baseline; numeric balance still
   works as fallback. Lets the card and any HA automations share
   one dynamic set of baseline helpers.
   v1.13: baseline editor - gear button in the strip unfolds a
   BALANCE BASELINES panel: steppers + "capture current volumes"
   edit a DRAFT only; save (sole write path, input_number.set_value)
   / reset / silent discard on close. Changed values green with
   "was" ghosts; UNSAVED tag while dirty.
   v1.14: strip wrap fix - gear merged into the balance chip as a
   split button (left zone applies, gear zone opens the editor);
   tighter chip padding/gap.
   v1.15: cast toggle chip in the strip (renders only when
   cast_on_script is configured): grey = tap runs cast_on_script,
   green = the active target is playing the cast stream (matched
   via cast_match substring in media_content_id) and tap runs
   cast_off_script. cast_label config (default "pc", "" = icon
   only). Chip padding trimmed another notch for room.
   v1.16: all strip chip labels configurable via labels: map
   (keys ma/playlists/balance/lock, "" = icon-only) - tune strip
   width in YAML, no card rebuilds.
   v1.17: lock folded into the balance split chip as an icon-only
   middle zone (balance | lock | gear) - amber when active;
   standalone lock chip removed.
   v1.18: strip_order config (list of ma/playlists/balance/cast)
   controls chip order in the strip.
   v1.19: split-chip zones stretch to full chip height so the
   lock's active wash and zone dividers reach the pill edges.
   v1.20: fix - v1.19's align-self made the split chip taller
   than its neighbors; zones still stretch, chip height back to
   content-sized.
   v1.21: baseline editor values are directly typable - the number
   is an invisible input (identical rendering); click to type,
   Enter/blur commits to the draft (clamped 0-100), Escape cancels,
   steppers unchanged.
   v1.22: lock can bind to an input_boolean via lock_entity - the
   chip reads/writes the helper (optimistic hold, follows external
   toggles), so automations can share the same lock state (e.g. a
   follow-the-leader volume automation). Without lock_entity the
   old card-internal lock behavior is unchanged; lock_default only
   applies to the internal fallback.
   v1.23: labels.lock works again (dead since the v1.17 split-chip
   fold-in) - labels: {lock: link} puts a text label in the lock
   zone; default stays icon-only.
   v1.24: fix - applying balance audibly un-muted muted rooms
   (volume_set overrides mute) while is_volume_muted stayed true,
   leaving a stale M in the UI. Balance apply now explicitly
   un-mutes muted rooms first (volume_mute false + optimistic
   clear) so the flag matches what you hear.
   v1.25: MUTE WINS everywhere else - a muted room is never
   volume-written by incidental paths (which would audibly un-mute
   it): lock-scaling skips muted rooms, and the Everywhere slider,
   while any member is muted, switches from the native group write
   to client-side proportional scaling of unmuted members only
   (native group write, and MA's server-side fan-out, resume when
   nothing is muted). Balance apply remains the deliberate
   unmute-and-reset gesture. Companion HA automation ("Follow:
   rooms track EVA-01 volume") skips muted rooms the same way.
   A muted room can drift off-ratio; unmute then balance/lock
   brings it back.
   v1.26: ANCHORED scaling mode. New config mode_entity (an
   input_select with options linear/anchored) + per-room
   low_entity/high_entity anchor helpers. linear = the existing
   ratio behavior, byte-for-byte. anchored = rooms move along
   per-room piecewise power curves through three ear-calibrated
   anchor rows (LOW / BASE / HIGH; BASE = the balance_entity
   helpers, shared with linear mode). Gear panel gains a mode
   toggle (writes the input_select so companion automations flip
   in lockstep) and, in anchored mode, a 3x3 typable anchor grid:
   tap a column header to arm it, "capture current" writes live
   volumes into the armed column (draft only; save = only write
   path, same rules as the baseline editor). Lock-scaling maps the
   dragged room to a log-space level via its own anchors and moves
   every other room to the same level. Balance apply = BASE row in
   both modes. Rooms missing anchor entities fall back to linear.
   Mute-wins policy unchanged in both modes.

   HOW-TO (hosting/update):
   - Ships as a base64 data: URL Lovelace resource:
       data:text/javascript;name=flat-music-card;base64,<BLOB>
   - Stored in .storage/lovelace_resources (included in HA backups).
   - To edit: decode base64 -> edit -> node --check -> re-encode ->
     replace resource via the Card Manager card (preferred) or
     Settings > Dashboards > Resources.
   - Zero external dependencies. Zero non-ASCII bytes.

   Example card YAML (placeholders - use your own entities):
     type: custom:flat-music-card
     group_entity: media_player.my_sync_group
     config_entry_id: <music assistant config entry id>
     ma_path: /<ma panel path>
     rooms:
       - entity: media_player.room_a
         name: Room A
         balance_entity: input_number.balance_room_a   # live helper
         low_entity: input_number.low_room_a     # anchored mode
         high_entity: input_number.high_room_a   # anchored mode
       - entity: media_player.room_b
         name: Room B
         balance: 70                                   # or a literal
   Options:
     cast_on_script: script.my_cast_script    # enables the cast chip
     cast_off_script: script.my_uncast_script
     cast_label: pc          # chip label; "" = icon only
     labels:                 # strip labels; "" = icon-only chip
       playlists: lists
     strip_order: [ma, cast, playlists, balance]  # chip order
     cast_match: vban_receiver  # substring marking the cast stream
     title: Music            # idle header label
     group_label: Everywhere # master row + source line label
     start_open: false       # force expanded on load
     lock_default: true      # ratio-lock active on load (fallback)
     lock_entity: input_boolean.my_music_lock  # shared lock helper
     mode_entity: input_select.my_scaling_mode # linear | anchored
     show_progress: true     # thin progress line
*/
(function () {
  "use strict";

  var ICONS = {
    note: "M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z",
    play: "M8,5.14V19.14L19,12.14L8,5.14Z",
    pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
    prev: "M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z",
    next: "M16,18H18V6H16M6,18L14.5,12L6,6V18Z",
    shuffle: "M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z",
    repeat: "M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z",
    repeatOne: "M13,15V9H12L10,10V11H11.5V15M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z",
    balance: "M12,3C10.73,3 9.6,3.8 9.18,5H3V7H4.95L2,14C1.53,16 3,17 5.5,17C8,17 9.56,16 9,14L6.05,7H9.17C9.5,7.85 10.15,8.5 11,8.83V20H2V22H22V20H13V8.82C13.85,8.5 14.5,7.85 14.82,7H17.95L15,14C14.53,16 16,17 18.5,17C21,17 22.56,16 22,14L19.05,7H21V5H14.83C14.4,3.8 13.27,3 12,3M5.5,10.25L7,14H4L5.5,10.25M18.5,10.25L20,14H17L18.5,10.25Z",
    openin: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
    playlist: "M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z",
    check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
    stop: "M18,18H6V6H18V18Z",
    lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
    cast: "M1,10V12A9,9 0 0,1 10,21H12C12,14.92 7.07,10 1,10M1,14V16A5,5 0 0,1 6,21H8A7,7 0 0,0 1,14M1,18V21H4A3,3 0 0,0 1,18M21,3H3C1.89,3 1,3.89 1,5V8H3V5H21V19H14V21H21A2,2 0 0,0 23,19V5C23,3.89 22.1,3 21,3Z",
    gear: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
    heart: "M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"
  };

  var ACCENT = "#4caf50";
  var ACCENT_SOFT = "rgba(76,175,80,.25)";
  var ACCENT_TXT = "#8fdb93";
  var AMBER = "#ff9c4a";
  var SUB = "var(--secondary-text-color, #9a9ba0)";
  var TRACK = "rgba(70,70,70,.3)";
  var LINE = "rgba(70,70,70,.25)";
  var OPT_MS = 8000;
  var FEAT_MUTE = 8;
  var NOTE_CH = "\u266a";
  var DOT_CH = " \u00b7 ";

  function svg(path, size) {
    return '<svg viewBox="0 0 24 24" style="width:' + size + "px;height:" + size +
      'px;display:block"><path fill="currentColor" d="' + path + '"></path></svg>';
  }

  function fireEvent(node, type, detail) {
    var ev = new CustomEvent(type, { bubbles: true, composed: true, detail: detail || {} });
    node.dispatchEvent(ev);
  }

  var FlatMusicCard = function () {
    var self = Reflect.construct(HTMLElement, [], FlatMusicCard);
    self._open = false;
    self._opt = {};
    self._drag = null;
    self._pickerOpen = false;
    self._pickerItems = null;
    self._pickerLoading = false;
    self._pickerFallback = false;
    self._pickerError = false;
    self._timer = null;
    self._built = false;
    self._lock = true;
    self._sel = null;
    self._blOpen = false;
    self._blDraft = null;
    self._blStored = null;
    self._ancDraft = null;
    self._ancStored = null;
    self._ancCol = 1;
    self._blModeShown = null;
    return self;
  };
  FlatMusicCard.prototype = Object.create(HTMLElement.prototype);
  FlatMusicCard.prototype.constructor = FlatMusicCard;
  Object.setPrototypeOf(FlatMusicCard, HTMLElement);

  FlatMusicCard.prototype.setConfig = function (config) {
    if (!config || !config.group_entity) throw new Error("group_entity is required");
    if (!config.rooms || !config.rooms.length) throw new Error("rooms list is required");
    this._config = config;
    this._open = !!config.start_open;
    this._lock = config.lock_default !== false;
    this._built = false;
  };

  FlatMusicCard.prototype.getCardSize = function () { return this._open ? 8 : 2; };

  Object.defineProperty(FlatMusicCard.prototype, "hass", {
    get: function () { return this._hass; },
    set: function (hass) {
      this._hass = hass;
      if (!this._config) return;
      if (!this._built) this._build();
      this._update();
    }
  });

  FlatMusicCard.prototype.connectedCallback = function () {
    var self = this;
    if (!this._timer) this._timer = setInterval(function () { self._updateProgress(); }, 1000);
  };
  FlatMusicCard.prototype.disconnectedCallback = function () {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  };

  /* ---------- build ---------- */

  FlatMusicCard.prototype._build = function () {
    var c = this._config;
    var root = this.shadowRoot || this.attachShadow({ mode: "open" });
    var showProg = c.show_progress !== false;
    var castLabel = c.cast_label === undefined ? "pc" : String(c.cast_label);
    var L = c.labels || {};
    function lbl(key, def) {
      var v = L[key] === undefined ? def : String(L[key]);
      return v ? "<span>" + v + "</span>" : "";
    }
    var chips = {
      ma: '<div class="chip" data-act="ma">' + svg(ICONS.openin, 12) + lbl("ma", "MA") + "</div>",
      playlists: '<div class="chip" data-act="picker">' + svg(ICONS.playlist, 13) + lbl("playlists", "playlists") + "</div>",
      balance: '<div class="chip split">' +
          '<span class="zone" data-act="balance">' + svg(ICONS.balance, 13) + lbl("balance", "balance") + "</span>" +
          '<span class="zone zlock" data-act="lock">' + svg(ICONS.lock, 12) + lbl("lock", "") + "</span>" +
          '<span class="zone zgear" data-act="bl">' + svg(ICONS.gear, 13) + "</span>" +
        "</div>",
      cast: c.cast_on_script
        ? '<div class="chip castchip" data-act="cast">' + svg(ICONS.cast, 13) +
          (castLabel ? "<span>" + castLabel + "</span>" : "") + "</div>"
        : ""
    };
    var order = Array.isArray(c.strip_order) ? c.strip_order : ["ma", "playlists", "balance", "cast"];
    var stripHtml = "";
    for (var oi = 0; oi < order.length; oi++) {
      if (chips[order[oi]]) stripHtml += chips[order[oi]];
    }

    var roomsHtml = "";
    for (var i = 0; i < c.rooms.length; i++) {
      roomsHtml +=
        '<div class="room" data-i="' + i + '">' +
          '<div class="tick" data-act="tick" data-i="' + i + '">' + svg(ICONS.check, 12) + "</div>" +
          '<div class="rn pick" data-act="pick" data-i="' + i + '"></div>' +
          '<div class="slider" data-slider="room" data-i="' + i + '">' +
            '<div class="fill"></div><div class="cap"></div>' +
          "</div>" +
          '<div class="pct" data-act="mute" data-i="' + i + '">--</div>' +
        "</div>";
    }

    root.innerHTML =
      "<style>" +
      ":host{display:block}" +
      "ha-card{border-radius:var(--ha-card-border-radius,12px);overflow:hidden;padding:0}" +
      ".hdr{display:flex;align-items:center;gap:12px;padding:8px 12px 8px 8px;min-height:60px;cursor:pointer;position:relative;transition:background .12s ease}" +
      ".hdr.pressed{background:rgba(70,70,70,.22)}" +
      "@media (hover:hover){.hdr:hover{background:rgba(255,193,7,.10)}}" +
      ".hart{width:46px;height:46px;border-radius:8px;background:rgba(70,70,70,.25);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(160,160,160,.55);background-size:cover;background-position:center;margin-left:4px}" +
      ".htxt{min-width:0;flex:1}" +
      ".ht{font-size:13.5px;font-weight:600;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".hs{font-size:11.5px;color:" + SUB + ";margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".hctl{display:flex;align-items:center;gap:8px;flex-shrink:0;position:relative;z-index:2}" +
      ".sk,.pp{display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s ease,background .12s ease;color:var(--primary-text-color);border-radius:50%}" +
      ".hctl .sk{width:38px;height:38px;color:" + SUB + "}" +
      ".hctl .pp{width:46px;height:46px;background:rgba(70,70,70,.3)}" +
      ".sk.pressed,.pp.pressed,.tick.pressed,.chip.pressed,.xb.pressed,.pkrow.pressed{transform:scale(.94);background:rgba(70,70,70,.22)}" +
      "@media (hover:hover){.hctl .sk:hover{background:rgba(255,255,255,.10)}.hctl .pp:hover{background:rgba(255,255,255,.18)}}" +
      ".bodywrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.4,0,.2,1)}" +
      ".bodywrap.open{grid-template-rows:1fr}" +
      ".body{overflow:hidden;min-height:0}" +
      ".srcline{display:flex;align-items:center;justify-content:center;gap:7px;padding:4px 16px 0;font-size:10.5px;letter-spacing:1px;font-weight:600;color:" + SUB + "}" +
      ".srcline .dot{width:5px;height:5px;border-radius:50%;background:rgba(120,120,120,.6)}" +
      ".srcline.live .dot{background:" + ACCENT + "}" +
      ".srcline b{color:" + ACCENT_TXT + ";font-weight:600}" +
      ".extras{display:flex;align-items:center;justify-content:center;gap:18px;height:40px}" +
      ".xb{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:" + SUB + ";transition:color .15s ease,background .12s ease,transform .12s ease}" +
      ".xb.on{color:" + ACCENT_TXT + "}" +
      ".xb.txt{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.3px}" +
      ".xb.off{opacity:.35;cursor:default}" +
      "@media (hover:hover){.xb:hover{background:rgba(255,255,255,.10)}}" +
      ".progzone{height:16px;display:none;align-items:center;cursor:pointer;margin:0 0 0;touch-action:none}" +
      ".progzone.on{display:flex}" +
      ".prog{height:2px;background:" + TRACK + ";position:relative;width:100%;transition:height .12s ease}" +
      "@media (hover:hover){.progzone:hover .prog{height:5px}}" +
      ".progzone.scrubbing .prog{height:5px}" +
      ".prog .pf{position:absolute;left:0;top:0;bottom:0;width:0%;background:rgba(76,175,80,.5)}" +
      ".mrow{display:flex;align-items:center;gap:11px;height:42px;margin:0 16px}" +
      ".mrow .rn{font-weight:500;flex:0 0 107px}" +
      ".rooms{border-top:1px solid " + LINE + ";margin:0 16px;padding:0 0 2px}" +
      ".room{display:flex;align-items:center;gap:11px;height:42px}" +
      ".tick{width:19px;height:19px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;border:1.5px solid rgba(70,70,70,.6);color:transparent;transition:background .15s ease,border-color .15s ease,transform .12s ease}" +
      ".tick.on{background:" + ACCENT_SOFT + ";color:" + ACCENT_TXT + ";border-color:transparent}" +
      ".rn{font-size:13px;flex:0 0 88px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".rn.pick{cursor:pointer;border-radius:7px;padding:4px 6px;margin-left:-6px;transition:background .12s ease}" +
      "@media (hover:hover){.rn.pick:hover{background:rgba(255,193,7,.14)}}" +
      ".rn.live{color:" + ACCENT_TXT + "}" +
      ".rn .nn{font-size:10px;margin-left:3px}" +
      ".room.dim .rn,.mrow.dim .rn{opacity:.45}" +
      ".slider{flex:1;height:5px;border-radius:3px;background:" + TRACK + ";position:relative;cursor:pointer;touch-action:none}" +
      ".slider .fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:" + ACCENT + ";border-radius:3px}" +
      ".room.dim .slider .fill,.mrow.dim .slider .fill{background:rgba(120,120,120,.35)}" +
      ".slider.muted .fill{background:rgba(120,120,120,.35)}" +
      ".slider .cap{position:absolute;top:50%;left:0%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#fff}" +
      ".slider.muted .cap{background:#9a9ba0}" +
      ".room.dim .slider .cap,.mrow.dim .slider .cap{display:none}" +
      ".room.dim .slider,.mrow.dim .slider{cursor:default}" +
      ".pct{font-size:11.5px;color:" + SUB + ";width:38px;flex-shrink:0;text-align:center;font-variant-numeric:tabular-nums;padding:5px 0;border-radius:9px;transition:background .12s ease,color .12s ease}" +
      ".pct.mutable{cursor:pointer}" +
      "@media (hover:hover){.pct.mutable:hover{background:rgba(255,156,74,.15);color:" + AMBER + "}}" +
      ".pct.m{color:" + AMBER + ";font-weight:600}" +
      ".strip{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border-top:1px solid " + LINE + ";margin:0 16px;flex-wrap:wrap;padding:4px 0}" +
      ".chip{display:flex;align-items:center;gap:5px;font-size:12px;color:" + SUB + ";padding:6px 10px;border-radius:16px;cursor:pointer;border:1px solid rgba(70,70,70,.4);transition:background .15s ease,color .15s ease,transform .12s ease}" +
      ".chip.castchip.on{color:" + ACCENT_TXT + ";border-color:rgba(76,175,80,.5);background:rgba(76,175,80,.12)}" +
      ".chip.active{color:var(--primary-text-color);background:rgba(70,70,70,.22)}" +
      ".chip.split .zlock.active{color:#ffc107;background:rgba(255,193,7,.14)}" +
      "@media (hover:hover){.chip:hover{background:rgba(70,70,70,.22);color:var(--primary-text-color)}}" +
      ".pickerwrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.4,0,.2,1)}" +
      ".pickerwrap.open{grid-template-rows:1fr}" +
      ".picker{overflow:hidden;min-height:0;margin:0 16px}" +
      ".pkinner{border-top:1px solid " + LINE + ";padding:6px 0 8px}" +
      ".pkhead{font-size:10.5px;letter-spacing:1px;color:" + SUB + ";font-weight:600;padding:6px 2px 4px}" +
      ".pkrow{display:flex;align-items:center;gap:10px;height:38px;padding:0 4px;border-radius:8px;cursor:pointer;transition:background .12s ease,transform .12s ease}" +
      "@media (hover:hover){.pkrow:hover{background:rgba(70,70,70,.18)}}" +
      ".pkrow .pi{width:26px;height:26px;border-radius:6px;background:rgba(70,70,70,.3);display:flex;align-items:center;justify-content:center;color:" + SUB + ";flex-shrink:0;background-size:cover;background-position:center}" +
      ".pkrow .pn{font-size:13px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".pkrow .ph{margin-left:auto;color:" + ACCENT_TXT + ";flex-shrink:0}" +
      ".pkfoot{font-size:11px;color:" + SUB + ";padding:6px 4px 2px;text-align:center}" +
      ".chip.split{padding:0;gap:0;overflow:hidden;align-items:stretch}" +
      ".chip.split .zone{display:flex;align-items:center;gap:5px;padding:6px 10px;cursor:pointer;transition:background .12s ease,color .12s ease}" +
      ".chip.split .zgear,.chip.split .zlock{border-left:1px solid rgba(70,70,70,.4);padding:6px 8px}" +
      ".chip.split .zgear.active{color:var(--primary-text-color);background:rgba(70,70,70,.28)}" +
      "@media (hover:hover){.chip.split .zone:hover{background:rgba(70,70,70,.22);color:var(--primary-text-color)}}" +
      ".blwrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.4,0,.2,1)}" +
      ".blwrap.open{grid-template-rows:1fr}" +
      ".blpanel{overflow:hidden;min-height:0;margin:0 16px}" +
      ".blinner{border-top:1px solid " + LINE + ";padding:6px 0 10px}" +
      ".blhead{font-size:10.5px;letter-spacing:1px;color:" + SUB + ";font-weight:600;padding:6px 2px 8px}" +
      ".blhead.hasmodes{display:flex;align-items:center;justify-content:space-between}" +
      ".bldirty{color:#ffc107}" +
      ".modes{display:flex;border:1px solid rgba(70,70,70,.4);border-radius:14px;overflow:hidden;font-size:11px;font-weight:600;letter-spacing:0}" +
      ".modes span{padding:4px 12px;color:" + SUB + ";cursor:pointer;transition:background .12s ease,color .12s ease}" +
      ".modes span.on{background:rgba(76,175,80,.18);color:#8fdb93}" +
      "@media (hover:hover){.modes span:not(.on):hover{background:rgba(255,255,255,.08);color:var(--primary-text-color)}}" +
      ".agrid{display:grid;grid-template-columns:86px 1fr 1fr 1fr;align-items:center;row-gap:2px}" +
      ".agrid .ach{font-size:10px;letter-spacing:1px;font-weight:600;color:" + SUB + ";text-align:center;padding:5px 0;border-radius:9px;cursor:pointer;transition:background .12s ease,color .12s ease}" +
      ".agrid .ach.sel{color:#ffc107;background:rgba(255,193,7,.10);box-shadow:inset 0 0 0 1px rgba(255,193,7,.4)}" +
      "@media (hover:hover){.agrid .ach:not(.sel):hover{background:rgba(255,255,255,.08)}}" +
      ".agrid .arn{font-size:12.5px;padding:7px 0;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".agrid .avin{width:100%;text-align:center;font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums;padding:6px 0;border-radius:8px;background:transparent;border:none;outline:none;color:var(--primary-text-color);font-family:inherit;cursor:text}" +
      "@media (hover:hover){.agrid .avin:hover{background:rgba(255,255,255,.08)}}" +
      ".agrid .avin:focus{background:rgba(255,255,255,.10)}" +
      ".agrid .avin.pend{color:#8fdb93}" +
      ".agrid .avin.selcol{background:rgba(255,193,7,.06)}" +
      ".agrid .avdash{text-align:center;font-size:13.5px;color:" + SUB + "}" +
      ".blrow{display:flex;align-items:center;gap:11px;height:38px}" +
      ".blrn{font-size:13px;flex:0 0 100px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".was{font-size:10px;color:" + SUB + ";margin-left:auto;font-variant-numeric:tabular-nums}" +
      ".blstep{display:flex;align-items:center;margin-left:auto}" +
      ".was + .blstep{margin-left:8px}" +
      ".bb{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:" + SUB + ";cursor:pointer;font-size:15px;transition:background .12s ease,color .12s ease}" +
      "@media (hover:hover){.bb:hover{background:rgba(255,255,255,.10);color:var(--primary-text-color)}}" +
      ".bb:active{transform:scale(.9)}" +
      ".bv{width:44px;text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--primary-text-color)}" +
      ".bvin{width:44px;text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--primary-text-color);background:transparent;border:none;outline:none;padding:2px 0;margin:0;font-family:inherit;border-radius:6px;transition:background .12s ease}" +
      ".bvin.pend{color:" + ACCENT_TXT + "}" +
      ".bvin:focus{background:rgba(255,255,255,.10)}" +
      "@media (hover:hover){.bvin:hover{background:rgba(255,255,255,.06);cursor:text}}" +
      ".bv.pend{color:" + ACCENT_TXT + "}" +
      ".blfoot{display:flex;justify-content:center;gap:8px;padding-top:10px;flex-wrap:wrap}" +
      ".blact{display:flex;align-items:center;gap:6px;font-size:12px;padding:6px 14px;border-radius:16px;cursor:pointer;border:1px solid rgba(70,70,70,.4);color:" + SUB + ";transition:background .12s ease,color .12s ease}" +
      "@media (hover:hover){.blact:hover{background:rgba(70,70,70,.22);color:var(--primary-text-color)}}" +
      ".blact.blsave-off{opacity:.4;cursor:default}" +
      ".blact.blsave-on{color:#0f1512;background:" + ACCENT + ";border-color:" + ACCENT + ";font-weight:600}" +
      "@media (hover:hover){.blact.blsave-on:hover{background:#5cb860}}" +
      ".blact.blreset{color:#ffc107;border-color:rgba(255,193,7,.4)}" +
      "@media (hover:hover){.blact.blreset:hover{background:rgba(255,193,7,.10);color:#ffc107}}" +
      ".blnote{font-size:10.5px;color:" + SUB + ";text-align:center;padding-top:7px}" +
      ".blnote.d{color:#ffc107}" +
      ".spacer{height:6px}" +
      "</style>" +
      "<ha-card>" +
        '<div class="hdr" data-act="toggle">' +
          '<div class="hart">' + svg(ICONS.note, 20) + "</div>" +
          '<div class="htxt"><div class="ht"></div><div class="hs"></div></div>' +
          '<div class="hctl">' +
            '<div class="sk" data-act="prev">' + svg(ICONS.prev, 19) + "</div>" +
            '<div class="pp" data-act="pp"></div>' +
            '<div class="sk" data-act="next">' + svg(ICONS.next, 19) + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="bodywrap"><div class="body">' +
          '<div class="srcline"><span class="dot"></span><span class="srctxt"></span></div>' +
          '<div class="extras">' +
            '<div class="xb" data-act="shuffle">' + svg(ICONS.shuffle, 17) + "</div>" +
            '<div class="xb txt" data-act="seekback">-30</div>' +
            '<div class="xb" data-act="stop">' + svg(ICONS.stop, 17) + "</div>" +
            '<div class="xb txt" data-act="seekfwd">+30</div>' +
            '<div class="xb" data-act="repeat"></div>' +
          "</div>" +
          (showProg ? '<div class="progzone" data-slider="prog"><div class="prog"><div class="pf"></div></div></div>' : "") +
          '<div class="mrow"><div class="rn pick" data-act="pick" data-g="1"></div>' +
            '<div class="slider" data-slider="master"><div class="fill"></div><div class="cap"></div></div>' +
            '<div class="pct" data-act="mute" data-g="1" data-master-pct>--</div></div>' +
          '<div class="rooms">' + roomsHtml + "</div>" +
          '<div class="strip">' + stripHtml + "</div>" +
          '<div class="blwrap"><div class="blpanel"><div class="blinner"></div></div></div>' +
          '<div class="pickerwrap"><div class="picker"><div class="pkinner"></div></div></div>' +
          '<div class="spacer"></div>' +
        "</div></div>" +
      "</ha-card>";

    this._els = {
      hdr: root.querySelector(".hdr"),
      hart: root.querySelector(".hart"),
      ht: root.querySelector(".ht"),
      hs: root.querySelector(".hs"),
      pp: root.querySelector('[data-act="pp"]'),
      shuffle: root.querySelector('[data-act="shuffle"]'),
      repeat: root.querySelector('[data-act="repeat"]'),
      seekback: root.querySelector('[data-act="seekback"]'),
      seekfwd: root.querySelector('[data-act="seekfwd"]'),
      srcline: root.querySelector(".srcline"),
      srctxt: root.querySelector(".srctxt"),
      bodywrap: root.querySelector(".bodywrap"),
      prog: root.querySelector(".prog"),
      progzone: root.querySelector(".progzone"),
      pf: root.querySelector(".pf"),
      rooms: root.querySelectorAll(".room"),
      masterRow: root.querySelector(".mrow"),
      masterLabel: root.querySelector(".mrow .rn"),
      masterSlider: root.querySelector('[data-slider="master"]'),
      masterPct: root.querySelector("[data-master-pct]"),
      pickerWrap: root.querySelector(".pickerwrap"),
      pkInner: root.querySelector(".pkinner"),
      pickerChip: root.querySelector('[data-act="picker"]'),
      lockChip: root.querySelector(".zlock"),
      gearBtn: root.querySelector(".zgear"),
      blWrap: root.querySelector(".blwrap"),
      blInner: root.querySelector(".blinner"),
      castChip: root.querySelector(".castchip")
    };
    this._bindEvents(root);
    this._built = true;
    this._els.bodywrap.classList.toggle("open", this._open);
    this._els.lockChip.classList.toggle("active", this._lockOn());
  };

  /* ---------- events ---------- */

  FlatMusicCard.prototype._bindEvents = function (root) {
    var self = this;

    function press(el) {
      el.addEventListener("pointerdown", function () { el.classList.add("pressed"); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
        el.addEventListener(t, function () { el.classList.remove("pressed"); });
      });
    }

    root.addEventListener("click", function (ev) {
      var el = ev.target;
      while (el && el !== root && !(el.dataset && el.dataset.act)) el = el.parentNode;
      if (!el || !el.dataset || !el.dataset.act) return;
      var act = el.dataset.act;
      if (act !== "toggle") ev.stopPropagation();
      if (act === "toggle") self._toggleOpen();
      else if (act === "pp") self._svc("media_play_pause", self._target().entity);
      else if (act === "prev") self._svc("media_previous_track", self._target().entity);
      else if (act === "next") self._svc("media_next_track", self._target().entity);
      else if (act === "tick") self._toggleRoom(parseInt(el.dataset.i, 10));
      else if (act === "pick") self._pickOutput(el.dataset.g ? -1 : parseInt(el.dataset.i, 10));
      else if (act === "mute") self._toggleMute(el.dataset.g ? -1 : parseInt(el.dataset.i, 10));
      else if (act === "shuffle") self._toggleShuffle();
      else if (act === "repeat") self._cycleRepeat();
      else if (act === "stop") self._svc("media_stop", self._target().entity);
      else if (act === "seekback") self._seek(-30);
      else if (act === "seekfwd") self._seek(30);
      else if (act === "ma") self._openMA();
      else if (act === "picker") self._togglePicker();
      else if (act === "balance") self._applyBalance();
      else if (act === "lock") self._toggleLock();
      else if (act === "bl") self._toggleBl();
      else if (act === "cast") self._toggleCast();
      else if (act === "blminus") self._blStep(parseInt(el.dataset.i, 10), -1);
      else if (act === "blplus") self._blStep(parseInt(el.dataset.i, 10), 1);
      else if (act === "blcap") self._blCapture();
      else if (act === "blreset") self._blReset();
      else if (act === "blsave") self._blSave();
      else if (act === "blmode") self._setScalingMode(el.dataset.mode);
      else if (act === "blcol") self._ancArm(parseInt(el.dataset.c, 10));
      else if (act === "anccap") self._ancCapture();
      else if (act === "ancreset") self._ancReset();
      else if (act === "ancsave") self._ancSave();
      else if (act === "pkplay") self._playPlaylist(el.dataset.uri);
    });

    press(this._els.hdr);
    var pressables = root.querySelectorAll(".sk,.pp,.tick,.chip:not(.split),.xb,.zone");
    for (var i = 0; i < pressables.length; i++) press(pressables[i]);

    var sliders = root.querySelectorAll(".slider, .progzone");
    for (var s = 0; s < sliders.length; s++) {
      (function (slider) {
        slider.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          self._sliderStart(slider, ev);
        });
      })(sliders[s]);
    }
    root.addEventListener("pointermove", function (ev) { self._sliderMove(ev); });
    ["pointerup", "pointercancel"].forEach(function (t) {
      root.addEventListener(t, function (ev) { self._sliderEnd(ev); });
    });
  };

  FlatMusicCard.prototype._toggleOpen = function () {
    this._open = !this._open;
    this._els.bodywrap.classList.toggle("open", this._open);
    if (!this._open && this._pickerOpen) this._setPicker(false);
    if (!this._open && this._blOpen) this._setBl(false);
    fireEvent(this, "card-size-changed", {});
  };

  /* ---------- active target ---------- */

  FlatMusicCard.prototype._target = function () {
    var c = this._config;
    var g = this._hass && this._hass.states[c.group_entity];
    if (g && (g.state === "playing" || g.state === "paused")) {
      return { entity: c.group_entity, isGroup: true, idx: -1, st: g };
    }
    for (var i = 0; i < c.rooms.length; i++) {
      var st = this._hass && this._hass.states[c.rooms[i].entity];
      if (st && (st.state === "playing" || st.state === "paused")) {
        return { entity: c.rooms[i].entity, isGroup: false, idx: i, st: st };
      }
    }
    if (this._sel && this._sel !== c.group_entity) {
      for (var j = 0; j < c.rooms.length; j++) {
        if (c.rooms[j].entity === this._sel) {
          return { entity: this._sel, isGroup: false, idx: j, st: this._hass && this._hass.states[this._sel] };
        }
      }
    }
    return { entity: c.group_entity, isGroup: true, idx: -1, st: g };
  };

  FlatMusicCard.prototype._pickOutput = function (idx) {
    var c = this._config;
    var dest = idx < 0 ? c.group_entity : c.rooms[idx].entity;
    var cur = this._target();
    if (cur.entity === dest) return;
    var st = cur.st;
    var live = st && (st.state === "playing" || st.state === "paused");
    if (live) {
      this._hass.callService("music_assistant", "transfer_queue", {
        entity_id: dest, source_player: cur.entity, auto_play: true
      });
      this._sel = null;
    } else {
      this._sel = dest;
    }
    this._update();
  };

  /* ---------- slider drag ---------- */

  FlatMusicCard.prototype._sliderStart = function (slider, ev) {
    var kind = slider.dataset.slider;
    var idx = kind === "room" ? parseInt(slider.dataset.i, 10) : -1;
    if (kind === "room") {
      var st = this._roomState(idx);
      if (!st || st.unavailable) return;
    }
    if (kind === "prog") {
      var t = this._target();
      var g = t.st;
      if (!g || typeof g.attributes.media_duration !== "number" || g.attributes.media_duration <= 0) return;
      slider.classList.add("scrubbing");
    }
    this._drag = { slider: slider, kind: kind, idx: idx };
    slider.setPointerCapture && slider.setPointerCapture(ev.pointerId);
    this._sliderSet(ev);
  };
  FlatMusicCard.prototype._sliderMove = function (ev) {
    if (!this._drag) return;
    this._sliderSet(ev);
  };
  FlatMusicCard.prototype._sliderEnd = function () {
    if (!this._drag) return;
    var d = this._drag;
    this._drag = null;
    if (d.kind === "prog") {
      d.slider.classList.remove("scrubbing");
      var po = this._opt.prog;
      if (!po) return;
      var t = this._target();
      var g = t.st;
      if (g && typeof g.attributes.media_duration === "number" && g.attributes.media_duration > 0) {
        po.until = Date.now() + 4000;
        this._svc("media_seek", t.entity, {
          seek_position: Math.round(po.val * g.attributes.media_duration)
        });
      }
      return;
    }
    var key = d.kind === "room" ? "room" + d.idx : "master";
    var opt = this._opt[key];
    if (!opt) return;
    var entity = d.kind === "room" ? this._config.rooms[d.idx].entity : this._config.group_entity;
    if (d.kind !== "room" && this._anyRoomMuted()) {
      this._masterScale(Math.round(opt.val));
    } else {
      this._hass.callService("media_player", "volume_set", {
        entity_id: entity, volume_level: Math.round(opt.val) / 100
      });
    }
    if (this._lockOn() && d.kind === "room") {
      for (var j = 0; j < this._config.rooms.length; j++) {
        if (j === d.idx) continue;
        var o = this._opt["room" + j];
        if (o && o.locked) {
          o.locked = false;
          this._hass.callService("media_player", "volume_set", {
            entity_id: this._config.rooms[j].entity, volume_level: o.val / 100
          });
        }
      }
    }
  };
  FlatMusicCard.prototype._sliderSet = function (ev) {
    var d = this._drag;
    if (!d) return;
    var rect = d.slider.getBoundingClientRect();
    var frac = (ev.clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    if (d.kind === "prog") {
      this._opt.prog = { val: frac, until: Date.now() + OPT_MS };
      this._els.pf.style.width = (frac * 100).toFixed(2) + "%";
      return;
    }
    var val = Math.round(frac * 100);
    var key = d.kind === "room" ? "room" + d.idx : "master";
    this._opt[key] = { val: val, until: Date.now() + OPT_MS };
    this._paintSlider(d.slider, val);
    var pctEl = d.kind === "room"
      ? this._els.rooms[d.idx].querySelector(".pct")
      : this._els.masterPct;
    pctEl.textContent = String(val);
    if (this._lockOn() && d.kind === "room") this._lockScale(d.idx, val);
  };

  FlatMusicCard.prototype._balanceOf = function (idx) {
    var room = this._config.rooms[idx];
    if (!room) return null;
    if (room.balance_entity && this._hass) {
      var st = this._hass.states[room.balance_entity];
      if (st) {
        var v = parseFloat(st.state);
        if (!isNaN(v) && v >= 0) return v;
      }
    }
    return typeof room.balance === "number" ? room.balance : null;
  };

  FlatMusicCard.prototype._lockScale = function (srcIdx, srcVal) {
    var rooms = this._config.rooms;
    var base = this._balanceOf(srcIdx);
    if (typeof base !== "number" || base <= 0) return;
    var factor = srcVal / base;
    var anchored = this._scalingMode() === "anchored";
    var srcAnc = anchored ? this._anchorsOf(srcIdx) : null;
    var srcLevel = anchored && this._ancUsable(srcAnc) && srcVal > 0
      ? this._levelOf(srcAnc, srcVal) : null;
    for (var j = 0; j < rooms.length; j++) {
      if (j === srcIdx) continue;
      var jbal = this._balanceOf(j);
      if (typeof jbal !== "number") continue;
      var st = this._roomState(j);
      if (!st || st.unavailable) continue;
      if (this._optVal("mute" + j, st.muted)) continue;
      var v;
      if (srcLevel !== null) {
        var jAnc = this._anchorsOf(j);
        v = this._ancUsable(jAnc)
          ? this._valueAt(jAnc, srcLevel)
          : Math.max(0, Math.min(100, Math.round(jbal * factor)));
      } else if (anchored && srcVal <= 0) {
        v = 0;
      } else {
        v = Math.max(0, Math.min(100, Math.round(jbal * factor)));
      }
      this._opt["room" + j] = { val: v, until: Date.now() + OPT_MS, locked: true };
      this._paintSlider(this._els.rooms[j].querySelector(".slider"), v);
      this._els.rooms[j].querySelector(".pct").textContent = String(v);
    }
  };

  FlatMusicCard.prototype._anyRoomMuted = function () {
    for (var i = 0; i < this._config.rooms.length; i++) {
      var st = this._roomState(i);
      if (st && !st.unavailable && st.inGroup && this._optVal("mute" + i, st.muted)) return true;
    }
    return false;
  };

  /* Client-side stand-in for MA's group volume scaling, used only
     while a member is muted: scales each UNMUTED in-group room
     proportionally and never writes to muted rooms (a volume_set
     would audibly un-mute them server-side). */
  FlatMusicCard.prototype._masterScale = function (newVal) {
    var g = this._hass.states[this._config.group_entity];
    var cur = g && typeof g.attributes.volume_level === "number"
      ? Math.round(g.attributes.volume_level * 100) : null;
    if (!cur || cur <= 0) {
      this._hass.callService("media_player", "volume_set", {
        entity_id: this._config.group_entity, volume_level: newVal / 100
      });
      return;
    }
    var factor = newVal / cur;
    for (var i = 0; i < this._config.rooms.length; i++) {
      var st = this._roomState(i);
      if (!st || st.unavailable || !st.inGroup || typeof st.vol !== "number") continue;
      if (this._optVal("mute" + i, st.muted)) continue;
      var v = Math.max(0, Math.min(100, Math.round(st.vol * factor)));
      this._opt["room" + i] = { val: v, until: Date.now() + OPT_MS };
      this._hass.callService("media_player", "volume_set", {
        entity_id: this._config.rooms[i].entity, volume_level: v / 100
      });
    }
  };

  FlatMusicCard.prototype._paintSlider = function (slider, val) {
    slider.querySelector(".fill").style.width = val + "%";
    slider.querySelector(".cap").style.left = val + "%";
  };

  /* ---------- actions ---------- */

  FlatMusicCard.prototype._svc = function (service, entity, data) {
    var payload = Object.assign({ entity_id: entity }, data || {});
    this._hass.callService("media_player", service, payload);
  };

  FlatMusicCard.prototype._seek = function (delta) {
    var t = this._target();
    var g = t.st;
    if (!g || (g.state !== "playing" && g.state !== "paused")) return;
    var dur = g.attributes.media_duration;
    if (typeof dur !== "number" || dur <= 0) return;
    var pos = g.attributes.media_position || 0;
    if (g.state === "playing" && g.attributes.media_position_updated_at) {
      var dt = (Date.now() - new Date(g.attributes.media_position_updated_at).getTime()) / 1000;
      pos += Math.max(0, dt);
    }
    var target = Math.max(0, Math.min(dur - 1, pos + delta));
    this._svc("media_seek", t.entity, { seek_position: Math.round(target) });
  };

  FlatMusicCard.prototype._toggleShuffle = function () {
    var t = this._target();
    var cur = !!(t.st && t.st.attributes.shuffle);
    this._opt.shuffle = { val: !cur, until: Date.now() + OPT_MS };
    this._svc("shuffle_set", t.entity, { shuffle: !cur });
    this._update();
  };

  FlatMusicCard.prototype._cycleRepeat = function () {
    var t = this._target();
    var cur = (t.st && t.st.attributes.repeat) || "off";
    var next = cur === "off" ? "all" : cur === "all" ? "one" : "off";
    this._opt.repeat = { val: next, until: Date.now() + OPT_MS };
    this._svc("repeat_set", t.entity, { repeat: next });
    this._update();
  };

  FlatMusicCard.prototype._toggleMute = function (idx) {
    var entity = idx < 0 ? this._config.group_entity : this._config.rooms[idx].entity;
    var st = this._hass.states[entity];
    if (!st || st.state === "unavailable") return;
    if (((st.attributes.supported_features || 0) & FEAT_MUTE) !== FEAT_MUTE) return;
    var cur = !!st.attributes.is_volume_muted;
    var key = idx < 0 ? "mutemaster" : "mute" + idx;
    this._opt[key] = { val: !cur, until: Date.now() + OPT_MS };
    this._svc("volume_mute", entity, { is_volume_muted: !cur });
    this._update();
  };

  FlatMusicCard.prototype._toggleRoom = function (idx) {
    var room = this._config.rooms[idx];
    var st = this._roomState(idx);
    if (!st || st.unavailable) return;
    var key = "tick" + idx;
    if (st.inGroup) {
      this._opt[key] = { val: 0, until: Date.now() + OPT_MS };
      this._hass.callService("media_player", "unjoin", { entity_id: room.entity });
    } else {
      this._opt[key] = { val: 1, until: Date.now() + OPT_MS };
      this._hass.callService("media_player", "join", {
        entity_id: this._config.group_entity, group_members: [room.entity]
      });
    }
    this._update();
  };

  FlatMusicCard.prototype._lockOn = function () {
    var e = this._config && this._config.lock_entity;
    if (e && this._hass) {
      var o = this._opt.lock;
      if (o && Date.now() < o.until) return o.val;
      var st = this._hass.states[e];
      if (st) return st.state === "on";
    }
    return this._lock;
  };

  FlatMusicCard.prototype._toggleLock = function () {
    var on = !this._lockOn();
    if (this._config.lock_entity && this._hass) {
      this._opt.lock = { val: on, until: Date.now() + OPT_MS };
      this._hass.callService("input_boolean", on ? "turn_on" : "turn_off", {
        entity_id: this._config.lock_entity
      });
    }
    this._lock = on;
    this._els.lockChip.classList.toggle("active", on);
  };

  /* ---------- scaling mode + anchor curves ---------- */

  FlatMusicCard.prototype._scalingMode = function () {
    var e = this._config && this._config.mode_entity;
    if (!e || !this._hass) return "linear";
    var o = this._opt.scalemode;
    if (o && Date.now() < o.until) return o.val;
    var st = this._hass.states[e];
    return st && st.state === "anchored" ? "anchored" : "linear";
  };

  FlatMusicCard.prototype._setScalingMode = function (mode) {
    if (!this._config.mode_entity || !this._hass) return;
    if (mode !== "linear" && mode !== "anchored") return;
    if (mode === this._scalingMode()) return;
    this._opt.scalemode = { val: mode, until: Date.now() + OPT_MS };
    this._hass.callService("input_select", "select_option", {
      entity_id: this._config.mode_entity, option: mode
    });
    if (this._blOpen) {
      this._blModeShown = mode;
      if (mode === "anchored") { this._ancStored = this._ancReadStored(); this._ancDraft = this._cloneAnc(this._ancStored); }
      else { this._blStored = this._blReadStored(); this._blDraft = this._blStored.slice(); }
      this._renderBl();
      fireEvent(this, "card-size-changed", {});
    }
  };

  FlatMusicCard.prototype._helperVal = function (entity) {
    if (!entity || !this._hass) return null;
    var st = this._hass.states[entity];
    if (!st) return null;
    var v = parseFloat(st.state);
    return isNaN(v) ? null : v;
  };

  /* anchors for room idx: [low, base, high] in slider % (null where missing) */
  FlatMusicCard.prototype._anchorsOf = function (idx) {
    var room = this._config.rooms[idx];
    if (!room) return null;
    var base = this._balanceOf(idx);
    return [
      this._helperVal(room.low_entity),
      typeof base === "number" ? base : null,
      this._helperVal(room.high_entity)
    ];
  };

  FlatMusicCard.prototype._ancUsable = function (a) {
    return !!(a && a[0] > 0 && a[1] > 0 && a[2] > 0 && a[0] !== a[1] && a[2] !== a[1]);
  };

  /* log-space level of value v against anchors [l,b,h]: 0=base, -1=low, +1=high */
  FlatMusicCard.prototype._levelOf = function (a, v) {
    if (v <= 0) return null;
    if (v >= a[1]) return Math.log(v / a[1]) / Math.log(a[2] / a[1]);
    return Math.log(v / a[1]) / Math.log(a[0] / a[1]) * -1;
  };

  /* value at level L for anchors [l,b,h] */
  FlatMusicCard.prototype._valueAt = function (a, L) {
    var v = L >= 0
      ? a[1] * Math.pow(a[2] / a[1], L)
      : a[1] * Math.pow(a[0] / a[1], -L);
    return Math.max(0, Math.min(100, Math.round(v)));
  };

  /* ---------- cast toggle ---------- */

  FlatMusicCard.prototype._castActive = function () {
    var t = this._target();
    var st = t.st;
    if (!st || (st.state !== "playing" && st.state !== "paused")) return false;
    var cid = st.attributes.media_content_id;
    var match = this._config.cast_match || "vban_receiver";
    return typeof cid === "string" && cid.indexOf(match) !== -1;
  };

  FlatMusicCard.prototype._toggleCast = function () {
    var c = this._config;
    var target = this._castActive() ? c.cast_off_script : c.cast_on_script;
    if (!target) return;
    this._hass.callService("script", "turn_on", { entity_id: target });
  };

  /* ---------- baseline editor ---------- */

  FlatMusicCard.prototype._toggleBl = function () { this._setBl(!this._blOpen); };

  FlatMusicCard.prototype._setBl = function (open) {
    this._blOpen = open;
    if (open) {
      if (this._pickerOpen) this._setPicker(false);
      var m = this._scalingMode();
      this._blModeShown = m;
      if (m === "anchored" && this._config.mode_entity) {
        this._ancStored = this._ancReadStored();
        this._ancDraft = this._cloneAnc(this._ancStored);
      } else {
        this._blStored = this._blReadStored();
        this._blDraft = this._blStored.slice();
      }
      this._renderBl();
    } else {
      this._blDraft = null;
      this._blStored = null;
      this._ancDraft = null;
      this._ancStored = null;
    }
    this._els.blWrap.classList.toggle("open", open);
    this._els.gearBtn.classList.toggle("active", open);
    fireEvent(this, "card-size-changed", {});
  };

  FlatMusicCard.prototype._blReadStored = function () {
    var out = [];
    for (var i = 0; i < this._config.rooms.length; i++) {
      var b = this._balanceOf(i);
      out.push(typeof b === "number" ? Math.round(b) : null);
    }
    return out;
  };

  FlatMusicCard.prototype._blDirty = function () {
    if (!this._blDraft || !this._blStored) return false;
    for (var i = 0; i < this._blDraft.length; i++) {
      if (this._blDraft[i] !== this._blStored[i]) return true;
    }
    return false;
  };

  FlatMusicCard.prototype._blRefreshClean = function () {
    if (!this._blOpen || !this._blStored || this._blDirty()) return;
    var fresh = this._blReadStored();
    for (var i = 0; i < fresh.length; i++) {
      if (fresh[i] !== this._blStored[i]) {
        this._blStored = fresh;
        this._blDraft = fresh.slice();
        this._renderBl();
        return;
      }
    }
  };

  FlatMusicCard.prototype._blStep = function (idx, delta) {
    if (!this._blDraft || this._blDraft[idx] === null) return;
    this._blDraft[idx] = Math.max(0, Math.min(100, this._blDraft[idx] + delta));
    this._renderBl();
  };

  FlatMusicCard.prototype._blCapture = function () {
    if (!this._blDraft) return;
    for (var i = 0; i < this._config.rooms.length; i++) {
      var st = this._roomState(i);
      if (st && !st.unavailable && typeof st.vol === "number" && this._blDraft[i] !== null) {
        this._blDraft[i] = st.vol;
      }
    }
    this._renderBl();
  };

  FlatMusicCard.prototype._blReset = function () {
    if (!this._blStored) return;
    this._blDraft = this._blStored.slice();
    this._renderBl();
  };

  FlatMusicCard.prototype._blSave = function () {
    if (!this._blDirty()) return;
    for (var i = 0; i < this._config.rooms.length; i++) {
      var room = this._config.rooms[i];
      if (!room.balance_entity) continue;
      if (this._blDraft[i] === null || this._blDraft[i] === this._blStored[i]) continue;
      this._hass.callService("input_number", "set_value", {
        entity_id: room.balance_entity, value: this._blDraft[i]
      });
    }
    this._blStored = this._blDraft.slice();
    this._renderBl();
  };

  FlatMusicCard.prototype._blHeadHtml = function (title, dirty) {
    var hasModes = !!this._config.mode_entity;
    var h = '<div class="blhead' + (hasModes ? " hasmodes" : "") + '"><span>' + title +
      (dirty ? ' <span class="bldirty">\u00b7 UNSAVED</span>' : "") + "</span>";
    if (hasModes) {
      var m = this._scalingMode();
      h += '<span class="modes">' +
        '<span data-act="blmode" data-mode="linear" class="' + (m === "linear" ? "on" : "") + '">linear</span>' +
        '<span data-act="blmode" data-mode="anchored" class="' + (m === "anchored" ? "on" : "") + '">anchored</span>' +
        "</span>";
    }
    return h + "</div>";
  };

  FlatMusicCard.prototype._renderBl = function () {
    var el = this._els.blInner;
    if (!el) return;
    if (this._scalingMode() === "anchored" && this._config.mode_entity) { this._renderAnc(); return; }
    if (!this._blDraft) return;
    var dirty = this._blDirty();
    var html = this._blHeadHtml("BALANCE BASELINES", dirty);
    for (var i = 0; i < this._config.rooms.length; i++) {
      var room = this._config.rooms[i];
      var name = room.name || room.entity;
      var v = this._blDraft[i];
      var stored = this._blStored[i];
      var editable = !!room.balance_entity && v !== null;
      var rowDirty = editable && v !== stored;
      html += '<div class="blrow">' +
        '<div class="blrn">' + this._escHtml(name) + "</div>" +
        (rowDirty ? '<span class="was">was ' + stored + "</span>" : "") +
        '<div class="blstep">' +
          (editable
            ? '<div class="bb" data-act="blminus" data-i="' + i + '">\u2212</div>' +
              '<input class="bvin' + (rowDirty ? " pend" : "") + '" data-bli="' + i + '" type="text" inputmode="numeric" maxlength="3" value="' + v + '">' +
              '<div class="bb" data-act="blplus" data-i="' + i + '">+</div>'
            : '<div class="bv">' + (v === null ? "--" : v) + "</div>") +
        "</div></div>";
    }
    html += '<div class="blfoot">' +
      '<div class="blact" data-act="blcap">\u21bb capture current</div>' +
      (dirty ? '<div class="blact blreset" data-act="blreset">reset</div>' : "") +
      '<div class="blact ' + (dirty ? "blsave-on" : "blsave-off") + '"' + (dirty ? ' data-act="blsave"' : "") + ">save</div>" +
    "</div>" +
    '<div class="blnote' + (dirty ? " d" : "") + '">' +
      (dirty ? "unsaved draft \u00b7 reset returns to stored values" : "edits are drafts until saved") + "</div>";
    el.innerHTML = html;
    var self = this;
    var ins = el.querySelectorAll(".bvin");
    for (var n = 0; n < ins.length; n++) {
      (function (inp) {
        var idx = parseInt(inp.dataset.bli, 10);
        inp.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { inp.blur(); }
          else if (ev.key === "Escape") { inp.value = String(self._blDraft[idx]); inp.blur(); }
          ev.stopPropagation();
        });
        inp.addEventListener("change", function () { self._blType(idx, inp); });
        inp.addEventListener("blur", function () { self._blType(idx, inp); });
        inp.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      })(ins[n]);
    }
  };

  FlatMusicCard.prototype._blType = function (idx, inp) {
    if (!this._blDraft || this._blDraft[idx] === null) return;
    var v = parseInt(String(inp.value).replace(/[^0-9]/g, ""), 10);
    if (isNaN(v)) { inp.value = String(this._blDraft[idx]); return; }
    v = Math.max(0, Math.min(100, v));
    if (v === this._blDraft[idx]) { inp.value = String(v); return; }
    this._blDraft[idx] = v;
    this._renderBl();
  };

  /* ---------- anchored (3x3) editor ---------- */

  FlatMusicCard.prototype._ancEntities = function (i) {
    var r = this._config.rooms[i];
    return [r.low_entity || null, r.balance_entity || null, r.high_entity || null];
  };

  FlatMusicCard.prototype._ancReadStored = function () {
    var out = [];
    for (var i = 0; i < this._config.rooms.length; i++) {
      var es = this._ancEntities(i);
      var row = [];
      for (var c = 0; c < 3; c++) {
        var v = this._helperVal(es[c]);
        row.push(typeof v === "number" ? Math.round(v) : null);
      }
      out.push(row);
    }
    return out;
  };

  FlatMusicCard.prototype._cloneAnc = function (a) {
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i].slice());
    return out;
  };

  FlatMusicCard.prototype._ancDirty = function () {
    if (!this._ancDraft || !this._ancStored) return false;
    for (var i = 0; i < this._ancDraft.length; i++) {
      for (var c = 0; c < 3; c++) {
        if (this._ancDraft[i][c] !== this._ancStored[i][c]) return true;
      }
    }
    return false;
  };

  FlatMusicCard.prototype._ancRefreshClean = function () {
    if (!this._blOpen || !this._ancStored || this._ancDirty()) return;
    var fresh = this._ancReadStored();
    for (var i = 0; i < fresh.length; i++) {
      for (var c = 0; c < 3; c++) {
        if (fresh[i][c] !== this._ancStored[i][c]) {
          this._ancStored = fresh;
          this._ancDraft = this._cloneAnc(fresh);
          this._renderBl();
          return;
        }
      }
    }
  };

  FlatMusicCard.prototype._ancArm = function (c) {
    if (c < 0 || c > 2 || c === this._ancCol) return;
    this._ancCol = c;
    this._renderBl();
  };

  FlatMusicCard.prototype._ancCapture = function () {
    if (!this._ancDraft) return;
    var c = this._ancCol;
    for (var i = 0; i < this._config.rooms.length; i++) {
      var st = this._roomState(i);
      if (st && !st.unavailable && typeof st.vol === "number" && this._ancDraft[i][c] !== null) {
        this._ancDraft[i][c] = st.vol;
      }
    }
    this._renderBl();
  };

  FlatMusicCard.prototype._ancReset = function () {
    if (!this._ancStored) return;
    this._ancDraft = this._cloneAnc(this._ancStored);
    this._renderBl();
  };

  FlatMusicCard.prototype._ancSave = function () {
    if (!this._ancDirty()) return;
    for (var i = 0; i < this._config.rooms.length; i++) {
      var es = this._ancEntities(i);
      for (var c = 0; c < 3; c++) {
        if (!es[c]) continue;
        if (this._ancDraft[i][c] === null || this._ancDraft[i][c] === this._ancStored[i][c]) continue;
        this._hass.callService("input_number", "set_value", {
          entity_id: es[c], value: this._ancDraft[i][c]
        });
      }
    }
    this._ancStored = this._cloneAnc(this._ancDraft);
    this._renderBl();
  };

  FlatMusicCard.prototype._ancType = function (i, c, inp) {
    if (!this._ancDraft || this._ancDraft[i][c] === null) return;
    var v = parseInt(String(inp.value).replace(/[^0-9]/g, ""), 10);
    if (isNaN(v)) { inp.value = String(this._ancDraft[i][c]); return; }
    v = Math.max(0, Math.min(100, v));
    if (v === this._ancDraft[i][c]) { inp.value = String(v); return; }
    this._ancDraft[i][c] = v;
    this._renderBl();
  };

  FlatMusicCard.prototype._renderAnc = function () {
    var el = this._els.blInner;
    if (!el || !this._ancDraft) return;
    var dirty = this._ancDirty();
    var labels = ["LOW", "BASE", "HIGH"];
    var html = this._blHeadHtml("VOLUME ANCHORS", dirty);
    html += '<div class="agrid"><div></div>';
    for (var c = 0; c < 3; c++) {
      html += '<div class="ach' + (c === this._ancCol ? " sel" : "") + '" data-act="blcol" data-c="' + c + '">' + labels[c] + "</div>";
    }
    for (var i = 0; i < this._config.rooms.length; i++) {
      var room = this._config.rooms[i];
      html += '<div class="arn">' + this._escHtml(room.name || room.entity) + "</div>";
      for (var k = 0; k < 3; k++) {
        var v = this._ancDraft[i][k];
        var stored = this._ancStored[i][k];
        var editable = !!this._ancEntities(i)[k] && v !== null;
        html += editable
          ? '<input class="avin' + (v !== stored ? " pend" : "") + (k === this._ancCol ? " selcol" : "") + '" data-ar="' + i + '" data-ac="' + k + '" type="text" inputmode="numeric" maxlength="3" value="' + v + '">'
          : '<div class="avdash">--</div>';
      }
    }
    html += "</div>";
    html += '<div class="blfoot">' +
      '<div class="blact" data-act="anccap">\u21bb capture current</div>' +
      (dirty ? '<div class="blact blreset" data-act="ancreset">reset</div>' : "") +
      '<div class="blact ' + (dirty ? "blsave-on" : "blsave-off") + '"' + (dirty ? ' data-act="ancsave"' : "") + ">save</div>" +
    "</div>" +
    '<div class="blnote' + (dirty ? " d" : "") + '">' +
      (dirty ? "unsaved draft \u00b7 reset returns to stored values" : "tap a column header to arm it \u00b7 capture writes live volumes into the armed column") + "</div>";
    el.innerHTML = html;
    var self = this;
    var ins = el.querySelectorAll(".avin");
    for (var n = 0; n < ins.length; n++) {
      (function (inp) {
        var ri = parseInt(inp.dataset.ar, 10);
        var ci = parseInt(inp.dataset.ac, 10);
        inp.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { inp.blur(); }
          else if (ev.key === "Escape") { inp.value = String(self._ancDraft[ri][ci]); inp.blur(); }
          ev.stopPropagation();
        });
        inp.addEventListener("change", function () { self._ancType(ri, ci, inp); });
        inp.addEventListener("blur", function () { self._ancType(ri, ci, inp); });
        inp.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      })(ins[n]);
    }
  };

  FlatMusicCard.prototype._applyBalance = function () {
    for (var i = 0; i < this._config.rooms.length; i++) {
      var room = this._config.rooms[i];
      var bal = this._balanceOf(i);
      if (typeof bal !== "number") continue;
      var st = this._roomState(i);
      if (!st || st.unavailable) continue;
      if (st.muted && st.canMute) {
        this._opt["mute" + i] = { val: false, until: Date.now() + OPT_MS };
        this._svc("volume_mute", room.entity, { is_volume_muted: false });
      }
      this._opt["room" + i] = { val: bal, until: Date.now() + OPT_MS };
      this._hass.callService("media_player", "volume_set", {
        entity_id: room.entity, volume_level: bal / 100
      });
    }
    this._update();
  };

  FlatMusicCard.prototype._openMA = function () {
    var path = this._config.ma_path || "/media-browser";
    history.pushState(null, "", path);
    fireEvent(window, "location-changed", {});
  };

  /* ---------- playlist picker ---------- */

  FlatMusicCard.prototype._togglePicker = function () {
    this._setPicker(!this._pickerOpen);
    if (this._pickerOpen && !this._pickerItems && !this._pickerLoading) this._loadPlaylists();
    else if (this._pickerOpen) this._renderPicker();
  };
  FlatMusicCard.prototype._setPicker = function (open) {
    if (open && this._blOpen) this._setBl(false);
    this._pickerOpen = open;
    this._els.pickerWrap.classList.toggle("open", open);
    this._els.pickerChip.classList.toggle("active", open);
    fireEvent(this, "card-size-changed", {});
  };

  FlatMusicCard.prototype._loadPlaylists = function () {
    var self = this;
    this._pickerLoading = true;
    this._pickerError = false;
    this._renderPicker();
    this._fetchLibrary(true).then(function (items) {
      if (items && items.length) { self._pickerFallback = false; return items; }
      self._pickerFallback = true;
      return self._fetchLibrary(false);
    }).then(function (items) {
      items = items || [];
      items.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      self._pickerItems = items;
      self._pickerLoading = false;
      self._renderPicker();
    }).catch(function () {
      self._pickerItems = [];
      self._pickerLoading = false;
      self._pickerError = true;
      self._renderPicker();
    });
  };

  FlatMusicCard.prototype._fetchLibrary = function (favoritesOnly) {
    var data = { media_type: "playlist", favorite: favoritesOnly };
    if (this._config.config_entry_id) data.config_entry_id = this._config.config_entry_id;
    return this._hass.callWS({
      type: "call_service",
      domain: "music_assistant",
      service: "get_library",
      service_data: data,
      return_response: true
    }).then(function (res) {
      var r = res && res.response ? res.response : res;
      var items = (r && (r.items || r.playlists)) || [];
      return items.map(function (it) {
        return { name: it.name || "?", uri: it.uri || it.media_id || it.item_id, image: it.image || null };
      }).filter(function (it) { return it.uri && it.name; });
    });
  };

  FlatMusicCard.prototype._renderPicker = function () {
    var el = this._els.pkInner;
    if (this._pickerLoading) { el.innerHTML = '<div class="pkfoot">loading...</div>'; return; }
    if (this._pickerError) {
      el.innerHTML = '<div class="pkfoot">could not load playlists - check config_entry_id</div>';
      return;
    }
    var items = this._pickerItems || [];
    var head = this._pickerFallback ? "ALL PLAYLISTS" : "FAVORITE PLAYLISTS";
    var tname = this._targetName().toUpperCase();
    var html = '<div class="pkhead">' + head + DOT_CH + "PLAYS ON " + this._escHtml(tname) + "</div>";
    if (!items.length) {
      html += '<div class="pkfoot">no playlists found</div>';
    } else {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var img = it.image ? ' style="background-image:url(' + String(it.image).replace(/"/g, "") + ')"' : "";
        html +=
          '<div class="pkrow" data-act="pkplay" data-uri="' + this._escAttr(it.uri) + '">' +
            '<div class="pi"' + img + ">" + (it.image ? "" : svg(ICONS.note, 13)) + "</div>" +
            '<div class="pn">' + this._escHtml(it.name) + "</div>" +
            (this._pickerFallback ? "" : '<div class="ph">' + svg(ICONS.heart, 11) + "</div>") +
          "</div>";
      }
      html += '<div class="pkfoot">' +
        (this._pickerFallback ? "heart playlists in MA to curate this list" : "curated by hearts in MA") +
        "</div>";
    }
    el.innerHTML = html;
    var rows = el.querySelectorAll(".pkrow");
    for (var r = 0; r < rows.length; r++) {
      (function (row) {
        row.addEventListener("pointerdown", function () { row.classList.add("pressed"); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
          row.addEventListener(t, function () { row.classList.remove("pressed"); });
        });
      })(rows[r]);
    }
  };

  FlatMusicCard.prototype._playPlaylist = function (uri) {
    this._hass.callService("music_assistant", "play_media", {
      entity_id: this._target().entity,
      media_id: uri,
      media_type: "playlist"
    });
    this._setPicker(false);
  };

  FlatMusicCard.prototype._escHtml = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  FlatMusicCard.prototype._escAttr = function (s) {
    return this._escHtml(s).replace(/"/g, "&quot;");
  };

  /* ---------- state + paint ---------- */

  FlatMusicCard.prototype._roomState = function (idx) {
    var room = this._config.rooms[idx];
    var st = this._hass ? this._hass.states[room.entity] : null;
    var g = this._hass ? this._hass.states[this._config.group_entity] : null;
    var members = (g && g.attributes && g.attributes.group_members) || [];
    if (!st) return { unavailable: true, inGroup: false, vol: null, muted: false, canMute: false };
    return {
      unavailable: st.state === "unavailable" || st.state === "unknown",
      inGroup: members.indexOf(room.entity) !== -1,
      vol: typeof st.attributes.volume_level === "number" ? Math.round(st.attributes.volume_level * 100) : null,
      muted: !!st.attributes.is_volume_muted,
      canMute: ((st.attributes.supported_features || 0) & FEAT_MUTE) === FEAT_MUTE
    };
  };

  FlatMusicCard.prototype._optVal = function (key, real) {
    var o = this._opt[key];
    if (o && Date.now() < o.until) return o.val;
    if (o) delete this._opt[key];
    return real;
  };

  FlatMusicCard.prototype._targetName = function () {
    var t = this._target();
    if (t.isGroup) return this._config.group_label || "Everywhere";
    var r = this._config.rooms[t.idx];
    return (r && (r.name || r.entity)) || "?";
  };

  FlatMusicCard.prototype._appLabel = function (st) {
    if (!st) return null;
    var an = st.attributes.app_name;
    if (an && String(an).toLowerCase().indexOf("music") === -1) return String(an).replace(/_/g, " ").toUpperCase();
    var cid = st.attributes.media_content_id;
    if (typeof cid === "string") {
      var m = cid.match(/^([a-z0-9_]+)(?:--[A-Za-z0-9]+)?:\/\//i);
      if (m) {
        var s0 = m[1].toLowerCase();
        if (s0 === "http" || s0 === "https") return "STREAM";
        return s0.replace(/_/g, " ").toUpperCase();
      }
    }
    return null;
  };

  FlatMusicCard.prototype._update = function () {
    if (!this._built || !this._hass) return;
    var c = this._config;
    this._els.lockChip.classList.toggle("active", this._lockOn());
    var t = this._target();
    var st = t.st;
    var playing = st && st.state === "playing";
    var paused = st && st.state === "paused";
    if (!this._didInitOpen) {
      this._didInitOpen = true;
      if (!this._open && (playing || paused)) {
        this._open = true;
        this._els.bodywrap.classList.add("open");
        fireEvent(this, "card-size-changed", {});
      }
    }
    var title = st && st.attributes.media_title;
    var artist = st && st.attributes.media_artist;

    // header mini-player (follows active target)
    if (playing || paused) {
      this._els.ht.textContent = title || "Unknown";
      this._els.hs.textContent = artist || (paused ? "Paused" : "Playing");
    } else {
      this._els.ht.textContent = c.title || "Music";
      this._els.hs.textContent = "Idle";
    }
    this._els.pp.innerHTML = svg(playing ? ICONS.pause : ICONS.play, 18);
    var pic = st && st.attributes.entity_picture;
    if (pic) {
      this._els.hart.style.backgroundImage = "url(" + pic + ")";
      if (this._els.hart.firstElementChild) this._els.hart.firstElementChild.style.display = "none";
    } else {
      this._els.hart.style.backgroundImage = "";
      if (this._els.hart.firstElementChild) this._els.hart.firstElementChild.style.display = "block";
    }

    // source line
    var tname = this._targetName().toUpperCase();
    var app = (playing || paused) ? this._appLabel(st) : null;
    var noDur = (playing || paused) && !(st && typeof st.attributes.media_duration === "number" && st.attributes.media_duration > 0);
    this._els.srcline.classList.toggle("live", !!playing);
    this._els.srctxt.innerHTML = "<b>" + this._escHtml(tname) + "</b>" +
      (app ? DOT_CH + this._escHtml(app) : "") +
      (noDur ? DOT_CH + "LIVE" : ((playing || paused) ? "" : DOT_CH + "IDLE"));

    // extras (follow target)
    var seekable = st && (playing || paused) &&
      typeof st.attributes.media_duration === "number" && st.attributes.media_duration > 0;
    this._els.seekback.classList.toggle("off", !seekable);
    this._els.seekfwd.classList.toggle("off", !seekable);
    var shuf = this._optVal("shuffle", !!(st && st.attributes.shuffle));
    this._els.shuffle.classList.toggle("on", !!shuf);
    var rep = this._optVal("repeat", (st && st.attributes.repeat) || "off");
    this._els.repeat.classList.toggle("on", rep !== "off");
    this._els.repeat.innerHTML = svg(rep === "one" ? ICONS.repeatOne : ICONS.repeat, 17);

    // master (Everywhere) row
    var g = this._hass.states[c.group_entity];
    var gvol = g && typeof g.attributes.volume_level === "number" ? Math.round(g.attributes.volume_level * 100) : null;
    var unavailG = !g || g.state === "unavailable";
    var glabel = c.group_label || "Everywhere";
    var gLive = t.isGroup && (playing || paused);
    this._els.masterLabel.innerHTML = this._escHtml(glabel) + (gLive ? '<span class="nn">' + NOTE_CH + "</span>" : "");
    this._els.masterLabel.classList.toggle("live", gLive);
    this._els.masterRow.classList.toggle("dim", unavailG);
    var gCanMute = g && ((g.attributes.supported_features || 0) & FEAT_MUTE) === FEAT_MUTE && !unavailG;
    var gMuted = this._optVal("mutemaster", !!(g && g.attributes.is_volume_muted));
    this._els.masterPct.classList.toggle("mutable", !!gCanMute);
    this._els.masterSlider.classList.toggle("muted", !!gMuted && !unavailG);
    if (gvol === null || unavailG) {
      this._els.masterPct.textContent = "--";
      this._els.masterPct.classList.remove("m");
    } else if (gMuted) {
      this._els.masterPct.textContent = "M";
      this._els.masterPct.classList.add("m");
      this._paintSlider(this._els.masterSlider, this._optVal("master", gvol));
    } else {
      var mv = this._optVal("master", gvol);
      this._els.masterPct.textContent = String(mv);
      this._els.masterPct.classList.remove("m");
      this._paintSlider(this._els.masterSlider, mv);
    }

    // rooms
    for (var i = 0; i < c.rooms.length; i++) {
      var row = this._els.rooms[i];
      var rst = this._roomState(i);
      var rname = c.rooms[i].name || c.rooms[i].entity;
      var rLive = !t.isGroup && t.idx === i && (playing || paused);
      row.classList.toggle("dim", !!rst.unavailable);
      var rn = row.querySelector(".rn");
      rn.innerHTML = this._escHtml(rname) + (rLive ? '<span class="nn">' + NOTE_CH + "</span>" : "");
      rn.classList.toggle("live", rLive);
      var tick = row.querySelector(".tick");
      var inG = this._optVal("tick" + i, rst.inGroup ? 1 : 0);
      tick.classList.toggle("on", !!inG && !rst.unavailable);
      var pct = row.querySelector(".pct");
      var slider = row.querySelector(".slider");
      var muted = this._optVal("mute" + i, rst.muted);
      pct.classList.toggle("mutable", !!rst.canMute && !rst.unavailable);
      slider.classList.toggle("muted", !!muted && !rst.unavailable);
      if (rst.unavailable || rst.vol === null) {
        pct.textContent = "--";
        pct.classList.remove("m");
        slider.querySelector(".fill").style.width = "0%";
      } else if (muted) {
        pct.textContent = "M";
        pct.classList.add("m");
        this._paintSlider(slider, this._optVal("room" + i, rst.vol));
      } else {
        var v = this._optVal("room" + i, rst.vol);
        pct.textContent = String(v);
        pct.classList.remove("m");
        this._paintSlider(slider, v);
      }
    }

    if (this._els.castChip) this._els.castChip.classList.toggle("on", this._castActive());
    if (this._blOpen) {
      var blMode = this._scalingMode();
      if (this._blModeShown !== blMode) {
        this._blModeShown = blMode;
        if (blMode === "anchored" && c.mode_entity) {
          this._ancStored = this._ancReadStored();
          this._ancDraft = this._cloneAnc(this._ancStored);
        } else {
          this._blStored = this._blReadStored();
          this._blDraft = this._blStored.slice();
        }
        this._renderBl();
        fireEvent(this, "card-size-changed", {});
      } else if (blMode === "anchored" && c.mode_entity) {
        this._ancRefreshClean();
      } else {
        this._blRefreshClean();
      }
    }
    this._updateProgress();
  };

  FlatMusicCard.prototype._updateProgress = function () {
    if (!this._built || !this._els.progzone) return;
    var t = this._target();
    var g = t.st;
    var show = this._config.show_progress !== false && g && (g.state === "playing" || g.state === "paused") &&
      typeof g.attributes.media_duration === "number" && g.attributes.media_duration > 0;
    this._els.progzone.classList.toggle("on", !!show);
    if (!show) return;
    if (this._drag && this._drag.kind === "prog") return;
    var po = this._opt.prog;
    if (po && Date.now() < po.until) {
      this._els.pf.style.width = (po.val * 100).toFixed(2) + "%";
      return;
    }
    var pos = g.attributes.media_position || 0;
    if (g.state === "playing" && g.attributes.media_position_updated_at) {
      var dt = (Date.now() - new Date(g.attributes.media_position_updated_at).getTime()) / 1000;
      pos += Math.max(0, dt);
    }
    var frac = Math.max(0, Math.min(1, pos / g.attributes.media_duration));
    this._els.pf.style.width = (frac * 100).toFixed(2) + "%";
  };

  customElements.define("flat-music-card", FlatMusicCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "flat-music-card",
    name: "Flat Music Card",
    description: "Whole-home Music Assistant control in the flat-card family."
  });
})();
