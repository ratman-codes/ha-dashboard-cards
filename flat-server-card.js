/* flat-server-card v1.12
 *
 * One-card answer to "is the NAS okay and is my data safe?" for the main
 * dashboard. Green-is-boring: healthy = ONE quiet header row; problems surface
 * as an alert strip even while collapsed. Tap the header to expand the full
 * section list (Storage / System / Mounts / Services / Power / Backups / Outside).
 * Long-press a row to open more-info for its entity. Read-only card: no
 * writes, no controls.
 *
 * HOW-TO (maintenance):
 *   This file is deployed as a base64 data: URL module in the dashboard
 *   resource registry (data:text/javascript;name=flat-server-card;base64,...).
 *   Decode the blob to read it. To update: edit source -> node --check ->
 *   re-encode -> replace via the Card Manager card's guarded update flow (or
 *   Settings > Dashboards > Resources). Stored in .storage/lovelace_resources,
 *   included in HA backups.
 *
 * DATA SOURCES (all via YAML config -- nothing baked in):
 *   - Unraid integration (array/parity/disks/pools/containers/uptime)
 *   - qBittorrent integration (WebUI truth)
 *   - NUT integration (UPS)
 *   - UrBackup monitor integration (client backup age/problem)
 *   - HA native backup sensor
 *   - mounts: two input_text helpers fed by a host-side cron User Script
 *     posting {"total":N,"up":N,"fail":["name",...]} to a webhook automation.
 *     The card renders staleness (amber) when the last report ages out.
 *   - Outside view: the core Uptime Kuma integration (HA 2025.8+) pointed at
 *     an off-site Uptime Kuma instance. Its per-monitor "Status" sensors read
 *     up / down / pending / maintenance; when HA cannot reach Kuma at all they
 *     go unavailable, which the card reports as "no data" -- that is the
 *     "the outside observer itself died" signal.
 *
 * NOTE on Unraid binary sensors: health/valid sensors are device_class
 * "problem" -- state "on" means PROBLEM, "off" means healthy. The first polls
 * after integration setup/restart can serve a stale parity snapshot; parity
 * health keys off parity_valid, activity off parity_running + progress.
 *
 * EXAMPLE YAML (placeholder entity ids -- use your own):
 *   type: custom:flat-server-card
 *   name: My Server
 *   array_state: sensor.my_server_array_state
 *   array_usage: sensor.my_server_array_usage
 *   parity_running: binary_sensor.my_server_parity_check_running
 *   parity_progress: sensor.my_server_parity_progress
 *   parity_valid: binary_sensor.my_server_parity_valid
 *   parity_anchor: input_datetime.server_parity_anchor
 *   disks:
 *     - { name: disk1, entity: binary_sensor.my_server_disk_disk1_health }
 *   pools:
 *     - { name: cache, entity: sensor.my_server_disk_cache_usage }
 *   mounts_status: input_text.server_mounts_status
 *   mounts_last_report: input_text.server_mounts_last_report
 *   qbit_status: sensor.qbittorrent_connection_status
 *   qbit_active: sensor.qbittorrent_active_torrents
 *   qbit_errored: sensor.qbittorrent_errored_torrents
 *   containers: [ switch.my_server_container_app1 ]
 *   ups_status: sensor.my_server_ups_status
 *   ups_charge: sensor.my_server_ups_battery_charge
 *   ups_runtime: sensor.ups_battery_runtime
 *   ups_load: sensor.my_server_ups_load
 *   ups_realpower: sensor.my_server_ups_real_power   # live watts (NUT ups.realpower,
 *     # disabled by default -- enable "Real power" on the NUT device). When set, the
 *     # Load row reads "<load>% - <cur> / <total> W" (watts dim). Absent -> "<load>%" only.
 *   ups_realpower_total: sensor.my_server_ups_nominal_real_power   # rated watts;
 *     # accepts an entity id OR a literal number (the nameplate never changes, so
 *     # `ups_realpower_total: 1000` is equally fine and needs no second sensor).
 *   up_since: sensor.my_server_up_since
 *   backup_client_name: PC-01
 *   backup_client: sensor.pc_01_urbackup_last_file_backup
 *   backup_client_problem: binary_sensor.pc_01_urbackup_file_backup_problem
 *   backup_client_online: binary_sensor.pc_01_urbackup_online
 *   backup_ha: sensor.backup_last_successful_automatic_backup
 *   thresholds:   # all optional; defaults shown
 *     array_amber: 85
 *     array_red: 95
 *     pool_amber: 85
 *     pool_red: 95
 *     parity_cycle_days: 92
 *     parity_red_extra_days: 14
 *     backup_client_amber_h: 48
 *     backup_client_red_h: 96
 *     backup_ha_amber_h: 48
 *     mounts_stale_min: 15
 *     reboot_amber_h: 24
 *     cpu_temp_amber: (auto: 85 C / 185 F by sensor unit)
 *     batt_amber: 50   # UPS charge <= this: amber alert + bar tint (any UPS status)
 *     batt_red: 20     # UPS charge <= this: red alert + bar tint
 *
 * Optional extras:
 *   server_url / qbit_url / urbackup_url  -- tap the Array / qBittorrent /
 *     backup-client row to open the matching web UI (new tab). Long-press
 *     stays more-info everywhere.
 *   notifications: sensor.my_server_active_notifications  (amber alert when >0)
 *   updates_containers: sensor.my_server_container_updates_available
 *   updates_os: update.my_server_update   (quiet dim row when updates exist)
 *   cpu_temp: sensor.my_server_cpu_temperature  (alert-only, no row)
 *   ram_usage: sensor.my_server_ram_usage  (host RAM bar in the System section)
 *   ram_used: sensor.my_server_ram_used    (GB sensor -> "used / total GB" label)
 *   ha_ram_usage / ha_ram_used: same pair for the HA VM itself (add the core
 *     System Monitor integration to get these; usage %, used GB)
 *   ha_disk_usage / ha_disk_used: the HA VM's own disk (System Monitor
 *     "Disk usage /" + "Disk use /"; pool thresholds)
 *   outside_monitors: what an OFF-SITE monitor sees (Uptime Kuma "Status"
 *     sensors). One "Outside" row: "VPS ok - HA Cloud ok - 40s ago"; tap opens
 *     outside_url (the Kuma dashboard). Alerts (amber): a monitor down, a
 *     monitor with no data, all monitors unavailable ("Outside monitor
 *     unreachable"), or the last check older than thresholds.outside_stale_min.
 *       outside_url: https://kuma.example.net/
 *       outside_monitors:
 *         - { name: VPS,      entity: sensor.internet_status }
 *         - { name: HA Cloud, entity: sensor.ha_cloud_status }
 *       outside_checked: sensor.ha_cloud_response_time   # optional. A sensor
 *         # whose VALUE moves each poll (WAN latency is ideal) so its
 *         # last_updated stays current -- a rock-steady ping freezes its
 *         # timestamp and would false-"stale". Accepts a list too. v1.9 also
 *         # auto-checks each monitor's *_response_time sensor, so freshness
 *         # is the newest of them all and robust either way.
 *       thresholds: { outside_stale_min: 5 }
 *
 * v1.12: Audit bundle (findings #3-#8 of the 2026-09-03 v1.9 audit), no visible
 *   change for a healthy card. (#3) backup_client_online is three-valued: an
 *   unavailable sensor now says "agent status unknown" instead of "offline".
 *   (#4) _ageMs clamps at 0 (matches Outside). (#5) ups_realpower_total accepts
 *   a quoted numeric string ("1000") as a literal. (#6) set hass skips the
 *   rebuild when none of the card's own entities changed (ids harvested from
 *   the config + derived *_response_time); the 30 s tick still re-renders, so
 *   any miss is bounded by 30 s. (#7) window.open uses noopener; long-press
 *   only on the primary button; rows get user-select:none / no touch callout;
 *   alert sort moved to just before severity (reds-first by construction).
 *   (#8) dead code removed (unused var, doubly nested if, duplicate restVal,
 *   ramPct/ramLabel aliases -> model.ram).
 * v1.11: Mounts freshness honesty. When mounts_last_report is configured but
 *   its value is empty/unparseable (fresh helper, restore, hand edit), the card
 *   now flags amber "Mounts: no report -- no timestamp" and marks the Last
 *   report row stale, instead of silently treating unknown age as fresh (was:
 *   valid JSON + empty timestamp rendered "6 / 6 mounted" + All clear).
 * v1.10: UPS battery charge alerts. batt_amber / batt_red now push an alert
 *   ("UPS battery low <n>%", amber / red) whenever charge is known, regardless of
 *   UPS status, and the Battery bar tint follows the same thresholds (was: bar
 *   tint only, and only while on battery -- an Online UPS at 12% read All clear).
 * v1.9: Outside freshness ("checked N ago" + stale alert) now takes the NEWEST
 *   last_updated across outside_checked (string or list) AND each monitor's
 *   auto-derived *_response_time sensor -- a WAN monitor whose value moves every
 *   poll always reads fresh, so a rock-steady ping (frozen timestamp) can no
 *   longer produce a false "Outside: last check N ago". Root cause: HA advances
 *   last_updated (and last_reported) only on a VALUE change, not on every poll.
 * v1.8: System section moved up under Storage (was between Services and Power).
 *   Subtext rows standardized to the v1.7 Load format via a subLead() helper --
 *   the grey secondary note leads, a grey dot, then the white main value on the
 *   right (parity "next in Nd", disks "N unknown", uptime "rebooted", backup
 *   "offline", Outside age all flipped; the default for any future subtext row).
 * v1.7: UPS Load row gained live wattage -- "<cur> / <total> W - <load>%" (watts dim
 *   on the left, percent normal on the right), from ups_realpower (+ ups_realpower_total,
 *   entity or literal number). Falls back to plain "<load>%" when ups_realpower is absent.
 * v1.6: Outside section (outside_monitors / outside_url / outside_checked,
 *   outside_stale_min threshold) -- the off-site view pulled back in through
 *   the core Uptime Kuma integration; seconds-resolution age formatter for it.
 * v1.5: HA disk row (ha_disk_usage / ha_disk_used, pool thresholds) -- the
 *   recorder-bloat watch; data_size sensors unit-converted (B..TiB) to GiB
 *   for the "used / total" labels instead of assuming GB.
 * v1.4: alignment root-caused live: BOTH cards have a 1px border, but the
 *   tile's circle sits 10px from the border-box edge (their pad is 9). padding
 *   9 + border 1 -> circle 10 / text 56 exactly. Also: HA-VM RAM row
 *   (ha_ram_usage / ha_ram_used, System Monitor integration sensors).
 * v1.3: System section split from Power (System = RAM + Uptime; Power = UPS/
 *   Battery/Runtime/Load); RAM row shows absolute "used / total GB" beside the
 *   bar when ram_used (GB sensor) is configured (total derived from used/pct).
 * v1.2: RAM bar row (host RAM; ram_usage config, ram_amber/ram_red thresholds);
 *   header glyph 20 -> 22px (tiles use 24 in 36).
 * v1.1.1: header geometry corrected to LIVE-MEASURED tile values (icon center
 *   28px, text start 56px -- measured via ha-tile-card getBoundingClientRect).
 * v1.1: header geometry first pass; UPS broken out into UPS/Battery/Runtime/Load rows; row tap-through
 *   urls; Unraid-notifications alert; quiet updates row; CPU temp alert.
 * v1.0: initial build from approved mockup v2.
 */

