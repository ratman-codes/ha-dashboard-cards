/* flat-front-door-card v1.4.2
 *
 * v1.4.2: (i) vertically centred on its row; pop-out tab changes re-render ONLY the
 * heatmap block (the previous grid stays, dimmed, until the new window arrives) instead
 * of rebuilding the whole overlay - no more flash of the gallery.
 *
 * v1.4.1: the (i) is now the house standard from the vacuum card - ha-icon
 * mdi:information-outline at 12px, dim grey, hover shows a dark tooltip bubble
 * positioned inside the card, tap makes it sticky, tap anywhere else hides it.
 * The v1.1 hand-drawn glyph + inline note toggle are gone.
 *
 * v1.4: header condensed (owner: the label is not worth 22px). Layout B of the header
 * mockup - 56px tall, 14px title, same icon slot / text-start x / chevron as the security
 * card so the two stack cleanly. Icon = a doorbell-shaped glyph (pill, lens, button ring,
 * faint detection arcs) in blue; amber for the rest of the day after a ring.
 *
 * v1.3: PERMANENT HEATMAP. Optional `walkers_stats:` = a total_increasing sensor that
 * mirrors a counter bumped on every person detection (see the notes doc for the
 * 3-piece pipeline). When set, the pop-out heatmap reads recorder/statistics_during_period
 * (hourly `change` = detections in that hour) - long-term statistics are never purged, so
 * the tabs become 7d / 30d / 90d / 1y and each cell shows the AVERAGE per weekday-hour
 * over the weeks in the window (tooltip carries the count and the week count). Without
 * it the heatmap falls back to raw history (7d / 14d, ~10 days of recorder).
 *
 * v1.2: PACKAGE WAITING glyph moved here from the security card (owner: it belongs on
 * the front-door card). Optional `package_waiting:` = an on/off entity that is ON while a
 * delivery sits outside; while on, the header shows a box icon + age ("1h 12m") in
 * orange, tap = that entity's more-info. Chevron sized 18px to match the security card
 * exactly (its .gl svg rule wins over .chev there).
 *
 * v1.1 (owner feedback on the first live render): header chrome matches the security
 * card it sits under (bare 34px icon, 22px title, 11.5px subtitle, 16px chevron);
 * ONE entry point to the pop-out ("history" beside Snapshots) - the redundant
 * "Walkway pattern" row is gone; the explanatory footer became an (i) glyph in the
 * LAST 24H header (hover title, tap toggles the note); lingering marks now come from
 * the lingering_<timestamp>.jpg snapshot files instead of the automation's history -
 * the recorder does not store last_triggered, so the v1.0 approach could never work.
 *
 * Front-door activity card for a battery doorbell whose events reach Home Assistant
 * as binary sensors (ring / package / vehicle / person) and whose notification
 * snapshots land as dated files in a media folder. Layout A of the 2026-09-05 mockup:
 *   - collapsed header: "1 package - 1 lingering - 23 walkers today"
 *   - LAST 24H: one tick row per event type (Ring, Package, Lingering, Vehicle) over
 *     a shared 24-hour axis, then a WALKERS density strip (person detections per hour
 *     - most are pass-throughs on a shared walkway, so they are counted, not ticked)
 *   - SNAPSHOTS: the newest N thumbnails from the media folder, kind chip + time
 *   - a pop-out (same overlay pattern as the climate card) with the walkway HEATMAP
 *     (weekday rows x hour columns, shade = person detections in that hour over the
 *     selected window) plus stat tiles and the FULL gallery (two-wide), tap a
 *     thumbnail for a full-size view.
 * Zero HA entities created. Reads: history/history_during_period (event sensors),
 * media_source/browse_media
 * (file list) and media_source/resolve_media (signed thumbnail URLs, re-resolved every
 * few minutes because the signatures expire). NEVER renders a camera entity - on a
 * battery doorbell that would wake it; snapshots are static files.
 *
 * HOW-TO (this file ships as a base64 data: URL dashboard resource):
 *   - Resource URL: data:text/javascript;name=flat-front-door-card;base64,<blob>
 *   - Decode to read/edit; re-encode and replace via the Card Manager card.
 *
 * Example YAML (placeholder ids):
 *   type: custom:flat-front-door-card
 *   title: Front Door
 *   collapsed_default: true
 *   ring: binary_sensor.doorbell_visitor          # button press
 *   package: binary_sensor.doorbell_package
 *   vehicle: binary_sensor.doorbell_vehicle
 *   person: binary_sensor.doorbell_person         # feeds the walkers strip + heatmap
 *   package_waiting: input_boolean.package_waiting  # optional: header box glyph + age while on
 *   walkers_stats: sensor.doorbell_walkers_total    # optional: permanent heatmap from long-term statistics
 *   (lingering marks = lingering_<timestamp>.jpg files in the snapshots folder)
 *   snapshots: media-source://media_source/local/reolink_rich_notifications
 *   history_hours: 24        # timeline window
 *   gallery_count: 3         # thumbnails on the card (pop-out shows all)
 *   heatmap_days: 7          # default pop-out window (tabs 7d / 14d)
 *   max_files: 200           # newest files considered from the folder
 *
 * Snapshot file names the gallery understands (anything else is ignored):
 *   <kind>_<YYYYMMDD-HHMMSS>.jpg   e.g. package_20260905-173414.jpg, lingering_..., vehicle_...
 *   package_<epoch seconds>.jpg    (delivery-mode files)
 * Kinds are colored: ring blue, package green, lingering amber, vehicle violet -
 * identity is carried by the row label / kind chip; color is secondary.
 */
