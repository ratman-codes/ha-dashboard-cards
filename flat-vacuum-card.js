/* flat-vacuum-card v2.7rev4 - custom Lovelace card for the main dashboard.
   v2.7rev4 (2026-08-27): HISTORY FIX - the begin/end pairing window in
   _parseHist widens 6h -> 12h. An away run with a mid-run recharge stall
   ran 6h15m wall clock (2026-08-27: leave 15:05 -> stall 17:08-19:35 ->
   end 21:21), so beginT stayed null: the row showed NO duration, the END
   time as its time, and the trigger fell back to 'manual' despite a
   correct leave record (attribution is skipped when beginT is null).
   12h covers any single run; begins must still precede the end.
   v2.7: EDGE 2 MIGRATION - all entities remapped to the qx_revo_ultra_2
   prefix (Roborock Qrevo Edge 2, Costco "QX Revo Ultra 2"). Start command
   is now the native vacuum.start service (the old full_cleaning button
   was a cloud ROUTINE on the returned unit - integration creates buttons
   per app routine; none exist on the new device and none are needed).
   DORMANT-ENTITY PATTERN: the Edge 2 integration currently exposes no
   dock error sensor, no dock strainer counter, and no empty-mode select.
   Those rows/tokens sleep when their entity is absent from hass.states
   and wake automatically if a future integration update (or lazy cloud
   property creation) adds them. Absent dock error sensor = NO error.
   SMOOTH COLLAPSE: outer body + all four groups now use the
   grid-template-rows 0fr/1fr technique (runtime .gin wrappers); ALL
   hardcoded height math is gone - groups always open to exact content
   size. Group headers + title header gained hover/active affordance.
   Mop intensity on this model: off/slight/low/medium/moderate/high/
   extreme (7 levels); smart_mode exists on suction + mop mode (DirTect;
   the app calls it SmartPlan). In smart_mode the intensity select reads
   'unknown' - profiles stay deterministic, smart is a per-run choice.
   v2.6: FULL CLEANING PROFILES - the Auto-clean suction rows became
   Away profile / Default profile rows: summary chip "max - high - deep >",
   tapping the row opens a popup editor with segmented pickers for
   Suction / Mop intensity / Mop mode (helpers: vacuum_suction_away/
   _default, vacuum_mop_intensity_away/_default, vacuum_mop_mode_away/
   _default; custom/custom_water_flow deliberately excluded - profiles
   are deterministic). HA side: the auto-clean away branch applies all
   three; automation "Vacuum: Profile Restore Default" restores all
   three at run end - the Default profile is the single source of truth
   for normal cleaning, and any pre-run tweak reverts afterward.
   v2.6 rev: HISTORY SETTINGS - the run-trigger record appends the profile
   applied ("A:suction|mopi|mopm" away branch / "D:..." default); History
   rows show it as a tiny second line (cyan = away profile, dim grey =
   default, absent = pre-feature or app-started run). Card-armed manual
   starts write their own record with the LIVE settings ("manual <iso>
   M:fan|mopi|mopm") - only app-started runs stay unannotated (the card
   cannot see those coming). Group height flexes.
   v2.5: STICKY-DEFAULT SUCTION PROFILES - two dropdown rows in Auto-clean
   (Away suction / Default suction, input_select.vacuum_suction_away /
   _default). Semantics: auto-cleans starting while everyone is out run at
   the away profile; a separate restore automation snaps suction back to
   the default whenever ANY run ends (auto, manual, app). The Config
   Suction row remains the LIVE value (reverts after runs - tooltip
   notes it). HA side: auto-clean automation sets fan speed pre-press
   when all-away at fire time; a small restore automation fires on
   last_clean_end change or status charging-for-5min.
   v2.4: HISTORY GROUP (fourth accordion) - last 4 full cleans (day, start
   time, trigger, duration, area) + a 14-day strip (teal square = a day with
   a clean, today brightest). Data: the card's FIRST websocket history fetch
   (history/history_during_period, 4 entities, 14 days), cached 5 min,
   refreshed on group open. TRIGGER ATTRIBUTION: the auto-clean automation
   writes "<trigger.id> <ISO timestamp>" to input_text.vacuum_run_trigger
   right before pressing full_cleaning; a run whose begin is within 10 min
   of a record = away (leave/window_open) or backstop; no record = manual.
   v2.4 rev: pause + dock controls stay available during dock-activity
   phases (washing/emptying is still mid-run - pausing there is legitimate;
   the dock button acts as end-run; display and controls now agree).
   v2.4 rev2: ISSUE ROWS - conditional amber rows at the top of the
   Maintenance group, one per active problem, mirroring the header tokens
   with detail: "Robot: <error> - blocks auto-cleans", "Dock: <error> -
   warn-only, cleans still run", "Water low - mop may be limited"; tap =
   the sensor's more-info. Group summary leads with the issue ("dock issue
   - 2 overdue") and the group ambers for issues even with no overdue
   counters. Group height flexes with active issue count.
   Also in the v2.3->v2.4 span: Suction dropdown (vacuum.set_fan_speed,
   fan_speed_list - the dropdown factory now takes opts/cur/set specs),
   Mop drying status row, Battery row at the bottom of Config (charging
   bolt from the status sensor, amber below 20% when not charging; battery
   removed from the header by owner preference), dialogs widened (guides
   480px, map 900px, both viewport-capped).
   v2.3: (1) WARNING-FIRST header secondary: warnings render as an amber
   prefix token ("\u26a0 water \u00b7 " / "\u26a0 dock \u00b7 " / "\u26a0 blocked \u00b7 ",
   highest priority first: blocked > dock > water) ahead of the normally
   colored status text - right-truncation can never eat the warning. This
   REPLACES v1.8's trailing "\u00b7 blocked"/"\u26a0" suffixes and whole-line
   amber (owner-chosen two-tone). Eligibility text is suppressed while
   blocked. (2) Cleaning progress reads "34% done". (3) Current room appears
   in the cleaning line (sensor.qx_revo_ultra_2_current_room). (4) Battery
   with a bolt appears in the DOCKED/IDLE line ONLY (deliberate: a second
   naked percentage in the cleaning line misreads as charge - owner-tested).
   (5) MAP BUTTON in the header while moving (cleaning/paused/returning)
   opens a dialog showing the live integration map (image entity's
   entity_picture proxy URL, session-authed; refreshes while open). The map
   dialog reuses the guide overlay with steps/footer hidden. (6) DOCK-ACTIVITY
   states: sensor.qx_revo_ultra_2_status disambiguates 'docked' - during
   washing_the_mop / going_to_wash_the_mop / emptying_the_bin the header shows
   that activity in cyan (run-in-progress) instead of the idle Docked line;
   play/arm suppressed, map available. 'charging' and stale 'paused' are
   deliberately excluded (post-run drying must not read as run-in-progress).
   v2.2: MAINTENANCE GUIDE DIALOGS - each maintenance row's info tooltip is
   replaced by a small book button opening a guide dialog: illustration
   (served from HA at /local/vacuum-guides/*.webp - owner-processed app
   diagrams living in /config/www/vacuum-guides, inside HA backups, NOT in
   this blob and NOT in the GitHub repo copy, which only carries these
   paths), how-to steps, the app-matched service interval, and an amber
   "reset the counter in the Roborock app" reminder on counter-backed rows.
   Missing image = dialog degrades to text-only (img onerror). Two new
   COUNTER-LESS rows: Mop pads + Dust bag ("as needed", never amber, never
   notify; whole row opens the guide since there is no history to show).
   "Dock strainer" renamed "Cleaning tray" to match the Roborock app.
   v2.1: (1) maintenance sub-rows have info tooltips with manual-verified
   service instructions (Q Revo manual p.11: side brush = one screw, sensors
   = dry-cloth wipe list, filter lives in the dustbin, etc.), each pointing
   to the Roborock app's illustrated Maintenance guide (their imagery cannot
   be embedded - copyright + this card's zero-dependency rule). (2) Dock
   empty mode chip is READ-ONLY (dimmed, tooltip): the integration currently
   rejects SET_DUST_COLLECTION_MODE (HA error log, verified by direct API
   call 2026-07-13) - re-enable by moving 'empty' back into the dropdown
   binds when fixed. (3) Mop intensity + mop mode are DROPDOWN MENUS
   (anchored under the chip, current option highlighted, 'unknown' filtered,
   flips above when near the card edge) instead of cycle chips.
   v2.0 RESTRUCTURE: the body is now THREE ACCORDION GROUPS (one open at a
   time; opening one closes the others):
     AUTO-CLEAN  - group row: green autorenew icon, chevron, toggle on the
                   right (ONLY the toggle flips the automation; tapping the
                   rest of the row expands the group). Sub-rows: Min days
                   between runs, Active window, Backstop time, Departure
                   delay, Notifications, Warning time, Presence.
     MAINTENANCE - group row summarizes ("2 overdue" amber / "all ok") and
                   takes an amber row wash + amber wrench icon when any
                   counter is negative. Sub-rows: Main brush, Side brush,
                   Filter, Sensor cleaning, Dock strainer - "Nh left" grey or
                   "Nh overdue" amber (icon echoes amber). Tap = more-info.
                   HA-side companion: automation.vacuum_maintenance_overdue_notify
                   pings once per item per below-zero crossing.
     CONFIG      - group row summarizes "mop <intensity> . vol <n>". Sub-rows:
                   Mop intensity / Mop mode / Dock empty mode (cycle chips ->
                   select.select_next, optimistic), Volume (slider ->
                   number.set_value), DND (toggle + two time chips -> the
                   robot's own quiet hours; chips open the time entities'
                   more-info), Dock child lock (toggle).
   Sub-rows are 36px, indented, on a darker inset background, with 15px
   dimmed leading icons (variant B - icons echo amber on overdue maintenance).
   Chevrons appear ONLY on group rows (signal: container, not action) and
   rotate when open. All v1.x header behavior is preserved unchanged:
   status line, eligibility/"blocked", warning countdown + Start/Abort,
   two-tap-arm play button, pause/resume/dock, long-press = more-info.

   Built 2026-07-13 by Claude for Ratman (design + automation architecture
   archived in the "NAS / Smart Home" Claude project; sibling of
   flat-thermostat / flat-treadmill / flat-weather / flat-sensor-stack cards).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-vacuum-card;base64,<blob>.
     There is no file on disk and no internet dependency - the code lives inside
     the URL itself, in HA's own config (.storage/lovelace_resources), and is
     included in every Home Assistant backup automatically. The ;name= parameter
     is only a human-readable label for the Resources page (RFC 2397).
   - To READ it: copy everything after "base64," and run it through any base64
     decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS (ASCII-only; unicode escapes for special
     chars in strings AND comments), run node --check, re-encode to base64,
     then in Settings > Dashboards > Resources replace this resource's URL with
     data:text/javascript;name=flat-vacuum-card;base64,<new blob>. Hard-refresh.
     (Established workflow: Claude hands a .txt with the full data: URL; owner pastes.)
   - Used from the dashboard as:  type: custom:flat-vacuum-card
   - COLOR SCHEME: teal/cyan (ACCENT #00bcd4 / TEXT #4dd0e1); toggle/auto-on
     green #4caf50; warning/paused/overdue amber #ffc107.
   - RULES CARRIED FORWARD: warning-time helper is fractional MINUTES with
     0.25 steps (15s) - float math only; its slider has a soft visual max
     (notify_slider_max, 10 min) below the helper's real 30; departure delay
     hard max 30 is COUPLED to the automation's window_open +30min offset.
   - HA-side dependencies (labeled "Vacuum Auto" except the presence sensor,
     "Household Presence" - SHARED, not vacuum teardown): the auto-clean
     automation, the maintenance notify automation, + 7 helpers. */

