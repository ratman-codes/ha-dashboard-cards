/* flat-maintenance-card v1.2
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
 *   - unavailable < debounce_minutes -> grey "settling" (restart storms drain ~10 min).
 *   - A manually-configured entity missing from HA -> red "not found" row (typo net).
 *   - Auto-discovered batteries with non-numeric values are skipped silently;
 *     manual battery-only entries get a dim "no data" row instead (so do filters).
 *   - Reachable is not proven alive: a sleepy Thread device can die silently while
 *     HA still shows it available. That failure mode is not passively detectable;
 *     the footer says so instead of pretending.
 *
 * Rows and alerts tap through to more-info. Header toggles expand/collapse.
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
      color:#6f6f6f; padding:8px 0 4px;
    }
    .row{ display:flex; align-items:center; gap:10px; padding:5px 0; font-size:13px; }
    .row[data-ent]{ cursor:pointer; }
    @media (hover:hover){ .row[data-ent]:hover{ background: rgba(255,255,255,.03); } }
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
  `;

  class FlatMaintenanceCard extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this._sig = "";
      this._built = false;
      this._disc = null;
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
        banner_threshold: num(config.banner_threshold, 5)
      };
      this._open = config.collapsed_default === false;
      this._sig = "";
      this._disc = null;
      this._build();
      if (this._hass) this._update();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._built) this._update();
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
      }
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
          if (age < deb) conn.settling.push({ name: d.name, area: d.area, ent: tapEnt, age });
          else conn.down.push({ name: d.name, area: d.area, ent: tapEnt, age });
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
      bats.low.sort((a, b) => a.v - b.v);
      filt.low.sort((a, b) => a.v - b.v);

      const banner = conn.down.length >= C.banner_threshold;
      const issues = conn.down.length + conn.missing.length + bats.low.length + filt.low.length;
      return { conn, bats, filt, banner, issues };
    }

    _update() {
      const m = this._compute();
      const sig = JSON.stringify([
        m.banner, m.issues,
        m.conn.total, m.conn.up,
        m.conn.down.map((x) => [x.name, x.area, fmtDur(x.age)]),
        m.conn.settling.length,
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
      } else {
        el.s.textContent = conn.settling.length
          ? "All quiet - " + conn.up + " reachable - " + conn.settling.length + " settling"
          : "All quiet - " + conn.up + " reachable - batteries OK - filters OK";
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
          alerts.push(this._alert("red", ICON_ALERT, this._label(x) + " unreachable", fmtDur(x.age), x.ent));
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

    _label(x) {
      return esc(x.name) + (x.area ? " (" + esc(x.area) + ")" : "");
    }

    _kName(x) {
      return esc(x.name) + (x.area ? ' <span class="dim">- ' + esc(x.area) + "</span>" : "");
    }

    _alert(cls, icon, text, val, ent) {
      return (
        '<div class="alert ' + cls + '"' + (ent ? ' data-ent="' + esc(ent) + '"' : "") + ">" +
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
        h += this._row("err", this._kName(x), "unreachable - " + fmtDur(x.age), x.ent);
      }
      for (const x of conn.missing) {
        h += this._row("err", esc(x.name), "entity not found", null);
      }
      if (conn.settling.length) {
        h += this._row("dim", "Settling", conn.settling.length + " - unavailable &lt; " + C.debounce_minutes + "m", null);
      }
      if (conn.down.length || conn.missing.length) {
        h += this._row("", "Everything else", conn.up + " / " + conn.up + " reachable", null);
      } else {
        h += this._row("", "Watched devices", conn.up + " / " + conn.total + " reachable", null);
      }

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

    _row(cls, k, vHtml, ent) {
      return (
        '<div class="row ' + cls + '"' + (ent ? ' data-ent="' + esc(ent) + '"' : "") + ">" +
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