const CSS = `
  :host { display: block; }
  .card {
    background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
    border: 1px solid var(--ha-card-border-color, #343434);
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    color: var(--primary-text-color, #e1e1e1);
    font-family: inherit;
  }
  .hd {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px 12px 9px; cursor: pointer; user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform .12s ease, background .12s ease;
  }
  @media (hover: hover) { .hd:hover { background: rgba(70,70,70,.14); } }
  .hd.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
  .hicon {
    width: 36px; height: 36px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center;
    background: rgba(124,179,66,.12);
  }
  .hicon svg { width: 22px; height: 22px; fill: #7cb342; }
  .card.warn .hicon { background: rgba(255,193,7,.12); }
  .card.warn .hicon svg { fill: #ffc107; }
  .card.crit .hicon { background: rgba(244,81,30,.12); }
  .card.crit .hicon svg { fill: #f4511e; }
  .htxt { flex: 1; min-width: 0; }
  .htxt .p { font-size: 14px; font-weight: 500; }
  .htxt .s {
    font-size: 12px; color: var(--secondary-text-color, #9b9b9b);
    margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .alerts { display: flex; flex-direction: column; gap: 1px; }
  .alert {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 16px; font-size: 12.5px;
    background: rgba(255,193,7,.09); color: #ffc107;
  }
  .alert.red { background: rgba(244,81,30,.10); color: #f4511e; }
  .alert svg { width: 15px; height: 15px; fill: currentColor; flex: none; }
  .alert .aval { margin-left: auto; opacity: .85; font-variant-numeric: tabular-nums; }
  .bodywrap {
    display: grid; grid-template-rows: 0fr;
    transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1);
  }
  .card.open .bodywrap { grid-template-rows: 1fr; }
  .bodyin { overflow: hidden; min-height: 0; }
  .sect { padding: 2px 16px 10px; }
  .sname {
    font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase;
    color: rgba(155,155,155,.62); padding: 8px 0 3px;
  }
  .row {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 4px; margin: 0 -4px; font-size: 13px;
    border-radius: 6px; user-select: none; -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform .12s ease, background .12s ease;
  }
  .row.link { cursor: pointer; }
  .row.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
  .row .k { color: var(--secondary-text-color, #9b9b9b); }
  .row .v {
    margin-left: auto; text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row .v .dim { color: rgba(155,155,155,.62); }
  .row.warn .v { color: #ffc107; }
  .row.err .k, .row.err .v { color: #f4511e; }
  .bar {
    width: 84px; height: 6px; border-radius: 3px; flex: none;
    background: rgba(70,70,70,.35); overflow: hidden; margin-left: auto;
  }
  .bar i { display: block; height: 100%; border-radius: 3px; background: rgba(155,155,155,.55); }
  .bar.warn i { background: #ffc107; }
  .bar.err i { background: #f4511e; }
  .bar + .pct {
    width: 40px; text-align: right; font-size: 12.5px; flex: none;
    color: var(--secondary-text-color, #9b9b9b); font-variant-numeric: tabular-nums;
  }
  .row.warn .bar + .pct { color: #ffc107; }
  .row.err .bar + .pct { color: #f4511e; }
  .pctw {
    text-align: right; font-size: 12.5px; flex: none;
    color: var(--secondary-text-color, #9b9b9b); font-variant-numeric: tabular-nums;
  }
  .row.warn .pctw { color: #ffc107; }
  .row.err .pctw { color: #f4511e; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #7cb342; flex: none; opacity: .85; }
  .dot.off { background: #f4511e; }
  .dot.na { background: rgba(155,155,155,.5); }
`;