const ACCENT = '#00bcd4';
const ACCENT_TEXT = '#4dd0e1';
const GREEN = '#4caf50';
const AMBER = '#ffc107';
const GREY = '#9e9e9e';

class FlatVacuumCard extends HTMLElement {
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = Object.assign({
      vacuum: 'vacuum.qx_revo_ultra_2',
      last_clean_sensor: 'sensor.qx_revo_ultra_2_last_clean_end',
      progress_sensor: 'sensor.qx_revo_ultra_2_cleaning_progress',
      error_sensor: 'sensor.qx_revo_ultra_2_vacuum_error',
      dock_error_sensor: 'sensor.qx_revo_ultra_2_dock_dock_error',
      automation: 'automation.vacuum_auto_clean_opportunistic_backstop',
      min_days_entity: 'input_number.vacuum_min_days_between',
      delay_entity: 'input_number.vacuum_departure_delay',
      window_start_entity: 'input_datetime.vacuum_window_start',
      window_end_entity: 'input_datetime.vacuum_window_end',
      backstop_entity: 'input_datetime.vacuum_backstop_time',
      notify_mode_entity: 'input_select.vacuum_notify_mode',
      notify_delay_entity: 'input_number.vacuum_notify_delay',
      notify_slider_max: 10,
      away_sensor: 'binary_sensor.household_all_away',
      maint: [
        ['m_filt', 'mdi:air-filter', 'Filter', 'sensor.qx_revo_ultra_2_filter_time_left'],
        ['m_main', 'mdi:broom', 'Main brush', 'sensor.qx_revo_ultra_2_main_brush_time_left'],
        ['m_side', 'mdi:brush-variant', 'Side brush', 'sensor.qx_revo_ultra_2_side_brush_time_left'],
        ['m_sens', 'mdi:eye-outline', 'Sensor cleaning', 'sensor.qx_revo_ultra_2_sensor_time_left'],
        ['m_mop', 'mdi:circle-multiple-outline', 'Mop pads', null],
        ['m_strn', 'mdi:filter-variant', 'Cleaning tray', 'sensor.qx_revo_ultra_2_dock_strainer_time_left'],
        ['m_bag', 'mdi:sack', 'Dust bag', null],
      ],
      guides_base: '/local/vacuum-guides/',
      room_sensor: 'sensor.qx_revo_ultra_2_current_room',
      battery_sensor: 'sensor.qx_revo_ultra_2_battery',
      water_sensor: 'binary_sensor.qx_revo_ultra_2_water_shortage',
      map_entity: 'image.qx_revo_ultra_2_map_0',
      status_sensor: 'sensor.qx_revo_ultra_2_status',
      mop_intensity_entity: 'select.qx_revo_ultra_2_mop_intensity',
      mop_mode_entity: 'select.qx_revo_ultra_2_mop_mode',
      empty_mode_entity: 'select.qx_revo_ultra_2_dock_empty_mode',
      volume_entity: 'number.qx_revo_ultra_2_volume',
      dnd_entity: 'switch.qx_revo_ultra_2_do_not_disturb',
      dnd_begin_entity: 'time.qx_revo_ultra_2_do_not_disturb_begin',
      dnd_end_entity: 'time.qx_revo_ultra_2_do_not_disturb_end',
      child_lock_entity: 'switch.qx_revo_ultra_2_dock_child_lock',
      drying_entity: 'binary_sensor.qx_revo_ultra_2_dock_mop_drying',
      drying_time_entity: 'sensor.qx_revo_ultra_2_dock_mop_drying_remaining_time',
      clean_begin_sensor: 'sensor.qx_revo_ultra_2_last_clean_begin',
      clean_area_sensor: 'sensor.qx_revo_ultra_2_cleaning_area',
      run_trigger_entity: 'input_text.vacuum_run_trigger',
      suction_away_entity: 'input_select.vacuum_suction_away',
      suction_default_entity: 'input_select.vacuum_suction_default',
      mop_intensity_away_entity: 'input_select.vacuum_mop_intensity_away',
      mop_intensity_default_entity: 'input_select.vacuum_mop_intensity_default',
      mop_mode_away_entity: 'input_select.vacuum_mop_mode_away',
      mop_mode_default_entity: 'input_select.vacuum_mop_mode_default',
      history_days: 14,
    }, config);
    this._open = false;
    this._grp = null;          // 'auto' | 'maint' | 'conf' | null (accordion)
    this._dragKey = null;
    this._opt = {};            // optimistic values by key
    this._optUntil = 0;
    if (!this.shadowRoot) this._createDom();
  }

  getCardSize() { return 3; }

  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    if (this._armTimer) { clearTimeout(this._armTimer); this._armTimer = null; }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._histAt && !this._histBusy) this._fetchHist();
    this._render();
  }

  _st(id) { return this._hass && this._hass.states[id]; }
  _num(id) {
    const s = this._st(id);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }
  _moreInfo(id) {
    this.dispatchEvent(new CustomEvent('hass-more-info',
      { detail: { entityId: id }, bubbles: true, composed: true }));
  }
  _svc(domain, service, data) {
    if (this._hass) this._hass.callService(domain, service, data);
  }
  _optv(key, fallback) {
    return (this._opt[key] != null && (this._dragKey === key || Date.now() < this._optUntil))
      ? this._opt[key] : fallback;
  }
  _t12(state) {
    if (!state || state.length < 5 || state === 'unknown' || state === 'unavailable') return '--:--';
    let h = parseInt(state.slice(0, 2), 10);
    const m = state.slice(3, 5);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  }

  _createDom() {
    const c = this._config;
    const root = this.attachShadow({ mode: 'open' });
    const maintRows = c.maint.map(([id, icon, name]) => `
          <div class="srow act" id="${id}">
            <ha-icon class="sic" id="${id}_ic" icon="${icon}"></ha-icon>
            <span class="slbl">${name}</span>
            <span class="vbtn gbtn" id="${id}_g"><ha-icon icon="mdi:book-open-variant"></ha-icon></span>
            <span class="rt stat" id="${id}_v">--</span>
          </div>`).join('');
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; overflow: hidden; position: relative; }
        .hdr { display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          cursor: pointer; transition: transform .12s ease, background .12s ease; }
        .hdr:hover { background: rgba(255,255,255,.04); }
        .grow:hover { background: rgba(255,255,255,.05); }
        .grow:active { transform: scale(.99); }
        .hdr.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .hdr ha-icon { --mdc-icon-size: 26px; width: 26px; height: 26px; display: flex;
          align-items: center; justify-content: center; line-height: 0; flex: none; }
        .ht { min-width: 0; flex: 1; }
        .ht .p { font-size: 14px; font-weight: 500; color: var(--primary-text-color); line-height: 1.3; }
        .ht .s { font-size: 12px; color: var(--secondary-text-color); line-height: 1.3;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hctl { display: flex; align-items: center; gap: 8px; flex: none; }
        .body { display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .3s cubic-bezier(.4,0,.2,1); }
        .body.open { grid-template-rows: 1fr; }
        .body > .gin, .gbody > .gin { overflow: hidden; min-height: 0; }
        .grow { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 14px;
          border-top: 1px solid rgba(255,255,255,.05); cursor: pointer;
          transition: transform .12s ease, background .12s ease; }
        .grow.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .grow.warn { background: rgba(255,193,7,.06); }
        .grow.warn.pressed { background: rgba(255,193,7,.12); }
        .grow ha-icon.gic { --mdc-icon-size: 19px; width: 19px; height: 19px; display: flex;
          align-items: center; justify-content: center; line-height: 0; flex: none;
          color: var(--secondary-text-color); }
        .grow .lbl { font-size: 13.5px; color: var(--primary-text-color); white-space: nowrap; }
        .grow .rt { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .chev { --mdc-icon-size: 14px; width: 14px; height: 14px; display: flex;
          align-items: center; justify-content: center; line-height: 0; flex: none;
          color: #666; transition: transform .25s ease; }
        .chev.open { transform: rotate(180deg); }
        .gbody { display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .28s cubic-bezier(.4,0,.2,1);
          background: rgba(0,0,0,.25); }
        .gbody.open { grid-template-rows: 1fr; }
        .srow { display: flex; align-items: center; gap: 9px; height: 36px; padding: 0 14px 0 28px;
          border-top: 1px solid rgba(255,255,255,.04);
          transition: transform .12s ease, background .12s ease; }
        .srow:first-child { border-top: none; }
        .srow.act { cursor: pointer; }
        .srow.pressed { transform: scale(.985); background: rgba(70,70,70,.22); }
        .srow.dim { opacity: .4; }
        .srow.dim .track, .srow.dim .chip { pointer-events: none; }
        ha-icon.sic { --mdc-icon-size: 15px; width: 15px; height: 15px; display: flex;
          align-items: center; justify-content: center; line-height: 0; flex: none;
          color: rgba(158,158,158,.6); }
        .slbl { font-size: 13px; color: #ccc; white-space: nowrap; }
        .srow .rt { margin-left: auto; display: flex; align-items: center; gap: 7px; }
        .row ha-icon.info, ha-icon.info { --mdc-icon-size: 12px; width: 12px; height: 12px;
          display: flex; align-items: center; justify-content: center; line-height: 0;
          flex: none; color: rgba(158,158,158,.45) !important; cursor: pointer;
          margin-left: -2px; }
        .row ha-icon.info.on, ha-icon.info.on { color: ${ACCENT_TEXT} !important; }
        .tip { position: absolute; background: rgba(0,0,0,.88); border-radius: 6px;
          padding: 5px 10px; font-size: 11.5px; color: #e8e8e8; z-index: 5;
          max-width: 260px; line-height: 1.4; pointer-events: none; }
        .vbtn { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,.08);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background .15s, transform .12s ease; }
        .vbtn:hover { background: rgba(255,255,255,.15); }
        .vbtn.pressed { transform: scale(.92); }
        .vbtn ha-icon { --mdc-icon-size: 15px; width: 15px; height: 15px;
          color: var(--primary-text-color); }
        .sw { width: 36px; height: 20px; border-radius: 10px; background: rgba(255,255,255,.15);
          position: relative; transition: background .2s; flex: none; cursor: pointer; }
        .sw .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
          border-radius: 50%; background: #bbb; transition: left .2s, background .2s; }
        .sw.on { background: rgba(76,175,80,.35); }
        .sw.on .knob { left: 18px; background: ${GREEN}; }
        .step { display: flex; align-items: center; gap: 2px; }
        .sbtn { width: 24px; height: 24px; border-radius: 7px; background: rgba(255,255,255,.06);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          color: var(--primary-text-color); font-size: 14px; user-select: none;
          transition: background .15s, transform .12s ease; }
        .sbtn:hover { background: rgba(255,255,255,.12); }
        .sbtn.pressed { transform: scale(.92); }
        .sval { min-width: 24px; text-align: center; font-size: 12.5px; color: var(--primary-text-color); }
        .track { position: relative; width: 108px; height: 14px; cursor: pointer;
          display: flex; align-items: center; touch-action: none; flex: none; }
        .track .rail { position: absolute; left: 0; right: 0; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,.15); }
        .track .fillr { position: absolute; left: 0; height: 4px; border-radius: 2px;
          background: ${ACCENT}; pointer-events: none;
          transition: width .25s cubic-bezier(.4,0,.2,1); }
        .track .th { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%;
          background: #fff; transform: translate(-50%,-50%); pointer-events: none;
          transition: left .25s cubic-bezier(.4,0,.2,1); }
        .track.dragging .fillr, .track.dragging .th { transition: none; }
        .track.dimmed { opacity: .4; pointer-events: none; }
        .rval { font-size: 12px; color: var(--secondary-text-color); width: 42px;
          text-align: right; white-space: nowrap; flex: none; }
        .rval.ed { cursor: pointer; }
        .rval.ed:hover { color: var(--primary-text-color); }
        .vin { width: 56px; flex: none; box-sizing: border-box; background: rgba(255,255,255,.08);
          border: 1px solid ${ACCENT_TEXT}; border-radius: 6px; color: var(--primary-text-color);
          font-size: 12px; padding: 3px 6px; text-align: right; outline: none;
          font-family: inherit; }
        .seg { display: flex; background: rgba(255,255,255,.06); border-radius: 7px;
          overflow: hidden; flex: none; }
        .seg span { font-size: 11px; padding: 3px 9px; color: var(--secondary-text-color);
          cursor: pointer; transition: background .15s, color .15s; }
        .seg span + span { border-left: 1px solid rgba(255,255,255,.06); }
        .seg span:hover { background: rgba(255,255,255,.06); }
        .seg span.sel { background: ${ACCENT_TEXT}; color: #0a2a30; font-weight: 500; }
        .chip { font-size: 11.5px; color: var(--primary-text-color); background: rgba(255,255,255,.07);
          border-radius: 6px; padding: 3px 8px; cursor: pointer; white-space: nowrap;
          transition: background .15s, transform .12s ease; }
        .chip:hover { background: rgba(255,255,255,.13); }
        .chip.pressed { transform: scale(.94); }
        .chip.ro { cursor: default; opacity: .55; }
        .chip.ro:hover { background: rgba(255,255,255,.07); }
        .menu { position: absolute; background: #262626; border: 1px solid rgba(255,255,255,.1);
          border-radius: 9px; padding: 4px; z-index: 6; box-shadow: 0 6px 20px rgba(0,0,0,.5);
          min-width: 110px; display: none; }
        .menu div { font-size: 12px; padding: 6px 10px; border-radius: 6px; color: #ccc;
          cursor: pointer; white-space: nowrap; }
        .menu div:hover { background: rgba(255,255,255,.08); }
        .menu div.sel { background: rgba(0,188,212,.2); color: ${ACCENT_TEXT}; font-weight: 500; }
        .gbtn { width: 22px; height: 22px; border-radius: 6px; flex: none;
          background: none; display: flex; align-items: center; justify-content: center; }
        .gbtn:hover { background: rgba(255,255,255,.08); }
        .gbtn ha-icon { --mdc-icon-size: 13px; width: 13px; height: 13px;
          display: flex; align-items: center; justify-content: center; line-height: 0;
          color: rgba(158,158,158,.5); }
        .gbtn:hover ha-icon { color: ${ACCENT_TEXT}; }
        .mcap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
          padding: 5px 14px 7px 28px; border-top: 1px solid rgba(255,255,255,.04);
          font-size: 10.5px; color: rgba(158,158,158,.55); letter-spacing: .2px;
          text-align: right; line-height: 1.5; }
        .hday { width: 52px; font-size: 12.5px; color: #ccc; flex: none; }
        .hmid { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; }
        .hrun { padding: 4px 14px 4px 28px; }
        .hrun + .hrun { border-top: 1px solid rgba(255,255,255,.04); }
        .hl1 { display: flex; align-items: center; gap: 9px; min-height: 21px; }
        .hl1 .rt { margin-left: auto; }
        .hprof { font-size: 10.5px; line-height: 1.15; color: rgba(158,158,158,.5);
          padding-left: 61px; }
        .hprof.away { color: ${ACCENT_TEXT}; opacity: .7; }
        .hstrip { display: flex; gap: 4px; align-items: center; justify-content: flex-end;
          padding: 6px 14px 8px 28px; border-top: 1px solid rgba(255,255,255,.04); }
        .hstrip .lb { font-size: 10.5px; color: rgba(158,158,158,.55); margin-right: auto; }
        .hsq { width: 8px; height: 8px; border-radius: 2px; background: rgba(255,255,255,.08);
          flex: none; }
        .hsq.on { background: #00838f; }
        .hsq.today { background: ${ACCENT_TEXT}; }
        .irow { background: rgba(255,193,7,.05); }
        .irow .il { color: ${AMBER}; flex: 1; min-width: 0; overflow: hidden;
          text-overflow: ellipsis; }
        .ihint { font-size: 11.5px; color: rgba(158,158,158,.7); white-space: nowrap; flex: none; }
        .pvdlg { background: #1c1c1c; border: 1px solid rgba(255,255,255,.1); border-radius: 14px;
          padding: 18px; width: 320px; max-width: calc(100vw - 40px); box-shadow: 0 8px 32px rgba(0,0,0,.5); }
        .pvsub { font-size: 11px; color: #8a8a8a; margin: 2px 0 12px 0; line-height: 1.4; }
        .pvlbl { font-size: 10px; color: var(--secondary-text-color); letter-spacing: .4px; margin: 12px 0 5px 0; }
        .pvlbl .note { color: #666; letter-spacing: 0; }
        .pvseg { display: flex; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.04); }
        .pvseg div { flex: 1; padding: 7px 0; text-align: center; font-size: 11px;
          color: var(--secondary-text-color); cursor: pointer; white-space: nowrap; }
        .pvseg div.sel { background: #00838f; color: #fff; }
        .pvbtns { display: flex; gap: 8px; margin-top: 16px; }
        .pvbtn { flex: 1; padding: 9px 0; text-align: center; border-radius: 9px; font-size: 12px; cursor: pointer; }
        .pvbtn.cancel { background: rgba(255,255,255,.06); color: var(--secondary-text-color); }
        .pvbtn.save { background: #00838f; color: #fff; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: none;
          align-items: center; justify-content: center; z-index: 9999; }
        .overlay.open { display: flex; }
        .dlg { background: #1c1c1c; border: 1px solid rgba(255,255,255,.1); border-radius: 14px;
          padding: 18px; width: 480px; max-width: calc(100vw - 40px);
          max-height: calc(100vh - 60px); overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,.5); }
        .dlg.wide { width: 900px; }
        .dhead { display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 10px; font-size: 14px; font-weight: 600;
          color: var(--primary-text-color); }
        .dclose { width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,.06);
          display: flex; align-items: center; justify-content: center;
          color: var(--secondary-text-color); cursor: pointer; font-size: 13px; }
        .dimg { width: 100%; border-radius: 9px; display: block; margin-bottom: 12px; }
        .dsteps { font-size: 12px; color: #ccc; line-height: 1.7; }
        .dsteps b { color: ${ACCENT_TEXT}; font-weight: 500; }
        .dfoot { font-size: 11px; color: var(--secondary-text-color); margin-top: 10px;
          padding-top: 10px; border-top: 1px solid rgba(255,255,255,.07); line-height: 1.6; }
        .dfoot .warn { color: ${AMBER}; }
        .dbtn { margin-top: 14px; padding: 9px 0; text-align: center; border-radius: 9px;
          font-size: 12px; background: rgba(255,255,255,.06);
          color: var(--secondary-text-color); cursor: pointer; }
        .abortc { color: #f0999b; background: rgba(226,75,74,.15); font-weight: 500;
          padding: 4px 12px; font-size: 12px; }
        .abortc:hover { background: rgba(226,75,74,.28); }
        .startc { color: ${ACCENT_TEXT}; background: rgba(0,188,212,.15); font-weight: 500;
          padding: 4px 12px; font-size: 12px; }
        .startc:hover { background: rgba(0,188,212,.28); }
        .armc { color: #0a2a30; background: #4dd0e1; font-weight: 500; padding: 5px 14px;
          font-size: 12px; }
        .armc:hover { background: #6fdbe8; }
        .dash { font-size: 11px; color: #666; }
        .stat { font-size: 12.5px; color: var(--secondary-text-color); }
        .gsum { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; }
      </style>
      <ha-card>
        <div class="hdr" id="hdr">
          <ha-icon id="hico" icon="mdi:robot-vacuum"></ha-icon>
          <div class="ht">
            <div class="p">Vacuum</div>
            <div class="s" id="hsub">--</div>
          </div>
          <span class="hctl" id="hctl">
            <span class="vbtn" id="hmap" style="display:none"><ha-icon icon="mdi:map-outline"></ha-icon></span>
            <span class="vbtn" id="hplay" style="display:none"><ha-icon icon="mdi:play" style="color:${ACCENT_TEXT}"></ha-icon></span>
            <span class="chip armc" id="harm" style="display:none">Start?</span>
            <span class="chip startc" id="hstart" style="display:none">Start</span>
            <span class="chip abortc" id="habort" style="display:none">Abort</span>
            <span class="vbtn" id="hpause" style="display:none"><ha-icon id="hpico" icon="mdi:pause"></ha-icon></span>
            <span class="vbtn" id="hdock" style="display:none"><ha-icon icon="mdi:home-import-outline"></ha-icon></span>
          </span>
        </div>
        <div class="body" id="body">

          <div class="grow" id="g_auto">
            <ha-icon class="gic" id="auico" icon="mdi:autorenew"></ha-icon>
            <span class="lbl">Auto-clean</span>
            <ha-icon class="info" id="i_auto" icon="mdi:information-outline"></ha-icon>
            <ha-icon class="chev" id="ch_auto" icon="mdi:chevron-down"></ha-icon>
            <span class="rt"><span class="sw" id="asw"><span class="knob"></span></span></span>
          </div>
          <div class="gbody" id="b_auto">
            <div class="srow" id="rdays">
              <ha-icon class="sic" icon="mdi:calendar-refresh"></ha-icon>
              <span class="slbl">Min days between runs</span>
              <ha-icon class="info" id="i_days" icon="mdi:information-outline"></ha-icon>
              <span class="rt step">
                <span class="sbtn" id="dminus">&minus;</span>
                <span class="sval" id="dval">-</span>
                <span class="sbtn" id="dplus">+</span>
              </span>
            </div>
            <div class="srow" id="rwin">
              <ha-icon class="sic" icon="mdi:clock-outline"></ha-icon>
              <span class="slbl">Active window</span>
              <ha-icon class="info" id="i_win" icon="mdi:information-outline"></ha-icon>
              <span class="rt">
                <span class="chip" id="cws">--:--</span>
                <span class="dash">&ndash;</span>
                <span class="chip" id="cwe">--:--</span>
              </span>
            </div>
            <div class="srow" id="rback">
              <ha-icon class="sic" icon="mdi:calendar-clock"></ha-icon>
              <span class="slbl">Backstop time</span>
              <ha-icon class="info" id="i_back" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="cbk">--:--</span></span>
            </div>
            <div class="srow" id="rdelay">
              <ha-icon class="sic" icon="mdi:timer-sand"></ha-icon>
              <span class="slbl">Departure delay</span>
              <ha-icon class="info" id="i_delay" icon="mdi:information-outline"></ha-icon>
              <span class="rt">
                <span class="track" id="track_delay"><span class="rail"></span><span class="fillr"></span><span class="th"></span></span>
                <span class="rval" id="dlval">--</span>
                <input class="vin" id="dlin" style="display:none">
              </span>
            </div>
            <div class="srow" id="rnotif">
              <ha-icon class="sic" icon="mdi:bell-outline"></ha-icon>
              <span class="slbl">Notifications</span>
              <ha-icon class="info" id="i_notif" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="seg" id="nseg">
                <span data-m="Off">Off</span><span data-m="Quiet">Quiet</span><span data-m="Loud">Loud</span>
              </span></span>
            </div>
            <div class="srow" id="rwarn">
              <ha-icon class="sic" icon="mdi:bell-ring-outline"></ha-icon>
              <span class="slbl">Warning time</span>
              <ha-icon class="info" id="i_warn" icon="mdi:information-outline"></ha-icon>
              <span class="rt">
                <span class="track" id="track_notify"><span class="rail"></span><span class="fillr"></span><span class="th"></span></span>
                <span class="rval" id="ntval">--</span>
                <input class="vin" id="ntin" style="display:none">
              </span>
            </div>
            <div class="srow act" id="rsucta">
              <ha-icon class="sic" icon="mdi:weather-tornado"></ha-icon>
              <span class="slbl">Away profile</span>
              <ha-icon class="info" id="i_sucta" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="c_sucta">--</span></span>
            </div>
            <div class="srow act" id="rsuctd">
              <ha-icon class="sic" icon="mdi:weather-dust"></ha-icon>
              <span class="slbl">Default profile</span>
              <ha-icon class="info" id="i_suctd" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="c_suctd">--</span></span>
            </div>
            <div class="srow act" id="raway">
              <ha-icon class="sic" id="aico" icon="mdi:home-account"></ha-icon>
              <span class="slbl">Presence</span>
              <ha-icon class="info" id="i_pres" icon="mdi:information-outline"></ha-icon>
              <span class="rt stat" id="atxt">--</span>
            </div>
          </div>

          <div class="grow" id="g_maint">
            <ha-icon class="gic" id="mico" icon="mdi:wrench-outline"></ha-icon>
            <span class="lbl">Maintenance</span>
            <ha-icon class="info" id="i_maint" icon="mdi:information-outline"></ha-icon>
            <ha-icon class="chev" id="ch_maint" icon="mdi:chevron-down"></ha-icon>
            <span class="rt gsum" id="msum">--</span>
          </div>
          <div class="gbody" id="b_maint">
            <div class="srow act irow" id="iss_vac" style="display:none">
              <ha-icon class="sic" icon="mdi:alert" style="color:${AMBER}"></ha-icon>
              <span class="slbl il" id="iss_vac_t">--</span>
              <span class="rt ihint">blocks auto-cleans</span>
            </div>
            <div class="srow act irow" id="iss_dock" style="display:none">
              <ha-icon class="sic" icon="mdi:alert" style="color:${AMBER}"></ha-icon>
              <span class="slbl il" id="iss_dock_t">--</span>
              <span class="rt ihint">warn-only</span>
            </div>
            <div class="srow act irow" id="iss_water" style="display:none">
              <ha-icon class="sic" icon="mdi:water-alert" style="color:${AMBER}"></ha-icon>
              <span class="slbl il">Water low</span>
              <span class="rt ihint">mop limited</span>
            </div>${maintRows}
            <div class="mcap">
              <span>hours = cleaning runtime, not clock time &middot; ~1&ndash;1.5h per clean</span>
              <span>reset counters: Roborock app &rarr; robot &rarr; &#8226;&#8226;&#8226; &rarr; Maintenance</span>
            </div>
          </div>

          <div class="grow" id="g_conf">
            <ha-icon class="gic" icon="mdi:cog-outline"></ha-icon>
            <span class="lbl">Config</span>
            <ha-icon class="info" id="i_conf" icon="mdi:information-outline"></ha-icon>
            <ha-icon class="chev" id="ch_conf" icon="mdi:chevron-down"></ha-icon>
            <span class="rt gsum" id="csum">--</span>
          </div>
          <div class="gbody" id="b_conf">
            <div class="srow" id="rfan">
              <ha-icon class="sic" icon="mdi:weather-dust"></ha-icon>
              <span class="slbl">Suction</span>
              <ha-icon class="info" id="i_fan" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="c_fan">--</span></span>
            </div>
            <div class="srow" id="rmopi">
              <ha-icon class="sic" icon="mdi:water"></ha-icon>
              <span class="slbl">Mop intensity</span>
              <ha-icon class="info" id="i_mopi" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="c_mopi">--</span></span>
            </div>
            <div class="srow" id="rmopm">
              <ha-icon class="sic" icon="mdi:water-sync"></ha-icon>
              <span class="slbl">Mop mode</span>
              <ha-icon class="info" id="i_mopm" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip" id="c_mopm">--</span></span>
            </div>
            <div class="srow" id="rempty">
              <ha-icon class="sic" icon="mdi:delete-empty-outline"></ha-icon>
              <span class="slbl">Dock empty mode</span>
              <ha-icon class="info" id="i_empty" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="chip ro" id="c_empty">--</span></span>
            </div>
            <div class="srow" id="rvol">
              <ha-icon class="sic" icon="mdi:volume-high"></ha-icon>
              <span class="slbl">Volume</span>
              <span class="rt">
                <span class="track" id="track_vol"><span class="rail"></span><span class="fillr"></span><span class="th"></span></span>
                <span class="rval" id="volval">--</span>
              </span>
            </div>
            <div class="srow" id="rdnd">
              <ha-icon class="sic" icon="mdi:sleep"></ha-icon>
              <span class="slbl">DND</span>
              <ha-icon class="info" id="i_dnd" icon="mdi:information-outline"></ha-icon>
              <span class="rt">
                <span class="chip" id="c_dndb">--:--</span>
                <span class="dash">&ndash;</span>
                <span class="chip" id="c_dnde">--:--</span>
                <span class="sw" id="dndsw"><span class="knob"></span></span>
              </span>
            </div>
            <div class="srow" id="rlock">
              <ha-icon class="sic" icon="mdi:lock-outline"></ha-icon>
              <span class="slbl">Dock child lock</span>
              <ha-icon class="info" id="i_lock" icon="mdi:information-outline"></ha-icon>
              <span class="rt"><span class="sw" id="locksw"><span class="knob"></span></span></span>
            </div>
            <div class="srow act" id="rdry">
              <ha-icon class="sic" id="dryic" icon="mdi:hair-dryer"></ha-icon>
              <span class="slbl">Mop drying</span>
              <ha-icon class="info" id="i_dry" icon="mdi:information-outline"></ha-icon>
              <span class="rt stat" id="drytxt">--</span>
            </div>
            <div class="srow act" id="rbatt">
              <ha-icon class="sic" id="battic" icon="mdi:battery"></ha-icon>
              <span class="slbl">Battery</span>
              <span class="rt stat" id="battxt">--</span>
            </div>
          </div>

          <div class="grow" id="g_hist">
            <ha-icon class="gic" icon="mdi:history"></ha-icon>
            <span class="lbl">History</span>
            <ha-icon class="info" id="i_hist" icon="mdi:information-outline"></ha-icon>
            <ha-icon class="chev" id="ch_hist" icon="mdi:chevron-down"></ha-icon>
            <span class="rt gsum" id="hsum">--</span>
          </div>
          <div class="gbody" id="b_hist">
            <div id="hlist"></div>
            <div class="hstrip" id="hstrip"><span class="lb">last 14 days</span></div>
          </div>

        </div>
        <div class="tip" id="tip" style="display:none"></div>
        <div class="menu" id="menu"></div>
      </ha-card>
      <div class="overlay" id="overlay">
        <div class="dlg" id="dlgbox">
          <div class="dhead"><span id="dtitle">--</span><span class="dclose" id="dclose">&#10005;</span></div>
          <img class="dimg" id="dimg" alt="">
          <div class="dsteps" id="dsteps"></div>
          <div class="dfoot" id="dfoot"></div>
          <div class="dbtn" id="dcloseb">Close</div>
        </div>
      </div>
      <div class="overlay" id="pvovl">
        <div class="pvdlg">
          <div class="dhead"><span id="pvttl">--</span><span class="dclose" id="pvclose">&#10005;</span></div>
          <div class="pvsub" id="pvsub"></div>
          <div class="pvlbl">SUCTION</div>
          <div class="pvseg" id="pv_suct"></div>
          <div class="pvlbl">MOP INTENSITY <span class="note">(water to the pads)</span></div>
          <div class="pvseg" id="pv_mopi"></div>
          <div class="pvlbl">MOP MODE <span class="note">(route)</span></div>
          <div class="pvseg" id="pv_mopm"></div>
          <div class="pvbtns">
            <div class="pvbtn cancel" id="pvcancel">Cancel</div>
            <div class="pvbtn save" id="pvsave">Save</div>
          </div>
        </div>
      </div>
    `;
    this._el = {};
    const ids = ['hdr','hico','hsub','hctl','hmap','hplay','harm','hstart','habort','hpause','hpico','hdock',
      'body','g_auto','auico','ch_auto','asw','b_auto',
      'rdays','dminus','dval','dplus','rwin','cws','cwe','rback','cbk',
      'rdelay','track_delay','dlval','dlin','rnotif','nseg','rwarn','track_notify','ntval','ntin',
      'rsucta','c_sucta','i_sucta','rsuctd','c_suctd','i_suctd',
      'pvovl','pvttl','pvsub','pvclose','pv_suct','pv_mopi','pv_mopm','pvcancel','pvsave',
      'raway','aico','atxt',
      'g_maint','mico','ch_maint','msum','b_maint','iss_vac','iss_vac_t','iss_dock','iss_dock_t','iss_water',
      'g_conf','ch_conf','csum','b_conf',
      'rmopi','c_mopi','rmopm','c_mopm','rempty','c_empty',
      'rvol','track_vol','volval','rdnd','c_dndb','c_dnde','dndsw','rlock','locksw','rbatt','battic','battxt',
      'rfan','c_fan','i_fan','rdry','dryic','drytxt','i_dry',
      'g_hist','ch_hist','hsum','b_hist','hlist','hstrip','i_hist',
      'tip','menu','i_auto','i_days','i_win','i_back','i_delay','i_notif','i_warn','i_pres',
      'i_maint','i_conf','i_dnd','i_lock','i_empty','i_mopi','i_mopm',
      'overlay','dlgbox','dtitle','dimg','dsteps','dfoot','dclose','dcloseb'];
    c.maint.forEach(([id]) => { ids.push(id, id + '_ic', id + '_v', id + '_g'); });
    ids.forEach(id => this._el[id] = root.getElementById(id));
    [this._el.track_delay, this._el.track_notify, this._el.track_vol].forEach(t => {
      t._fill = t.querySelector('.fillr');
      t._th = t.querySelector('.th');
    });
    this._bind();
  }

  /* ---------- interactions ---------- */
  _press(node, cls) {
    node.addEventListener('pointerdown', () => node.classList.add(cls || 'pressed'));
    ['pointerup','pointercancel','pointerleave'].forEach(ev =>
      node.addEventListener(ev, () => node.classList.remove(cls || 'pressed')));
  }

  _setGroup(name) {
    this._grp = this._grp === name ? null : name;
    if (this._closeMenu) this._closeMenu();
    if (this._grp === 'hist') this._fetchHist();
    const map = { auto: [this._el.b_auto, this._el.ch_auto],
                  maint: [this._el.b_maint, this._el.ch_maint],
                  conf: [this._el.b_conf, this._el.ch_conf],
                  hist: [this._el.b_hist, this._el.ch_hist] };
    Object.keys(map).forEach(k => {
      const [b, ch] = map[k];
      const open = this._grp === k;
      b.classList.toggle('open', open);
      ch.classList.toggle('open', open);
    });
  }

  _bind() {
    const el = this._el;
    const c = this._config;
    /* header: click toggles body, long-press = vacuum more-info */
    this._press(el.hdr);
    let timer = null; this._lp = false;
    el.hdr.addEventListener('pointerdown', () => {
      this._lp = false;
      timer = setTimeout(() => { this._lp = true; this._moreInfo(c.vacuum); }, 550);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(ev =>
      el.hdr.addEventListener(ev, () => clearTimeout(timer)));
    /* grid-collapse wrappers: each collapsing container needs a single
       grid-row child (min-height:0). Built at runtime so the markup
       stays flat; element references survive the move. */
    [el.body, el.b_auto, el.b_maint, el.b_conf, el.b_hist].forEach((b) => {
      const w = document.createElement('div');
      w.className = 'gin';
      while (b.firstChild) w.appendChild(b.firstChild);
      b.appendChild(w);
    });
    el.hdr.addEventListener('click', () => {
      if (this._lp) { this._lp = false; return; }
      this._open = !this._open;
      el.body.classList.toggle('open', this._open);
    });
    /* header controls: keep presses off the header */
    el.hctl.addEventListener('pointerdown', (e) => e.stopPropagation());
    [el.hplay, el.harm, el.hstart, el.habort, el.hpause, el.hdock].forEach(b => this._press(b));
    const disarm = () => {
      this._armUntil = 0;
      if (this._armTimer) { clearTimeout(this._armTimer); this._armTimer = null; }
      this._render();
    };
    el.hplay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._armUntil = Date.now() + 3000;
      if (this._armTimer) clearTimeout(this._armTimer);
      this._armTimer = setTimeout(disarm, 3000);
      this._render();
    });
    el.harm.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = this._st(c.vacuum);
      const st = s ? s.state : '';
      const a = this._st(c.automation);
      if ((st === 'docked' || st === 'idle') && !(a && (a.attributes.current || 0) > 0)) {
        /* record the LIVE settings this manual run will use (M: prefix),
           mirroring the automation's A:/D: records */
        const fan = (s && s.attributes.fan_speed) || '';
        const mi = (this._st(c.mop_intensity_entity) || {}).state || '';
        const mm = (this._st(c.mop_mode_entity) || {}).state || '';
        if (fan && mi && mm)
          this._svc('input_text', 'set_value', { entity_id: c.run_trigger_entity,
            value: 'manual ' + new Date().toISOString() + ' M:' + fan + '|' + mi + '|' + mm });
        this._svc('vacuum', 'start', { entity_id: c.vacuum });
      }
      disarm();
    });
    el.habort.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._hass) this._hass.callApi('POST', 'events/vacuum_warning_abort', {});
    });
    el.hstart.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._hass) this._hass.callApi('POST', 'events/vacuum_warning_start', {});
    });
    el.hpause.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = this._st(c.vacuum);
      const paused = s && s.state === 'paused';
      this._svc('vacuum', paused ? 'start' : 'pause', { entity_id: c.vacuum });
    });
    el.hdock.addEventListener('click', (e) => {
      e.stopPropagation();
      this._svc('vacuum', 'return_to_base', { entity_id: c.vacuum });
    });
    el.hmap.addEventListener('click', (e) => {
      e.stopPropagation();
      this._openMap();
    });
    /* group rows (accordion) */
    this._press(el.g_auto); this._press(el.g_maint); this._press(el.g_conf); this._press(el.g_hist);
    el.g_auto.addEventListener('click', () => this._setGroup('auto'));
    el.g_maint.addEventListener('click', () => this._setGroup('maint'));
    el.g_conf.addEventListener('click', () => this._setGroup('conf'));
    el.g_hist.addEventListener('click', () => this._setGroup('hist'));
    /* auto-clean toggle: ONLY the switch flips the automation */
    const bindSwitch = (sw, key, domain, entity) => {
      sw.addEventListener('pointerdown', (e) => e.stopPropagation());
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = this._st(entity);
        const on = this._optv(key, s ? s.state : 'off') === 'on';
        this._opt[key] = on ? 'off' : 'on';
        this._optUntil = Date.now() + 8000;
        this._render();
        this._svc(domain, on ? 'turn_off' : 'turn_on', { entity_id: entity });
      });
    };
    bindSwitch(el.asw, 'auto', 'automation', c.automation);
    bindSwitch(el.dndsw, 'dnd', 'switch', c.dnd_entity);
    bindSwitch(el.locksw, 'lock', 'switch', c.child_lock_entity);
    /* min-days stepper */
    [el.dminus, el.dplus].forEach(b => this._press(b));
    const stepDays = (d) => {
      const s = this._st(c.min_days_entity);
      if (!s) return;
      const a = s.attributes;
      const cur = this._optv('days', parseFloat(s.state));
      const v = Math.min(a.max != null ? a.max : 14,
        Math.max(a.min != null ? a.min : 0, cur + d * (a.step || 1)));
      if (v === cur || isNaN(v)) return;
      this._opt.days = v;
      this._optUntil = Date.now() + 8000;
      this._render();
      this._svc('input_number', 'set_value', { entity_id: c.min_days_entity, value: v });
    };
    el.dminus.addEventListener('click', () => stepDays(-1));
    el.dplus.addEventListener('click', () => stepDays(1));
    /* sliders */
    this._bindSlider(el.track_delay, 'delay', c.delay_entity, null, 'input_number');
    this._bindSlider(el.track_notify, 'notify', c.notify_delay_entity, c.notify_slider_max, 'input_number');
    this._bindSlider(el.track_vol, 'vol', c.volume_entity, null, 'number');
    /* inline label editing */
    this._bindEdit(el.dlval, el.dlin, el.track_delay, 'delay', c.delay_entity,
      (t) => { const v = parseFloat(t); return isNaN(v) ? null : v; });
    this._bindEdit(el.ntval, el.ntin, el.track_notify, 'notify', c.notify_delay_entity,
      (t) => {
        t = (t || '').trim().toLowerCase();
        if (!t) return null;
        const ms = t.match(/^(\d+):([0-5]?\d)$/);
        if (ms) return parseInt(ms[1], 10) + parseInt(ms[2], 10) / 60;
        const sec = t.match(/^(\d+(?:\.\d+)?)\s*s/);
        if (sec) return parseFloat(sec[1]) / 60;
        const v = parseFloat(t);
        return isNaN(v) ? null : v;
      });
    /* notify mode segments */
    el.nseg.querySelectorAll('span').forEach(sp => {
      sp.addEventListener('click', () => {
        const m = sp.dataset.m;
        this._opt.mode = m;
        this._optUntil = Date.now() + 8000;
        this._render();
        this._svc('input_select', 'select_option', { entity_id: c.notify_mode_entity, option: m });
      });
    });
    /* time chips */
    const chip = (node, ent) => {
      this._press(node);
      node.addEventListener('pointerdown', (e) => e.stopPropagation());
      node.addEventListener('click', (e) => { e.stopPropagation(); this._moreInfo(c[ent]); });
    };
    chip(el.cws, 'window_start_entity');
    chip(el.cwe, 'window_end_entity');
    chip(el.cbk, 'backstop_entity');
    chip(el.c_dndb, 'dnd_begin_entity');
    chip(el.c_dnde, 'dnd_end_entity');
    /* select dropdown menus (mop intensity / mop mode); empty mode is read-only -
       the integration rejects SET_DUST_COLLECTION_MODE (see header). To re-enable
       when fixed: swap c_empty's 'ro' class off and add a dd() bind for it. */
    const closeMenu = () => {
      el.menu.style.display = 'none';
      this._menuKey = null;
    };
    this._closeMenu = closeMenu;
    el.menu.addEventListener('pointerdown', (e) => e.stopPropagation());
    const dd = (node, key, spec) => {
      this._press(node);
      node.addEventListener('pointerdown', (e) => e.stopPropagation());
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._menuKey === key) { closeMenu(); return; }
        const opts = (spec.opts() || []).filter(o => o !== 'unknown');
        if (!opts.length) return;
        const cur = this._optv(key, spec.cur());
        const m = el.menu;
        m.innerHTML = '';
        opts.forEach(o => {
          const d = document.createElement('div');
          d.textContent = o;
          if (o === cur) d.classList.add('sel');
          d.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this._opt[key] = o;
            this._optUntil = Date.now() + 8000;
            closeMenu();
            this._render();
            spec.set(o);
          });
          m.appendChild(d);
        });
        m.style.display = 'block';
        m.style.left = '0px'; m.style.top = '0px';
        const card = this.shadowRoot.querySelector('ha-card');
        const cr = card.getBoundingClientRect();
        const nr = node.getBoundingClientRect();
        const w = m.offsetWidth, h = m.offsetHeight;
        let x = nr.right - cr.left - w;
        x = Math.max(8, Math.min(x, cr.width - w - 8));
        let y = nr.bottom - cr.top + 4;
        if (y + h > cr.height - 4) y = nr.top - cr.top - h - 4;
        if (y < 4) y = 4;
        m.style.left = x + 'px';
        m.style.top = y + 'px';
        this._menuKey = key;
      });
    };
    /* smart_mode is a ONE-WAY DOOR from HA: the device rejects individual
       mode commands while in SmartPlan, so only the Roborock app can exit
       it. It stays visible as a CURRENT value but is never offered as a
       pickable option in the Config dropdowns. */
    const noSmart = (l) => (l || []).filter((o) => o !== 'smart_mode');
    const selSpec = (entity) => ({
      opts: () => noSmart(((this._st(entity) || {}).attributes || {}).options),
      cur: () => (this._st(entity) || {}).state,
      set: (o) => this._svc('select', 'select_option', { entity_id: entity, option: o }),
    });
    dd(el.c_mopi, 'mopi', selSpec(c.mop_intensity_entity));
    dd(el.c_mopm, 'mopm', selSpec(c.mop_mode_entity));
    dd(el.c_fan, 'fan', {
      opts: () => noSmart(((this._st(c.vacuum) || {}).attributes || {}).fan_speed_list),
      cur: () => ((this._st(c.vacuum) || {}).attributes || {}).fan_speed,
      set: (o) => this._svc('vacuum', 'set_fan_speed', { entity_id: c.vacuum, fan_speed: o }),
    });
    /* profile editor popup (away / default) */
    const PRETTY = { max_plus: 'max+', deep_plus: 'deep+' };
    const pv = (s) => PRETTY[s] || s;
    const PV_SETTINGS = [
      { key: 'suction', node: el.pv_suct, away: c.suction_away_entity, def: c.suction_default_entity },
      { key: 'mopi', node: el.pv_mopi, away: c.mop_intensity_away_entity, def: c.mop_intensity_default_entity },
      { key: 'mopm', node: el.pv_mopm, away: c.mop_mode_away_entity, def: c.mop_mode_default_entity },
    ];
    const renderProfDlg = () => {
      const st = this._profDlg;
      if (!st) return;
      PV_SETTINGS.forEach((s) => {
        const ent = st.kind === 'away' ? s.away : s.def;
        const opts = (((this._st(ent) || {}).attributes || {}).options) || [];
        s.node.innerHTML = '';
        opts.forEach((o) => {
          const d = document.createElement('div');
          d.textContent = pv(o);
          if (o === st.vals[s.key]) d.classList.add('sel');
          d.addEventListener('click', () => { st.vals[s.key] = o; renderProfDlg(); });
          s.node.appendChild(d);
        });
      });
    };
    this._openProfile = (kind) => {
      const vals = {};
      PV_SETTINGS.forEach((s) => {
        const ent = kind === 'away' ? s.away : s.def;
        const st = this._st(ent);
        vals[s.key] = st ? st.state : null;
      });
      this._profDlg = { kind, vals };
      el.pvttl.textContent = kind === 'away' ? 'Away profile' : 'Default profile';
      el.pvsub.textContent = kind === 'away'
        ? 'Used when an auto-clean starts and everyone is out. Reverts to Default when the run ends.'
        : 'What every run reverts to when it ends - the robot\u2019s normal way of cleaning.';
      renderProfDlg();
      el.pvovl.classList.add('open');
    };
    const closeProfile = () => { el.pvovl.classList.remove('open'); this._profDlg = null; };
    el.pvclose.addEventListener('click', closeProfile);
    el.pvcancel.addEventListener('click', closeProfile);
    el.pvovl.addEventListener('click', (e) => { if (e.target === el.pvovl) closeProfile(); });
    el.pvsave.addEventListener('click', () => {
      const st = this._profDlg;
      if (!st) return;
      PV_SETTINGS.forEach((s) => {
        const ent = st.kind === 'away' ? s.away : s.def;
        if (st.vals[s.key] != null)
          this._svc('input_select', 'select_option', { entity_id: ent, option: st.vals[s.key] });
      });
      closeProfile();
    });
    this._press(el.rsucta);
    el.rsucta.addEventListener('click', () => this._openProfile('away'));
    this._press(el.rsuctd);
    el.rsuctd.addEventListener('click', () => this._openProfile('default'));
    /* drying row -> more-info */
    this._press(el.rdry);
    el.rdry.addEventListener('click', () => this._moreInfo(c.drying_entity));
    /* maintenance guide dialogs */
    const GUIDES = {
      m_main: { img: 'main-brush.webp', title: 'Main brush - replace',
        steps: ['Flip the robot; unlatch the brush cover.', 'Lift out the roller; clean or swap it.', 'Click the cover back until it latches.'],
        interval: 'Clean every 2 weeks; replace after ~300h of runtime.', reset: true },
      m_side: { img: 'side-brush.webp', title: 'Side brush - replace',
        steps: ['Flip the robot over.', 'Unscrew the single screw; swap the brush.', 'Re-tighten - spares came in the box.'],
        interval: 'Clean monthly; replace after ~200h of runtime.', reset: true },
      m_filt: { img: 'filter.webp', title: 'Filter - replace or rinse',
        steps: ['Open the dustbin; the filter slots into its side.', 'Rinse with water only - no soap.', 'Dry FULLY (24h) before reinstalling.'],
        interval: 'Rinse every 2 weeks; replace after ~150h of runtime.', reset: true },
      m_sens: { img: 'sensors.webp', title: 'Sensors - wipe',
        steps: ['Soft dry cloth only - no liquids.', 'Wipe the cliff, wall, obstacle and mop-wash sensors plus the dock locator.', 'Include the charging contacts.'],
        interval: 'Wipe after ~30h of runtime.', reset: true },
      m_strn: { img: 'cleaning-tray.webp', title: 'Cleaning tray - rinse',
        steps: ['Pull the tray out of the dock base.', 'Rinse off the trapped particles (they protect the water pipes).', 'Dry and reseat.'],
        interval: 'Rinse at least once a month.', reset: true },
      m_mop: { img: 'mop.webp', title: 'Mop pads - replace',
        steps: ['Peel the pads off the spinner plates.', 'Wash them; replace when worn or permanently stained.', 'Press new pads onto the velcro.'],
        interval: 'As needed - no counter tracks this.', reset: false },
      m_bag: { img: 'dust-bag.webp', title: 'Dust bag - replace',
        steps: ['Open the dock lid.', 'Lift the bag by its handle - it self-seals.', 'Slot a new bag in; clean the robot dustbin monthly.'],
        interval: 'As needed - no counter tracks this.', reset: false },
    };
    const openGuide = (id) => {
      const g = GUIDES[id];
      if (!g) return;
      this._mapOpen = false;
      el.dlgbox.classList.remove('wide');
      el.dsteps.style.display = '';
      el.dfoot.style.display = '';
      el.dtitle.textContent = g.title;
      el.dimg.style.display = 'block';
      el.dimg.onerror = () => { el.dimg.style.display = 'none'; };
      el.dimg.src = c.guides_base + g.img;
      el.dsteps.innerHTML = g.steps.map((s, i) =>
        '<b>' + (i + 1) + '</b>&nbsp; ' + s).join('<br>');
      el.dfoot.innerHTML = 'Roborock interval: ' + g.interval +
        (g.reset ? '<br><span class="warn">After servicing, reset the counter in the Roborock app:</span> open your robot &rarr; the circled &#8226;&#8226;&#8226; icon &rarr; Maintenance. That flips this row back to normal and re-arms the overdue notification.' : '');
      el.overlay.classList.add('open');
    };
    const closeGuide = () => {
      el.overlay.classList.remove('open');
      this._mapOpen = false;
    };
    this._openMap = () => {
      const s = this._st(c.map_entity);
      const pic = s && s.attributes.entity_picture;
      if (!pic) return;
      this._mapOpen = true;
      el.dlgbox.classList.add('wide');
      el.dsteps.style.display = 'none';
      el.dfoot.style.display = 'none';
      el.dimg.style.display = 'block';
      el.dimg.onerror = () => { el.dimg.style.display = 'none'; };
      this._mapPic = pic;
      el.dimg.src = pic;
      el.overlay.classList.add('open');
      this._render();
    };
    el.dclose.addEventListener('click', closeGuide);
    el.dcloseb.addEventListener('click', closeGuide);
    el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeGuide(); });
    /* issue rows -> error sensor more-info */
    this._press(el.iss_vac);
    el.iss_vac.addEventListener('click', () => this._moreInfo(c.error_sensor));
    this._press(el.iss_dock);
    el.iss_dock.addEventListener('click', () => this._moreInfo(c.dock_error_sensor));
    this._press(el.iss_water);
    el.iss_water.addEventListener('click', () => this._moreInfo(c.water_sensor));
    /* maintenance rows: guide button always opens the guide; row click = sensor
       history when a counter exists, else the guide */
    c.maint.forEach(([id, , , entity]) => {
      const row = el[id];
      const btn = el[id + '_g'];
      this._press(row);
      this._press(btn);
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => { e.stopPropagation(); openGuide(id); });
      row.addEventListener('click', () => entity ? this._moreInfo(entity) : openGuide(id));
    });
    /* presence */
    this._press(el.raway);
    el.raway.addEventListener('click', () => this._moreInfo(c.away_sensor));
    /* battery row */
    this._press(el.rbatt);
    el.rbatt.addEventListener('click', () => this._moreInfo(c.battery_sensor));
    /* info tooltips */
    const TIPS = {
      i_auto: 'Master switch for the automatic schedule. Tap the row to open the settings; only this toggle turns it on or off.',
      i_days: "Minimum calendar days between cleans, counting manual runs too - 2 means every other day at most; 0 means no limit, clean on every opportunity.",
      i_win: 'Leave-triggered cleans only start inside these hours.',
      i_back: "Daily fallback - runs even if you're home, once eligible.",
      i_delay: 'How long everyone must be gone before a clean starts.',
      i_notif: 'Pre-run warning: Loud pings your phone, Quiet is silent, Off skips the wait entirely.',
      i_warn: 'How long the warning lasts before the robot starts.',
      i_pres: 'Who the automation currently thinks is home.',
      i_maint: "Roborock's recommended service countdowns, in CLEANING RUNTIME hours (the robot runs ~1-1.5h per clean, so 150h is several months). Amber = overdue; a notification fires when an item crosses zero.",
      i_conf: 'Device settings - changes apply to the robot immediately.',
      i_dnd: "The robot's own quiet hours: suppresses its internal schedules, auto-resume, and dock auto-empty. Commanded starts still run.",
      i_lock: 'Disables the physical buttons on the robot and dock (cat insurance).',
      i_empty: 'Read-only for now: the Roborock integration rejects changes to this setting. Change it in the Roborock app instead.',
      i_mopi: 'How wet the spinning pads run (water fed to the mops). Off = vacuum only with dry pads; low to high = increasing dampness. The custom options defer to per-room settings from the app.',
      i_mopm: 'The mopping route: standard = one normal pass; deep / deep+ = slower, tighter overlapping passes that scrub harder; fast = quicker sparse pass; custom = per-room app settings.',
      i_fan: 'Vacuum suction power: quiet to max+ trades noise and battery for pick-up strength. Off = mop only. Custom defers to per-room app settings. NOTE: this is the LIVE value - it reverts to the Default suction profile after every run ends.',
      i_sucta: 'The full cleaning profile for auto-cleans that start while everyone is out: suction + mop water + mop route. Tap the row to edit. Temporary - the run ends, the Default profile returns. Crank it, nobody is home.',
      i_suctd: 'The sticky Default profile - the robot\u2019s normal way of cleaning, restored automatically whenever any run ends (auto, manual, or app-started). Tap the row to edit. Away runs and one-off tweaks are always per-run visitors.',
      i_dry: "After mopping, the dock blow-dries the pads for a few hours to prevent odor and mildew. Read-only status; the drying duration is set in the Roborock app.",
      i_hist: 'Recent full cleans: when, what triggered them (away / backstop / manual), how long, how much floor. Squares = the last 14 days, teal = a day with a clean.',
    };
    const tipShow = (icon, text) => {
      const t = el.tip;
      t.textContent = text;
      t.style.display = 'block';
      t.style.left = '0px'; t.style.top = '0px';
      const card = this.shadowRoot.querySelector('ha-card');
      const cr = card.getBoundingClientRect();
      const ir = icon.getBoundingClientRect();
      const w = t.offsetWidth, h = t.offsetHeight;
      let x = ir.left - cr.left + ir.width / 2 - w / 2;
      x = Math.max(8, Math.min(x, cr.width - w - 8));
      let y = ir.top - cr.top - h - 6;
      if (y < 4) y = ir.bottom - cr.top + 6;
      t.style.left = x + 'px';
      t.style.top = y + 'px';
      icon.classList.add('on');
      this._tipIcon = icon;
    };
    const tipHide = () => {
      el.tip.style.display = 'none';
      if (this._tipIcon) this._tipIcon.classList.remove('on');
      this._tipIcon = null;
      this._tipSticky = false;
    };
    Object.keys(TIPS).forEach((id) => {
      const icon = el[id];
      icon.addEventListener('pointerdown', (e) => e.stopPropagation());
      icon.addEventListener('mouseenter', () => {
        if (!this._tipSticky) tipShow(icon, TIPS[id]);
      });
      icon.addEventListener('mouseleave', () => {
        if (!this._tipSticky) tipHide();
      });
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._tipSticky && this._tipIcon === icon) { tipHide(); return; }
        tipHide();
        tipShow(icon, TIPS[id]);
        this._tipSticky = true;
      });
    });
    this.shadowRoot.querySelector('ha-card').addEventListener('pointerdown', () => {
      if (this._tipSticky) tipHide();
      if (this._menuKey) this._closeMenu();
    });
  }

  _bindSlider(track, key, entity, softMax, domain) {
    const valFromX = (x) => {
      const s = this._st(entity);
      const a = (s && s.attributes) || {};
      const mn = a.min != null ? a.min : 0, st = a.step || 1;
      let mx = a.max != null ? a.max : 30;
      if (softMax != null) mx = Math.min(mx, softMax);
      const r = track.getBoundingClientRect();
      let f = Math.max(0, Math.min(1, (x - r.left) / r.width));
      return Math.min(mx, Math.max(mn, Math.round((mn + f * (mx - mn)) / st) * st));
    };
    const down = (e) => {
      if (!this._st(entity)) return;
      this._dragKey = key;
      this._opt[key] = valFromX(e.clientX);
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      this._render();
    };
    const move = (e) => {
      if (this._dragKey !== key) return;
      track.classList.add('dragging');
      this._opt[key] = valFromX(e.clientX);
      this._render();
    };
    const up = () => {
      if (this._dragKey !== key) return;
      this._dragKey = null;
      track.classList.remove('dragging');
      this._optUntil = Date.now() + 8000;
      if (this._opt[key] != null)
        this._svc(domain, 'set_value', { entity_id: entity, value: this._opt[key] });
    };
    track.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _bindEdit(lbl, inp, track, key, entity, parse) {
    lbl.classList.add('ed');
    lbl.addEventListener('pointerdown', (e) => e.stopPropagation());
    lbl.addEventListener('click', (e) => {
      e.stopPropagation();
      inp.value = lbl.textContent === '--' ? '' : lbl.textContent;
      lbl.style.display = 'none';
      inp.style.display = 'block';
      track.classList.add('dimmed');
      inp.focus();
      inp.select();
    });
    const close = () => {
      inp.style.display = 'none';
      lbl.style.display = '';
      track.classList.remove('dimmed');
    };
    const commit = () => {
      const s = this._st(entity);
      const a = (s && s.attributes) || {};
      let v = parse(inp.value);
      if (v != null && !isNaN(v)) {
        const st = a.step || 1;
        v = Math.round(v / st) * st;
        if (a.min != null) v = Math.max(a.min, v);
        if (a.max != null) v = Math.min(a.max, v);
        v = Math.round(v * 100) / 100;
        this._opt[key] = v;
        this._optUntil = Date.now() + 8000;
        this._svc('input_number', 'set_value', { entity_id: entity, value: v });
      }
      close();
      this._render();
    };
    inp.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { this._noBlur = true; commit(); }
      else if (ev.key === 'Escape') { this._noBlur = true; close(); }
    });
    inp.addEventListener('blur', () => {
      if (this._noBlur) { this._noBlur = false; return; }
      commit();
    });
    inp.addEventListener('click', (ev) => ev.stopPropagation());
    inp.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  }

  _renderSlider(track, valEl, key, entity, fmt, softMax) {
    const s = this._st(entity);
    const a = (s && s.attributes) || {};
    const mn = a.min != null ? a.min : 0;
    let mx = a.max != null ? a.max : 30;
    if (softMax != null) mx = Math.min(mx, softMax);
    const v = this._optv(key, this._num(entity));
    if (v != null) {
      const p = Math.min(100, ((v - mn) / (mx - mn)) * 100);
      track._fill.style.width = p + '%';
      track._th.style.left = p + '%';
      valEl.textContent = fmt ? fmt(v) : Math.round(v) + ' min';
    } else {
      valEl.textContent = '--';
    }
  }

  /* ---------- cleaning history (websocket fetch, cached 5 min) ---------- */
  _fetchHist(force) {
    if (!this._hass) return;
    if (!force && this._histAt && Date.now() - this._histAt < 300000) return;
    if (this._histBusy) return;
    this._histBusy = true;
    const c = this._config;
    const start = new Date(Date.now() - c.history_days * 86400e3).toISOString();
    this._hass.callWS({
      type: 'history/history_during_period',
      start_time: start,
      end_time: new Date().toISOString(),
      entity_ids: [c.last_clean_sensor, c.clean_begin_sensor, c.clean_area_sensor, c.run_trigger_entity],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    }).then((res) => {
      this._histBusy = false;
      this._histAt = Date.now();
      this._runs = this._parseHist(res || {});
      this._renderHist();
    }).catch(() => {
      this._histBusy = false;
      this._histAt = Date.now();
      this._runs = null;
      this._renderHist();
    });
  }

  _histSeries(res, ent) {
    const raw = res[ent] || [];
    return raw.map((it) => ({
      s: it.s != null ? it.s : it.state,
      t: it.lu != null ? it.lu * 1000 : Date.parse(it.last_updated || it.last_changed || 0),
    })).filter((it) => it.s != null && it.s !== 'unknown' && it.s !== 'unavailable' && it.t);
  }

  _parseHist(res) {
    const c = this._config;
    const ends = this._histSeries(res, c.last_clean_sensor);
    const begins = this._histSeries(res, c.clean_begin_sensor);
    const areas = this._histSeries(res, c.clean_area_sensor);
    const trigs = this._histSeries(res, c.run_trigger_entity);
    const runs = [];
    let prev = null;
    ends.forEach((e) => {
      if (e.s === prev) return;
      prev = e.s;
      const endT = Date.parse(e.s);
      if (isNaN(endT)) return;
      let beginT = null;
      begins.forEach((b) => {
        const bt = Date.parse(b.s);
        if (!isNaN(bt) && bt <= endT + 5e3 && endT - bt < 12 * 3600e3 && (beginT == null || bt > beginT)) beginT = bt;
      });
      if (beginT != null && endT < beginT) beginT = null;
      let area = null;
      areas.forEach((a) => {
        const v = parseFloat(a.s);
        if (!isNaN(v) && v > 0 && a.t <= endT + 120e3 && (beginT == null || a.t >= beginT))
          area = v;
      });
      let trig = 'manual', prof = null;
      if (beginT != null) trigs.forEach((tr) => {
        const parts = String(tr.s).split(' ');
        const word = parts[0];
        if (Math.abs(tr.t - beginT) < 600e3 && tr.t <= beginT + 60e3) {
          const t2 = word === 'backstop' ? 'backstop'
            : (word === 'leave' || word === 'window_open') ? 'away'
            : word === 'manual' ? 'manual' : null;
          if (t2) { trig = t2; if (parts[2]) prof = parts[2]; }
        }
      });
      runs.push({ endT, beginT, area, trig, prof });
    });
    runs.sort((a, b) => b.endT - a.endT);
    return runs;
  }

  _renderHist() {
    const el = this._el;
    if (!el) return;
    const runs = this._runs;
    if (runs == null) {
      el.hsum.textContent = '--';
      el.hlist.innerHTML = '<div class="hrun"><div class="hl1"><span class="hmid">history unavailable</span></div></div>';
      return;
    }
    const week = runs.filter((r) => Date.now() - r.endT < 7 * 86400e3).length;
    el.hsum.textContent = week === 0 ? 'no runs this week'
      : week + ' run' + (week > 1 ? 's' : '') + ' this week';
    const dayLbl = (t) => {
      const d = new Date(t); d.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((today - d) / 86400e3);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yday';
      if (diff < 7) return new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    const t12 = (t) => new Date(t).toLocaleTimeString(undefined,
      { hour: 'numeric', minute: '2-digit' });
    const dur = (r) => {
      if (r.beginT == null) return '';
      const m = Math.round((r.endT - r.beginT) / 60e3);
      return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
    };
    const PRETTY_H = { max_plus: 'max+', deep_plus: 'deep+' };
    el.hlist.innerHTML = runs.slice(0, 4).map((r) => {
      const right = [dur(r), r.area != null ? Math.round(r.area) + ' m\u00b2' : '']
        .filter(Boolean).join(' \u00b7 ');
      const mid = (r.beginT != null ? t12(r.beginT) : t12(r.endT)) + ' \u00b7 ' + r.trig;
      let profLine = '';
      if (r.prof && r.prof.length > 2) {
        const away = r.prof.slice(0, 2) === 'A:';
        const body = r.prof.slice(2).split('|').map((p) => PRETTY_H[p] || p).join(' \u00b7 ');
        profLine = '<div class="hprof' + (away ? ' away' : '') + '">' + body + '</div>';
      }
      return '<div class="hrun"><div class="hl1"><span class="hday">' + dayLbl(r.endT) +
        '</span><span class="hmid">' + mid +
        '</span><span class="rt stat">' + right + '</span></div>' + profLine + '</div>';
    }).join('') || '<div class="hrun"><div class="hl1"><span class="hmid">no runs in the last 14 days</span></div></div>';
    const cleaned = new Set(runs.map((r) => {
      const d = new Date(r.endT); d.setHours(0, 0, 0, 0); return d.getTime();
    }));
    const c = this._config;
    let strip = '<span class="lb">last ' + c.history_days + ' days</span>';
    for (let i = c.history_days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const on = cleaned.has(d.getTime());
      strip += '<span class="hsq' + (on ? (i === 0 ? ' today' : ' on') : '') + '"></span>';
    }
    el.hstrip.innerHTML = strip;
  }

  /* ---------- rendering ---------- */
  _render() {
    if (!this._hass || !this._el) return;
    const el = this._el;
    const c = this._config;

    const vs = this._st(c.vacuum);
    const vstate = vs ? vs.state : 'unavailable';
    const unavailable = vstate === 'unavailable' || vstate === 'unknown';
    const as = this._st(c.automation);
    const autoOn = this._optv('auto', as ? as.state : 'off') === 'on';
    const errVac = (this._st(c.error_sensor) || {}).state !== 'none';
    /* dormant-entity guard: the Edge 2 integration does not (currently)
       expose a dock error sensor. Absent entity = no dock issues; if a
       future integration update creates it, the row+token wake untouched. */
    const dockSt = this._hass.states[c.dock_error_sensor]
      ? this._hass.states[c.dock_error_sensor].state : null;
    const errDock = dockSt != null && dockSt !== 'ok'
      && dockSt !== 'unknown' && dockSt !== 'unavailable';
    const water = (this._st(c.water_sensor) || {}).state === 'on';
    const warnTok = errVac ? 'blocked' : errDock ? 'dock' : water ? 'water' : null;
    const prog = this._num(c.progress_sensor);
    const pTxt = prog != null ? ' \u00b7 ' + Math.round(prog) + '% done' : '';

    /* warning period */
    const idleish = vstate === 'docked' || vstate === 'idle';
    const warning = as && (as.attributes.current || 0) > 0 && idleish;
    let mmss = '';
    if (warning) {
      const lt = as.attributes.last_triggered ? new Date(as.attributes.last_triggered) : null;
      const total = (this._num(c.notify_delay_entity) || 5) * 60;
      const rem = lt && !isNaN(lt) ? Math.max(0, total - (Date.now() - lt.getTime()) / 1000) : 0;
      mmss = Math.floor(rem / 60) + ':' + String(Math.floor(rem % 60)).padStart(2, '0');
    }
    if (warning && !this._tick) this._tick = setInterval(() => this._render(), 1000);
    if (!warning && this._tick) { clearInterval(this._tick); this._tick = null; }

    /* dock-activity phases: the vacuum entity reads 'docked' while the dock is
       actually working mid-run (mop washes, prep, bin empty) - the status
       sensor disambiguates. 'charging'/'paused' etc. deliberately NOT in this
       map (post-run drying and stale statuses must not read as run-in-progress). */
    const statusRaw = (this._st(c.status_sensor) || {}).state || '';
    const DOCK_ACT = { washing_the_mop: 'Washing mops',
      going_to_wash_the_mop: 'Going to wash mops', emptying_the_bin: 'Emptying bin' };
    const dockAct = !warning && (idleish || vstate === 'returning') && DOCK_ACT[statusRaw]
      ? DOCK_ACT[statusRaw] : null;

    /* header text (warning-first two-tone: amber prefix token + state-colored rest) */
    let sub;
    if (unavailable) sub = 'Unavailable';
    else if (warning) sub = vstate.replace(/^./, ch => ch.toUpperCase()) + ' \u00b7 starting in ' + mmss;
    else if (dockAct) sub = dockAct + (prog != null && prog > 0 ? pTxt : '');
    else if (vstate === 'cleaning') {
      sub = 'Cleaning' + pTxt;
      const rs = this._st(c.room_sensor);
      if (rs && rs.state && rs.state !== 'unavailable' && rs.state !== 'unknown')
        sub += ' \u00b7 ' + rs.state;
    }
    else if (vstate === 'paused') sub = 'Paused' + pTxt;
    else if (vstate === 'returning') sub = 'Returning to dock';
    else {
      sub = vstate.replace(/_/g, ' ').replace(/^./, ch => ch.toUpperCase());
      const lcs = this._st(c.last_clean_sensor);
      const lc = lcs && lcs.state !== 'unavailable' && lcs.state !== 'unknown'
        ? new Date(lcs.state) : null;
      if (lc && !isNaN(lc)) {
        const today = new Date(); today.setHours(0,0,0,0);
        const lcd = new Date(lc); lcd.setHours(0,0,0,0);
        const d = Math.round((today - lcd) / 86400e3);
        const x = this._num(c.min_days_entity);
        sub += ' \u00b7 cleaned ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
        if (!errVac && x != null) sub += ' \u00b7 ' + (d >= x ? 'eligible today'
          : 'eligible in ' + (x - d) + ' day' + (x - d > 1 ? 's' : ''));
      }
    }
    if (!autoOn) sub += ' \u00b7 auto off';
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const subHtml = (warnTok
      ? '<span style="color:' + AMBER + '">\u26a0 ' + warnTok + ' \u00b7 </span>' : '') + esc(sub);
    if (this._subHtml !== subHtml) { this._subHtml = subHtml; el.hsub.innerHTML = subHtml; }

    /* header state machine */
    if (this._armUntil && Date.now() > this._armUntil) this._armUntil = 0;
    const running = vstate === 'cleaning' || vstate === 'paused';
    const show = (n, v) => { const d = v ? 'flex' : 'none'; if (n.style.display !== d) n.style.display = d; };
    if (warning) el.hico.setAttribute('icon', 'mdi:alarm');
    else if (vstate === 'returning') el.hico.setAttribute('icon', 'mdi:home-import-outline');
    else el.hico.setAttribute('icon', 'mdi:robot-vacuum');
    el.hico.style.color = warning ? AMBER
      : (vstate === 'cleaning' || vstate === 'returning' || dockAct) ? ACCENT_TEXT
      : vstate === 'paused' ? AMBER
      : autoOn ? GREY : 'rgba(255,255,255,.25)';
    el.hsub.style.color = warning || vstate === 'paused' ? AMBER
      : (vstate === 'cleaning' || vstate === 'returning' || dockAct) ? ACCENT_TEXT : '';
    const armed = this._armUntil > 0;
    show(el.hmap, running || vstate === 'returning' || !!dockAct);
    show(el.hplay, idleish && !warning && !dockAct && !unavailable && !armed);
    show(el.harm, idleish && !warning && !dockAct && !unavailable && armed);
    show(el.hstart, warning);
    show(el.habort, warning);
    show(el.hpause, running || !!dockAct);
    show(el.hdock, running || !!dockAct);
    el.hpico.setAttribute('icon', vstate === 'paused' ? 'mdi:play' : 'mdi:pause');

    /* map dialog: keep title + image fresh while open */
    if (this._mapOpen) {
      this._el.dtitle.textContent = 'Map \u00b7 ' + sub;
      const ms = this._st(c.map_entity);
      const pic = ms && ms.attributes.entity_picture;
      if (pic && pic !== this._mapPic) {
        this._mapPic = pic;
        this._el.dimg.src = pic;
      }
    }

    /* auto-clean group */
    el.asw.classList.toggle('on', autoOn);
    el.auico.style.color = autoOn ? GREEN : '';
    const dv = this._optv('days', this._num(c.min_days_entity));
    el.dval.textContent = dv != null ? String(Math.round(dv)) : '-';
    const t = (ent) => { const s = this._st(ent); return s ? this._t12(s.state) : '--:--'; };
    el.cws.textContent = t(c.window_start_entity);
    el.cwe.textContent = t(c.window_end_entity);
    el.cbk.textContent = t(c.backstop_entity);
    this._renderSlider(el.track_delay, el.dlval, 'delay', c.delay_entity);
    this._renderSlider(el.track_notify, el.ntval, 'notify', c.notify_delay_entity, (v) => {
      const s = Math.round(v * 60);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, c.notify_slider_max);
    const ms = this._st(c.notify_mode_entity);
    const mode = this._optv('mode', ms ? ms.state : 'Loud');
    el.nseg.querySelectorAll('span').forEach(sp =>
      sp.classList.toggle('sel', sp.dataset.m === mode));
    el.rwarn.classList.toggle('dim', mode === 'Off');
    const aw = this._st(c.away_sensor);
    const away = aw && aw.state === 'on';
    el.atxt.textContent = !aw || aw.state === 'unavailable' || aw.state === 'unknown'
      ? '--' : (away ? 'All away' : 'Someone home');
    el.atxt.style.color = away ? AMBER : '';
    el.aico.style.color = away ? AMBER : '';

    /* maintenance group */
    /* maintenance group: issue rows first, then counters */
    const pretty = (s) => String(s).replace(/_/g, ' ');
    const vacErrState = (this._st(c.error_sensor) || {}).state;
    const dockErrState = (this._st(c.dock_error_sensor) || {}).state;
    show(el.iss_vac, errVac);
    if (errVac) el.iss_vac_t.textContent = 'Robot: ' + pretty(vacErrState);
    show(el.iss_dock, errDock);
    if (errDock) el.iss_dock_t.textContent = 'Dock: ' + pretty(dockErrState);
    show(el.iss_water, water);
    const issueCt = (errVac ? 1 : 0) + (errDock ? 1 : 0) + (water ? 1 : 0);
    let overdue = 0, unknownCt = 0, counterRows = 0;
    c.maint.forEach(([id, , , entity]) => {
      const vEl = el[id + '_v'];
      const iEl = el[id + '_ic'];
      /* dormant-entity guard: hide counter rows whose entity does not
         exist on this device (e.g. dock strainer on the Edge 2). Rows
         with a null entity are guide-only by design and always show. */
      if (entity && !this._hass.states[entity]) {
        vEl.parentElement.style.display = 'none';
        return;
      }
      vEl.parentElement.style.display = '';
      if (!entity) {
        vEl.textContent = 'as needed';
        vEl.style.color = 'rgba(158,158,158,.55)';
        iEl.style.color = '';
        return;
      }
      counterRows++;
      const v = this._num(entity);
      if (v == null) {
        vEl.textContent = '--';
        vEl.style.color = '';
        iEl.style.color = '';
        unknownCt++;
      } else if (v < 0) {
        vEl.textContent = Math.round(-v) + 'h overdue';
        vEl.style.color = AMBER;
        iEl.style.color = 'rgba(255,193,7,.7)';
        overdue++;
      } else {
        vEl.textContent = Math.round(v) + 'h left';
        vEl.style.color = '';
        iEl.style.color = '';
      }
    });
    el.g_maint.classList.toggle('warn', overdue > 0 || issueCt > 0);
    el.mico.style.color = overdue > 0 || issueCt > 0 ? AMBER : '';
    const issueTxt = errVac ? 'robot issue' : errDock ? 'dock issue' : water ? 'water low' : null;
    el.msum.textContent = [issueTxt, overdue > 0 ? overdue + ' overdue' : null]
      .filter(Boolean).join(' \u00b7 ')
      || (unknownCt === counterRows ? '--' : 'all ok');
    el.msum.style.color = overdue > 0 || issueCt > 0 ? AMBER : '';

    /* config group */
    const selTxt = (key, entity) => {
      const s = this._st(entity);
      return this._optv(key, s && s.state !== 'unavailable' && s.state !== 'unknown' ? s.state : null) || '--';
    };
    const PRETTY_R = { max_plus: 'max+', deep_plus: 'deep+' };
    const pvr = (id) => {
      const s = this._st(id);
      const v = s && s.state !== 'unavailable' && s.state !== 'unknown' ? s.state : null;
      return v ? (PRETTY_R[v] || v) : '--';
    };
    el.c_sucta.textContent = pvr(c.suction_away_entity) + ' \u00b7 ' + pvr(c.mop_intensity_away_entity)
      + ' \u00b7 ' + pvr(c.mop_mode_away_entity) + ' \u203a';
    el.c_suctd.textContent = pvr(c.suction_default_entity) + ' \u00b7 ' + pvr(c.mop_intensity_default_entity)
      + ' \u00b7 ' + pvr(c.mop_mode_default_entity) + ' \u203a';
    el.c_mopi.textContent = selTxt('mopi', c.mop_intensity_entity) + ' \u25be';
    el.c_mopm.textContent = selTxt('mopm', c.mop_mode_entity) + ' \u25be';
    const va = (this._st(c.vacuum) || {}).attributes || {};
    el.c_fan.textContent = (this._optv('fan', va.fan_speed) || '--') + ' \u25be';
    show(el.rempty, !!this._hass.states[c.empty_mode_entity]);
    if (this._hass.states[c.empty_mode_entity])
      el.c_empty.textContent = selTxt('empty', c.empty_mode_entity);
    const drying = (this._st(c.drying_entity) || {}).state;
    const dryMin = this._num(c.drying_time_entity);
    if (drying === 'on') {
      el.drytxt.textContent = 'drying' + (dryMin != null && dryMin > 0 ? ' \u00b7 ' + Math.round(dryMin) + ' min left' : '');
      el.drytxt.style.color = ACCENT_TEXT;
      el.dryic.style.color = ACCENT_TEXT;
    } else if (drying === 'off') {
      el.drytxt.textContent = 'off';
      el.drytxt.style.color = '';
      el.dryic.style.color = '';
    } else {
      el.drytxt.textContent = '--';
      el.drytxt.style.color = '';
      el.dryic.style.color = '';
    }
    this._renderSlider(el.track_vol, el.volval, 'vol', c.volume_entity, (v) => Math.round(v) + '%');
    const dndOn = this._optv('dnd', (this._st(c.dnd_entity) || {}).state) === 'on';
    el.dndsw.classList.toggle('on', dndOn);
    el.c_dndb.textContent = t(c.dnd_begin_entity);
    el.c_dnde.textContent = t(c.dnd_end_entity);
    const lockOn = this._optv('lock', (this._st(c.child_lock_entity) || {}).state) === 'on';
    el.locksw.classList.toggle('on', lockOn);
    const batt = this._num(c.battery_sensor);
    const charging = statusRaw === 'charging';
    if (batt != null) {
      el.battxt.textContent = (charging ? '\u26a1 ' : '') + Math.round(batt) + '%';
      el.battic.setAttribute('icon', charging ? 'mdi:battery-charging'
        : batt > 80 ? 'mdi:battery' : batt > 50 ? 'mdi:battery-60'
        : batt > 20 ? 'mdi:battery-40' : 'mdi:battery-alert');
      el.battxt.style.color = batt <= 20 && !charging ? AMBER : '';
      el.battic.style.color = batt <= 20 && !charging ? 'rgba(255,193,7,.7)' : '';
    } else {
      el.battxt.textContent = '--';
      el.battxt.style.color = '';
      el.battic.style.color = '';
    }
    const PRETTY_C = { max_plus: 'max+', deep_plus: 'deep+' };
    const fanNow = this._optv('fan', va.fan_speed);
    el.csum.textContent = (fanNow ? (PRETTY_C[fanNow] || fanNow) : '--') +
      ' \u00b7 ' + (PRETTY_C[selTxt('mopi', c.mop_intensity_entity)] || selTxt('mopi', c.mop_intensity_entity)) +
      ' \u00b7 ' + (PRETTY_C[selTxt('mopm', c.mop_mode_entity)] || selTxt('mopm', c.mop_mode_entity));
  }
}

customElements.define('flat-vacuum-card', FlatVacuumCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-vacuum-card',
  name: 'Flat Vacuum Card',
  description: 'Collapsible vacuum control: status header with contextual actions, accordion groups for auto-clean schedule, maintenance counters, and device config',
});
