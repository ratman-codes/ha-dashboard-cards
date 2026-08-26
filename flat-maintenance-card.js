/* flat-maintenance-card v1.5
 *
 * (Renamed from flat-health-card in v1.2 - same card, owner preferred the name.)
 * Device maintenance card: Matter connectivity + battery levels + purifier filter
 * life. One quiet row when everything is fine (green is boring); alert strip shows
 * even while collapsed; when many devices drop at once the strip collapses to a
 * single radio-level banner alert but the body ALWAYS lists every down device
 * individually (v1.2: row suppression removed, owner call); 15-min debounce so
 * restart storms raise nothing. Device rows and battery rows show the device's
 * registry AREA as a dim suffix (v1.2).
 *
 * v1.5: DEVICE TAPS OPEN THE DEVICE PAGE. Auto-discovered device rows, alerts,
 * lanes and network-event members navigate to /config/devices/device/<id>
 * (all of the device's entities, logbook, reconfigure) instead of more-info on
 * one arbitrary canary entity - the owner tapped the doorbell's lane and got
 * its infrared-light toggle. Manual `devices:` entries (entity-defined) and
 * battery/filter rows keep more-info.
 *
 * v1.4: LAST 24H SECTION. On expand the card fetches recorder history for one
 * canary entity per watched device (history/history_during_period, compressed
 * rows) and draws a timeline lane per device that was unavailable inside the
 * window: red segments = outages past the debounce, grey slivers = blips, one
 * amber "Network event" lane when >= banner_threshold devices drop within
 * history_event_window_s of each other (tap it to list the members). Right
 * column = count + total downtime; lanes sorted worst-first, capped at
 * history_max_lanes with a "+N more" row. Section is absent when the window is
 * clean; header gains a dim "24h: N outages" suffix while it is not. Refreshes
 * every 5 min while open. Zero new HA entities - the card's contract holds.
 * YAML: history_hours (default 24, 0 disables), history_max_lanes (6),
 * history_event_window_s (120). Micro-blips under 30 s (integration reloads)
 * are dropped as noise.
 *
 * v1.3: SETTLING DEVICES ARE NAMED. The debounce still keeps a fresh
 * 'unavailable' out of the alert strip, but the body now lists each settling
 * device by name (dim row, "settling - 4m", tap = more-info) instead of a bare
 * count, and the collapsed header names it when there is exactly one. Owner
 * call after an HA restart reset every device's clock and the card said
 * "1 settling" for 15 minutes without saying WHAT.
 *
 * AUTO-DISCOVERY (v1.1, default ON): the card reads the frontend entity/device
 * registries (hass.entities / hass.devices) and discovers, by itself:
 *   - Connectivity: every device owned by the integrations in `platforms`
 *     (default: matter). A device counts as unreachable when ALL of its entities
 *     read 'unavailable'. Device display name = your registry name.
 *   - Batteries: every sensor with device_class 'battery' and unit '%'
 *     (one per device). Non-numeric values (e.g. text states) are skipped.
 * New pairings appear on the card automatically - no YAML edits.
 * Curate with `exclude` (case-insensitive substring matched against device name
 * AND entity_ids) and `rename` (exact device name -> display name).
 * A manual `devices` list (see below) still works and merges on top.
 *
 * Card-only by design: NO notifications, no helpers, no server-side entities.
 *
 * HOW-TO (this file ships as a base64 data: URL dashboard resource):
 *   - The resource URL looks like: data:text/javascript;name=flat-maintenance-card;base64,<blob>
 *   - To read/edit: decode the base64, edit, re-encode, replace the resource URL
 *     via the Card Manager card (preferred) or Settings > Dashboards > Resources.
 *   - Stored in .storage/lovelace_resources; included in HA backups.
 *
 * Example YAML (placeholder names/entities):
 *   type: custom:flat-maintenance-card
 *   title: Devices
 *   collapsed_default: true
 *   auto: true              # registry auto-discovery (default true)
 *   platforms: [matter]     # integrations whose devices join the connectivity watch
 *   exclude:                # substring match vs device name or entity_id
 *     - my track light      # e.g. devices on a switched circuit
 *     - my phone
 *   rename:
 *     "Vendor Remote (B) Red": B Red (spare)
 *   battery_warn: 20        # amber at/below this %
 *   battery_crit: 10        # red at/below this %
 *   filter_warn: 30         # amber at/below this %
 *   debounce_minutes: 15    # unavailable shorter than this = "settling", not an issue
 *   banner_threshold: 5     # this many down at once = radio banner, rows suppressed
 *   history_hours: 24       # LAST 24H lanes window; 0 = no history section
 *   history_max_lanes: 6    # worst-first cap, then "+N more"
 *   history_event_window_s: 120  # drops within this many seconds = one network event
 *   devices:                # OPTIONAL manual extras (or full manual mode w/ auto: false)
 *     - name: Extra Device
 *       entity: sensor.my_extra_canary
 *       battery: sensor.my_extra_battery
 *   filters:                # filters are always explicit (no discoverable class)
 *     - name: Purifier Living Room
 *       entity: sensor.my_purifier_filter_life
 *
 * Row semantics:
 *   - Only state 'unavailable' counts as unreachable ('unknown' is normal for
 *     event entities after restarts and is NOT alarmed).
 *   - unavailable < debounce_minutes -> dim named "settling" row (no alert;
 *     restart storms drain ~10 min).
 *   - A manually-configured entity missing from HA -> red "not found" row (typo net).
 *   - Auto-discovered batteries with non-numeric values are skipped silently;
 *     manual battery-only entries get a dim "no data" row instead (so do filters).
 *   - Reachable is not proven alive: a sleepy Thread device can die silently while
 *     HA still shows it available. That failure mode is not passively detectable;
 *     the footer says so instead of pretending.
 *
 * Device rows/alerts/lanes open the device page; battery, filter and manual
 * rows open more-info. Header toggles expand/collapse.
 */