(() => {
  "use strict";

  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pad2 = (n) => (n < 10 ? "0" : "") + n;

  const fmtClock = (ms) => {
    const d = new Date(ms);
    let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + ":" + pad2(m) + " " + ap;
  };
  const fmtShort = (ms) => fmtClock(ms).replace(":00 ", "").replace(" ", "");
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtDay = (ms) => {
    const d = new Date(ms), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yd = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    return (sameDay ? "Today" : yd ? "Yesterday" : DAYS[d.getDay()]) + " " + fmtClock(ms);
  };
  const fmtHour = (h) => (h % 12 || 12) + (h >= 12 ? "p" : "a");

  const KINDS = {
    ring: { label: "Ring", color: "#2196f3" },
    package: { label: "Package", color: "#7cb342" },
    lingering: { label: "Lingering", color: "#ffc107" },
    vehicle: { label: "Vehicle", color: "#a774d6" }
  };
  const KIND_ORDER = ["ring", "package", "lingering", "vehicle"];

  const ICON_BELL = '<svg viewBox="0 0 24 24"><rect x="7.5" y="2.5" width="9" height="19" rx="3.5"/><circle cx="12" cy="7.5" r="2"/><circle cx="12" cy="16.5" r="1.7"/><path class="arc" d="M4.5 6.5a8 8 0 000 11M19.5 6.5a8 8 0 010 11"/></svg>';
  const ICON_CHEV = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
  const ICON_PKG = '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>';
  const fmtAgo = (ms) => { const m = Math.floor(ms / 60000); if (m < 1) return "<1m"; if (m < 60) return m + "m"; const h = Math.floor(m / 60); if (h < 24) return h + "h" + (m % 60 ? " " + (m % 60) + "m" : ""); return Math.floor(h / 24) + "d"; };
  const NOTE = "Ticks are doorbell AI events; walkers = person detections per hour (most are pass-throughs on the walkway). Tap a tick or a snapshot to open it. Recorder keeps ~10 days; snapshots 30 days.";

  const CSS = `
    :host { display: block; }
    .card{
      background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
      border: 1px solid var(--ha-card-border-color, #343434);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden; user-select: none; -webkit-user-select: none;
      color: var(--primary-text-color, #e1e1e1);
      font-family: Roboto, 'Segoe UI', system-ui, sans-serif;
    }
    .hdr{ display:flex; align-items:center; gap:11px; padding:9px 18px 9px 12px; cursor:pointer; }
    @media (hover:hover){ .hdr:hover{ background: rgba(70,70,70,.22); } }
    .hicon{ width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center; }
    .hicon svg{ width:24px; height:24px; fill:none; stroke:#2196f3; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; display:block; transition: stroke .35s; }
    .hicon svg .arc{ stroke-width:1.3; opacity:.6; }
    .card.ring .hicon svg{ stroke:#ffc107; }
    .htxt{ flex:1; min-width:0; }
    .htxt .p{ font-size:14px; font-weight:400; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .htxt .s{ font-size:11.5px; color: var(--secondary-text-color, #9e9e9e); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gl{ display:flex; gap:10px; align-items:center; flex:none; }
    .gl-pkg{ display:none; align-items:center; gap:5px; color:#ff9c4a; font-size:11px; letter-spacing:.3px; white-space:nowrap; cursor:pointer; padding:2px 4px; border-radius:5px; }
    .gl-pkg svg{ width:18px; height:18px; fill:none; stroke:#ff9c4a; stroke-width:1.6; display:block; }
    @media (hover:hover){ .gl-pkg:hover{ background: rgba(70,70,70,.22); } }
    .chev{ width:18px; height:18px; flex:none; opacity:.4; transition: transform .35s cubic-bezier(.4,0,.2,1); }
    .chev svg{ width:100%; height:100%; fill:none; stroke: var(--primary-text-color, #e8e8e8); stroke-width:2; display:block; }
    .card.open .chev{ transform: rotate(180deg); }
    .card{ position:relative; }
    ha-icon.info{ --mdc-icon-size:12px; width:12px; height:12px; display:flex; align-items:center; justify-content:center; line-height:0; flex:none; color: rgba(158,158,158,.45) !important; cursor:pointer; margin-left:4px; }
    ha-icon.info.on{ color:#2196f3 !important; }
    .tip{ position:absolute; background: rgba(0,0,0,.88); border-radius:6px; padding:5px 10px; font-size:11.5px; color:#e8e8e8; z-index:5; max-width:260px; line-height:1.4; pointer-events:none; letter-spacing:0; text-transform:none; }
    .bodywrap{ display:grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1); }
    .card.open .bodywrap{ grid-template-rows: 1fr; }
    .bodyin{ overflow:hidden; min-height:0; }
    .sect{ padding:4px 15px 10px; }
    .sname{ font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:#6f6f6f; padding:8px 0 4px; display:flex; align-items:center; gap:8px; }
    .sname .sr{ margin-left:auto; letter-spacing:0; text-transform:none; font-size:11px; }
    .sname .sr.link{ color:#ffc107; cursor:pointer; }
    @media (hover:hover){ .sname .sr.link:hover{ text-decoration: underline; } }
    .dim{ color:#6f6f6f; }
    .row{ display:flex; align-items:center; gap:10px; padding:5px 0; font-size:13px; }
    .row .k{ color: var(--secondary-text-color, #9b9b9b); }
    .row .v{ margin-left:auto; color:#ffc107; font-size:12px; cursor:pointer; }
    @media (hover:hover){ .row .v:hover{ text-decoration: underline; } }

    .tlr{ display:flex; align-items:center; gap:10px; padding:5px 0; font-size:12.5px; }
    .tlk{ width:64px; flex:none; color: var(--secondary-text-color, #9b9b9b); }
    .tlt{ flex:1; height:10px; border-radius:5px; background: rgba(70,70,70,.35); position:relative; }
    .tlt i{ position:absolute; top:-3px; bottom:-3px; width:9px; margin-left:-4.5px; cursor:pointer; }
    .tlt i:before{ content:""; position:absolute; left:3px; top:3px; bottom:3px; width:3px; border-radius:2px; background: currentColor; }
    .tlt b{ position:absolute; top:-13px; font-size:9.5px; font-weight:400; transform:translateX(-50%); white-space:nowrap; pointer-events:none; }
    .tlt.strip{ display:flex; align-items:flex-end; gap:1px; height:22px; background:none; border-radius:0; }
    .tlt.strip i{ position:static; flex:1; width:auto; margin:0; background:#6f6f6f; border-radius:1px 1px 0 0; opacity:.8; cursor:default; }
    .tlt.strip i:before{ display:none; }
    .tld{ width:34px; flex:none; text-align:right; font-size:12px; color: var(--secondary-text-color, #9b9b9b); font-variant-numeric: tabular-nums; }
    .dens{ margin-top:6px; }
    .axis{ display:flex; gap:10px; align-items:center; padding:1px 0 0; }
    .axis .tlk{ }
    .axis .at{ flex:1; position:relative; height:12px; font-size:9.5px; color:#555; }
    .axis .at span{ position:absolute; transform:translateX(-50%); white-space:nowrap; }
    .axis .at span.first{ left:0; transform:none; }
    .axis .at span.last{ right:0; transform:none; }

    .gal{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; padding-top:4px; }
    .gal.big{ grid-template-columns: repeat(2, minmax(0,1fr)); }
    .gi{ min-width:0; cursor:pointer; }
    .gimg{ position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; background: radial-gradient(120% 90% at 30% 10%,#33343a 0%,#232428 45%,#191a1d 100%); }
    .gimg img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
    .gk{ position:absolute; top:6px; left:6px; display:flex; align-items:center; gap:4px; font-size:9.5px; letter-spacing:.5px; text-transform:uppercase; background: rgba(0,0,0,.55); border-radius:5px; padding:2px 6px; }
    .gk i{ width:6px; height:6px; border-radius:50%; display:block; }
    .gcap{ font-size:11px; color: var(--secondary-text-color, #9b9b9b); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gempty{ font-size:12px; color:#6f6f6f; padding:6px 0; }
    .foot{ padding:2px 15px 12px; font-size:11px; color:#6f6f6f; line-height:1.5; }

    /* pop-out */
    .ov{ position:fixed; inset:0; background: rgba(0,0,0,.6); z-index:1000; display:none; align-items:flex-start; justify-content:center; overflow:auto; padding:24px 10px; }
    .ov.open{ display:flex; }
    .pop{ background: var(--ha-card-background, #1c1c1c); border:1px solid var(--ha-card-border-color, #343434); border-radius:12px; width:100%; max-width:560px; padding:14px 15px 16px; box-sizing:border-box; color: var(--primary-text-color, #e1e1e1); font-family: Roboto, 'Segoe UI', system-ui, sans-serif; }
    .pt{ display:flex; align-items:center; margin-bottom:10px; }
    .pt .ttl{ font-size:14px; }
    .pt .x{ margin-left:auto; color:#6f6f6f; cursor:pointer; font-size:16px; padding:2px 6px; }
    .tabs{ display:flex; gap:6px; margin-bottom:10px; }
    .tab{ font-size:11px; padding:4px 9px; border-radius:12px; border:1px solid #343434; color:#9e9e9e; cursor:pointer; }
    .tab.on{ background: rgba(255,193,7,.12); color:#ffc107; border-color: rgba(255,193,7,.3); }
    .hm{ padding-top:4px; }
    .hmblock{ transition: opacity .2s; }
    .hmblock.wait{ opacity:.45; }
    .hmr{ display:flex; gap:2px; margin-bottom:2px; align-items:center; }
    .hmk{ width:30px; flex:none; font-size:10px; color:#9e9e9e; }
    .hmc{ flex:1; aspect-ratio:1; border-radius:2px; background: rgba(70,70,70,.25); }
    .hmc.lbl{ background:none; font-size:9px; color:#555; aspect-ratio:auto; height:12px; }
    .tiles{ display:flex; gap:8px; margin-top:10px; }
    .tile{ flex:1; background: rgba(255,255,255,.04); border-radius:8px; padding:8px 10px; min-width:0; }
    .tile .tv{ font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .tile .tk{ font-size:10px; color:#6f6f6f; letter-spacing:.06em; text-transform:uppercase; margin-top:2px; }
    .lb{ position:fixed; inset:0; background: rgba(0,0,0,.85); z-index:1001; display:none; align-items:center; justify-content:center; cursor:zoom-out; }
    .lb.open{ display:flex; }
    .lb img{ max-width:96vw; max-height:88vh; border-radius:8px; }
    .lb .cap{ position:absolute; bottom:14px; left:0; right:0; text-align:center; color:#ddd; font-size:12px; }
    .pfoot{ font-size:11px; color:#6f6f6f; line-height:1.5; padding-top:10px; }
  `;

  class FlatFrontDoorCard extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this._sig = "";
      this._built = false;
      this._hist = null; this._histAt = 0; this._histPending = false; this._histError = false;
      this._files = null; this._filesAt = 0; this._filesPending = false; this._filesError = false;
      this._urls = {};   // media_content_id -> {url, at}
      this._heat = null; this._heatAt = 0; this._heatPending = false; this._heatDays = 7;
      this._popOpen = false;
      this._tipSticky = false;
      this._stamp = 0;
    }

    setConfig(config) {
      this._cfg = {
        title: config.title || "Front Door",
        ring: config.ring || null,
        package: config.package || null,
        vehicle: config.vehicle || null,
        person: config.person || null,
        package_waiting: config.package_waiting || null,
        walkers_stats: config.walkers_stats || null,
        snapshots: config.snapshots || null,
        history_hours: num(config.history_hours, 24),
        gallery_count: num(config.gallery_count, 3),
        heatmap_days: num(config.heatmap_days, 7),
        max_files: num(config.max_files, 200)
      };
      this._heatDays = this._cfg.heatmap_days;
      this._open = config.collapsed_default === false;
      this._sig = "";
      this._build();
      if (this._hass) { this._maybeFetchHistory(true); this._maybeFetchFiles(true); this._update(); }
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._built) return;
      if (first || Date.now() - this._histAt > 600000) this._maybeFetchHistory(false);
      if (first || Date.now() - this._filesAt > (this._open ? 300000 : 600000)) this._maybeFetchFiles(false);
      this._update();
    }

    getCardSize() { return this._open ? 7 : 2; }
    static getStubConfig() { return { title: "Front Door" }; }

    _build() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML =
        "<style>" + CSS + "</style>" +
        '<div class="card">' +
        '  <div class="hdr">' +
        '    <div class="hicon">' + ICON_BELL + '</div>' +
        '    <div class="htxt"><div class="p"></div><div class="s"></div></div>' +
        '    <div class="gl"><span class="gl-pkg">' + ICON_PKG + '<span class="gl-pkg-tx"></span></span><div class="chev">' + ICON_CHEV + '</div></div>' +
        "  </div>" +
        '  <div class="bodywrap"><div class="bodyin"><div class="sect"></div></div></div>' +
        '  <div class="tip" style="display:none"></div>' +
        "</div>" +
        '<div class="ov"><div class="pop"></div></div>' +
        '<div class="lb"><img alt=""><div class="cap"></div></div>';
      this._el = {
        card: this.shadowRoot.querySelector(".card"),
        p: this.shadowRoot.querySelector(".htxt .p"),
        s: this.shadowRoot.querySelector(".htxt .s"),
        sect: this.shadowRoot.querySelector(".sect"),
        pkg: this.shadowRoot.querySelector(".gl-pkg"),
        pkgTx: this.shadowRoot.querySelector(".gl-pkg-tx"),
        tip: this.shadowRoot.querySelector(".tip"),
        ov: this.shadowRoot.querySelector(".ov"),
        pop: this.shadowRoot.querySelector(".pop"),
        lb: this.shadowRoot.querySelector(".lb"),
        lbImg: this.shadowRoot.querySelector(".lb img"),
        lbCap: this.shadowRoot.querySelector(".lb .cap")
      };
      this._el.p.textContent = this._cfg.title;
      if (this._open) this._el.card.classList.add("open");
      this._el.card.addEventListener("click", (e) => this._onClick(e));
      this._el.card.addEventListener("pointerdown", (e) => { if (this._tipSticky && !(e.target.closest && e.target.closest("ha-icon.info"))) this._tipHide(); });
      this._el.card.addEventListener("mouseover", (e) => { const i = e.target.closest ? e.target.closest("ha-icon.info") : null; if (i && !this._tipSticky) this._tipShow(i); });
      this._el.card.addEventListener("mouseout", (e) => { const i = e.target.closest ? e.target.closest("ha-icon.info") : null; if (i && !this._tipSticky) this._tipHide(); });
      this._el.ov.addEventListener("click", (e) => this._onPopClick(e));
      this._el.lb.addEventListener("click", () => this._el.lb.classList.remove("open"));
      this._onKey = (e) => { if (e.key === "Escape") { if (this._el.lb.classList.contains("open")) this._el.lb.classList.remove("open"); else if (this._popOpen) this._closePop(); } };
      this._built = true;
    }

    connectedCallback() { window.addEventListener("keydown", this._onKey); }
    disconnectedCallback() { window.removeEventListener("keydown", this._onKey); }

    /* ---------------- events ---------------- */
    _onClick(e) {
      const t = e.target;
      const c = (sel) => (t.closest ? t.closest(sel) : null);
      const pop = c("[data-pop]");
      if (pop) { e.stopPropagation(); this._openPop(pop.getAttribute("data-pop")); return; }
      if (c(".gl-pkg")) { e.stopPropagation(); this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this._cfg.package_waiting }, bubbles: true, composed: true })); return; }
      const info = c("ha-icon.info");
      if (info) { e.stopPropagation(); if (this._tipSticky && this._tipIcon === info) { this._tipHide(); return; } this._tipHide(); this._tipShow(info); this._tipSticky = true; return; }
      const tick = c("[data-tick]");
      if (tick) { e.stopPropagation(); this._openPop("gallery", tick.getAttribute("data-tick")); return; }
      const thumb = c("[data-file]");
      if (thumb) { e.stopPropagation(); this._lightbox(thumb.getAttribute("data-file")); return; }
      if (c(".hdr")) {
        this._open = !this._open;
        this._el.card.classList.toggle("open", this._open);
        if (this._open) this._maybeFetchFiles(false);
        this._sig = ""; this._update();
      }
    }

    _onPopClick(e) {
      const t = e.target;
      const c = (sel) => (t.closest ? t.closest(sel) : null);
      if (c(".x") || t === this._el.ov) { this._closePop(); return; }
      const tab = c("[data-days]");
      if (tab) { this._heatDays = parseInt(tab.getAttribute("data-days"), 10); this._maybeFetchHeat(true); this._renderHeat(); return; }
      const thumb = c("[data-file]");
      if (thumb) { this._lightbox(thumb.getAttribute("data-file")); return; }
    }

    _tipShow(icon) {
      const t = this._el.tip;
      t.textContent = icon.getAttribute("data-tip") || "";
      t.style.display = "block"; t.style.left = "0px"; t.style.top = "0px";
      const cr = this._el.card.getBoundingClientRect(), ir = icon.getBoundingClientRect();
      const w = t.offsetWidth, h = t.offsetHeight;
      let x = ir.left - cr.left + ir.width / 2 - w / 2;
      x = Math.max(8, Math.min(x, cr.width - w - 8));
      let y = ir.top - cr.top - h - 6;
      if (y < 4) y = ir.bottom - cr.top + 6;
      t.style.left = x + "px"; t.style.top = y + "px";
      icon.classList.add("on");
      this._tipIcon = icon;
    }
    _tipHide() {
      this._el.tip.style.display = "none";
      if (this._tipIcon) this._tipIcon.classList.remove("on");
      this._tipIcon = null; this._tipSticky = false;
    }

    _openPop(section, highlight) {
      this._popOpen = true;
      this._popHighlight = highlight || null;
      this._el.ov.classList.add("open");
      this._maybeFetchFiles(false);
      this._maybeFetchHeat(false);
      this._renderPop();
      if (section === "gallery" && highlight) { const g = this._el.pop.querySelector(".gal"); if (g && g.scrollIntoView) g.scrollIntoView({ block: "start" }); }
      else { this._el.ov.scrollTop = 0; }
    }
    _closePop() { this._popOpen = false; this._el.ov.classList.remove("open"); }

    _lightbox(id) {
      const f = (this._files || []).find((x) => x.id === id);
      if (!f) return;
      this._resolve(f).then((url) => {
        if (!url) return;
        this._el.lbImg.src = url;
        this._el.lbCap.textContent = KINDS[f.kind].label + " - " + fmtDay(f.t);
        this._el.lb.classList.add("open");
      });
    }

    /* ---------------- data: 24h history ---------------- */
    _maybeFetchHistory(force) {
      const H = this._hass, C = this._cfg;
      if (!H || this._histPending || typeof H.callWS !== "function") return;
      if (!force && this._hist && Date.now() - this._histAt < 600000) return;
      const ids = [C.ring, C.package, C.vehicle, C.person].filter(Boolean);
      const now = Date.now(), start = now - C.history_hours * 3600000;
      this._histPending = true;
      (ids.length ? H.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: true
      }) : Promise.resolve({})).then((raw) => {
        this._histPending = false; this._histError = false;
        this._hist = this._computeHistory(raw || {}, start, now);
        this._histAt = Date.now(); this._stamp++; this._sig = "";
        if (this._built) this._update();
      }).catch(() => {
        this._histPending = false; this._histError = true; this._histAt = Date.now(); this._stamp++; this._sig = "";
        if (this._built) this._update();
      });
    }

    _rowTime(r) {
      if (typeof r.lc === "number") return r.lc * 1000;
      if (typeof r.lu === "number") return r.lu * 1000;
      if (r.last_changed) return Date.parse(r.last_changed);
      if (r.last_updated) return Date.parse(r.last_updated);
      return NaN;
    }

    _onsets(rows, start) {
      // times at which the entity went to "on" (off/unavailable -> on), inside the window
      const out = [];
      if (!Array.isArray(rows)) return out;
      let prev = null;
      for (const r of rows) {
        const st = r.s !== undefined ? r.s : r.state;
        const t = this._rowTime(r);
        if (st === undefined || !isFinite(t)) continue;
        if (st === "on" && prev !== "on" && t >= start) out.push(t);
        prev = st;
      }
      return out;
    }

    _computeHistory(raw, start, now) {
      const C = this._cfg;
      const ev = { ring: [], package: [], vehicle: [], lingering: [] };
      if (C.ring) ev.ring = this._onsets(raw[C.ring], start);
      if (C.package) ev.package = this._onsets(raw[C.package], start);
      if (C.vehicle) ev.vehicle = this._onsets(raw[C.vehicle], start);
      const persons = C.person ? this._onsets(raw[C.person], start) : [];
      const bins = new Array(24).fill(0);
      const span = now - start;
      for (const t of persons) { const i = Math.min(23, Math.max(0, Math.floor((t - start) / span * 24))); bins[i]++; }
      return { ev, persons: persons.length, bins, start, end: now };
    }

    /* ---------------- data: snapshot files ---------------- */
    _parseName(title) {
      let m = /^(ring|package|lingering|vehicle)_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.jpe?g$/i.exec(title);
      if (m) return { kind: m[1].toLowerCase(), t: new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]).getTime() };
      m = /^(package)_(\d{10})\.jpe?g$/i.exec(title);
      if (m) return { kind: "package", t: parseInt(m[2], 10) * 1000 };
      return null;
    }

    _maybeFetchFiles(force) {
      const H = this._hass, C = this._cfg;
      if (!H || !C.snapshots || this._filesPending || typeof H.callWS !== "function") return;
      if (!force && this._files && Date.now() - this._filesAt < 300000) return;
      this._filesPending = true;
      H.callWS({ type: "media_source/browse_media", media_content_id: C.snapshots }).then((res) => {
        this._filesPending = false; this._filesError = false;
        const kids = (res && res.children) || [];
        const files = [];
        for (const k of kids) {
          const name = k.title || "";
          const p = this._parseName(name);
          if (!p || !k.media_content_id) continue;
          files.push({ id: k.media_content_id, name: name, kind: p.kind, t: p.t });
        }
        files.sort((a, b) => b.t - a.t);
        this._files = files.slice(0, C.max_files);
        this._filesAt = Date.now(); this._stamp++; this._sig = "";
        if (this._built) this._update();
        if (this._popOpen) this._renderPop();
      }).catch(() => {
        this._filesPending = false; this._filesError = true; this._files = this._files || [];
        this._filesAt = Date.now(); this._stamp++; this._sig = "";
        if (this._built) this._update();
        if (this._popOpen) this._renderPop();
      });
    }

    _resolve(f) {
      const H = this._hass;
      const c = this._urls[f.id];
      if (c && Date.now() - c.at < 240000) return Promise.resolve(c.url);
      if (!H || typeof H.callWS !== "function") return Promise.resolve(null);
      return H.callWS({ type: "media_source/resolve_media", media_content_id: f.id }).then((r) => {
        const url = r && r.url ? r.url : null;
        if (url) this._urls[f.id] = { url: url, at: Date.now() };
        return url;
      }).catch(() => null);
    }

    _fillThumbs(root) {
      // resolve signed URLs for every <img data-src-id> under root (lazy, cached)
      const imgs = root.querySelectorAll("img[data-src-id]");
      imgs.forEach((img) => {
        const id = img.getAttribute("data-src-id");
        const f = (this._files || []).find((x) => x.id === id);
        if (!f) return;
        this._resolve(f).then((url) => { if (url && img.getAttribute("src") !== url) img.setAttribute("src", url); });
      });
    }

    /* ---------------- data: heatmap ---------------- */
    _maybeFetchHeat(force) {
      const H = this._hass, C = this._cfg;
      if (!H || !C.person || this._heatPending || typeof H.callWS !== "function") return;
      if (!force && this._heat && this._heat.days === this._heatDays && Date.now() - this._heatAt < 1800000) return;
      const now = Date.now(), start = now - this._heatDays * 86400000, days = this._heatDays;
      this._heatPending = true;
      if (C.walkers_stats) {
        H.callWS({
          type: "recorder/statistics_during_period",
          start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(),
          statistic_ids: [C.walkers_stats], period: "hour", types: ["change"]
        }).then((raw) => {
          this._heatPending = false;
          const rows = (raw && raw[C.walkers_stats]) || [];
          const grid = []; for (let d = 0; d < 7; d++) grid.push(new Array(24).fill(0));
          let total = 0, first = Infinity;
          for (const r of rows) {
            const t = typeof r.start === "number" ? (r.start > 1e12 ? r.start : r.start * 1000) : Date.parse(r.start);
            const v = typeof r.change === "number" ? r.change : parseFloat(r.change);
            if (!isFinite(t) || !isFinite(v) || v <= 0) continue;
            const d = new Date(t); grid[d.getDay()][d.getHours()] += v; total += v; if (t < first) first = t;
          }
          const coveredDays = isFinite(first) ? Math.max(1, Math.round((now - first) / 86400000)) : 0;
          const weeks = Math.max(1, coveredDays / 7);
          let best = { v: -1, d: 0, h: 0 };
          for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > best.v) best = { v: grid[d][h], d: d, h: h };
          this._heat = { days: days, grid: grid, total: Math.round(total), best: best, coveredDays: coveredDays, weeks: weeks, stats: true };
          this._heatAt = Date.now();
          if (this._popOpen) this._renderHeat();
        }).catch(() => { this._heatPending = false; this._heat = { days: days, error: true }; if (this._popOpen) this._renderHeat(); });
        return;
      }
      H.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(),
        entity_ids: [C.person], minimal_response: true, no_attributes: true, significant_changes_only: true
      }).then((raw) => {
        this._heatPending = false;
        const ons = this._onsets((raw || {})[C.person], start);
        const grid = []; for (let d = 0; d < 7; d++) grid.push(new Array(24).fill(0));
        let first = Infinity;
        for (const t of ons) { const d = new Date(t); grid[d.getDay()][d.getHours()]++; if (t < first) first = t; }
        let best = { v: -1, d: 0, h: 0 };
        for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > best.v) best = { v: grid[d][h], d: d, h: h };
        const coveredDays = isFinite(first) ? Math.max(1, Math.round((now - first) / 86400000)) : 0;
        this._heat = { days: days, grid: grid, total: ons.length, best: best, coveredDays: coveredDays, weeks: Math.max(1, coveredDays / 7), stats: false };
        this._heatAt = Date.now();
        if (this._popOpen) this._renderHeat();
      }).catch(() => { this._heatPending = false; this._heat = { days: days, error: true }; if (this._popOpen) this._renderHeat(); });
    }

    _lingeringMarks(h) {
      // lingering alerts = lingering_<timestamp>.jpg files inside the window (the automation's
      // last_triggered is not recorded, so files are the only durable trace)
      if (!h || !this._files) return [];
      return this._files.filter((f) => f.kind === "lingering" && f.t >= h.start && f.t <= h.end).map((f) => f.t).sort((a, b) => a - b);
    }

    /* ---------------- render ---------------- */
    _update() {
      if (!this._built || !this._hass) return;
      const pk = this._cfg.package_waiting ? this._hass.states[this._cfg.package_waiting] : null;
      const pkOn = !!(pk && pk.state === "on");
      const pkTx = pkOn ? fmtAgo(Date.now() - Date.parse(pk.last_changed)) : "";
      const sig = JSON.stringify([this._stamp, this._open, this._histPending, this._filesPending, this._histError, this._filesError, pkOn, pkTx]);
      if (sig === this._sig) return;
      this._sig = sig;
      const pkShow = pkOn ? "inline-flex" : "none";
      if (this._el.pkg.style.display !== pkShow) this._el.pkg.style.display = pkShow;
      if (pkOn && this._el.pkgTx.textContent !== pkTx) this._el.pkgTx.textContent = pkTx;
      const h = this._hist;
      if (h) h.ev.lingering = this._lingeringMarks(h);
      const parts = [];
      if (h) {
        const n = (k) => h.ev[k].length;
        if (n("ring")) parts.push(n("ring") + (n("ring") === 1 ? " ring" : " rings"));
        if (n("package")) parts.push(n("package") + (n("package") === 1 ? " package" : " packages"));
        if (n("vehicle")) parts.push(n("vehicle") + (n("vehicle") === 1 ? " vehicle" : " vehicles"));
        if (n("lingering")) parts.push(n("lingering") + " lingering");
        parts.push(h.persons + (h.persons === 1 ? " walker" : " walkers"));
        this._el.s.textContent = parts.join(" - ") + (this._cfg.history_hours === 24 ? " today" : " - " + this._cfg.history_hours + "h");
        this._el.card.classList.toggle("ring", n("ring") > 0);
      } else {
        this._el.s.textContent = this._histError ? "History unavailable - recorder" : "Loading";
      }
      this._el.sect.innerHTML = this._sectHtml();
      if (this._open) this._fillThumbs(this._el.sect);   // signed-URL resolves only when the body is visible
    }

    _timelineHtml(h, compact) {
      const span = Math.max(1, h.end - h.start);
      const pct = (t) => (Math.max(0, Math.min(1, (t - h.start) / span)) * 100).toFixed(2);
      let out = "";
      for (const k of KIND_ORDER) {
        if (k === "ring" && !this._cfg.ring) continue;
        if (k === "package" && !this._cfg.package) continue;
        if (k === "vehicle" && !this._cfg.vehicle) continue;
        if (k === "lingering" && !this._cfg.snapshots) continue;
        const K = KINDS[k], ts = h.ev[k];
        let segs = "", labs = "";
        // label collision guard: only label ticks at least 9% apart
        let lastLab = -1e9;
        for (const t of ts) {
          const p = parseFloat(pct(t));
          segs += '<i style="left:' + p + '%;color:' + K.color + '" data-tick="' + k + ":" + t + '" title="' + esc(K.label + " " + fmtClock(t)) + '"></i>';
          if (!compact && p - lastLab >= 9) { labs += '<b style="left:' + p + '%;color:' + K.color + '">' + esc(fmtShort(t)) + "</b>"; lastLab = p; }
        }
        out += '<div class="tlr"><span class="tlk">' + K.label + '</span><span class="tlt">' + segs + labs + '</span><span class="tld">' + (ts.length ? ts.length : '<span class="dim">none</span>') + "</span></div>";
      }
      if (this._cfg.person) {
        const mx = Math.max.apply(null, h.bins) || 1;
        let dens = "";
        for (const b of h.bins) dens += '<i style="height:' + Math.max(2, Math.round(b / mx * 100)) + '%" title="' + b + ' walkers"></i>';
        out += '<div class="tlr dens"><span class="tlk">Walkers</span><span class="tlt strip">' + dens + '</span><span class="tld">' + h.persons + "</span></div>";
      }
      const mid = h.start + span / 2;
      out += '<div class="axis"><span class="tlk"></span><span class="at"><span class="first">' + esc(fmtShort(h.start)) + '</span><span style="left:50%">' + esc(fmtShort(mid)) + '</span><span class="last">now</span></span><span class="tld"></span></div>';
      return out;
    }

    _thumbHtml(f) {
      const K = KINDS[f.kind];
      return '<div class="gi" data-file="' + esc(f.id) + '"><div class="gimg"><img data-src-id="' + esc(f.id) + '" alt="">' +
        '<span class="gk" style="color:' + K.color + '"><i style="background:' + K.color + '"></i>' + K.label + '</span></div>' +
        '<div class="gcap">' + esc(fmtDay(f.t)) + "</div></div>";
    }

    _sectHtml() {
      const h = this._hist, C = this._cfg;
      let out = "";
      const winLabel = C.history_hours === 24 ? "Last 24h" : "Last " + C.history_hours + "h";
      if (!h) {
        out += '<div class="sname">' + winLabel + "</div>" + '<div class="gempty">' + (this._histError ? "History unavailable - recorder" : "Loading history") + "</div>";
      } else {
        const n = (k) => h.ev[k].length;
        const sr = [n("package") + (n("package") === 1 ? " package" : " packages"), n("lingering") + " lingering", n("ring") + (n("ring") === 1 ? " ring" : " rings")].join(" - ");
        out += '<div class="sname">' + winLabel + '<ha-icon class="info" icon="mdi:information-outline" data-tip="' + esc(NOTE) + '"></ha-icon><span class="sr">' + sr + "</span></div>" + this._timelineHtml(h, false);
      }
      if (C.snapshots) {
        out += '<div class="sname" style="padding-top:14px">Snapshots<span class="sr link" data-pop="gallery">history &rsaquo;</span></div>';
        const files = this._files;
        if (this._filesError) out += '<div class="gempty">Media folder unavailable</div>';
        else if (!files) out += '<div class="gempty">Loading</div>';
        else if (!files.length) out += '<div class="gempty">No snapshots yet</div>';
        else { out += '<div class="gal">'; for (const f of files.slice(0, C.gallery_count)) out += this._thumbHtml(f); out += "</div>"; }
      }
      return out;
    }

    _heatHtml() {
      const C = this._cfg, H = this._heat;
      const tabs = C.walkers_stats ? [[7, "7d"], [30, "30d"], [90, "90d"], [365, "1y"]] : [[7, "7d"], [14, "14d"]];
      let out = '<div class="tabs">' + tabs.map((t) => '<span class="tab' + (t[0] === this._heatDays ? " on" : "") + '" data-days="' + t[0] + '">' + t[1] + "</span>").join("") + "</div>";
      const current = !!(H && H.days === this._heatDays);
      const G = H && !H.error ? H : null;   // while a new window loads, keep drawing the previous grid (dimmed)
      if (H && H.error && current) out += '<div class="gempty">History unavailable - recorder</div>';
      else if (!G) out += '<div class="gempty">Loading history</div>';
      else {
        const mx = Math.max.apply(null, G.grid.map((r) => Math.max.apply(null, r))) || 1;
        out += '<div class="hm"><div class="hmr"><span class="hmk"></span>';
        for (let x = 0; x < 24; x++) out += '<span class="hmc lbl">' + (x % 6 === 0 ? fmtHour(x) : "") + "</span>";
        out += "</div>";
        const order = [1, 2, 3, 4, 5, 6, 0];
        for (const d of order) {
          out += '<div class="hmr"><span class="hmk">' + DAYS[d] + "</span>";
          for (let x = 0; x < 24; x++) {
            const v = G.grid[d][x];
            const tip = G.weeks > 1.05 ? "avg " + (v / G.weeks).toFixed(1) + "/h over " + Math.round(G.weeks) + " weeks (" + Math.round(v) + " total)" : Math.round(v) + " walkers";
            out += '<span class="hmc" style="background:rgba(255,193,7,' + (0.06 + 0.9 * v / mx).toFixed(2) + ')" title="' + DAYS[d] + " " + fmtHour(x) + "-" + fmtHour((x + 1) % 24) + " - " + tip + '"></span>';
          }
          out += "</div>";
        }
        out += "</div>";
        const files = this._files || [];
        const since = Date.now() - G.days * 86400000;
        const pk = files.filter((f) => f.kind === "package" && f.t >= since).length;
        const lg = files.filter((f) => f.kind === "lingering" && f.t >= since).length;
        out += '<div class="tiles"><div class="tile"><div class="tv">' + G.total + '</div><div class="tk">walkers' + (G.coveredDays && G.coveredDays < G.days - 1 ? " - " + G.coveredDays + "d of data" : "") + "</div></div>" +
          '<div class="tile"><div class="tv">' + (G.best.v > 0 ? DAYS[G.best.d] + " " + fmtHour(G.best.h) + "-" + fmtHour((G.best.h + 1) % 24) : "-") + '</div><div class="tk">busiest hour</div></div>' +
          '<div class="tile"><div class="tv">' + pk + " / " + lg + '</div><div class="tk">packages / lingering</div></div></div>';
      }
      return { html: out, waiting: !current };
    }

    _renderHeat() {
      const el = this._el.pop.querySelector(".hmblock");
      if (!el) return;
      const r = this._heatHtml();
      el.innerHTML = r.html;
      el.classList.toggle("wait", r.waiting);
    }

    _renderPop() {
      const C = this._cfg;
      let out = '<div class="pt"><span class="ttl">' + esc(C.title) + ' - history</span><span class="x">&#x2715;</span></div>';
      if (C.person) { const r = this._heatHtml(); out += '<div class="hmblock' + (r.waiting ? " wait" : "") + '">' + r.html + "</div>"; }
      if (C.snapshots) {
        const files = this._files;
        out += '<div class="sname" style="padding-top:14px">All snapshots<span class="sr">' + (files ? files.length + (files.length === 1 ? " file" : " files") : "") + "</span></div>";
        if (this._filesError) out += '<div class="gempty">Media folder unavailable</div>';
        else if (!files) out += '<div class="gempty">Loading</div>';
        else if (!files.length) out += '<div class="gempty">No snapshots yet</div>';
        else { out += '<div class="gal big">'; for (const f of files) out += this._thumbHtml(f); out += "</div>"; }
      }
      out += '<div class="pfoot">' + (C.walkers_stats
        ? "Heatmap: weekday rows, hour columns, shade = person detections in that hour, averaged over the weeks in the window (long-term statistics - kept forever). Snapshots are pruned after 30 days."
        : "Heatmap: weekday rows, hour columns, shade = person detections in that hour over the window. Recorder keeps ~10 days, so 14d shows what exists. Snapshots are pruned after 30 days.") + "</div>";
      this._el.pop.innerHTML = out;
      this._fillThumbs(this._el.pop);
    }
  }

  if (!customElements.get("flat-front-door-card")) customElements.define("flat-front-door-card", FlatFrontDoorCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === "flat-front-door-card")) {
    window.customCards.push({ type: "flat-front-door-card", name: "flat-front-door-card", description: "Front-door activity: 24h event ticks + walker density, snapshot gallery, walkway heatmap pop-out" });
  }
})();