const SVG_SERVER = '<svg viewBox="0 0 24 24"><path d="M4 3h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1m0 6.5h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1m0 6.5h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1M9 5H5v2h4V5m0 6.5H5v2h4v-2M9 18H5v2h4v-2z"/></svg>';
const SVG_WARN = '<svg viewBox="0 0 24 24"><path d="M13 13h-2V7h2m0 10h-2v-2h2M12 2A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z"/></svg>';

const DEF_TH = {
  array_amber: 85, array_red: 95,
  pool_amber: 85, pool_red: 95,
  parity_cycle_days: 92, parity_red_extra_days: 14,
  backup_client_amber_h: 48, backup_client_red_h: 96,
  backup_ha_amber_h: 48,
  mounts_stale_min: 15,
  reboot_amber_h: 24,
  batt_amber: 50,
  batt_red: 20,
  ram_amber: 90,
  ram_red: 97,
  outside_stale_min: 5
};

class FlatServerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._open = false;
    this._built = false;
    this._pressT = null;
    this._lpFired = false;
  }

  setConfig(config) {
    if (!config) throw new Error('flat-server-card: config required');
    this._cfg = config;
    this._th = Object.assign({}, DEF_TH, config.thresholds || {});
    this._open = config.collapsed_default === false;
    this._built = false;
    this._watch = this._collectIds(config);
  }

  // Every entity id the card reads, harvested from the config (any string
  // shaped like an entity id, at any depth) plus the *_response_time ids the
  // Outside section derives. Used to skip re-rendering on unrelated hass updates.
  _collectIds(cfg) {
    const ids = new Set();
    const re = /^[a-z_]+\.[a-z0-9_]+$/;
    const walk = (v) => {
      if (typeof v === 'string') { if (re.test(v)) ids.add(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k]));
    };
    walk(cfg);
    (cfg.outside_monitors || []).forEach(o => {
      if (o && typeof o.entity === 'string' && /_status$/.test(o.entity)) ids.add(o.entity.replace(/_status$/, '_response_time'));
    });
    return Array.from(ids);
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    // Skip the rebuild when none of OUR entities changed (HA state objects are
    // immutable, so identity compare is exact). The 30 s tick still calls
    // _render() directly to advance the ages, so a miss is bounded by 30 s.
    if (prev && this._built && this._watch &&
        !this._watch.some(id => prev.states[id] !== hass.states[id])) return;
    this._render();
  }

  connectedCallback() {
    this._tick = setInterval(() => { if (this._hass) this._render(); }, 30000);
  }
  disconnectedCallback() {
    clearInterval(this._tick);
  }

  getCardSize() { return this._open ? 8 : 2; }

  /* ---------- state helpers ---------- */
  _st(id) {
    if (!id || !this._hass) return null;
    return this._hass.states[id] || null;
  }
  _val(id) {
    const s = this._st(id);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    return s.state;
  }
  _num(id) {
    const v = this._val(id);
    if (v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  _ageMs(id) {
    const v = this._val(id);
    if (v === null) return null;
    const t = Date.parse(v);
    if (isNaN(t)) return null;
    return Math.max(0, Date.now() - t);
  }
  _fmtAge(ms) {
    if (ms === null) return '--';
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'now';
    if (m < 90) return m + 'm';
    const h = Math.floor(ms / 3600000);
    if (h < 48) return h + 'h';
    return Math.floor(h / 24) + 'd';
  }
  _fmtAgeS(ms) {
    if (ms === null) return '--';
    if (ms < 60000) return Math.max(0, Math.floor(ms / 1000)) + 's';
    return this._fmtAge(ms);
  }
  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  _contName(id) {
    const m = id.match(/container_(.+)$/);
    return m ? m[1].replace(/_/g, '-') : id.split('.').pop();
  }

  /* ---------- model ---------- */
  _model() {
    const c = this._cfg, th = this._th;
    const issues = []; // {sev:'red'|'amber', text, val}
    const push = (sev, text, val) => issues.push({ sev, text, val: val || '' });

    // Array
    const arrState = this._val(c.array_state);
    if (c.array_state && arrState === null) push('amber', 'Array state unavailable');
    else if (arrState && arrState.toLowerCase() !== 'started') push('red', 'Array ' + arrState);
    const arrPct = this._num(c.array_usage);
    if (arrPct !== null) {
      if (arrPct >= th.array_red) push('red', 'Array ' + Math.round(arrPct) + '% full');
      else if (arrPct >= th.array_amber) push('amber', 'Array ' + Math.round(arrPct) + '% full');
    }

    // Parity
    const parityRunning = this._val(c.parity_running) === 'on';
    const parityProg = this._num(c.parity_progress);
    const parityBad = this._val(c.parity_valid) === 'on'; // problem-class
    if (parityBad && !parityRunning) push('red', 'Parity invalid');
    let parityDays = null, parityDue = null;
    const anchor = this._val(c.parity_anchor);
    if (anchor) {
      const t = Date.parse(anchor + 'T00:00:00');
      if (!isNaN(t)) {
        parityDays = Math.floor((Date.now() - t) / 86400000);
        parityDue = th.parity_cycle_days - parityDays;
        if (!parityRunning) {
          if (parityDue < -th.parity_red_extra_days) push('red', 'Parity check overdue', (-parityDue) + 'd');
          else if (parityDue < 0) push('amber', 'Parity check overdue', (-parityDue) + 'd');
        }
      }
    }

    // Disks (problem-class: on = flagged)
    const disks = (c.disks || []).map(d => {
      const s = this._st(d.entity);
      const state = s ? s.state : null;
      return { name: d.name, flagged: state === 'on', na: !s || state === 'unavailable' || state === 'unknown' };
    });
    const flagged = disks.filter(d => d.flagged);
    const diskNa = disks.filter(d => d.na);
    flagged.forEach(d => push('red', 'Disk health flag', d.name));
    if (diskNa.length) push('amber', diskNa.length + ' disk sensor' + (diskNa.length > 1 ? 's' : '') + ' unavailable');

    // Pools
    const pools = (c.pools || []).map(p => {
      const pct = this._num(p.entity);
      let sev = '';
      if (pct !== null) {
        if (pct >= th.pool_red) { sev = 'err'; push('red', p.name + ' pool ' + Math.round(pct) + '% full'); }
        else if (pct >= th.pool_amber) { sev = 'warn'; push('amber', p.name + ' pool ' + Math.round(pct) + '% full'); }
      }
      return { name: p.name, pct, sev, entity: p.entity };
    });

    // Mounts
    let mounts = null;
    if (c.mounts_status) {
      const raw = this._val(c.mounts_status);
      const ageMs = this._ageMs(c.mounts_last_report);
      mounts = { total: null, up: null, fail: [], stale: false, bad: false, ageMs };
      if (raw) {
        try {
          const j = JSON.parse(raw);
          mounts.total = j.total; mounts.up = j.up; mounts.fail = j.fail || [];
        } catch (e) { mounts.bad = true; }
      } else mounts.bad = true;
      if (mounts.bad) push('amber', 'Mounts: no data');
      else {
        mounts.fail.forEach(n => push('red', 'Mount down', n));
        if (ageMs !== null && ageMs > th.mounts_stale_min * 60000) {
          mounts.stale = true;
          push('amber', 'Mounts: no report', this._fmtAge(ageMs));
        } else if (ageMs === null && c.mounts_last_report) {
          // Timestamp helper empty/unparseable: unknown freshness is NOT fresh.
          mounts.stale = true;
          push('amber', 'Mounts: no report', 'no timestamp');
        }
      }
    }

    // qBittorrent
    let qbit = null;
    if (c.qbit_status) {
      const st = this._val(c.qbit_status);
      const active = this._num(c.qbit_active);
      const errored = this._num(c.qbit_errored);
      qbit = { up: st === 'connected', na: st === null, active, errored };
      if (qbit.na) push('amber', 'qBittorrent sensor unavailable');
      else if (!qbit.up) push('red', 'qBittorrent unreachable');
      if (errored !== null && errored > 0) push('amber', 'qBittorrent errored torrents', String(errored));
    }

    // Containers
    let cont = null;
    if (c.containers && c.containers.length) {
      const stopped = [], na = [];
      c.containers.forEach(id => {
        const s = this._st(id);
        if (!s || s.state === 'unavailable' || s.state === 'unknown') na.push(id);
        else if (s.state !== 'on') stopped.push(id);
      });
      cont = { total: c.containers.length, stopped, na };
      stopped.forEach(id => push('amber', 'Container stopped', this._contName(id)));
      if (na.length) push('amber', na.length + ' container sensor' + (na.length > 1 ? 's' : '') + ' unavailable');
    }

    // UPS
    let ups = null;
    if (c.ups_status) {
      const st = this._val(c.ups_status);
      let rtotal = null;
      if (typeof c.ups_realpower_total === 'number') rtotal = c.ups_realpower_total;
      else if (typeof c.ups_realpower_total === 'string') {
        const lit = parseFloat(c.ups_realpower_total);   // "1000" (quoted) -> literal
        rtotal = isNaN(lit) ? this._num(c.ups_realpower_total) : lit;
      }
      ups = {
        status: st, na: st === null,
        charge: this._num(c.ups_charge),
        runtime: this._num(c.ups_runtime),
        load: this._num(c.ups_load),
        rpower: this._num(c.ups_realpower),
        rtotal: rtotal
      };
      if (ups.na) push('amber', 'UPS unavailable');
      else if (!/online/i.test(st)) {
        const rt = ups.runtime !== null ? Math.round(ups.runtime / 60) + ' min left' : '';
        push('red', 'UPS: ' + st, rt);
      }
      if (!ups.na && ups.charge !== null) {
        if (ups.charge <= th.batt_red) push('red', 'UPS battery low', Math.round(ups.charge) + '%');
        else if (ups.charge <= th.batt_amber) push('amber', 'UPS battery low', Math.round(ups.charge) + '%');
      }
    }

    // RAM / disk gauges (host + HA VM share logic)
    const BYTES = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12,
                    KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776 };
    const toG = (v, id) => {
      const s = this._st(id);
      const unit = s && s.attributes.unit_of_measurement ? s.attributes.unit_of_measurement.trim() : '';
      if (BYTES[unit]) return v * BYTES[unit] / 1073741824;
      return v; // no/unknown unit: assume already GB-scale
    };
    const fmtG = (g) => (g < 10 ? g.toFixed(1) : String(Math.round(g)));
    const ramCalc = (pctId, usedId, alertName, amberTh, redTh) => {
      const pct = this._num(pctId);
      let used = this._num(usedId);
      let label = null;
      if (used !== null) used = toG(used, usedId);
      if (used !== null && pct !== null && pct > 0) {
        const total = used / (pct / 100);
        label = fmtG(used) + ' / ' + fmtG(total) + ' GB';
      }
      if (pct !== null) {
        if (pct >= redTh) push('red', alertName + ' ' + Math.round(pct) + '% used', label || '');
        else if (pct >= amberTh) push('amber', alertName + ' ' + Math.round(pct) + '% used', label || '');
      }
      return { pct, label };
    };
    const ram = c.ram_usage ? ramCalc(c.ram_usage, c.ram_used, 'RAM', th.ram_amber, th.ram_red) : null;
    const haRam = c.ha_ram_usage ? ramCalc(c.ha_ram_usage, c.ha_ram_used, 'HA RAM', th.ram_amber, th.ram_red) : null;
    const haDisk = c.ha_disk_usage ? ramCalc(c.ha_disk_usage, c.ha_disk_used, 'HA disk', th.pool_amber, th.pool_red) : null;

    // Uptime
    let upMs = this._ageMs(c.up_since);
    if (c.up_since && upMs !== null && upMs < th.reboot_amber_h * 3600000) {
      push('amber', 'Rebooted', this._fmtAge(upMs) + ' ago');
    }

    // Backups
    let bkClient = null;
    if (c.backup_client) {
      const age = this._ageMs(c.backup_client);
      const problem = this._val(c.backup_client_problem) === 'on';
      let online = true; // true / false / null = sensor unavailable
      if (c.backup_client_online) {
        const ov = this._val(c.backup_client_online);
        online = ov === null ? null : ov === 'on';
      }
      const name = c.backup_client_name || 'Client';
      bkClient = { age, problem, online, name };
      if (problem) push('red', name + ' backup problem');
      if (age === null) push('amber', name + ' backup age unknown');
      else if (age > th.backup_client_red_h * 3600000) push('red', name + ' backup stale', this._fmtAge(age));
      else if (age > th.backup_client_amber_h * 3600000) push('amber', name + ' backup stale', this._fmtAge(age));
      if (online === false) push('amber', name + ' offline (backup agent)');
      else if (online === null) push('amber', name + ' agent status unknown');
    }
    let bkHa = null;
    if (c.backup_ha) {
      const age = this._ageMs(c.backup_ha);
      bkHa = { age };
      if (age === null) push('amber', 'HA backup age unknown');
      else if (age > th.backup_ha_amber_h * 3600000) push('amber', 'HA backup stale', this._fmtAge(age));
    }

    // Outside view (off-site Uptime Kuma via the core integration)
    let outside = null;
    if (c.outside_monitors && c.outside_monitors.length) {
      const mons = c.outside_monitors.map(o => {
        const v = this._val(o.entity);
        const st = v === null ? null : String(v).toLowerCase();
        return {
          name: o.name || o.entity, entity: o.entity, state: st,
          up: st === 'up', down: st === 'down', na: st === null
        };
      });
      // Freshness = newest last_updated across candidate response-time sensors.
      // HA only advances last_updated when a VALUE changes, so a rock-steady
      // ping freezes its timestamp even while polling fine. A monitor whose
      // value moves every poll (WAN latency) always reads fresh, so taking the
      // newest across all of them can never false-"stale". Candidates:
      // outside_checked (string or list) + each monitor's derived
      // *_response_time sensor.
      let ageMs = null;
      const cand = Array.isArray(c.outside_checked) ? c.outside_checked.slice()
                 : (c.outside_checked ? [c.outside_checked] : []);
      c.outside_monitors.forEach(o => {
        if (o.entity && /_status$/.test(o.entity)) cand.push(o.entity.replace(/_status$/, '_response_time'));
      });
      let newest = null;
      cand.forEach(id => {
        const s = this._st(id);
        if (s && s.state !== 'unavailable' && s.state !== 'unknown') {
          const t = Date.parse(s.last_updated);
          if (!isNaN(t) && (newest === null || t > newest)) newest = t;
        }
      });
      if (newest !== null) ageMs = Math.max(0, Date.now() - newest);
      const allNa = mons.every(x => x.na);
      const stale = !allNa && ageMs !== null && ageMs > th.outside_stale_min * 60000;
      outside = { mons, ageMs, allNa, stale };
      if (allNa) push('amber', 'Outside monitor unreachable');
      else {
        mons.filter(x => x.down).forEach(x => push('amber', 'Outside: ' + x.name + ' down'));
        mons.filter(x => x.na).forEach(x => push('amber', 'Outside: ' + x.name + ' no data'));
        if (stale) push('amber', 'Outside: last check', this._fmtAgeS(ageMs) + ' ago');
      }
    }

    // Unraid notifications (alert-only)
    const notifN = this._num(c.notifications);
    if (notifN !== null && notifN > 0) push('amber', 'Unraid notifications', String(Math.round(notifN)));

    // Updates (quiet row, no alert)
    let updates = null;
    if (c.updates_containers || c.updates_os) {
      const nC = this._num(c.updates_containers);
      const os = this._val(c.updates_os) === 'on';
      updates = { containers: nC, os, any: (nC !== null && nC > 0) || os };
    }

    // CPU temp (alert-only)
    if (c.cpu_temp) {
      const t = this._num(c.cpu_temp);
      if (t !== null) {
        const s = this._st(c.cpu_temp);
        const unit = (s.attributes.unit_of_measurement || '').toUpperCase();
        const def = unit.indexOf('F') >= 0 ? 185 : 85;
        const lim = th.cpu_temp_amber !== undefined ? th.cpu_temp_amber : def;
        if (t >= lim) push('amber', 'CPU temp high', Math.round(t) + (unit ? ' ' + unit.replace(/[^A-Z]/g, '') : ''));
      }
    }

    issues.sort((a, b) => (a.sev === b.sev) ? 0 : (a.sev === 'red' ? -1 : 1)); // reds first (stable)
    const sev = issues.some(i => i.sev === 'red') ? 'crit' : (issues.length ? 'warn' : 'ok');
    return {
      issues, sev,
      arrState, arrPct, parityRunning, parityProg, parityBad, parityDays, parityDue,
      disks, flagged, diskNa, pools, mounts, qbit, cont, ups, upMs, bkClient, bkHa, updates, ram, haRam, haDisk,
      outside
    };
  }

  /* ---------- render ---------- */
  _build() {
    this.shadowRoot.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div class="card">' +
      '  <div class="hd" id="hd">' +
      '    <div class="hicon">' + SVG_SERVER + '</div>' +
      '    <div class="htxt"><div class="p" id="pname"></div><div class="s" id="psum"></div></div>' +
      '  </div>' +
      '  <div class="alerts" id="alerts"></div>' +
      '  <div class="bodywrap"><div class="bodyin"><div class="sect" id="body"></div></div></div>' +
      '</div>';
    const hd = this.shadowRoot.getElementById('hd');
    hd.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      hd.classList.add('pressed');
      this._lpFired = false;
      this._pressT = setTimeout(() => { this._lpFired = true; }, 550);
    });
    const clear = () => { hd.classList.remove('pressed'); clearTimeout(this._pressT); };
    hd.addEventListener('pointerup', clear);
    hd.addEventListener('pointercancel', clear);
    hd.addEventListener('pointerleave', clear);
    hd.addEventListener('click', () => {
      if (this._lpFired) return;
      this._open = !this._open;
      this.shadowRoot.querySelector('.card').classList.toggle('open', this._open);
    });
    const body = this.shadowRoot.getElementById('body');
    body.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const row = ev.target.closest('[data-ent],[data-url]');
      if (!row) return;
      this._rowLp = false;
      if (row.hasAttribute('data-url')) row.classList.add('pressed');
      this._rowT = setTimeout(() => {
        this._rowLp = true;
        row.classList.remove('pressed');
        this._fireMoreInfo(row.getAttribute('data-ent'));
      }, 550);
    });
    const rowClear = (ev) => {
      clearTimeout(this._rowT);
      const row = ev.target.closest && ev.target.closest('[data-url]');
      if (row) row.classList.remove('pressed');
      body.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
      body.addEventListener(t, rowClear));
    body.addEventListener('click', (ev) => {
      if (this._rowLp) { this._rowLp = false; return; }
      const row = ev.target.closest('[data-url]');
      if (row) window.open(row.getAttribute('data-url'), '_blank', 'noopener');
    });
    this._built = true;
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const ev = new CustomEvent('hass-more-info', {
      bubbles: true, composed: true, detail: { entityId }
    });
    this.dispatchEvent(ev);
  }

  _render() {
    if (!this._cfg || !this._hass) return;
    if (!this._built) this._build();
    const m = this._model();
    const c = this._cfg, esc = this._esc.bind(this);

    const card = this.shadowRoot.querySelector('.card');
    card.classList.toggle('warn', m.sev === 'warn');
    card.classList.toggle('crit', m.sev === 'crit');
    card.classList.toggle('open', this._open);

    this.shadowRoot.getElementById('pname').textContent = c.name || 'Server';

    // summary line
    let sum;
    if (m.issues.length) {
      const parts = [m.issues.length + ' issue' + (m.issues.length > 1 ? 's' : '')];
      if (m.arrState && m.arrState.toLowerCase() === 'started') parts.push('array OK');
      if (m.ups && !m.ups.na && /online/i.test(m.ups.status)) parts.push('UPS online');
      sum = parts.join(' \u00b7 ');
    } else {
      const parts = ['All clear'];
      if (m.disks.length) parts.push(m.disks.length + ' disks OK');
      if (m.parityDays !== null) parts.push('parity ' + m.parityDays + 'd');
      if (m.bkClient && m.bkClient.age !== null) parts.push('backup ' + this._fmtAge(m.bkClient.age));
      sum = parts.join(' \u00b7 ');
    }
    this.shadowRoot.getElementById('psum').textContent = sum;

    // alerts
    this.shadowRoot.getElementById('alerts').innerHTML = m.issues.map(i =>
      '<div class="alert' + (i.sev === 'red' ? ' red' : '') + '">' + SVG_WARN +
      '<span>' + esc(i.text) + '</span><span class="aval">' + esc(i.val) + '</span></div>'
    ).join('');

    // body
    const H = [];
    const row = (cls, kHtml, vHtml, ent, url) =>
      '<div class="row' + (cls ? ' ' + cls : '') + (url ? ' link' : '') + '"' +
      (ent ? ' data-ent="' + ent + '"' : '') + (url ? ' data-url="' + esc(url) + '"' : '') + '>' +
      kHtml + vHtml + '</div>';
    const kv = (k) => '<span class="k">' + k + '</span>';
    const vv = (v) => '<span class="v">' + v + '</span>';
    // Standard subtext row: grey secondary note leads, grey dot, white main on the
    // right -- "<sub> &middot; <main>". Use for every value that pairs a main
    // reading with a secondary detail (the default going forward).
    const subLead = (main, sub) => '<span class="dim">' + sub + ' &middot;</span> ' + main;
    const barRow = (name, pct, sev, ent) => {
      const p = pct === null ? null : Math.min(100, Math.max(0, pct));
      return '<div class="row' + (sev ? ' ' + sev : '') + '"' + (ent ? ' data-ent="' + ent + '"' : '') + '>' +
        kv(esc(name)) +
        (p === null
          ? vv('--')
          : '<span class="bar' + (sev ? ' ' + sev : '') + '"><i style="width:' + p.toFixed(0) + '%"></i></span>' +
            '<span class="pct">' + p.toFixed(0) + '%</span>') +
        '</div>';
    };

    // STORAGE
    H.push('<div class="sname">Storage</div>');
    H.push(row(m.arrState && m.arrState.toLowerCase() !== 'started' ? 'err' : '',
      kv('Array'), vv(m.arrState ? esc(m.arrState) : '--'), c.array_state, c.server_url));
    let arrSev = '';
    if (m.arrPct !== null) {
      if (m.arrPct >= this._th.array_red) arrSev = 'err';
      else if (m.arrPct >= this._th.array_amber) arrSev = 'warn';
    }
    H.push(barRow('Array fill', m.arrPct, arrSev, c.array_usage));
    // parity row
    let pv;
    if (m.parityRunning) {
      pv = 'check running' + (m.parityProg !== null ? ' &middot; ' + m.parityProg + '%' : '');
    } else if (m.parityDays !== null) {
      pv = m.parityDue !== null
        ? subLead(m.parityDays + 'd ago', m.parityDue >= 0 ? 'next in ' + m.parityDue + 'd' : (-m.parityDue) + 'd overdue')
        : m.parityDays + 'd ago';
    } else pv = '--';
    const pcls = m.parityBad && !m.parityRunning ? 'err' : (m.parityDue !== null && m.parityDue < 0 && !m.parityRunning ? 'warn' : '');
    H.push(row(pcls, kv('Parity check'), vv(pv), c.parity_valid || c.parity_running));
    // disks
    if (m.disks.length) {
      const okCount = m.disks.filter(d => !d.flagged && !d.na).length;
      m.flagged.forEach(d => {
        const ent = (c.disks.find(x => x.name === d.name) || {}).entity;
        H.push(row('err', kv(esc(d.name)), vv('health flag'), ent));
      });
      const restLabel = m.flagged.length ? 'other disks' : 'Disks';
      let restVal = okCount + ' / ' + (m.disks.length - m.flagged.length) + ' healthy';
      if (m.diskNa.length) restVal = subLead(restVal, m.diskNa.length + ' unknown');
      H.push(row(m.diskNa.length ? 'warn' : '', kv(restLabel), vv(restVal)));
    }
    m.pools.forEach(p => H.push(barRow(p.name, p.pct, p.sev, p.entity)));

    // SYSTEM
    if (c.ram_usage || c.ha_ram_usage || c.ha_disk_usage || c.up_since) {
      H.push('<div class="sname">System</div>');
      const ramRow = (label, pct, lbl, ent, amberTh, redTh) => {
        const a = amberTh !== undefined ? amberTh : this._th.ram_amber;
        const r = redTh !== undefined ? redTh : this._th.ram_red;
        let rsev = '';
        if (pct !== null) {
          if (pct >= r) rsev = 'err';
          else if (pct >= a) rsev = 'warn';
        }
        const p = pct === null ? null : Math.min(100, Math.max(0, pct));
        H.push('<div class="row' + (rsev ? ' ' + rsev : '') + '" data-ent="' + ent + '">' +
          kv(label) +
          (p === null ? vv('--')
            : '<span class="bar' + (rsev ? ' ' + rsev : '') + '"><i style="width:' + p.toFixed(0) + '%"></i></span>' +
              '<span class="pctw">' + (lbl ? esc(lbl) : p.toFixed(0) + '%') + '</span>') +
          '</div>');
      };
      if (c.ram_usage && m.ram) ramRow('RAM', m.ram.pct, m.ram.label, c.ram_usage);
      if (c.ha_ram_usage && m.haRam) ramRow('HA RAM', m.haRam.pct, m.haRam.label, c.ha_ram_usage);
      if (c.ha_disk_usage && m.haDisk) ramRow('HA disk', m.haDisk.pct, m.haDisk.label, c.ha_disk_usage, this._th.pool_amber, this._th.pool_red);
      if (c.up_since) {
        const warn = m.upMs !== null && m.upMs < this._th.reboot_amber_h * 3600000;
        let uv = m.upMs === null ? '--' : this._fmtAge(m.upMs);
        if (warn) uv = subLead(uv, 'rebooted');
        H.push(row(warn ? 'warn' : '', kv('Uptime'), vv(uv), c.up_since));
      }
    }

    // MOUNTS
    if (m.mounts) {
      H.push('<div class="sname">Mounts</div>');
      if (m.mounts.bad) {
        H.push(row('warn', kv('SMB remotes'), vv('no data'), c.mounts_status));
      } else {
        m.mounts.fail.forEach(n =>
          H.push(row('err', '<span class="dot off"></span>' + kv(esc(n)), vv('down'), c.mounts_status)));
        const okN = m.mounts.up, tot = m.mounts.total;
        const lbl = m.mounts.fail.length ? 'others' : 'SMB remotes';
        const okTot = m.mounts.fail.length ? tot - m.mounts.fail.length : tot;
        H.push(row('', kv(lbl), vv(okN + ' / ' + okTot + ' mounted'), c.mounts_status));
        H.push(row(m.mounts.stale ? 'warn' : '', kv('Last report'),
          vv(m.mounts.ageMs === null ? '--' : this._fmtAge(m.mounts.ageMs) + ' ago'), c.mounts_last_report));
      }
    }

    // SERVICES
    if (m.qbit || m.cont) {
      H.push('<div class="sname">Services</div>');
      if (m.qbit) {
        let qval, qcls = '', dot = 'dot';
        if (m.qbit.na) { qval = 'unavailable'; qcls = 'warn'; dot = 'dot na'; }
        else if (!m.qbit.up) { qval = 'unreachable'; qcls = 'err'; dot = 'dot off'; }
        else {
          qval = 'Up' + (m.qbit.active !== null ? ' &middot; ' + m.qbit.active + ' active' : '');
          if (m.qbit.errored) { qval += ' &middot; ' + m.qbit.errored + ' errored'; qcls = 'warn'; }
        }
        H.push(row(qcls, '<span class="' + dot + '"></span>' + kv('qBittorrent'), vv(qval), c.qbit_status, c.qbit_url));
      }
      if (m.cont) {
        const run = m.cont.total - m.cont.stopped.length - m.cont.na.length;
        let cval = run + ' / ' + m.cont.total + ' running';
        let ccls = '';
        if (m.cont.stopped.length) {
          cval = m.cont.stopped.map(id => esc(this._contName(id))).join(', ') + ' stopped &middot; ' + cval;
          ccls = 'warn';
        } else if (m.cont.na.length) ccls = 'warn';
        H.push(row(ccls, kv('Containers'), vv(cval)));
      }
      if (m.updates && m.updates.any) {
        const bits = [];
        if (m.updates.containers) bits.push(m.updates.containers + ' container' + (m.updates.containers > 1 ? 's' : ''));
        if (m.updates.os) bits.push('OS');
        H.push(row('', kv('Updates'), vv('<span class="dim">' + bits.join(' &middot; ') + '</span>'), c.updates_containers || c.updates_os));
      }
    }

    // POWER
    if (m.ups) {
      H.push('<div class="sname">Power</div>');
      let uval, ucls = '', dot = 'dot';
      const onBatt = !m.ups.na && !/online/i.test(m.ups.status);
      if (m.ups.na) { uval = 'unavailable'; ucls = 'warn'; dot = 'dot na'; }
      else {
        uval = esc(m.ups.status);
        if (onBatt) { ucls = 'err'; dot = 'dot off'; }
      }
      H.push(row(ucls, '<span class="' + dot + '"></span>' + kv('UPS'), vv(uval), c.ups_status));
      if (!m.ups.na && m.ups.charge !== null) {
        let bsev = '';
        if (m.ups.charge <= this._th.batt_red) bsev = 'err';
        else if (m.ups.charge <= this._th.batt_amber) bsev = 'warn';
        H.push(barRow('Battery', m.ups.charge, bsev, c.ups_charge));
      }
      if (!m.ups.na && m.ups.runtime !== null) {
        H.push(row(onBatt ? 'warn' : '', kv('Runtime'), vv(Math.round(m.ups.runtime / 60) + ' min'), c.ups_runtime));
      }
      if (!m.ups.na && m.ups.load !== null) {
        let loadVal = Math.round(m.ups.load) + '%';
        if (m.ups.rpower !== null) {
          const w = Math.round(m.ups.rpower);
          const tot = m.ups.rtotal !== null ? Math.round(m.ups.rtotal) : null;
          loadVal = subLead(loadVal, w + (tot !== null ? ' / ' + tot : '') + ' W');
        }
        H.push(row('', kv('Load'), vv(loadVal), c.ups_realpower || c.ups_load));
      }
    }

    // BACKUPS
    if (m.bkClient || m.bkHa) {
      H.push('<div class="sname">Backups</div>');
      if (m.bkClient) {
        const b = m.bkClient;
        let cls = '';
        if (b.problem || (b.age !== null && b.age > this._th.backup_client_red_h * 3600000)) cls = 'err';
        else if (b.age === null || b.age > this._th.backup_client_amber_h * 3600000) cls = 'warn';
        let val = b.age === null ? '--' : this._fmtAge(b.age) + ' ago';
        if (b.problem) val = 'problem &middot; ' + val;
        if (b.online === false) val = subLead(val, 'offline');
        else if (b.online === null) val = subLead(val, 'status unknown');
        H.push(row(cls, kv(esc(b.name)), vv(val), c.backup_client, c.urbackup_url));
      }
      if (m.bkHa) {
        const warn = m.bkHa.age === null || m.bkHa.age > this._th.backup_ha_amber_h * 3600000;
        H.push(row(warn ? 'warn' : '', kv('Home Assistant'),
          vv(m.bkHa.age === null ? '--' : this._fmtAge(m.bkHa.age) + ' ago'), c.backup_ha));
      }
    }

    // OUTSIDE (what the off-site monitor sees; tap -> Kuma dashboard)
    if (m.outside) {
      H.push('<div class="sname">Outside</div>');
      const o = m.outside;
      let oval, ocls = '', dot = 'dot';
      if (o.allNa) {
        oval = 'no data';
        ocls = 'warn'; dot = 'dot na';
      } else {
        oval = o.mons.map(x =>
          esc(x.name) + ' ' + (x.up ? 'ok' : (x.na ? '?' : esc(x.state)))
        ).join(' &middot; ');
        if (o.mons.some(x => x.down)) { ocls = 'warn'; dot = 'dot off'; }
        else if (o.mons.some(x => x.na) || o.stale) { ocls = 'warn'; }
        if (o.ageMs !== null) {
          oval = subLead(oval, this._fmtAgeS(o.ageMs) + ' ago');
        }
      }
      H.push(row(ocls, '<span class="' + dot + '"></span>' + kv('Outside'), vv(oval),
        c.outside_monitors[0].entity, c.outside_url));
    }

    this.shadowRoot.getElementById('body').innerHTML = H.join('');
  }
}

customElements.define('flat-server-card', FlatServerCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-server-card',
  name: 'Flat Server Card',
  description: 'NAS health + backup confidence: array, parity, disks, pools, mounts, services, UPS, backups.'
});