(() => {
  "use strict";

  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const fmtDur = (ms) => {
    const m = Math.floor(ms / 60000);
    if (m < 1) return "now";
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    if (h < 48) return h + "h";
    return Math.floor(h / 24) + "d";
  };

  const fmtDur2 = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return "<1m";
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h < 24) return h + "h " + (r < 10 ? "0" : "") + r + "m";
    return Math.floor(h / 24) + "d " + (h % 24) + "h";
  };
  const fmtClock = (ms) => {
    const d = new Date(ms);
    const h = d.getHours(), mi = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
  };

  const DOMAIN_PRIORITY = ["light", "switch", "binary_sensor", "cover", "lock", "climate", "fan", "event", "sensor"];
  const domainRank = (eid) => {
    const i = DOMAIN_PRIORITY.indexOf(eid.split(".")[0]);
    return i === -1 ? DOMAIN_PRIORITY.length : i;
  };

  const ICON_PULSE =
    "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H16.17L14.5,13.34L10.72,18.25L9.9,12.21L7.21,15H3V13Z";
  const ICON_CHEV = "M7.41 8.58 12 13.17l4.59-4.59L18 10l-6 6-6-6z";
  const ICON_ALERT =
    "M13 13h-2V7h2m0 10h-2v-2h2M12 2A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z";
  const ICON_BATT =
    "M16 18H8V6h8m.67-2H15V2H9v2H7.33C6.6 4 6 4.6 6 5.33v15.34C6 21.4 6.6 22 7.33 22h9.34c.73 0 1.33-.6 1.33-1.33V5.33C18 4.6 17.4 4 16.67 4z";
  const ICON_CLOCK =
    "M12 2A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2m1 5v6l4.25 2.52.77-1.28-3.52-2.09V7H13z";

  const CSS = `
    :host { display: block; }
    .card{
      background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
      border: 1px solid var(--ha-card-border-color, #343434);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      color: var(--primary-text-color, #e1e1e1);
      font-family: Roboto, 'Segoe UI', system-ui, sans-serif;
    }
    .hdr{ display:flex; align-items:center; gap:10px; padding:13px 15px 13px 9px; cursor:pointer; }
    @media (hover:hover){ .hdr:hover{ background: rgba(255,255,255,.04); } }
    .hdr:active{ background: rgba(70,70,70,.22); }
    .hicon{
      width:36px; height:36px; border-radius:50%; flex:none;
      display:flex; align-items:center; justify-content:center;
      background: rgba(124,179,66,.12);
    }
    .hicon svg{ width:22px; height:22px; fill:#7cb342; display:block; }
    .card.warn .hicon{ background: rgba(255,193,7,.12); }
    .card.warn .hicon svg{ fill:#ffc107; }
    .card.down .hicon{ background: rgba(244,81,30,.12); }
    .card.down .hicon svg{ fill:#f4511e; }
    .htxt{ flex:1; min-width:0; }
    .htxt .p{ font-size:14px; font-weight:400; }
    .htxt .s{
      font-size:12px; color: var(--secondary-text-color, #9b9b9b); margin-top:2px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .chev{ color:#6f6f6f; flex:none; transition: transform .25s cubic-bezier(.4,0,.2,1); }
    .chev svg{ width:20px; height:20px; fill:currentColor; display:block; }
    .card.open .chev{ transform: rotate(180deg); }

    .alerts{ display:flex; flex-direction:column; gap:1px; }
    .alert{
      display:flex; align-items:center; gap:10px; padding:9px 15px; font-size:12.5px;
      background: rgba(255,193,7,.09); color:#ffc107; cursor:pointer;
    }
    .alert.red{ background: rgba(244,81,30,.10); color:#f4511e; }
    .alert.plain{ cursor:default; }
    .alert svg{ width:16px; height:16px; fill:currentColor; flex:none; }
    .alert .atxt{ flex:0 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .alert .aval{
      margin-left:auto; color:inherit; opacity:.85; flex:none;
      font-variant-numeric: tabular-nums; white-space:nowrap;
    }

    .bodywrap{
      display:grid; grid-template-rows: 0fr;
      transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1);
    }
    .card.open .bodywrap{ grid-template-rows: 1fr; }
    .bodyin{ overflow:hidden; min-height:0; }
    .sect{ padding:4px 15px 10px; }
    .sname{
      font-size:10.5px; letter-spacing:.09em; text-transform:uppercase;
      color:#6f6f6f; padding:8px 0 4px; display:flex; align-items:baseline; gap:8px;
    }
    .row{ display:flex; align-items:center; gap:10px; padding:5px 0; font-size:13px; }
    .row[data-ent], .row[data-dev]{ cursor:pointer; }
    @media (hover:hover){ .row[data-ent]:hover, .row[data-dev]:hover{ background: rgba(255,255,255,.03); } }
    .row .k{
      color: var(--secondary-text-color, #9b9b9b);
      flex:0 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .row .v{
      margin-left:auto; color: var(--primary-text-color, #e1e1e1); flex:none;
      font-variant-numeric: tabular-nums; text-align:right;
    }
    .row .v .dim{ color:#6f6f6f; }
    .row .k .dim{ color:#6f6f6f; }
    .row.err .k .dim{ color:#f4511e; opacity:.65; }
    .row.warn .k .dim{ color:#6f6f6f; }
    .row.dim .k, .row.dim .v{ color:#6f6f6f; }
    .row.dim .k .dim{ color:#555; }
    .row.warn .k{ color: var(--primary-text-color, #e1e1e1); }
    .row.warn .v{ color:#ffc107; }
    .row.err .k, .row.err .v{ color:#f4511e; }

    .bar{
      width:86px; height:6px; border-radius:3px; background: rgba(70,70,70,.35);
      overflow:hidden; flex:none; margin-left:auto;
    }
    .bar i{ display:block; height:100%; border-radius:3px; background: rgba(155,155,155,.55); }
    .bar.warn i{ background:#ffc107; }
    .bar.err i{ background:#f4511e; }
    .pct{
      width:38px; text-align:right; font-size:12.5px; flex:none;
      color: var(--secondary-text-color, #9b9b9b); font-variant-numeric: tabular-nums;
    }
    .row.warn .pct{ color:#ffc107; }
    .row.err .pct{ color:#f4511e; }

    .foot{ padding:2px 15px 12px; font-size:11px; color:#6f6f6f; line-height:1.5; }

    .sname .sr{ margin-left:auto; letter-spacing:0; text-transform:none; font-size:11px; }
    .lane{ display:flex; align-items:center; gap:10px; padding:4px 0; font-size:12.5px; }
    .lane[data-ent], .lane[data-dev], .lane[data-evt]{ cursor:pointer; }
    @media (hover:hover){ .lane[data-ent]:hover, .lane[data-dev]:hover, .lane[data-evt]:hover{ background: rgba(255,255,255,.03); } }
    .lane .lk{
      color: var(--secondary-text-color, #9b9b9b); width:112px; flex:none;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .lane .lk .dim{ color:#6f6f6f; }
    .lane.err .lk{ color:#f4511e; }
    .lane.evt .lk{ color:#ffc107; }
    .lane.dim .lk, .lane.dim .ld{ color:#6f6f6f; }
    .track{
      flex:1; height:8px; border-radius:4px; background: rgba(70,70,70,.35);
      position:relative; overflow:hidden;
    }
    .seg{ position:absolute; top:0; bottom:0; min-width:3px; background:#f4511e; border-radius:4px; }
    .seg.blip{ background:#6f6f6f; }
    .seg.evt{ background:#ffc107; }
    .lane .ld{
      width:66px; flex:none; text-align:right; font-size:12px;
      color: var(--secondary-text-color, #9b9b9b); font-variant-numeric: tabular-nums; white-space:nowrap;
    }
    .lane .ld .dim{ color:#6f6f6f; }
    .lane.err .ld{ color:#f4511e; }
    .lane.evt .ld{ color:#ffc107; }
    .axis{ display:flex; align-items:center; gap:10px; padding:2px 0 0; }
    .axis .lk{ width:112px; flex:none; }
    .axis .at{ flex:1; position:relative; height:12px; font-size:9.5px; color:#555; font-variant-numeric: tabular-nums; }
    .axis .at span{ position:absolute; transform:translateX(-50%); white-space:nowrap; }
    .axis .at span.first{ transform:none; }
    .axis .at span.last{ transform:translateX(-100%); }
    .axis .ld{ width:66px; flex:none; }
    .members{ padding:0 0 4px 12px; }
    .members .row{ padding:3px 0; font-size:12px; }
  `;

  class FlatMaintenanceCard extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this._sig = "";
      this._built = false;
      this._disc = null;
      this._hist = null;
      this._histAt = 0;
      this._histStamp = 0;
      this._histPending = false;
      this._histError = false;
      this._evtOpen = {};
    }

    setConfig(config) {
      const auto = config.auto !== false;
      if (!auto && (!Array.isArray(config.devices) || !config.devices.length)) {
        throw new Error("flat-maintenance-card: with auto: false a non-empty 'devices' list is required");
      }
      if (config.devices) {
        for (const d of config.devices) {
          if (!d || !d.name || (!d.entity && !d.battery)) {
            throw new Error(
              "flat-maintenance-card: every devices item needs a name and at least one of entity/battery"
            );
          }
        }
      }
      if (config.filters && !Array.isArray(config.filters)) {
        throw new Error("flat-maintenance-card: 'filters' must be a list");
      }
      this._cfg = {
        title: config.title || "Devices",
        auto: auto,
        platforms: Array.isArray(config.platforms) && config.platforms.length ? config.platforms : ["matter"],
        exclude: (Array.isArray(config.exclude) ? config.exclude : []).map((x) => String(x).toLowerCase()),
        rename: config.rename && typeof config.rename === "object" ? config.rename : {},
        devices: config.devices || [],
        filters: config.filters || [],
        battery_warn: num(config.battery_warn, 20),
        battery_crit: num(config.battery_crit, 10),
        filter_warn: num(config.filter_warn, 30),
        debounce_minutes: num(config.debounce_minutes, 15),
        banner_threshold: num(config.banner_threshold, 5),
        history_hours: num(config.history_hours, 24),
        history_max_lanes: num(config.history_max_lanes, 6),
        history_event_window_s: num(config.history_event_window_s, 120)
      };
      this._open = config.collapsed_default === false;
      this._sig = "";
      this._disc = null;
      this._hist = null;
      this._histAt = 0;
      this._build();
      if (this._hass) {
        this._update();
        if (this._open) this._maybeFetchHistory(true);
      }
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (this._built) {
        this._update();
        if (this._open && (first || Date.now() - this._histAt > 300000)) this._maybeFetchHistory(false);
      }
    }

    getCardSize() {
      return this._open ? 6 : 2;
    }

    static getStubConfig() {
      return { auto: true, platforms: ["matter"] };
    }

    _build() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML =
        "<style>" + CSS + "</style>" +
        '<div class="card">' +
        '  <div class="hdr">' +
        '    <div class="hicon"><svg viewBox="0 0 24 24"><path d="' + ICON_PULSE + '"/></svg></div>' +
        '    <div class="htxt"><div class="p"></div><div class="s"></div></div>' +
        '    <div class="chev"><svg viewBox="0 0 24 24"><path d="' + ICON_CHEV + '"/></svg></div>' +
        "  </div>" +
        '  <div class="alerts"></div>' +
        '  <div class="bodywrap"><div class="bodyin">' +
        '    <div class="sect"></div>' +
        '    <div class="foot"></div>' +
        "  </div></div>" +
        "</div>";
      this._el = {
        card: this.shadowRoot.querySelector(".card"),
        p: this.shadowRoot.querySelector(".htxt .p"),
        s: this.shadowRoot.querySelector(".htxt .s"),
        alerts: this.shadowRoot.querySelector(".alerts"),
        sect: this.shadowRoot.querySelector(".sect"),
        foot: this.shadowRoot.querySelector(".foot")
      };
      this._el.p.textContent = this._cfg.title;
      if (this._open) this._el.card.classList.add("open");
      this._el.card.addEventListener("click", (e) => this._onClick(e));
      this._built = true;
    }

    _onClick(e) {
      const evtEl = e.target.closest ? e.target.closest("[data-evt]") : null;
      if (evtEl) {
        e.stopPropagation();
        const k = evtEl.getAttribute("data-evt");
        this._evtOpen[k] = !this._evtOpen[k];
        this._sig = "";
        this._update();
        return;
      }
      const devEl = e.target.closest ? e.target.closest("[data-dev]") : null;
      if (devEl) {
        e.stopPropagation();
        const path = "/config/devices/device/" + devEl.getAttribute("data-dev");
        window.history.pushState(null, "", path);
        window.dispatchEvent(new Event("location-changed"));
        return;
      }
      const entEl = e.target.closest ? e.target.closest("[data-ent]") : null;
      if (entEl) {
        e.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId: entEl.getAttribute("data-ent") },
            bubbles: true,
            composed: true
          })
        );
        return;
      }
      if (e.target.closest && e.target.closest(".hdr")) {
        this._open = !this._open;
        this._el.card.classList.toggle("open", this._open);
        if (this._open) this._maybeFetchHistory(false);
      }
    }

    // ---------- LAST 24H (v1.4) ----------

    _historyTargets() {
      // one canary entity per watched device: first present entity in domain-priority order
      const H = this._hass;
      const disc = this._discover(H);
      const out = [];
      const seen = {};
      for (const d of disc.connDevices) {
        let ent = null;
        for (const eid of d.ents) if (H.states[eid]) { ent = eid; break; }
        if (!ent || seen[ent]) continue;
        seen[ent] = true;
        out.push({ name: d.name, area: d.area, ent: ent, dev: d.dev });
      }
      for (const d of this._cfg.devices) {
        if (!d.entity || seen[d.entity] || !H.states[d.entity]) continue;
        seen[d.entity] = true;
        out.push({ name: d.name, area: this._areaOf(H, d.entity), ent: d.entity });
      }
      return out;
    }

    _maybeFetchHistory(force) {
      const C = this._cfg;
      const H = this._hass;
      if (!H || !C.history_hours || this._histPending) return;
      if (!force && this._hist && Date.now() - this._histAt < 300000) return;
      if (typeof H.callWS !== "function") return;
      const targets = this._historyTargets();
      if (!targets.length) { this._setHist({ lanes: [], events: [], outages: 0, more: 0, start: 0, end: 0 }); return; }
      const now = Date.now();
      const start = now - C.history_hours * 3600000;
      this._histPending = true;
      H.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: targets.map((t) => t.ent),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: true
      }).then((raw) => {
        this._histPending = false;
        this._histError = false;
        const names = {};
        for (const t of targets) names[t.ent] = t;
        this._histNames = names;
        this._setHist(this._computeHistory(raw || {}, targets, start, now));
      }).catch(() => {
        this._histPending = false;
        this._histError = true;
        this._setHist(null);
      });
    }

    _setHist(h) {
      this._hist = h;
      this._histAt = Date.now();
      this._histStamp++;
      this._sig = "";
      if (this._built && this._hass) this._update();
    }

    _rowTime(r) {
      // compressed rows: lc = last_changed (epoch s), lu only when it differs; full rows carry ISO strings
      if (typeof r.lc === "number") return r.lc * 1000;
      if (typeof r.lu === "number") return r.lu * 1000;
      if (r.last_changed) return Date.parse(r.last_changed);
      if (r.last_updated) return Date.parse(r.last_updated);
      return NaN;
    }

    _computeHistory(raw, targets, start, now) {
      const C = this._cfg;
      const deb = C.debounce_minutes * 60000;
      const MIN_MS = 30000; // micro-blips (integration reloads) are noise
      const byEnt = {};
      for (const t of targets) byEnt[t.ent] = t;

      // 1. unavailable intervals per device, clamped to the window
      const intervals = [];
      for (const ent in raw) {
        const t = byEnt[ent];
        const rows = raw[ent];
        if (!t || !Array.isArray(rows) || !rows.length) continue;
        const pts = [];
        for (const r of rows) {
          const st = r.s !== undefined ? r.s : r.state;
          const tm = this._rowTime(r);
          if (st === undefined || !isFinite(tm)) continue;
          pts.push({ s: st, t: tm });
        }
        pts.sort((a, b) => a.t - b.t);
        let openAt = null;
        let openedBefore = false;
        for (const p of pts) {
          if (p.s === "unavailable") {
            if (openAt === null) { openAt = Math.max(p.t, start); openedBefore = p.t < start; }
          } else if (openAt !== null) {
            const e = Math.min(p.t, now);
            if (e - openAt >= MIN_MS) intervals.push({ ent: ent, s: openAt, e: e, ongoing: false, before: openedBefore });
            openAt = null;
          }
        }
        if (openAt !== null && now - openAt >= MIN_MS) {
          intervals.push({ ent: ent, s: openAt, e: now, ongoing: true, before: openedBefore });
        }
      }

      // 2. network events: >= banner_threshold distinct devices dropping within the event window
      intervals.sort((a, b) => a.s - b.s);
      const win = C.history_event_window_s * 1000;
      const events = [];
      const used = {};
      let i = 0;
      while (i < intervals.length) {
        const first = intervals[i];
        const members = [];
        const seen = {};
        let j = i;
        while (j < intervals.length && intervals[j].s - first.s <= win) {
          if (!seen[intervals[j].ent]) { seen[intervals[j].ent] = true; members.push(intervals[j]); }
          j++;
        }
        if (members.length >= C.banner_threshold) {
          let e = 0, ongoing = false;
          for (const m of members) { if (m.e > e) e = m.e; if (m.ongoing) ongoing = true; used[intervals.indexOf(m)] = true; }
          events.push({ s: first.s, e: e, ongoing: ongoing, members: members });
          i = j;
        } else {
          i++;
        }
      }

      // 3. lanes per device from the intervals not absorbed by an event
      const lanesByEnt = {};
      for (let k = 0; k < intervals.length; k++) {
        if (used[k]) continue;
        const iv = intervals[k];
        const t = byEnt[iv.ent];
        let L = lanesByEnt[iv.ent];
        if (!L) { L = lanesByEnt[iv.ent] = { name: t.name, area: t.area, ent: iv.ent, dev: t.dev, ivs: [], total: 0, count: 0, outage: 0, ongoing: false, allDay: false }; }
        const dur = iv.e - iv.s;
        iv.blip = dur < deb;
        L.ivs.push(iv);
        L.total += dur;
        L.count++;
        if (!iv.blip) L.outage++;
        if (iv.ongoing) L.ongoing = true;
        if (iv.before && iv.ongoing) L.allDay = true;
      }
      let lanes = Object.keys(lanesByEnt).map((k) => lanesByEnt[k]);
      lanes.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      const more = Math.max(0, lanes.length - C.history_max_lanes);
      lanes = lanes.slice(0, C.history_max_lanes);

      let outages = events.length;
      for (const L of Object.keys(lanesByEnt).map((k) => lanesByEnt[k])) outages += L.outage;
      return { lanes: lanes, events: events, outages: outages, more: more, start: start, end: now };
    }

    _histHtml() {
      const C = this._cfg;
      const h = this._hist;
      if (!C.history_hours) return "";
      const label = C.history_hours === 24 ? "Last 24h" : "Last " + C.history_hours + "h";
      if (this._histError) {
        return '<div class="sname">' + label + "</div>" + this._row("dim", "History unavailable", "recorder", null);
      }
      if (!h) {
        return this._histPending
          ? '<div class="sname">' + label + "</div>" + this._row("dim", "Loading history", "", null)
          : "";
      }
      if (!h.lanes.length && !h.events.length) return "";
      const span = Math.max(1, h.end - h.start);
      const pct = (t) => (Math.max(0, Math.min(1, (t - h.start) / span)) * 100).toFixed(2);
      const segHtml = (iv, cls, name) => {
        const left = pct(iv.s);
        const width = Math.max(0, pct(iv.e) - left).toFixed(2);
        const tip = esc(name) + ": " + fmtClock(iv.s) + " - " + (iv.ongoing ? "now" : fmtClock(iv.e)) + " (" + fmtDur2(iv.e - iv.s) + ")";
        return '<i class="seg ' + cls + '" style="left:' + left + "%;width:" + width + '%" title="' + tip + '"></i>';
      };
      let out = "";
      const devices = h.lanes.length + h.more;
      out += '<div class="sname">' + label +
        '<span class="sr">' + h.outages + (h.outages === 1 ? " outage" : " outages") +
        (devices ? " - " + devices + (devices === 1 ? " device" : " devices") : "") + "</span></div>";

      // device lanes (worst first), events interleaved by start time after them
      for (const L of h.lanes) {
        const cls = L.outage ? "err" : "dim";
        let segs = "";
        for (const iv of L.ivs) segs += segHtml(iv, iv.blip ? "blip" : "", L.name);
        let right;
        if (L.allDay) right = "all day";
        else if (L.count > 1) right = L.count + ' <span class="dim">-</span> ' + fmtDur2(L.total);
        else right = fmtDur2(L.total) + (L.ongoing ? '<span class="dim"> +</span>' : "");
        out += '<div class="lane ' + cls + '"' + this._tgt(L) + ">" +
          '<span class="lk" title="' + esc(L.name) + (L.area ? " (" + esc(L.area) + ")" : "") + '">' + esc(L.name) + "</span>" +
          '<span class="track">' + segs + "</span>" +
          '<span class="ld">' + right + "</span></div>";
      }
      for (let k = 0; k < h.events.length; k++) {
        const ev = h.events[k];
        const key = "e" + k;
        const dur = fmtDur2(ev.e - ev.s);
        out += '<div class="lane evt" data-evt="' + key + '">' +
          '<span class="lk">Network event <span class="dim">x' + ev.members.length + "</span></span>" +
          '<span class="track">' + segHtml(ev, "evt", "Network event x" + ev.members.length) + "</span>" +
          '<span class="ld">' + fmtClock(ev.s) + ' <span class="dim">-</span> ' + dur + "</span></div>";
        if (this._evtOpen[key]) {
          out += '<div class="members">';
          const ms = ev.members.slice().sort((a, b) => b.e - b.s - (a.e - a.s));
          for (const m of ms) {
            const t = this._hist && this._histNames ? this._histNames[m.ent] : null;
            const nm = t ? t.name : m.ent;
            out += this._row("dim", esc(nm), fmtClock(m.s) + " - " + (m.ongoing ? "now" : fmtClock(m.e)) + ' <span class="dim">-</span> ' + fmtDur2(m.e - m.s), null, this._tgt(t || { ent: m.ent }));
          }
          out += "</div>";
        }
      }
      if (h.more) out += this._row("dim", "+ " + h.more + " more", "shorter outages", null);

      // axis: start / quarter marks / now
      let ax = "";
      const marks = [0, 0.5, 1];
      for (let q = 0; q < marks.length; q++) {
        const cls = q === 0 ? "first" : q === marks.length - 1 ? "last" : "";
        const txt = q === marks.length - 1 ? "now" : fmtClock(h.start + span * marks[q]);
        ax += '<span class="' + cls + '" style="left:' + (marks[q] * 100) + '%">' + txt + "</span>";
      }
      out += '<div class="axis"><span class="lk"></span><span class="at">' + ax + '</span><span class="ld"></span></div>';
      return out;
    }

    _areaName(hass, areaId) {
      if (!areaId || !hass.areas || !hass.areas[areaId]) return null;
      return hass.areas[areaId].name || null;
    }

    _areaOf(hass, eid) {
      const reg = hass.entities && hass.entities[eid];
      if (!reg) return null;
      if (reg.area_id) return this._areaName(hass, reg.area_id);
      const dv = reg.device_id && hass.devices && hass.devices[reg.device_id];
      return dv ? this._areaName(hass, dv.area_id) : null;
    }

    _excluded(name, ents) {
      const n = String(name).toLowerCase();
      for (const pat of this._cfg.exclude) {
        if (n.indexOf(pat) !== -1) return true;
        for (const e of ents) if (e.indexOf(pat) !== -1) return true;
      }
      return false;
    }

    _discover(hass) {
      const stateCount = Object.keys(hass.states).length;
      if (
        this._disc &&
        this._disc.entsRef === hass.entities &&
        this._disc.devsRef === hass.devices &&
        this._disc.stateCount === stateCount
      ) {
        return this._disc;
      }
      const C = this._cfg;
      const entities = hass.entities || {};
      const devices = hass.devices || {};
      const platforms = {};
      for (const p of C.platforms) platforms[p] = true;

      const connDevices = [];
      const autoBats = [];

      if (C.auto) {
        const byDevice = {};
        for (const eid in entities) {
          const reg = entities[eid];
          if (!reg || !reg.device_id) continue;
          let rec = byDevice[reg.device_id];
          if (!rec) {
            const dv = devices[reg.device_id];
            rec = {
              name: (dv && (dv.name_by_user || dv.name)) || reg.device_id,
              area: this._areaName(hass, dv && dv.area_id),
              ents: [],
              watched: false
            };
            byDevice[reg.device_id] = rec;
          }
          rec.ents.push(eid);
          if (platforms[reg.platform]) rec.watched = true;
        }
        for (const id in byDevice) {
          const rec = byDevice[id];
          if (!rec.watched) continue;
          if (this._excluded(rec.name, rec.ents)) continue;
          rec.ents.sort((a, b) => domainRank(a) - domainRank(b));
          connDevices.push({
            name: Object.prototype.hasOwnProperty.call(C.rename, rec.name) ? C.rename[rec.name] : rec.name,
            area: rec.area,
            dev: id,
            ents: rec.ents
          });
        }
        connDevices.sort((a, b) => a.name.localeCompare(b.name));

        const seenBatDevice = {};
        for (const eid in hass.states) {
          if (eid.indexOf("sensor.") !== 0) continue;
          const st = hass.states[eid];
          const a = st.attributes;
          if (!a || a.device_class !== "battery" || a.unit_of_measurement !== "%") continue;
          const reg = entities[eid];
          const devId = reg && reg.device_id;
          if (devId && seenBatDevice[devId]) continue;
          const dv = devId ? devices[devId] : null;
          const rawName =
            (dv && (dv.name_by_user || dv.name)) ||
            (a.friendly_name ? String(a.friendly_name).replace(/\s*battery.*$/i, "") : eid);
          if (this._excluded(rawName, [eid])) continue;
          if (devId) seenBatDevice[devId] = true;
          autoBats.push({
            name: Object.prototype.hasOwnProperty.call(C.rename, rawName) ? C.rename[rawName] : rawName,
            area: this._areaOf(hass, eid),
            ent: eid
          });
        }
        autoBats.sort((a, b) => a.name.localeCompare(b.name));
      }

      this._disc = {
        entsRef: hass.entities,
        devsRef: hass.devices,
        stateCount: stateCount,
        connDevices: connDevices,
        autoBats: autoBats
      };
      return this._disc;
    }

    _compute() {
      const H = this._hass;
      const C = this._cfg;
      const now = Date.now();
      const deb = C.debounce_minutes * 60000;
      const disc = this._discover(H);

      const conn = { total: 0, up: 0, down: [], settling: [], missing: [] };
      const bats = { total: 0, low: [], lowest: null, nodata: [] };
      const seenBatEnt = {};

      // auto-discovered connectivity devices: down = ALL present entities unavailable
      for (const d of disc.connDevices) {
        let present = 0;
        let allUnavail = true;
        let newestFlip = 0;
        let tapEnt = null;
        for (const eid of d.ents) {
          const st = H.states[eid];
          if (!st) continue;
          present++;
          if (!tapEnt) tapEnt = eid;
          if (st.state === "unavailable") {
            const t = Date.parse(st.last_changed);
            if (t > newestFlip) newestFlip = t;
          } else {
            allUnavail = false;
          }
        }
        if (!present) continue;
        conn.total++;
        if (allUnavail) {
          const age = now - newestFlip;
          if (age < deb) conn.settling.push({ name: d.name, area: d.area, ent: tapEnt, dev: d.dev, age });
          else conn.down.push({ name: d.name, area: d.area, ent: tapEnt, dev: d.dev, age });
        } else {
          conn.up++;
        }
      }

      // auto-discovered batteries
      for (const b of disc.autoBats) {
        const st = H.states[b.ent];
        const v = st ? parseFloat(st.state) : NaN;
        seenBatEnt[b.ent] = true;
        if (!isFinite(v)) continue; // silent skip: text/unavailable auto batteries
        bats.total++;
        if (bats.lowest === null || v < bats.lowest) bats.lowest = v;
        if (v <= C.battery_warn) {
          bats.low.push({ name: b.name, area: b.area, ent: b.ent, v: v, crit: v <= C.battery_crit });
        }
      }

      // manual devices (full manual mode, or extras merged on top of auto)
      for (const d of C.devices) {
        if (d.entity) {
          conn.total++;
          const st = H.states[d.entity];
          const area = this._areaOf(H, d.entity);
          if (!st) {
            conn.missing.push({ name: d.name, ent: d.entity });
          } else if (st.state === "unavailable") {
            const age = now - Date.parse(st.last_changed);
            if (age < deb) conn.settling.push({ name: d.name, area: area, ent: d.entity, age });
            else conn.down.push({ name: d.name, area: area, ent: d.entity, age });
          } else {
            conn.up++;
          }
        }
        if (d.battery && !seenBatEnt[d.battery]) {
          const st = H.states[d.battery];
          const v = st ? parseFloat(st.state) : NaN;
          if (isFinite(v)) {
            bats.total++;
            if (bats.lowest === null || v < bats.lowest) bats.lowest = v;
            if (v <= C.battery_warn) {
              bats.low.push({
                name: d.name, area: this._areaOf(H, d.battery), ent: d.battery,
                v: v, crit: v <= C.battery_crit
              });
            }
          } else if (!d.entity) {
            bats.nodata.push({ name: d.name, ent: d.battery });
          }
        }
      }

      const filt = { total: 0, low: [], lowest: null, nodata: [] };
      for (const f of C.filters) {
        const st = f.entity ? H.states[f.entity] : null;
        const v = st ? parseFloat(st.state) : NaN;
        if (isFinite(v)) {
          filt.total++;
          if (filt.lowest === null || v < filt.lowest) filt.lowest = v;
          if (v <= C.filter_warn) filt.low.push({ name: f.name, ent: f.entity, v: v });
        } else {
          filt.nodata.push({ name: f.name, ent: f.entity || "" });
        }
      }

      conn.down.sort((a, b) => b.age - a.age);
      conn.settling.sort((a, b) => b.age - a.age);
      bats.low.sort((a, b) => a.v - b.v);
      filt.low.sort((a, b) => a.v - b.v);

      const banner = conn.down.length >= C.banner_threshold;
      const issues = conn.down.length + conn.missing.length + bats.low.length + filt.low.length;
      return { conn, bats, filt, banner, issues };
    }

    _update() {
      const m = this._compute();
      const sig = JSON.stringify([
        this._histStamp, this._histPending, this._histError, Object.keys(this._evtOpen).filter((k) => this._evtOpen[k]),
        m.banner, m.issues,
        m.conn.total, m.conn.up,
        m.conn.down.map((x) => [x.name, x.area, fmtDur(x.age)]),
        m.conn.settling.map((x) => [x.name, x.area, fmtDur(x.age)]),
        m.conn.missing.map((x) => x.name),
        m.bats.total, m.bats.lowest,
        m.bats.low.map((x) => [x.name, x.area, x.v, x.crit]),
        m.bats.nodata.map((x) => x.name),
        m.filt.total, m.filt.lowest,
        m.filt.low.map((x) => [x.name, x.v]),
        m.filt.nodata.map((x) => x.name)
      ]);
      if (sig === this._sig) return;
      this._sig = sig;
      this._render(m);
    }

    _render(m) {
      const el = this._el;
      const conn = m.conn;

      el.card.classList.toggle("down", m.banner);
      el.card.classList.toggle("warn", !m.banner && m.issues > 0);

      if (m.banner) {
        el.s.textContent =
          "Matter mesh trouble - " + conn.down.length + " of " + conn.total + " unreachable";
      } else if (m.issues > 0) {
        el.s.textContent =
          m.issues + (m.issues === 1 ? " issue" : " issues") +
          " - " + conn.up + " / " + conn.total + " reachable";
      } else if (conn.settling.length === 1) {
        el.s.textContent =
          "All quiet - " + conn.up + " reachable - " + conn.settling[0].name + " settling";
      } else if (conn.settling.length) {
        el.s.textContent =
          "All quiet - " + conn.up + " reachable - " + conn.settling.length + " settling";
      } else {
        el.s.textContent = "All quiet - " + conn.up + " reachable - batteries OK - filters OK";
      }

      const h = this._hist;
      if (h && h.outages && !m.banner) {
        el.s.textContent += " - " + (this._cfg.history_hours === 24 ? "24h" : this._cfg.history_hours + "h") + ": " +
          h.outages + (h.outages === 1 ? " outage" : " outages");
      }

      el.alerts.innerHTML = this._alertsHtml(m);
      el.sect.innerHTML = this._sectHtml(m);
      el.foot.innerHTML = m.banner
        ? "Wait out the ~10 min reconnect storm before battery reseats - reseats during the storm fail."
        : "Reachable is not proven alive - a sleepy remote can die silently; press a button to truly verify after Matter trouble.";
    }

    _alertsHtml(m) {
      const alerts = [];
      if (m.banner) {
        const oldest = m.conn.down.length ? fmtDur(m.conn.down[0].age) : "";
        alerts.push(
          this._alert("red plain", ICON_ALERT,
            "Widespread outage - check Matter Server / OTBR",
            m.conn.down.length + " down - " + oldest, null)
        );
      } else {
        for (const x of m.conn.down) {
          alerts.push(this._alert("red", ICON_ALERT, this._label(x) + " unreachable", fmtDur(x.age), null, this._tgt(x)));
        }
        for (const x of m.conn.missing) {
          alerts.push(this._alert("red plain", ICON_ALERT, esc(x.name) + " entity not found", "YAML?", null));
        }
        for (const x of m.bats.low.filter((b) => b.crit)) {
          alerts.push(this._alert("red", ICON_BATT, this._label(x) + " battery critical", x.v + "%", x.ent));
        }
        for (const x of m.bats.low.filter((b) => !b.crit)) {
          alerts.push(this._alert("", ICON_BATT, this._label(x) + " battery low", x.v + "%", x.ent));
        }
        for (const x of m.filt.low) {
          alerts.push(this._alert("", ICON_CLOCK, esc(x.name) + " filter", x.v + "%", x.ent));
        }
      }
      if (alerts.length > 6) {
        const extra = alerts.length - 5;
        alerts.length = 5;
        alerts.push(this._alert("plain", ICON_ALERT, "+ " + extra + " more (expand for details)", "", null));
      }
      return alerts.join("");
    }

    _tgt(x) {
      if (x && x.dev) return ' data-dev="' + esc(x.dev) + '"';
      if (x && x.ent) return ' data-ent="' + esc(x.ent) + '"';
      return "";
    }

    _label(x) {
      return esc(x.name) + (x.area ? " (" + esc(x.area) + ")" : "");
    }

    _kName(x) {
      return esc(x.name) + (x.area ? ' <span class="dim">- ' + esc(x.area) + "</span>" : "");
    }

    _alert(cls, icon, text, val, ent, tgtAttr) {
      const attr = tgtAttr !== undefined ? tgtAttr : (ent ? ' data-ent="' + esc(ent) + '"' : "");
      return (
        '<div class="alert ' + cls + '"' + attr + ">" +
        '<svg viewBox="0 0 24 24"><path d="' + icon + '"/></svg>' +
        '<span class="atxt">' + text + "</span>" +
        '<span class="aval">' + esc(String(val)) + "</span></div>"
      );
    }

    _sectHtml(m) {
      const C = this._cfg;
      const conn = m.conn, bats = m.bats, filt = m.filt;
      let h = "";

      h += '<div class="sname">Connectivity</div>';
      for (const x of conn.down) {
        h += this._row("err", this._kName(x), "unreachable - " + fmtDur(x.age), null, this._tgt(x));
      }
      for (const x of conn.missing) {
        h += this._row("err", esc(x.name), "entity not found", null);
      }
      for (const x of conn.settling) {
        h += this._row("dim", this._kName(x), "settling - " + fmtDur(x.age), null, this._tgt(x));
      }
      if (conn.down.length || conn.missing.length) {
        h += this._row("", "Everything else", conn.up + " / " + conn.up + " reachable", null);
      } else {
        h += this._row("", "Watched devices", conn.up + " / " + conn.total + " reachable", null);
      }

      h += this._histHtml();

      h += '<div class="sname">Batteries</div>';
      for (const x of bats.low) {
        h += this._barRow(x.crit ? "err" : "warn", this._kName(x), x.v, x.ent);
      }
      const okBats = bats.total - bats.low.length;
      if (bats.total === 0) {
        h += this._row("dim", "No battery data", "", null);
      } else if (bats.low.length) {
        h += this._row("", okBats + (okBats === 1 ? " other" : " others"),
          "all &gt; " + C.battery_warn + "%", null);
      } else {
        h += this._row("", bats.total + " devices",
          "all &gt; " + C.battery_warn + '% <span class="dim">- lowest ' + bats.lowest + "%</span>", null);
      }
      for (const x of bats.nodata) {
        h += this._row("dim", esc(x.name), "no data", x.ent);
      }

      if (C.filters.length) {
        h += '<div class="sname">Filters</div>';
        for (const x of filt.low) {
          h += this._barRow("warn", esc(x.name), x.v, x.ent);
        }
        const okFilt = filt.total - filt.low.length;
        if (filt.total > 0) {
          if (filt.low.length) {
            h += this._row("", okFilt + (okFilt === 1 ? " other" : " others"),
              "all &gt; " + C.filter_warn + "%", null);
          } else {
            h += this._row("", filt.total === 1 ? "1 filter" : filt.total + " filters",
              "all &gt; " + C.filter_warn + '% <span class="dim">- lowest ' + filt.lowest + "%</span>", null);
          }
        }
        for (const x of filt.nodata) {
          h += this._row("dim", esc(x.name), "no data", x.ent || null);
        }
      }

      return h;
    }

    _row(cls, k, vHtml, ent, tgtAttr) {
      const attr = tgtAttr !== undefined ? tgtAttr : (ent ? ' data-ent="' + esc(ent) + '"' : "");
      return (
        '<div class="row ' + cls + '"' + attr + ">" +
        '<span class="k">' + k + "</span>" +
        '<span class="v">' + vHtml + "</span></div>"
      );
    }

    _barRow(cls, k, v, ent) {
      const w = Math.max(0, Math.min(100, v));
      return (
        '<div class="row ' + cls + '"' + (ent ? ' data-ent="' + esc(ent) + '"' : "") + ">" +
        '<span class="k">' + k + "</span>" +
        '<span class="bar ' + cls + '"><i style="width:' + w + '%"></i></span>' +
        '<span class="pct">' + v + "%</span></div>"
      );
    }
  }

  if (!customElements.get("flat-maintenance-card")) {
    customElements.define("flat-maintenance-card", FlatMaintenanceCard);
  }
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === "flat-maintenance-card")) {
    window.customCards.push({
      type: "flat-maintenance-card",
      name: "flat-maintenance-card",
      description: "Device connectivity + battery/filter health (auto-discovering, card-only)"
    });
  }
})();
