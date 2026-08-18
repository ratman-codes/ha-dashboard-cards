/* flat-thermostat-card v2.6.11 - custom Lovelace card for the main dashboard.
   Slim dual-handle flat thermostat: current temp left, dual/single-handle
   temperature track right, native-style mode strip below (with optional
   daily-runtime chip at its left), detached eco (leaf) toggle beside the
   strip.
   Built 2026-07-09, eco added 2026-07-20, runtime chip added 2026-07-23,
   by Claude for Ratman (design spec archived in the "NAS / Smart Home"
   Claude project, doc claude/ha-dashboard-notes.md).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;base64,<blob>. There is no
     file on disk and no internet dependency - the code lives inside the URL
     itself, in HA's own config (.storage/lovelace_resources), and is included
     in every Home Assistant backup automatically.
   - To READ it: copy everything after "base64," and run it through any
     base64 decoder (or atob() in a browser console). You get this file.
   - To MODIFY it: edit the decoded JS, re-encode to base64, then in
     Settings > Dashboards > Resources replace this resource's URL with
     data:text/javascript;base64,<new blob>. Hard-refresh the browser.
   - Used from the dashboard as:  type: custom:flat-thermostat-card
                                  entity: climate.hall_nest_thermostat

   ECO (v2.3): Nest exposes eco as preset_mode none|eco. The leaf button is a
   separate rounded-rect NEXT TO the mode strip (not in it - eco overlays the
   hvac mode, it is not mutually exclusive with it). While eco is on:
   - leaf button goes Nest-green, status text shows green "Eco" when idle
   - the entity itself reports the ECO setpoints in temperature /
     target_temp_low/high (verified live 2026-07-20: cool 76 -> eco -> 80),
     so the track just renders what the entity says - in green, read-only
     (handles hidden, drag disabled: Nest rejects setpoint changes in eco).
   - button hides itself if the entity has no "eco" in preset_modes.

   RUNTIME CHIP (v2.4): optional chip at the LEFT of the bottom row showing
   today's ACTIVE HVAC time (compressor/furnace actually running, from
   hvac_action - not just mode-on time). Config:
     runtime_cooling: <entity>   e.g. sensor.nest_cooling_runtime_today
     runtime_heating: <entity>   e.g. sensor.nest_heating_runtime_today
   These are daily utility_meter entities counting HOURS, fed by Riemann
   integrals of 0/1 template signals on hvac_action (pipeline documented in
   project doc claude/hvac-runtime-tracking-notes.md). Behavior: cool mode
   shows the cooling meter, heat the heating meter, heat_cool both (two
   compact rows); configured meters for the active mode are ALWAYS shown,
   including at "0m" (owner choice, v2.4.1) - the chip hides only when
   unconfigured, mode off, or the thermostat is unavailable. Unavailable
   meter shows '--'. Tap = more-info history of the shown meter.
   v2.4.5 (owner request): NO resting background on the chip - it reads as
   a quiet stat, not a button; a subtle hover highlight (wrapped in
   media hover:hover so touch devices skip it, per house style) reveals
   that it is tappable.
   Layout (v2.5; evolved from the v2.4.4 two-row + slot structure):
   Row 1: temp/status block + track vertically centered beside it. Row 2:
   chip slot + mode strip + eco. v2.5 slims the left column from
   20%-of-card to a FIXED 96px so the track and strip extend further
   left, and centers the temp/status + chip on the TRUE center of the
   empty region: the region spans card edge -> track start (96px column
   + 8px track lead-in = 104px), so both column blocks carry
   padding-left 8px (box-sizing border-box) putting their content center
   v2.5.2 - THE CENTERING RULE, FINAL (owner-specified after two wrong
   attempts; do not re-litigate): the empty space is bounded by the
   CARD'S VISIBLE EDGE on the left (the 14px card padding COUNTS as
   empty space) and the track's left edge on the right. The full
   visible block - digits WITH the degree unit in normal flow, status
   text, chip - is centered in THAT span, so the gap from card edge to
   the block equals the gap from the block to the track. The math:
   with column width C and row gap / track padding both 8, the span
   runs -14 (card padding counts as space) to C+8, so its center is
   (C-6)/2 - which is exactly the content center of a border-box
   column with padding-right 6px, for ANY C. Both column blocks
   therefore carry padding-right 6px. v2.5.3 (owner's original ask):
   column slimmed 96 -> 76px and chip 80 -> 68px (still fits "9h 59m"
   + icon) so the track and mode strip gain 20px of width.
   v2.5.4 (owner-final): the DEGREE UNIT IS EXCLUDED from centering -
   sup is absolutely positioned off the digits' right edge (the
   original v1 design, briefly moved in-flow v2.5-v2.5.3). The owner's
   settled rule: the DIGITS must sit exactly over the status text and
   the chip on the shared axis; the small degree unit floats right and
   does not count as visual mass. So the axis carries: digits, status,
   chip; excluded adornments: degree unit. Alignment invariants kept:
   strip left edge == track left edge (C + 8 gap == C + 8 padding),
   track and eco flush right.

   OFF MODE (v2.5.6, owner-final: the chip NEVER hides): in off mode
   it prefers the meters that ran today (one or both rows); when
   NOTHING ran it shows ALL configured meters at "0m" (both rows, so a
   bare zero is not ambiguous about which meter it is). v2.5's
   hide-when-zero behavior is dead - the only things that hide the
   chip are: no runtime_* config, or the climate entity unavailable.

   RUNTIME GRAPH (v2.5, owner request + mockup-approved): tapping the
   chip no longer opens more-info - it expands an IN-CARD graph panel
   (house grid-rows animation, no popups, no browser_mod, no deps):
   last 14 days of daily runtime as bars from HA long-term statistics
   (recorder/statistics_during_period WS, period day, type change) for
   the active mode's series, today as a dashed live bar fed by the
   daily meter's state, dashed 7-day average line, peak direct label,
   per-bar hover/tap tooltip, and a today / 7-day avg / peak summary
   row. The summary tiles are TAP-THROUGHS to native more-info
   (v2.5.5): TODAY opens the daily meter; 7-DAY AVG and PEAK open the
   stats entity (the Riemann total with the full long-term history). Config: runtime_cooling_stats / runtime_heating_stats = the
   LONG-TERM stats entities (the Riemann totals, which carry the
   backfilled history); they default to the daily meter entities when
   unset. The temp/status block still opens native more-info.

   RUNTIME VIEWS (v2.6, owner request + mockup-approved v4): the summary
   tiles are no longer more-info tap-throughs (v2.5.5 behavior replaced -
   the views subsume it; raw history remains reachable via the HA UI).
   The tile row now sits ABOVE the plot (owner: tiles must never shift
   position as content changes) and acts as a TAB SWITCHER: tapping a
   tile swaps the plot area in place ("in-card swap" shape, chosen over
   a floating popup 2026-08-18); the X in the panel header restores the
   default 14-day bars. Active tile is tinted with the series color.
   - TODAY view (tile 1): Nest-style day detail. Hero total + runs
     count + longest run; an on/off RIBBON of exact compressor/furnace
     segments read from recorder history of the 0/1 signal sensor
     (config: runtime_cooling_signal / runtime_heating_signal, e.g.
     sensor.nest_cooling_signal - minute detail, only ~10 days back per
     recorder retention, ribbon quietly drops out beyond that); hourly
     bars from LTS hour-period stats (work for ANY day, forever); a
     "now" line on today; and a < date > pager to walk previous days.
   - PERIOD view (tile 2): range explorer. Chips 7d/14d/30d/60d/Season/
     Custom (Season = since Jun 1 for cooling, Nov 1 for heating;
     Custom = two native date inputs); stat row total / avg per day /
     days ran / vs previous equal-length window; per-day bars + dashed
     window-average line; and a 3-hour-band x day HEATMAP (bands
     12-6a, 6-9a, 9a-12, 12-3p, 3-6p, 6-12a) from hour-period stats.
     AUTO-WEEKLY: when the window exceeds 35 days the bars and heatmap
     columns aggregate per week (Sun-start) - readable at any range in
     the card's width (owner accepted this over a wider popup).
   - RECORDS view (tile 3): peak-day hero, top-5 ranked days (last 365d,
     today excluded; tapping a rank opens that day in the TODAY view),
     and - when config outdoor_high_stats is set to a temperature entity
     with LTS (the PWS station sensor) - a runtime-vs-outdoor-high
     scatter of the last 60 days, peak highlighted, other days gray.
   All view data comes from the two WS APIs already trusted here
   (recorder/statistics_during_period + history/history_during_period);
   no new helpers, no deps. Views follow the active series (_gDef) like
   the graph does, cache for 15 min, and reset to the default bars when
   the chip/panel closes.
   v2.6.1 (owner nitpicks on live v2.6, 2026-08-18): TODAY - pager
   vertically centered on the hero row; the date label opens a native
   calendar picker (hidden date input + showPicker(), max = today);
   hero says "<time> total" so the big number is not read as the
   minutes-per-hour axis. PERIOD - roomier UI (bigger chips, stat
   tiles, section labels; the panel is a toggled expansion, so it can
   afford the size); bar peak-labels get edge-clamping (first/last bar
   anchor left/right instead of center) and extra scale headroom so
   they never clip or collide with the section title above; heatmap
   cells are now true uniform squares sized from the column count
   (larger band labels) instead of full-width stretchy rectangles.
   v2.6.2 (owner round 2, 2026-08-18): TODAY pager - date label gets a
   FIXED-WIDTH slot (78px, centered) so the arrows never shift as the
   text changes, plus a >> jump-straight-to-today arrow (the native
   calendar popup cannot host a Today button, so the jump lives in the
   pager instead). PERIOD - heatmap grid centers itself in the area
   right of the band labels when the squares do not fill the width;
   zero-day bar stubs dimmed so runs stand out. RECORDS - the scatter
   gains a least-squares TREND LINE (dashed, like the avg lines) drawn
   via an inline SVG with vector-effect non-scaling-stroke; honesty
   guard: hidden when r^2 < 0.1 so a meaningless slope is never shown
   (plausible here - the owner drives the thermostat manually, so the
   temperature-runtime fit can be weak).
   v2.6.3 (owner round 3, 2026-08-18): TODAY hero restructured to TWO
   ROWS - big number + pager on row one (number nowrap, pager fixed
   right), the runs/longest secondary text on its own full-width line
   below - so long secondary text can never wrap the hero again
   (v2.6.2's 156px pager reservation caused exactly that on the live
   card). PERIOD heatmap centering now treats BAND LABELS + GRID as
   one block and centers that whole block in the panel (v2.6.2
   centered only the grid within the space right of the labels, which
   still read left-heavy); band labels bumped to 10px in a wider
   column for legibility.
   v2.6.4 (owner round 4 + explicit choice, 2026-08-18): heatmap rows
   are now UNIFORM 3-HOUR BANDS (8 rows: 12-3a .. 9p-12a). The old
   6-row scheme squeezed 12-6a and 6p-12a into single 6-hour rows - a
   save-vertical-space assumption from the popup-era mockup that both
   misread the owner's data (the AC runs at night here) and ignored
   that this panel is an expansion, where height is cheap (owner
   stated this twice). Cells grow to 16px max, band labels to 11px
   full-opacity. Owner picked 3-hour uniform over 2-hour/hourly via
   explicit choice.
   v2.6.5 (owner round 5, 2026-08-18): heatmap geometry rules, final.
   (1) CENTERING ANCHOR = THE GRID, NOT LABELS+GRID: the owner's rule
   is that the colored grid centers on the panel like every other
   plot; band labels are annotations hanging immediately left of
   wherever the grid lands, contributing no visual mass (v2.6.3's
   block-centering read right-shifted). Clamped so labels always fit.
   (2) DENSE RANGES FILL THE WIDTH: when the per-column pitch is
   under the 16px cap, cells take an exact FRACTIONAL width so the
   grid runs flush to the panel's right edge (no more integral-pixel
   leftover slack); row height ~= cell width keeps them near-square,
   radius drops to 2px under 12px so small cells read as squares,
   not dots. When pitch would exceed the cap, cells are 16px squares
   and the capped grid centers per rule 1. [superseded by v2.6.6]
   v2.6.6 (owner design, 2026-08-18): heatmap TRANSPOSED - the owner
   proposed the actual fix: time-of-day as 8 FIXED COLUMNS across the
   top (12a..9p band starts, full band name in the header tooltip),
   dates DOWN the left as rows, panel just grows taller with longer
   ranges. Fixed column count kills the cell-squeeze problem outright:
   every cell is a 20px square at every range. EVERY date row is
   labeled (v2.6.7 - the first-row/Monday-only scheme read as random).
   Rows run NEWEST-FIRST, 'Today' on top (v2.6.8, owner choice after
   weighing both orders: the panel is tall, and the rows you open it
   for - the recent ones - belong above the fold; feed convention,
   opposite temporal direction from the bars is accepted).
   v2.6.9 (owner polish, 2026-08-18): the "By hour x day/week" section
   caption is REMOVED - the grid's own hour header + date column say
   it already. Centering = OPTICAL BALANCE: the grid anchors on the
   panel center nudged right by a QUARTER of the label column (~13px)
   - the owner-tuned midpoint between ignoring the labels (v2.6.5,
   read right-weighted once cells got big) and full block centering
   (v2.6.3, read left-weighted). Labels half-count, in effect. Also fixed:
   bar hover TOOLTIPS now clamp inside the plot so first/last-bar
   values are never cut off at the card edge (both the default 14-day
   graph and all view plots). */

const ICONS = { off: 'mdi:power', cool: 'mdi:snowflake', heat: 'mdi:fire', heat_cool: 'mdi:sun-snowflake-variant' };
const COLORS = { off: '#9e9e9e', cool: '#2196f3', heat: '#ff6f22', heat_cool: '#ffc107', eco: '#4caf50' };
const LABEL_COLORS = { heat: '#ff9c4a', cool: '#64b5f6', eco: '#81c784' };
const ACTION_TEXT = { cooling: 'Cooling', heating: 'Heating', idle: 'Idle', off: 'Off', fan: 'Fan', drying: 'Drying', preheating: 'Preheating' };
const GRAPH_DAYS = 14;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class FlatThermostatCard extends HTMLElement {
  static getStubConfig() { return { entity: '' }; }

  setConfig(config) {
    if (!config.entity) throw new Error('flat-thermostat-card: "entity" is required');
    this._config = Object.assign({ modes: ['off', 'cool', 'heat', 'heat_cool'], gap: 2 }, config);
    this._drag = null;
    this._opt = {};
    this._optUntil = 0;
    this._optMode = null;
    this._optModeUntil = 0;
    this._optEco = null;
    this._optEcoUntil = 0;
    this._rtHtml = '';
    this._gOpen = false;
    this._gDef = null;
    this._gKey = null;
    this._gRows = null;
    this._gFetched = 0;
    this._gCache = '';
    this._gLoading = false;
    // v2.6 view state
    this._view = null;
    this._vDay = 0;
    const PDEF = ['7d', '14d', '30d', '60d', 'season'];
    this._vpSel = PDEF.indexOf(config.period_default) >= 0 ? config.period_default : '14d';
    this._vpAvg = null;
    this._vpAvgLoading = false;
    this._vpA = null;
    this._vpB = null;
    this._vData = null;
    this._vKey = null;
    this._vLoading = false;
    this._vCache = '';
    if (!this.shadowRoot) this._createDom();
    this._modesBuilt = false;
  }

  getCardSize() { return 2; }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _stateObj() { return this._hass && this._hass.states[this._config.entity]; }

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { display: block; padding: 12px 14px 10px 14px; }
        .main { display: flex; gap: 0; align-items: center; padding: 4px 0 0 0; }
        .curblock { flex: 0 0 76px; box-sizing: border-box; padding-right: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 0; cursor: pointer; }
        .cur::before { content: ''; position: absolute; width: 104px; height: 84px; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(closest-side, var(--glow, transparent) 0%, transparent 100%);
          opacity: .14; z-index: -1; pointer-events: none; }
        .cur { position: relative; z-index: 0; font-size: 32px; font-weight: 500; line-height: 1.05; color: var(--primary-text-color); }
        .cur sup { position: absolute; left: calc(100% + 1px); top: 2px; font-size: 14px; color: var(--secondary-text-color); font-weight: 400; }
        .st { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
        .bar-wrap { position: relative; flex: 1; min-width: 0; padding: 0 0 0 8px; }
        .bar { position: relative; height: 16px; border-radius: 8px; background: rgba(70,70,70,.3); touch-action: none; cursor: pointer; }
        .bar.ecolock { cursor: default; }
        .fill { position: absolute; top: 0; bottom: 0; pointer-events: none; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1); }
        .fill.heatf { left: 0; background: ${COLORS.heat}; opacity: .5; border-radius: 8px 0 0 8px; }
        .fill.coolf { right: 0; background: ${COLORS.cool}; opacity: .5; border-radius: 0 8px 8px 0; }
        .fill.brightf { opacity: 1; border-radius: 8px; z-index: 1; }
        .fill.singlef { left: 0; border-radius: 8px 0 0 8px; }
        .handle { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%;
          background: #fff; transform: translate(-50%,-50%); cursor: grab;
          z-index: 3; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .handle:active { cursor: grabbing; }
        .blabel { position: absolute; top: -28px; transform: translateX(-50%); font-size: 13px;
          font-weight: 600; white-space: nowrap; pointer-events: none; z-index: 4; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .blabel .deg { position: absolute; left: 100%; top: 0; }
        .curdot { position: absolute; top: 50%; width: 7px; height: 7px; border-radius: 50%;
          background: #a6a6a6;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 2; display: none;
          transition: left .35s cubic-bezier(.4,0,.2,1); }
        .bar.dragging .fill, .bar.dragging .handle, .bar.dragging .blabel, .bar.dragging .curdot { transition: none; }
        .offlabel { position: absolute; top: -28px; left: 50%; transform: translateX(-50%);
          color: var(--secondary-text-color); font-size: 13px; display: none; }
        .bottom { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
        .chipslot { flex: 0 0 76px; box-sizing: border-box; padding-right: 6px; display: flex; align-items: center; justify-content: center; }
        .modes { flex: 1; min-width: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0,1fr); height: 42px;
          border-radius: 12px; background: rgba(255,255,255,.04); overflow: hidden; }
        .mode { display: flex; align-items: center; justify-content: center; border-radius: 12px;
          cursor: pointer; transition: background .15s; }
        .mode:hover { background: rgba(255,255,255,.07); }
        .mode ha-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; display: flex;
          align-items: center; justify-content: center; line-height: 0; color: var(--primary-text-color); }
        .mode.active ha-icon { color: #fff; }
        .ecobtn { flex: 0 0 46px; height: 42px; border-radius: 12px; background: rgba(255,255,255,.04);
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .ecobtn:hover { background: rgba(255,255,255,.07); }
        .ecobtn ha-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; display: flex;
          align-items: center; justify-content: center; line-height: 0; color: var(--primary-text-color); }
        .ecobtn.on { background: ${COLORS.eco}; }
        .ecobtn.on:hover { background: ${COLORS.eco}; }
        .ecobtn.on ha-icon { color: #fff; }
        .ecobtn.gone { display: none; }
        .rtchip { flex: 0 0 auto; box-sizing: border-box; width: 68px; height: 42px; border-radius: 12px;
          background: transparent; transition: background .15s;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 0 4px; gap: 1px; cursor: pointer; }
        @media (hover: hover) { .rtchip:hover { background: rgba(255,255,255,.07); } }
        .rtchip .rrow { font-size: 12px; font-weight: 600; color: var(--primary-text-color);
          line-height: 1.2; display: flex; align-items: center; gap: 4px; }
        .rtchip .rrow ha-icon { --mdc-icon-size: 12px; width: 12px; height: 12px; display: flex;
          align-items: center; justify-content: center; line-height: 0; }
        .rtchip .rcap { font-size: 8.5px; color: var(--secondary-text-color);
          text-transform: uppercase; letter-spacing: .6px; }
        .rtchip.two .rrow { font-size: 11px; }
        .rtchip.gone { display: none; }
        .rtchip.open { background: rgba(255,255,255,.07); }
        .gwrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1); }
        .gwrap.open { grid-template-rows: 1fr; }
        .gin { overflow: hidden; min-height: 0; }
        .gpanel { margin-top: 0; padding-top: 0; border-top: 0 solid rgba(255,255,255,.06);
          transition: margin-top .35s cubic-bezier(.4,0,.2,1), padding-top .35s cubic-bezier(.4,0,.2,1), border-top-width .35s cubic-bezier(.4,0,.2,1); }
        .gwrap.open .gpanel { margin-top: 10px; padding-top: 10px; border-top-width: 1px; }
        .gtitle-row { font-size: 11px; color: var(--secondary-text-color); letter-spacing: .3px;
          margin: 0 2px 8px; display: flex; justify-content: space-between; }
        .gtitle-row b { color: var(--primary-text-color); font-weight: 600; }
        .gplot { position: relative; height: 96px; margin: 0 2px; }
        .gline { position: absolute; left: 0; right: 26px; height: 1px; background: rgba(255,255,255,.06); }
        .ggtxt { position: absolute; right: 0; width: 22px; font-size: 9px; color: var(--secondary-text-color);
          opacity: .7; transform: translateY(-50%); }
        .gavg { position: absolute; left: 0; right: 26px; border-top: 1px dashed rgba(255,255,255,.28); }
        .gavgtxt { position: absolute; right: 0; width: 26px; font-size: 8.5px; color: var(--secondary-text-color);
          transform: translateY(-60%); }
        .gbars { position: absolute; left: 0; right: 26px; top: 0; bottom: 0; display: flex; align-items: flex-end; gap: 2px; }
        .gb { flex: 1; border-radius: 4px 4px 0 0; position: relative; min-height: 2px; cursor: pointer; }
        .gb.zero { background: rgba(255,255,255,.06); height: 2px; border-radius: 1px; }
        .gb.today { border-style: dashed; border-width: 1px; border-bottom: none; }
        .gdlab { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 3px;
          font-size: 9px; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; pointer-events: none; }
        .gxrow { display: flex; gap: 2px; margin: 4px 28px 0 2px; }
        .gxrow span { flex: 1; font-size: 8.5px; color: var(--secondary-text-color); opacity: .7; text-align: center; }
        .gtip { position: absolute; transform: translate(-50%, calc(-100% - 6px)); display: none;
          background: #2c2c2e; border: 1px solid rgba(255,255,255,.1); border-radius: 6px;
          padding: 4px 8px; font-size: 10px; color: var(--primary-text-color); white-space: nowrap; z-index: 5;
          box-shadow: 0 2px 6px rgba(0,0,0,.5); pointer-events: none; }
        .gstats { display: flex; gap: 8px; margin: 0 2px 10px; }
        .gstat { flex: 1; text-align: center; cursor: pointer; border-radius: 8px; padding: 4px 0;
          transition: background .15s; }
        @media (hover: hover) { .gstat:hover { background: rgba(255,255,255,.05); } }
        .gstat .gv { font-size: 13px; font-weight: 600; color: var(--primary-text-color); }
        .gstat .gc { font-size: 8.5px; color: var(--secondary-text-color); text-transform: uppercase;
          letter-spacing: .6px; margin-top: 1px; }
        .gmsg { font-size: 11px; color: var(--secondary-text-color); text-align: center; padding: 20px 0; }
        /* ---- v2.6 runtime views ---- */
        .gclose { cursor: pointer; padding: 0 2px; }
        @media (hover: hover) { .gclose:hover { color: var(--primary-text-color); } }
        .vhero { font-size: 22px; font-weight: 500; line-height: 1.15; color: var(--primary-text-color);
          margin: 0 2px 2px; display: flex; align-items: baseline; position: relative; }
        .vhero .vval { white-space: nowrap; }
        .vsub { font-size: 10.5px; color: var(--secondary-text-color); margin: 1px 2px 0; }
        .vhero small { font-size: 10.5px; color: var(--secondary-text-color); font-weight: 400; margin-left: 7px; }
        .vpager { position: absolute; right: 0; top: 50%; transform: translateY(-50%);
          font-size: 11px; color: var(--secondary-text-color); font-weight: 400;
          display: flex; align-items: center; gap: 2px; white-space: nowrap; }
        .vpg { cursor: pointer; padding: 1px 6px 2px; font-size: 15px; line-height: 1; color: var(--secondary-text-color); }
        @media (hover: hover) { .vpg:hover { color: var(--primary-text-color); } }
        .vpg.off { opacity: .25; pointer-events: none; }
        .vdl { cursor: pointer; position: relative; padding: 2px 0; width: 78px; text-align: center; }
        @media (hover: hover) { .vdl:hover { color: var(--primary-text-color); text-decoration: underline dotted; } }
        .vdi { position: absolute; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0;
          right: 40px; top: 0; pointer-events: none; }
        .vsect { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--secondary-text-color);
          opacity: .85; margin: 14px 2px 6px; font-weight: 600; }
        .vrib { position: relative; height: 14px; border-radius: 4px; background: rgba(255,255,255,.05); margin: 6px 2px 0; }
        .vrib .seg { position: absolute; top: 0; bottom: 0; border-radius: 3px; min-width: 2px; }
        .vrib .vnow { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 1px;
          background: var(--primary-text-color); }
        .vxax { display: flex; justify-content: space-between; font-size: 9.5px; color: var(--secondary-text-color);
          opacity: .8; margin: 3px 2px 0; }
        .vchips { display: flex; gap: 5px; flex-wrap: wrap; margin: 0 2px; }
        .vchip { font-size: 11px; color: var(--secondary-text-color); border: 1px solid rgba(255,255,255,.14);
          border-radius: 14px; padding: 4px 11px; cursor: pointer; transition: background .15s; line-height: 1.3; }
        @media (hover: hover) { .vchip:hover { background: rgba(255,255,255,.06); } }
        .vchip.on { color: #fff; font-weight: 600; }
        .vdates { display: flex; gap: 6px; align-items: center; margin: 7px 2px 0; font-size: 10px;
          color: var(--secondary-text-color); }
        .vdates input { background: rgba(255,255,255,.05); color: var(--primary-text-color); color-scheme: dark;
          border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 2px 6px; font-size: 10px;
          font-family: inherit; }
        .vstats { display: flex; gap: 8px; margin: 11px 2px 0; }
        .vstile { flex: 1; min-width: 0; background: rgba(255,255,255,.04); border-radius: 8px; padding: 7px 9px 6px; }
        .vstile .l { font-size: 8.5px; letter-spacing: .7px; text-transform: uppercase;
          color: var(--secondary-text-color); opacity: .9; white-space: nowrap; }
        .vstile .v { font-size: 15px; font-weight: 600; color: var(--primary-text-color); margin-top: 2px; white-space: nowrap; }
        .vstile .v em { font-style: normal; font-size: 11px; font-weight: 400; color: var(--secondary-text-color); }
        .vhrow { display: flex; align-items: center; gap: 2px; margin: 0 2px 2px; }
        .vhlab { flex: 0 0 46px; font-size: 11px; color: var(--secondary-text-color);
          display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; }
        .vhc { flex: 0 0 auto; border-radius: 3px; }
        .vhth { flex: 0 0 auto; text-align: center; font-size: 10px; color: var(--secondary-text-color);
          opacity: .85; line-height: 1.6; }
        .vrrow { display: flex; align-items: center; gap: 8px; padding: 3px 4px; font-size: 11px;
          border-radius: 6px; cursor: pointer; transition: background .15s; }
        @media (hover: hover) { .vrrow:hover { background: rgba(255,255,255,.05); } }
        .vrd { flex: 0 0 46px; color: var(--secondary-text-color); }
        .vrbar { height: 7px; border-radius: 4px; }
        .vrnote { font-size: 9px; color: var(--secondary-text-color); opacity: .7; }
        .vrv { margin-left: auto; font-weight: 600; color: var(--primary-text-color); }
        .vplot { position: relative; height: 110px; margin: 4px 2px 0; }
        .vdot { position: absolute; width: 7px; height: 7px; border-radius: 50%; transform: translate(-50%,50%); }
        .vdot.hi { width: 10px; height: 10px; border: 2px solid var(--card-background-color, #1c1c1e); box-sizing: content-box; }
        .vdlab { position: absolute; transform: translate(-100%,50%); padding-right: 8px; font-size: 8.5px;
          font-weight: 600; color: var(--primary-text-color); white-space: nowrap; line-height: 1; margin-top: -3px; }
        .unavailable { opacity: .4; pointer-events: none; }
      </style>
      <ha-card>
        <div class="main" id="main">
          <div class="curblock" id="curblock">
            <div class="cur"><span id="curval">--</span><sup id="unit"></sup></div>
            <div class="st" id="state"></div>
          </div>
          <div class="bar-wrap">
            <div class="bar" id="bar">
              <div class="fill heatf" id="fheat"></div>
              <div class="fill coolf" id="fcool"></div>
              <div class="fill singlef" id="fsingle"></div>
              <div class="fill brightf" id="bfheat"></div>
              <div class="fill brightf" id="bfcool"></div>
              <div class="curdot" id="curdot"></div>
              <div class="handle" id="hlow"></div>
              <div class="handle" id="hhigh"></div>
              <div class="blabel" id="blow"></div>
              <div class="blabel" id="bhigh"></div>
              <div class="offlabel" id="offlbl">Off</div>
            </div>
          </div>
        </div>
        <div class="bottom">
          <div class="chipslot"><div class="rtchip gone" id="rtchip"></div></div>
          <div class="modes" id="modes"></div>
          <div class="ecobtn gone" id="ecobtn"><ha-icon icon="mdi:leaf"></ha-icon></div>
        </div>
        <div class="gwrap" id="gwrap"><div class="gin">
          <div class="gpanel">
            <div class="gtitle-row"><span id="gtitle"></span><span id="gright">hours/day</span></div>
            <div class="gstats" id="gstats"></div>
            <div id="gdef">
              <div class="gplot" id="gplot"></div>
              <div class="gxrow" id="gxrow"></div>
            </div>
            <div id="gview" style="display:none"></div>
          </div>
        </div></div>
      </ha-card>
    `;
    this._el = {};
    ['main','curblock','bar','fheat','fcool','fsingle','bfheat','bfcool','curdot','hlow','hhigh','blow','bhigh','offlbl','modes','ecobtn','rtchip','gwrap','gtitle','gright','gplot','gxrow','gstats','gdef','gview','curval','unit','state']
      .forEach(id => this._el[id] = root.getElementById(id));
    this._el.bfheat.style.background = COLORS.heat;
    this._el.bfcool.style.background = COLORS.cool;
    this._bindDrag();
    this._el.ecobtn.addEventListener('click', () => this._toggleEco());
    // tapping the runtime chip toggles the in-card runtime graph (v2.5)
    this._el.rtchip.addEventListener('click', () => this._toggleGraph());
    // summary tiles switch the plot area to their view (v2.6, delegated;
    // replaces the v2.5.5 more-info tap-through - the views subsume it)
    this._el.gstats.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.gstat') : null;
      const view = t && t.dataset.view;
      if (!view) return;
      e.stopPropagation();
      if (this._view === view) this._closeView();
      else this._openView(view);
    });
    // panel-header X closes the open view, restoring the default bars
    this._el.gright.addEventListener('click', () => { if (this._view) this._closeView(); });
    // clicking the current temp / status area opens the native more-info dialog
    this._el.curblock.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      }));
    });
  }

  /* ---------- helpers ---------- */
  _attrs() { const s = this._stateObj(); return s ? s.attributes : {}; }
  _min() { return this._config.min_temp != null ? this._config.min_temp : (this._attrs().min_temp != null ? this._attrs().min_temp : 50); }
  _max() { return this._config.max_temp != null ? this._config.max_temp : (this._attrs().max_temp != null ? this._attrs().max_temp : 90); }
  _step() { return this._config.step != null ? this._config.step : (this._attrs().target_temp_step || 1); }
  _pct(v) { return (v - this._min()) / (this._max() - this._min()) * 100; }
  _fmt(v) { if (v == null) return '--'; return (v % 1 === 0) ? String(v) : v.toFixed(1); }

  _vals() {
    const a = this._attrs();
    const useOpt = this._drag || Date.now() < this._optUntil;
    return {
      low:    (useOpt && this._opt.low    != null) ? this._opt.low    : a.target_temp_low,
      high:   (useOpt && this._opt.high   != null) ? this._opt.high   : a.target_temp_high,
      single: (useOpt && this._opt.single != null) ? this._opt.single : a.temperature,
    };
  }

  _mode() {
    const s = this._stateObj();
    if (!s) return 'off';
    if (this._optMode && Date.now() < this._optModeUntil) return this._optMode;
    return s.state;
  }

  _ecoSupported() { return (this._attrs().preset_modes || []).includes('eco'); }

  _ecoOn() {
    if (Date.now() < this._optEcoUntil) return this._optEco;
    return this._attrs().preset_mode === 'eco';
  }

  /* ---------- rendering ---------- */
  _render() {
    const s = this._stateObj();
    if (!s || !this._el) return;
    const el = this._el;
    const unavailable = s.state === 'unavailable' || s.state === 'unknown';
    el.main.classList.toggle('unavailable', unavailable);

    const a = s.attributes;
    el.curval.textContent = this._fmt(a.current_temperature);
    el.unit.textContent = (this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || '\u00b0F';

    const mode = this._mode();
    const eco = this._ecoOn();
    const act = a.hvac_action;
    // status text: eco replaces "Idle" only - active heating/cooling still wins
    let action;
    if (unavailable) action = 'Unavailable';
    else if (mode === 'off') action = 'Off';
    else if (eco && act !== 'cooling' && act !== 'heating') action = 'Eco';
    else action = ACTION_TEXT[act] || (act ? act : '');
    el.state.textContent = action;
    const glow = act === 'cooling' ? COLORS.cool : act === 'heating' ? COLORS.heat : 'transparent';
    el.curblock.style.setProperty('--glow', glow);
    el.state.style.color = act === 'cooling' ? LABEL_COLORS.cool : act === 'heating' ? LABEL_COLORS.heat : (action === 'Eco' ? LABEL_COLORS.eco : '');

    el.ecobtn.classList.toggle('gone', !this._ecoSupported());
    el.ecobtn.classList.toggle('on', eco);
    el.bar.classList.toggle('ecolock', eco);

    this._buildModes();
    this._updateModes(mode);
    this._updateBar(mode);
    this._updateRuntime(mode, act, unavailable);
  }

  /* ---------- runtime chip (v2.4) ---------- */
  _fmtRuntime(v) {
    if (v == null) return '--';
    let h = Math.floor(v);
    let m = Math.round((v - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  _updateRuntime(mode, act, unavailable) {
    const el = this._el.rtchip;
    const defs = [
      { key: 'runtime_cooling', icon: this._config.icon_cool || ICONS.cool, color: LABEL_COLORS.cool, bar: COLORS.cool, name: 'Cooling', act: 'cooling' },
      { key: 'runtime_heating', icon: this._config.icon_heat || ICONS.heat, color: LABEL_COLORS.heat, bar: COLORS.heat, name: 'Heating', act: 'heating' },
    ];
    const want = mode === 'cool' ? [defs[0]] : mode === 'heat' ? [defs[1]] : (mode === 'heat_cool' || mode === 'off') ? defs : [];
    let rows = [];
    for (const d of want) {
      const ent = this._config[d.key];
      if (!ent) continue;
      const st = this._hass.states[ent];
      if (!st) continue;
      const num = parseFloat(st.state);
      const v = isNaN(num) ? null : num;
      // active modes always show their configured meters ("0m" included, v2.4.1); '--' when unavailable
      rows.push({ ent: ent, icon: d.icon, color: d.color, v: v, def: d });
    }
    // off mode (v2.5.6): NEVER hide - prefer meters that ran today; when none ran, keep all configured rows at 0m
    if (mode === 'off') {
      const ran = rows.filter(r => r.v != null && r.v > 0);
      if (ran.length) rows = ran;
    }
    if (unavailable || !rows.length) {
      el.classList.add('gone');
      this._gDef = null;
      if (this._gOpen) this._closeGraph();
      return;
    }
    el.classList.remove('gone');
    el.classList.toggle('two', rows.length > 1);
    const html = rows.map(r =>
      '<div class="rrow"><ha-icon icon="' + r.icon + '" style="color:' + r.color + '"></ha-icon>' + this._fmtRuntime(r.v) + '</div>'
    ).join('') + (rows.length === 1 ? '<div class="rcap">today</div>' : '');
    if (html !== this._rtHtml) { el.innerHTML = html; this._rtHtml = html; }
    this._gDef = rows[0].def;
    this._graphTick();
  }

  /* ---------- runtime graph (v2.5) ---------- */
  _toggleGraph() {
    if (this._gOpen) { this._closeGraph(); return; }
    if (!this._gDef) return;
    this._gOpen = true;
    this._el.gwrap.classList.add('open');
    this._el.rtchip.classList.add('open');
    this._loadGraph();
  }

  _closeGraph() {
    this._gOpen = false;
    this._el.gwrap.classList.remove('open');
    this._el.rtchip.classList.remove('open');
    // closing the panel resets any open view so reopening shows the default bars
    this._view = null;
    this._vKey = null;
    this._vData = null;
    this._vCache = '';
    this._gCache = '';
    this._el.gview.style.display = 'none';
    this._el.gdef.style.display = '';
  }

  _statsEntity() {
    // LTS source for the bars: *_stats override (the Riemann total, which carries
    // backfilled history) - falls back to the daily meter entity itself
    if (!this._gDef) return null;
    return this._config[this._gDef.key + '_stats'] || this._config[this._gDef.key];
  }

  _graphTick() {
    // called from every render; cheap no-op unless the panel is open and something changed
    if (!this._gOpen || this._gLoading) return;
    const key = this._gDef ? this._gDef.key : null;
    if (key !== this._gKey || Date.now() - this._gFetched > 900000) { this._loadGraph(); return; }
    if (this._gRows) this._renderGraph();
    if (this._view) this._viewTick();
  }

  _loadGraph() {
    const ent = this._statsEntity();
    if (!ent || !this._hass) { this._graphMsg('No runtime meter configured'); return; }
    this._gKey = this._gDef.key;
    this._gLoading = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (GRAPH_DAYS - 1));
    this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: [ent],
      period: 'day',
      types: ['change'],
    }).then((resp) => {
      this._gLoading = false;
      this._gRows = (resp && resp[ent]) || [];
      this._gFetched = Date.now();
      this._gCache = '';
      this._renderGraph();
      if (this._view) this._viewTick();
    }).catch(() => {
      this._gLoading = false;
      this._gRows = null;
      this._graphMsg('History unavailable');
    });
  }

  _graphMsg(text) {
    this._el.gtitle.innerHTML = '<b>' + (this._gDef ? this._gDef.name : 'Runtime') + ' runtime</b> &middot; last ' + GRAPH_DAYS + ' days';
    this._el.gplot.innerHTML = '<div class="gmsg">' + text + '</div>';
    this._el.gxrow.innerHTML = '';
    this._el.gstats.innerHTML = '';
    this._gCache = '';
  }

  _graphDays() {
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = GRAPH_DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      days.push({ t: d.getTime(), d: d, v: 0 });
    }
    (this._gRows || []).forEach((r) => {
      const rd = new Date(r.start); rd.setHours(0, 0, 0, 0);
      const hit = days.find((x) => x.t === rd.getTime());
      if (hit && r.change != null && r.change > 0) hit.v = r.change;
    });
    // live "today" from the daily meter state (fresher than the hourly-compiled stats)
    const st = this._hass.states[this._config[this._gDef.key]];
    const live = st ? parseFloat(st.state) : NaN;
    if (!isNaN(live)) days[days.length - 1].v = live;
    return days;
  }

  _renderGraph() {
    if (!this._gDef) return;
    const days = this._graphDays();
    const cache = this._gDef.key + '|' + (this._view || '') + '|' + (this._vpSel || '') + '|' + (this._vpAvg ? this._vpAvg.sel + ':' + this._vpAvg.v.toFixed(3) : '') + '|' + days.map((x) => x.v.toFixed(3)).join(',');
    if (cache === this._gCache) return;
    this._gCache = cache;

    const el = this._el;
    // header + which pane is visible (v2.6): views swap the plot area in place
    const VIEW_SUB = { today: 'today', period: 'period', records: 'records' };
    if (this._view) {
      el.gtitle.innerHTML = '<b>' + this._gDef.name + '</b> &middot; ' + VIEW_SUB[this._view];
      el.gright.innerHTML = '&#10005;';
      el.gright.className = 'gclose';
      el.gdef.style.display = 'none';
      el.gview.style.display = '';
    } else {
      el.gtitle.innerHTML = '<b>' + this._gDef.name + ' runtime</b> &middot; last ' + GRAPH_DAYS + ' days';
      el.gright.innerHTML = 'hours/day';
      el.gright.className = '';
      el.gdef.style.display = '';
      el.gview.style.display = 'none';
    }

    const H = 96;
    const maxV = Math.max.apply(null, days.map((x) => x.v));
    const scale = Math.max(1, maxV * 1.08);
    const step = scale <= 3 ? 1 : scale <= 8 ? 2 : 4;
    const plot = el.gplot;
    plot.innerHTML = '';
    for (let v = step; v < scale; v += step) {
      const y = H - (v / scale) * H;
      const g = document.createElement('div'); g.className = 'gline'; g.style.top = y + 'px'; plot.appendChild(g);
      const t = document.createElement('div'); t.className = 'ggtxt'; t.style.top = y + 'px'; t.textContent = v + 'h'; plot.appendChild(t);
    }
    const last7 = days.slice(-7);
    const avg = last7.reduce((s, x) => s + x.v, 0) / last7.length;
    if (avg > 0) {
      const y = H - (avg / scale) * H;
      const a = document.createElement('div'); a.className = 'gavg'; a.style.top = y + 'px'; plot.appendChild(a);
      const at = document.createElement('div'); at.className = 'gavgtxt'; at.style.top = y + 'px'; at.textContent = 'avg'; plot.appendChild(at);
    }
    const tip = document.createElement('div'); tip.className = 'gtip'; plot.appendChild(tip);
    const bars = document.createElement('div'); bars.className = 'gbars'; plot.appendChild(bars);
    // peak is a HISTORICAL stat - exclude the still-counting today so the
    // summary row never shows today's number twice under two captions
    let peakIdx = -1;
    days.forEach((x, i) => { if (i < days.length - 1 && x.v > 0 && (peakIdx < 0 || x.v > days[peakIdx].v)) peakIdx = i; });
    days.forEach((x, i) => {
      const b = document.createElement('div'); b.className = 'gb';
      const isToday = i === days.length - 1;
      if (x.v <= 0) b.classList.add('zero');
      else {
        b.style.height = Math.max(2, (x.v / scale) * H) + 'px';
        if (isToday) { b.classList.add('today'); b.style.background = this._gDef.bar + '59'; b.style.borderColor = this._gDef.color; }
        else b.style.background = this._gDef.bar;
      }
      if (i === peakIdx && !isToday) {
        const l = document.createElement('div'); l.className = 'gdlab'; l.textContent = this._fmtRuntime(x.v); b.appendChild(l);
      }
      const show = () => {
        const r = b.getBoundingClientRect(); const pr = plot.getBoundingClientRect();
        tip.innerHTML = WEEKDAYS[x.d.getDay()] + ' ' + MONTHS[x.d.getMonth()] + ' ' + x.d.getDate() +
          ' &middot; <b style="color:' + this._gDef.color + '">' + this._fmtRuntime(x.v) + '</b>' + (isToday ? ' so far' : '');
        tip.style.display = 'block';
        // clamp inside the plot so edge-bar values are never cut off (v2.6.6)
        const half = tip.offsetWidth / 2;
        let lx = r.left - pr.left + r.width / 2;
        lx = Math.max(half + 2, Math.min(pr.width - half - 2, lx));
        tip.style.left = lx + 'px';
        tip.style.top = (r.top - pr.top) + 'px';
      };
      b.addEventListener('pointerenter', show);
      b.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
      b.addEventListener('click', (e) => { e.stopPropagation(); show(); });
      bars.appendChild(b);
    });
    el.gxrow.innerHTML = days.map((x, i) => '<span>' + (i % 2 === 0 ? x.d.getDate() : '') + '</span>').join('');
    const todayD = days[days.length - 1];
    const peak = peakIdx >= 0 ? days[peakIdx] : null;
    // tiles (ABOVE the plot, v2.6): tab switcher into the views; active tile
    // tinted with the series color; values still live-update while a view is open
    const tint = 'background:' + this._gDef.bar + '26';
    const tile = (view, val, cap) => {
      const hot = this._view === view;
      return '<div class="gstat" data-view="' + view + '"' + (hot ? ' style="' + tint + '"' : '') + '>' +
        '<div class="gv">' + val + '</div><div class="gc"' + (hot ? ' style="color:' + this._gDef.color + '"' : '') + '>' + cap + '</div></div>';
    };
    const sel = this._vpSel || '14d';
    let avgV = null, avgCap;
    if (sel === '7d') { avgV = avg; avgCap = '7-day avg'; }
    else {
      avgCap = (sel === 'season' ? 'season' : sel === 'custom' ? 'custom' : sel) + ' avg';
      const st2 = this._vpAvg;
      if (st2 && st2.key === this._gDef.key && st2.sel === sel) {
        avgV = st2.v;
        if (Date.now() - (st2.fetched || 0) > 900000 && !this._view) this._tileAvgEnsure(sel);
      } else if (sel === '14d') {
        avgV = days.reduce((s2, x) => s2 + x.v, 0) / days.length; // derivable from the graph's own 14 days
      } else {
        this._tileAvgEnsure(sel); // larger window: one quiet fetch fills the tile
      }
    }
    el.gstats.innerHTML =
      tile('today', this._fmtRuntime(todayD.v), 'today') +
      tile('period', avgV == null ? '--' : this._fmtRuntime(avgV), avgCap) +
      (peak ? tile('records', this._fmtRuntime(peak.v), 'peak &middot; ' + MONTHS[peak.d.getMonth()] + ' ' + peak.d.getDate()) : '');
  }

  /* ---------- runtime views (v2.6) ---------- */
  _openView(view) {
    if (!this._gDef) return;
    if (view === 'today') this._vDay = 0;
    if (view === 'period' && this._vpSel === 'custom' && (!this._vpA || !this._vpB)) this._vpSel = '30d';
    this._view = view;
    this._vKey = null;
    this._vData = null;
    this._vCache = '';
    this._gCache = '';
    this._renderGraph();
    this._viewTick();
  }

  _closeView() {
    this._view = null;
    this._vKey = null;
    this._vData = null;
    this._vCache = '';
    this._gCache = '';
    this._renderGraph();
  }

  _viewKey() {
    const base = this._view + '|' + this._gDef.key;
    if (this._view === 'today') return base + '|' + this._vDay;
    if (this._view === 'period') return base + '|' + this._vpSel + '|' + (this._vpA || '') + '|' + (this._vpB || '');
    return base;
  }

  _viewTick() {
    if (!this._view || !this._gDef || this._vLoading) return;
    const key = this._viewKey();
    if (key !== this._vKey || !this._vData || Date.now() - this._vData.fetched > 900000) { this._loadView(key); return; }
    this._renderView();
  }

  _viewMsg(text) {
    this._el.gview.innerHTML = '<div class="gmsg">' + text + '</div>';
    this._vCache = '';
  }

  _loadView(key) {
    this._vLoading = true;
    if (!this._vData) this._viewMsg('Loading\u2026');
    const done = (data) => {
      this._vLoading = false;
      this._vKey = key;
      this._vData = data;
      this._vData.fetched = Date.now();
      this._vCache = '';
      // the desired key may have moved while fetching (fast taps) - re-check
      if (this._view && this._viewKey() === key) this._renderView();
      else if (this._view) this._viewTick();
    };
    const fail = () => done({ err: true });
    if (this._view === 'today') this._loadToday(done, fail);
    else if (this._view === 'period') this._loadPeriod(done, fail);
    else this._loadRecords(done, fail);
  }

  // one quiet day-stats fetch so the summary tile can show a window the
  // 14-day graph data cannot derive (30d/60d/season defaults, v2.6.11)
  _tileAvgEnsure(sel) {
    if (this._vpAvgLoading || !this._gDef || !this._hass) return;
    const key = this._gDef.key;
    this._vpAvgLoading = true;
    const r = this._periodRange();
    this._statsFetch(this._statsEntity(), r.a, r.b, 'day', ['change']).then((rows) => {
      this._vpAvgLoading = false;
      const spanDays = Math.max(1, Math.round((r.b - r.a) / 86400000));
      const todayT = this._dayStart(0).getTime();
      const stt = this._hass.states[this._config[key]];
      const live = stt ? parseFloat(stt.state) : NaN;
      let tot = 0, hadToday = false;
      (rows || []).forEach((x) => {
        if (x.change == null) return;
        const rd = new Date(x.start); rd.setHours(0, 0, 0, 0);
        let v = x.change > 0 ? x.change : 0;
        if (rd.getTime() === todayT) { hadToday = true; if (!isNaN(live)) v = live; }
        tot += v;
      });
      if (!hadToday && !isNaN(live)) tot += live;
      this._vpAvg = { key: key, sel: sel, v: tot / spanDays, fetched: Date.now() };
      this._gCache = '';
      this._renderGraph();
    }).catch(() => { this._vpAvgLoading = false; });
  }

  _renderView() {
    if (!this._view || !this._vData) return;
    if (this._vData.err) {
      if (this._vCache !== 'err') { this._viewMsg('History unavailable'); this._vCache = 'err'; }
      return;
    }
    if (this._view === 'today') this._renderToday();
    else if (this._view === 'period') this._renderPeriod();
    else this._renderRecords();
  }

  /* --- view fetch/format helpers --- */
  _statsFetch(ent, start, end, period, types) {
    const msg = {
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: [ent],
      period: period,
      types: types,
    };
    if (end) msg.end_time = end.toISOString();
    return this._hass.callWS(msg).then((r) => (r && r[ent]) || []);
  }

  _histFetch(ent, start, end) {
    return this._hass.callWS({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [ent],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    }).then((r) => (r && r[ent]) || []);
  }

  _dayStart(back) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (back) d.setDate(d.getDate() - back);
    return d;
  }

  _isoDate(d) {
    const p = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  _midDate(d) { return WEEKDAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

  _shortDate(t) { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate(); }

  _hexRgb(hex) {
    return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16);
  }

  _hourLbl(h) {
    h = ((h % 24) + 24) % 24;
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    return (h % 12) + (h < 12 ? 'a' : 'p');
  }

  // generic bar plot for the views (the default 14-day graph keeps its own code)
  _plotBars(host, items, o) {
    const H = o.height || 84;
    const plot = document.createElement('div');
    plot.className = 'gplot';
    plot.style.height = H + 'px';
    const maxV = Math.max.apply(null, items.map((x) => x.v).concat([o.minMax || 0]));
    // headroom above the tallest bar; more when a peak label rides on top (v2.6.1)
    const scale = Math.max(0.001, maxV * (o.head || 1.08));
    const step = scale <= 3 ? 1 : scale <= 8 ? 2 : scale <= 16 ? 4 : scale <= 40 ? 10 : scale <= 90 ? 30 : 60;
    for (let v = step; v < scale; v += step) {
      const y = H - (v / scale) * H;
      const g = document.createElement('div'); g.className = 'gline'; g.style.top = y + 'px'; plot.appendChild(g);
      const t = document.createElement('div'); t.className = 'ggtxt'; t.style.top = y + 'px'; t.textContent = v + o.unit; plot.appendChild(t);
    }
    if (o.avg != null && o.avg > 0 && o.avg < scale) {
      const y = H - (o.avg / scale) * H;
      const av = document.createElement('div'); av.className = 'gavg'; av.style.top = y + 'px'; plot.appendChild(av);
      const at = document.createElement('div'); at.className = 'gavgtxt'; at.style.top = y + 'px'; at.textContent = 'avg'; plot.appendChild(at);
    }
    const tip = document.createElement('div'); tip.className = 'gtip'; plot.appendChild(tip);
    const bars = document.createElement('div'); bars.className = 'gbars'; plot.appendChild(bars);
    items.forEach((x, i) => {
      const b = document.createElement('div'); b.className = 'gb';
      if (x.v <= 0) b.classList.add('zero');
      else {
        b.style.height = Math.max(2, (x.v / scale) * H) + 'px';
        if (x.live) { b.classList.add('today'); b.style.background = o.color + '59'; b.style.borderColor = o.colorLite; }
        else b.style.background = o.color;
      }
      if (i === o.peakIdx && x.v > 0 && x.lab) {
        const l = document.createElement('div'); l.className = 'gdlab'; l.textContent = x.lab;
        // edge clamp (v2.6.1): first/last bars anchor the label inward so it never clips
        if (i === 0) { l.style.left = '0'; l.style.transform = 'none'; }
        else if (i === items.length - 1) { l.style.left = 'auto'; l.style.right = '0'; l.style.transform = 'none'; }
        b.appendChild(l);
      }
      const show = () => {
        const r = b.getBoundingClientRect(); const pr = plot.getBoundingClientRect();
        tip.innerHTML = x.tip;
        tip.style.display = 'block';
        // clamp inside the plot so edge-bar values are never cut off (v2.6.6)
        const half = tip.offsetWidth / 2;
        let lx = r.left - pr.left + r.width / 2;
        lx = Math.max(half + 2, Math.min(pr.width - half - 2, lx));
        tip.style.left = lx + 'px';
        tip.style.top = (r.top - pr.top) + 'px';
      };
      b.addEventListener('pointerenter', show);
      b.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
      b.addEventListener('click', (e) => { e.stopPropagation(); show(); });
      bars.appendChild(b);
    });
    host.appendChild(plot);
  }

  /* --- TODAY view --- */
  _loadToday(done, fail) {
    const statsEnt = this._statsEntity();
    const sigEnt = this._config[this._gDef.key + '_signal'];
    const a = this._dayStart(this._vDay);
    const b = new Date(a.getTime() + 86400000);
    const hEnd = new Date(Math.min(b.getTime(), Date.now()));
    Promise.all([
      this._statsFetch(statsEnt, a, b, 'hour', ['change']),
      sigEnt ? this._histFetch(sigEnt, a, hEnd).catch(() => null) : Promise.resolve(null),
    ]).then((res) => done({ hours: res[0] || [], hist: res[1] })).catch(fail);
  }

  _renderToday() {
    const d = this._vData;
    const a = this._dayStart(this._vDay);
    const aT = a.getTime();
    const isToday = this._vDay === 0;
    const endLive = isToday ? Date.now() : aT + 86400000;
    const mins = new Array(24).fill(0);
    let daySum = 0;
    (d.hours || []).forEach((r) => {
      if (r.change == null || r.change <= 0) return;
      const h = new Date(r.start).getHours();
      const rT = new Date(r.start).getTime();
      if (rT >= aT && rT < aT + 86400000) { mins[h] += r.change * 60; daySum += r.change; }
    });
    // exact on/off segments from the signal sensor's recorder history (~10 days)
    let segs = null;
    if (d.hist && d.hist.length) {
      const pts = d.hist.map((p) => ({
        t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated || p.last_changed),
        on: parseFloat(p.s != null ? p.s : p.state) > 0,
      })).filter((p) => !isNaN(p.t)).sort((x, y) => x.t - y.t);
      segs = [];
      let run = null;
      pts.forEach((p) => {
        if (p.on && run == null) run = Math.max(p.t, aT);
        else if (!p.on && run != null) { segs.push([run, Math.min(p.t, endLive)]); run = null; }
      });
      if (run != null) segs.push([run, endLive]);
      segs = segs.filter((s) => s[1] > s[0]);
    }
    let total = daySum;
    if (isToday) {
      const st = this._hass.states[this._config[this._gDef.key]];
      const live = st ? parseFloat(st.state) : NaN;
      if (!isNaN(live)) total = live;
    }
    const cache = 'today|' + this._vDay + '|' + total.toFixed(3) + '|' + mins.map((m) => m.toFixed(1)).join(',') +
      '|' + (segs ? segs.map((s) => Math.round(s[0] / 60000) + ':' + Math.round(s[1] / 60000)).join(',') : 'x');
    if (cache === this._vCache) return;
    this._vCache = cache;

    let sub = 'total';
    if (segs && segs.length) {
      let longest = 0;
      segs.forEach((s) => { if (s[1] - s[0] > longest) longest = s[1] - s[0]; });
      sub = 'total &middot; ' + segs.length + (segs.length === 1 ? ' run' : ' runs') + ' &middot; longest ' + this._fmtRuntime(longest / 3600000);
    } else if (segs && !segs.length && total <= 0) sub = 'did not run';
    const ax = '<div class="vxax"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>';
    const gv = this._el.gview;
    gv.innerHTML =
      '<div class="vhero"><span class="vval">' + this._fmtRuntime(total) + '</span>' +
        '<span class="vpager"><span class="vpg" id="vprev">&#8249;</span>' +
        '<span class="vdl" id="vdate">' + (isToday ? 'Today' : this._midDate(a)) +
        '<input type="date" class="vdi" id="vdi" value="' + this._isoDate(a) + '" max="' + this._isoDate(this._dayStart(0)) + '"></span>' +
        '<span class="vpg' + (isToday ? ' off' : '') + '" id="vnext">&#8250;</span>' +
        '<span class="vpg' + (isToday ? ' off' : '') + '" id="vskip" title="Jump to today">&#187;</span></span></div>' +
      '<div class="vsub">' + sub + '</div>' +
      (segs ? '<div class="vsect">Ran during</div><div class="vrib" id="vrib"></div>' + ax : '') +
      '<div class="vsect">Minutes per hour</div><div id="vhb"></div>' +
      '<div style="margin-right:26px">' + ax + '</div>';
    if (segs) {
      const rib = gv.querySelector('#vrib');
      segs.forEach((s) => {
        const seg = document.createElement('div');
        seg.className = 'seg';
        seg.style.background = this._gDef.bar;
        seg.style.left = ((s[0] - aT) / 864000) + '%';
        seg.style.width = ((s[1] - s[0]) / 864000) + '%';
        rib.appendChild(seg);
      });
      if (isToday) {
        const now = document.createElement('div');
        now.className = 'vnow';
        now.style.left = ((Date.now() - aT) / 864000) + '%';
        rib.appendChild(now);
      }
    }
    const nowH = new Date().getHours();
    const items = mins.map((m, h) => ({
      v: m,
      live: isToday && h === nowH,
      lab: Math.round(m) + 'm',
      tip: this._hourLbl(h) + '\u2013' + this._hourLbl(h + 1) + ' &middot; <b style="color:' + this._gDef.color + '">' + Math.round(m) + 'm</b>',
    }));
    let peakIdx = -1;
    items.forEach((x, i) => { if (x.v > 0 && (peakIdx < 0 || x.v > items[peakIdx].v)) peakIdx = i; });
    this._plotBars(gv.querySelector('#vhb'), items, {
      color: this._gDef.bar, colorLite: this._gDef.color, unit: 'm', height: 72, minMax: 45, head: 1.18, peakIdx: peakIdx,
    });
    gv.querySelector('#vprev').addEventListener('click', () => { this._vDay += 1; this._viewTick(); });
    gv.querySelector('#vnext').addEventListener('click', () => { if (this._vDay > 0) { this._vDay -= 1; this._viewTick(); } });
    gv.querySelector('#vskip').addEventListener('click', () => { if (this._vDay > 0) { this._vDay = 0; this._viewTick(); } });
    // tapping the date opens the native calendar picker (v2.6.1)
    const vdi = gv.querySelector('#vdi');
    gv.querySelector('#vdate').addEventListener('click', (e) => {
      if (e.target === vdi) return;
      try { if (vdi.showPicker) vdi.showPicker(); else vdi.focus(); } catch (err) { vdi.focus(); }
    });
    vdi.addEventListener('change', () => {
      if (!vdi.value) return;
      const picked = new Date(vdi.value + 'T00:00:00');
      if (isNaN(picked.getTime())) return;
      const diff = Math.round((this._dayStart(0).getTime() - picked.getTime()) / 86400000);
      if (diff >= 0) { this._vDay = diff; this._viewTick(); }
    });
  }

  /* --- PERIOD view --- */
  _seasonStart() {
    const today = this._dayStart(0);
    const m = this._gDef.key === 'runtime_heating' ? 10 : 5; // Nov 1 / Jun 1
    let a = new Date(today.getFullYear(), m, 1);
    if (a > today) a = new Date(today.getFullYear() - 1, m, 1);
    return a;
  }

  _periodRange() {
    const tomorrow = new Date(this._dayStart(0).getTime() + 86400000);
    let a, b = tomorrow;
    if (this._vpSel === 'season') a = this._seasonStart();
    else if (this._vpSel === 'custom') {
      a = new Date(this._vpA + 'T00:00:00');
      const bd = new Date(this._vpB + 'T00:00:00');
      b = isNaN(bd.getTime()) ? tomorrow : new Date(bd.getTime() + 86400000);
      if (isNaN(a.getTime()) || a >= b) { a = this._dayStart(29); b = tomorrow; }
      if (b > tomorrow) b = tomorrow;
    } else {
      const n = parseInt(this._vpSel, 10) || 30;
      a = this._dayStart(n - 1);
    }
    return { a: a, b: b };
  }

  _loadPeriod(done, fail) {
    const statsEnt = this._statsEntity();
    const r = this._periodRange();
    const span = Math.max(1, Math.round((r.b - r.a) / 86400000));
    const prevA = new Date(r.a.getTime() - span * 86400000);
    // heatmap source is capped at the most recent 120 days of the window
    const heatA = span > 120 ? new Date(r.b.getTime() - 120 * 86400000) : r.a;
    Promise.all([
      this._statsFetch(statsEnt, prevA, r.b, 'day', ['change']),
      this._statsFetch(statsEnt, heatA, r.b, 'hour', ['change']).catch(() => []),
    ]).then((res) => done({
      days: res[0] || [], hours: res[1] || [],
      a: r.a.getTime(), b: r.b.getTime(), prevA: prevA.getTime(), heatA: heatA.getTime(),
    })).catch(fail);
  }

  _renderPeriod() {
    const d = this._vData;
    const todayT = this._dayStart(0).getTime();
    // per-day values across [a,b) - built by date walking (DST-safe)
    const days = [];
    const byT = {};
    for (let dt = new Date(d.a); dt.getTime() < d.b; dt.setDate(dt.getDate() + 1)) {
      const o = { t: dt.getTime(), v: 0 };
      days.push(o); byT[o.t] = o;
    }
    let prevTotal = 0, prevAny = false;
    (d.days || []).forEach((r) => {
      if (r.change == null) return;
      const rd = new Date(r.start); rd.setHours(0, 0, 0, 0);
      const hit = byT[rd.getTime()];
      if (hit) { if (r.change > 0) hit.v = r.change; }
      else if (rd.getTime() < d.a && rd.getTime() >= d.prevA) { prevTotal += Math.max(0, r.change); prevAny = true; }
    });
    const lastDay = days[days.length - 1];
    const hasToday = lastDay && lastDay.t === todayT;
    if (hasToday) {
      const st = this._hass.states[this._config[this._gDef.key]];
      const live = st ? parseFloat(st.state) : NaN;
      if (!isNaN(live)) lastDay.v = live;
    }
    const total = days.reduce((s, x) => s + x.v, 0);
    const ran = days.filter((x) => x.v > 0.005).length;
    const avgDay = total / days.length;
    let prevTxt = '--', prevCol = '';
    if (prevAny && prevTotal > 0.01) {
      const pct = Math.round((total - prevTotal) / prevTotal * 100);
      prevTxt = (pct >= 0 ? '+' : '') + pct + '%';
      prevCol = pct > 0 ? '#ff9c4a' : '#81c784';
    }
    // weekly aggregation past 35 days (auto-granularity: readable at any range)
    const weekly = days.length > 35;
    let cols = days;
    if (weekly) {
      const wmap = {}; cols = [];
      days.forEach((x) => {
        const wd = new Date(x.t); wd.setDate(wd.getDate() - wd.getDay()); wd.setHours(0, 0, 0, 0);
        let w = wmap[wd.getTime()];
        if (!w) { w = { t: wd.getTime(), v: 0, live: false }; wmap[wd.getTime()] = w; cols.push(w); }
        w.v += x.v;
        if (x.t === todayT) w.live = true;
      });
    }
    const cache = 'period|' + this._vpSel + '|' + (this._vpA || '') + '|' + (this._vpB || '') + '|' +
      days.map((x) => x.v.toFixed(2)).join(',') + '|' + (d.hours || []).length + '|' + prevTxt;
    if (cache === this._vCache) return;
    this._vCache = cache;
    // feed the summary tile (v2.6.10): it mirrors the selected window's avg/day
    this._vpAvg = { key: this._gDef.key, sel: this._vpSel, v: avgDay, fetched: Date.now() };
    this._gCache = '';
    this._renderGraph();

    const bar = this._gDef.bar, lite = this._gDef.color, rgb = this._hexRgb(bar);
    const CHIPS = [['7d', '7d'], ['14d', '14d'], ['30d', '30d'], ['60d', '60d'], ['season', 'Season'], ['custom', 'Custom \u25be']];
    const chips = CHIPS.map((c) =>
      '<span class="vchip' + (this._vpSel === c[0] ? ' on' : '') + '" data-sel="' + c[0] + '"' +
      (this._vpSel === c[0] ? ' style="background:' + bar + '2e;border-color:' + bar + '8c"' : '') + '>' + c[1] + '</span>').join('');
    const stile = (l, v) => '<div class="vstile"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>';
    const range = this._periodRange();
    const dates = this._vpSel === 'custom' ?
      '<div class="vdates"><input type="date" id="vda" value="' + this._isoDate(range.a) + '"> to ' +
      '<input type="date" id="vdb" value="' + this._isoDate(new Date(range.b - 86400000)) + '"></div>' : '';
    const heatCapped = d.heatA > d.a;
    const gv = this._el.gview;
    gv.innerHTML =
      '<div class="vchips">' + chips + '</div>' + dates +
      '<div class="vstats">' +
        stile('Total', this._fmtRuntime(total)) +
        stile('Avg / day', this._fmtRuntime(avgDay)) +
        '<div class="vstile"><div class="l">Days ran</div><div class="v">' + ran + '<em>/' + days.length + '</em></div></div>' +
        '<div class="vstile"><div class="l">Vs prev ' + days.length + 'd</div><div class="v"' + (prevCol ? ' style="color:' + prevCol + '"' : '') + '>' + prevTxt + '</div></div>' +
      '</div>' +
      '<div class="vsect">Hours per ' + (weekly ? 'week' : 'day') + (weekly ? ' &middot; auto (range &gt; 5 weeks)' : '') + '</div>' +
      '<div id="vpb"></div>' +
      '<div class="vxax" style="margin-right:28px"><span>' + this._shortDate(days[0].t) + '</span><span>' + this._shortDate(days[days.length - 1].t) + '</span></div>' +
      '<div id="vhm"' + (heatCapped ? ' title="hour detail: last 120 days"' : '') + '></div>';
    // bars
    let peakIdx = -1;
    cols.forEach((x, i) => {
      const isLive = weekly ? x.live : x.t === todayT;
      if (!isLive && x.v > 0 && (peakIdx < 0 || x.v > cols[peakIdx].v)) peakIdx = i;
    });
    const items = cols.map((x) => {
      const isLive = weekly ? !!x.live : x.t === todayT;
      return {
        v: x.v, live: isLive, lab: this._fmtRuntime(x.v),
        tip: (weekly ? 'Week of ' + this._shortDate(x.t) : this._midDate(new Date(x.t))) +
          ' &middot; <b style="color:' + lite + '">' + this._fmtRuntime(x.v) + '</b>' + (isLive ? ' so far' : ''),
      };
    });
    this._plotBars(gv.querySelector('#vpb'), items, {
      color: bar, colorLite: lite, unit: 'h', height: 96, head: 1.2,
      avg: weekly ? total / cols.length : avgDay, peakIdx: peakIdx,
    });
    // heatmap: 6 three-hour bands x day/week columns
    // heatmap, TRANSPOSED (v2.6.6, owner design): time-of-day bands are 8 FIXED
    // COLUMNS across the top, dates run DOWN as rows, and the card simply grows
    // taller with longer ranges. Fixed column count = every cell is the same
    // 20px square at every range - the column-squeeze problem cannot exist.
    const BANDS = ['12-3a', '3-6a', '6-9a', '9a-12', '12-3p', '3-6p', '6-9p', '9p-12a'];
    const BANDS_SHORT = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']; // band START, column headers
    const heatRows = weekly ? cols.filter((c) => c.t + 7 * 86400000 > d.heatA) : days.filter((c) => c.t >= d.heatA);
    const hByT = {}; heatRows.forEach((c, i) => hByT[c.t] = i);
    const grid = heatRows.map(() => [0, 0, 0, 0, 0, 0, 0, 0]);
    (d.hours || []).forEach((r) => {
      if (r.change == null || r.change <= 0) return;
      const rd = new Date(r.start);
      const band = Math.floor(rd.getHours() / 3);
      const key = new Date(rd.getTime());
      key.setHours(0, 0, 0, 0);
      if (weekly) key.setDate(key.getDate() - key.getDay());
      const ri = hByT[key.getTime()];
      if (ri != null) grid[ri][band] += r.change;
    });
    let maxCell = 0;
    grid.forEach((c) => c.forEach((v) => { if (v > maxCell) maxCell = v; }));
    const hm = gv.querySelector('#vhm');
    const SIDE = 20, GAP = 2, PITCH = SIDE + GAP;
    const LABW = 51; // 46px label basis + 5px padding (content-box)
    const innerW = Math.max(160, (hm.clientWidth || this._el.gview.clientWidth || 452) - 4);
    const gridW = 8 * PITCH - GAP;
    // optical centering (v2.6.9): panel center nudged right by a quarter of the
    // label column - labels half-count; clamped so they always fit at the left
    const gridLeft = Math.max(LABW + 2, Math.floor((innerW - gridW) / 2 + (LABW + 2) / 4));
    const hpad = gridLeft - LABW - 2;
    // header row: band-start times over each column
    const head = document.createElement('div'); head.className = 'vhrow';
    head.style.paddingLeft = hpad + 'px';
    head.style.marginTop = '14px'; // spacing formerly provided by the removed section caption
    const hspace = document.createElement('div'); hspace.className = 'vhlab'; head.appendChild(hspace);
    BANDS_SHORT.forEach((t, i) => {
      const th = document.createElement('div'); th.className = 'vhth';
      th.style.width = SIDE + 'px';
      th.textContent = t;
      th.title = BANDS[i];
      head.appendChild(th);
    });
    hm.appendChild(head);
    const todayT2 = this._dayStart(0).getTime();
    // newest-first (v2.6.8): Today at the top, oldest below the fold
    heatRows.slice().reverse().forEach((c) => {
      const ri = hByT[c.t];
      const row = document.createElement('div'); row.className = 'vhrow';
      row.style.paddingLeft = hpad + 'px';
      const lab = document.createElement('div'); lab.className = 'vhlab';
      // every row is labeled (v2.6.7, owner: sparse Monday-only labels read as random)
      lab.textContent = c.t === todayT2 && !weekly ? 'Today' : this._shortDate(c.t);
      row.appendChild(lab);
      for (let b2 = 0; b2 < 8; b2++) {
        const cell = document.createElement('div'); cell.className = 'vhc';
        cell.style.width = SIDE + 'px';
        cell.style.height = SIDE + 'px';
        cell.style.borderRadius = '4px';
        const v = grid[ri][b2];
        const inten = maxCell > 0 ? v / maxCell : 0;
        cell.style.background = inten < 0.01 ? 'rgba(255,255,255,.04)' : 'rgba(' + rgb + ',' + (0.12 + inten * 0.88).toFixed(2) + ')';
        cell.title = (weekly ? 'Week of ' + this._shortDate(c.t) : this._shortDate(c.t)) + ' ' + BANDS[b2] + ' \u00b7 ' + this._fmtRuntime(v);
        row.appendChild(cell);
      }
      hm.appendChild(row);
    });
    // interactions
    gv.querySelectorAll('.vchip').forEach((c) => c.addEventListener('click', () => {
      const sel = c.dataset.sel;
      if (sel === 'custom' && (!this._vpA || !this._vpB)) {
        const r2 = this._periodRange();
        this._vpA = this._isoDate(r2.a);
        this._vpB = this._isoDate(new Date(r2.b - 86400000));
      }
      this._vpSel = sel;
      this._viewTick();
    }));
    const da = gv.querySelector('#vda'), db = gv.querySelector('#vdb');
    if (da) da.addEventListener('change', () => { if (da.value) { this._vpA = da.value; this._viewTick(); } });
    if (db) db.addEventListener('change', () => { if (db.value) { this._vpB = db.value; this._viewTick(); } });
  }

  /* --- RECORDS view --- */
  _loadRecords(done, fail) {
    const statsEnt = this._statsEntity();
    const a = this._dayStart(365);
    const b = new Date(this._dayStart(0).getTime() + 86400000);
    const outEnt = this._config.outdoor_high_stats;
    Promise.all([
      this._statsFetch(statsEnt, a, b, 'day', ['change']),
      outEnt ? this._statsFetch(outEnt, this._dayStart(59), b, 'day', ['max']).catch(() => []) : Promise.resolve([]),
    ]).then((res) => done({ days: res[0] || [], out: res[1] || [] })).catch(fail);
  }

  _renderRecords() {
    const d = this._vData;
    const todayT = this._dayStart(0).getTime();
    const past = [];
    const runByT = {};
    (d.days || []).forEach((r) => {
      if (r.change == null) return;
      const rd = new Date(r.start); rd.setHours(0, 0, 0, 0);
      const t = rd.getTime();
      if (t >= todayT) return; // today is still counting - not a record yet
      runByT[t] = Math.max(0, r.change);
      if (r.change > 0) past.push({ t: t, v: r.change });
    });
    past.sort((x, y) => y.v - x.v);
    const top = past.slice(0, 5);
    const outByT = {};
    (d.out || []).forEach((r) => {
      if (r.max == null) return;
      const rd = new Date(r.start); rd.setHours(0, 0, 0, 0);
      outByT[rd.getTime()] = r.max;
    });
    // scatter pairs: last 60 full days where BOTH runtime stats and outdoor high exist
    const pairs = [];
    for (let i = 1; i <= 60; i++) {
      const t = this._dayStart(i).getTime();
      if (outByT[t] != null && runByT[t] != null) pairs.push({ t: t, temp: outByT[t], v: runByT[t] });
    }
    const cache = 'records|' + top.map((x) => x.t + ':' + x.v.toFixed(2)).join(',') + '|' + pairs.length;
    if (cache === this._vCache) return;
    this._vCache = cache;

    const gv = this._el.gview;
    if (!top.length) {
      gv.innerHTML = '<div class="gmsg">No completed days with runtime yet</div>';
      return;
    }
    const bar = this._gDef.bar, lite = this._gDef.color;
    const peak = top[0];
    const showScatter = pairs.length >= 8;
    gv.innerHTML =
      '<div class="vhero">' + this._fmtRuntime(peak.v) + '<small>peak day &middot; ' + this._midDate(new Date(peak.t)) + '</small></div>' +
      '<div class="vsect">Top days &middot; last 12 months</div><div id="vranks"></div>' +
      (showScatter ? '<div class="vsect">Runtime vs outdoor high &middot; last 60 days</div><div class="vplot" id="vsc"></div>' +
        '<div class="vxax" style="margin-left:2px" id="vscx"></div>' : '');
    const ranks = gv.querySelector('#vranks');
    top.forEach((x, i) => {
      const row = document.createElement('div'); row.className = 'vrrow';
      const note = i === 0 && outByT[x.t] != null ? '<span class="vrnote">high ' + Math.round(outByT[x.t]) + '\u00b0</span>' : '';
      row.innerHTML = '<span class="vrd">' + this._shortDate(x.t) + '</span>' +
        '<span class="vrbar" style="width:' + Math.max(6, Math.round(x.v / peak.v * 46)) + '%;background:' + (i === 0 ? lite : bar) + '"></span>' +
        note + '<span class="vrv">' + this._fmtRuntime(x.v) + '</span>';
      row.addEventListener('click', () => {
        // drill into that day's TODAY view
        this._vDay = Math.max(0, Math.round((todayT - x.t) / 86400000));
        this._view = 'today';
        this._vKey = null; this._vData = null; this._vCache = ''; this._gCache = '';
        this._renderGraph();
        this._viewTick();
      });
      ranks.appendChild(row);
    });
    if (showScatter) {
      const plot = gv.querySelector('#vsc');
      const H = 110;
      let tmin = Infinity, tmax = -Infinity, vmax = 0;
      pairs.forEach((p) => {
        if (p.temp < tmin) tmin = p.temp;
        if (p.temp > tmax) tmax = p.temp;
        if (p.v > vmax) vmax = p.v;
      });
      tmin = Math.floor(tmin - 1); tmax = Math.ceil(tmax + 1);
      const scale = Math.max(1, vmax * 1.15);
      const step = scale <= 3 ? 1 : scale <= 8 ? 2 : 4;
      for (let v = step; v < scale; v += step) {
        const y = H - (v / scale) * H;
        const g = document.createElement('div'); g.className = 'gline'; g.style.top = y + 'px'; plot.appendChild(g);
        const t = document.createElement('div'); t.className = 'ggtxt'; t.style.top = y + 'px'; t.textContent = v + 'h'; plot.appendChild(t);
      }
      const px = (temp) => ((temp - tmin) / (tmax - tmin)) * 94 + 1; // % (keep off the h-axis labels)
      let hi = null;
      pairs.forEach((p) => { if (!hi || p.v > hi.v) hi = p; });
      pairs.forEach((p) => {
        if (p === hi) return;
        const dot = document.createElement('div'); dot.className = 'vdot';
        dot.style.background = 'rgba(158,158,158,.4)';
        dot.style.left = px(p.temp) + '%';
        dot.style.bottom = (p.v / scale) * H + 'px';
        dot.title = this._shortDate(p.t) + ' \u00b7 ' + Math.round(p.temp) + '\u00b0 \u00b7 ' + this._fmtRuntime(p.v);
        plot.appendChild(dot);
      });
      if (hi) {
        const dot = document.createElement('div'); dot.className = 'vdot hi';
        dot.style.background = lite;
        dot.style.left = px(hi.temp) + '%';
        dot.style.bottom = (hi.v / scale) * H + 'px';
        dot.title = this._shortDate(hi.t) + ' \u00b7 ' + Math.round(hi.temp) + '\u00b0 \u00b7 ' + this._fmtRuntime(hi.v);
        plot.appendChild(dot);
        const l = document.createElement('div'); l.className = 'vdlab';
        l.style.left = px(hi.temp) + '%';
        l.style.bottom = (hi.v / scale) * H + 'px';
        l.textContent = this._shortDate(hi.t);
        plot.appendChild(l);
      }
      // least-squares trend (v2.6.2) - hidden when the fit is noise (r^2 < 0.1)
      const n = pairs.length;
      let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
      pairs.forEach((p2) => { sx += p2.temp; sy += p2.v; sxx += p2.temp * p2.temp; sxy += p2.temp * p2.v; syy += p2.v * p2.v; });
      const den = n * sxx - sx * sx;
      if (den > 0) {
        const slope = (n * sxy - sx * sy) / den;
        const icept = (sy - slope * sx) / n;
        const varY = n * syy - sy * sy;
        const r2 = varY > 0 ? Math.pow(n * sxy - sx * sy, 2) / (den * varY) : 0;
        if (r2 >= 0.1) {
          const yAt = (temp) => Math.max(0, Math.min(scale, slope * temp + icept));
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('viewBox', '0 0 100 ' + H);
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
          const ln = document.createElementNS(svgNS, 'line');
          ln.setAttribute('x1', px(tmin));
          ln.setAttribute('y1', H - (yAt(tmin) / scale) * H);
          ln.setAttribute('x2', px(tmax));
          ln.setAttribute('y2', H - (yAt(tmax) / scale) * H);
          ln.setAttribute('stroke', 'rgba(255,255,255,.28)');
          ln.setAttribute('stroke-dasharray', '4 4');
          ln.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(ln);
          plot.insertBefore(svg, plot.firstChild);
        }
      }
      const mid = Math.round((tmin + tmax) / 2);
      gv.querySelector('#vscx').innerHTML =
        '<span>' + tmin + '\u00b0</span><span>' + mid + '\u00b0</span><span>' + tmax + '\u00b0</span>';
    }
  }

  _buildModes() {
    if (this._modesBuilt) return;
    const avail = this._attrs().hvac_modes || [];
    const list = this._config.modes.filter(m => avail.includes(m));
    (list.length ? list : avail).forEach(m => {
      const d = document.createElement('div');
      d.className = 'mode';
      d.dataset.mode = m;
      const ic = document.createElement('ha-icon');
      ic.setAttribute('icon', this._config['icon_' + m] || ICONS[m] || 'mdi:thermostat');
      d.appendChild(ic);
      d.addEventListener('click', () => this._setMode(m));
      this._el.modes.appendChild(d);
    });
    this._modesBuilt = true;
  }

  _updateModes(mode) {
    this._el.modes.querySelectorAll('.mode').forEach(d => {
      const active = d.dataset.mode === mode;
      d.classList.toggle('active', active);
      d.style.background = active ? (COLORS[d.dataset.mode] || 'var(--primary-color)') : '';
    });
  }

  _updateBar(mode) {
    const el = this._el;
    const a = this._attrs();
    const v = this._vals();
    const eco = this._ecoOn();
    const ALL = ['fheat','fcool','fsingle','bfheat','bfcool','hlow','hhigh','blow','bhigh','curdot','offlbl'];
    const used = new Set();
    const show = (k) => { if (el[k].style.display !== 'block') el[k].style.display = 'block'; used.add(k); };

    // eco recolors the faded fills green; setpoints are the entity-reported eco temps
    el.fheat.style.background = eco ? COLORS.eco : COLORS.heat;
    el.fcool.style.background = eco ? COLORS.eco : COLORS.cool;

    const cur = a.current_temperature;
    const curC = cur != null ? Math.min(this._max(), Math.max(this._min(), cur)) : null;
    if (curC != null && mode !== 'off') {
      show('curdot');
      el.curdot.style.left = this._pct(curC) + '%';
    }

    const label = (k, val, kind) => {
      show(k);
      el[k].style.left = this._pct(val) + '%';
      el[k].style.color = eco ? LABEL_COLORS.eco : LABEL_COLORS[kind];
      el[k].innerHTML = this._fmt(val) + '<span class="deg">&deg;</span>';
    };
    const handle = (k, val) => {
      if (eco) return; // read-only in eco: no handles
      show(k);
      el[k].style.left = this._pct(val) + '%';
    };
    // bright segment: extends 8px past each endpoint so round caps surround handle & dot (native line-cap look).
    // from === to draws a 16px cap centered on the handle - native always renders this (zero-length round-cap stroke).
    // suppressed entirely in eco (no handle, no work-zone emphasis on a read-only track).
    const bright = (k, from, to) => {
      if (eco) return false;
      if (from == null || to == null || to < from) return false;
      show(k);
      el[k].style.left = 'calc(' + this._pct(from) + '% - 8px)';
      el[k].style.width = 'calc(' + (this._pct(to) - this._pct(from)) + '% + 16px)';
      return true;
    };
    let dotOnBright = false;

    if (mode === 'heat_cool' && v.low != null && v.high != null) {
      show('fheat'); el.fheat.style.width = this._pct(v.low) + '%';
      show('fcool'); el.fcool.style.width = (100 - this._pct(v.high)) + '%';
      if (curC != null && curC < v.low) { bright('bfheat', curC, v.low); dotOnBright = true; }
      else bright('bfheat', v.low, v.low);
      if (curC != null && curC > v.high) { bright('bfcool', v.high, curC); dotOnBright = true; }
      else bright('bfcool', v.high, v.high);
      handle('hlow', v.low);
      handle('hhigh', v.high);
      label('blow', v.low, 'heat');
      label('bhigh', v.high, 'cool');
    } else if (mode === 'heat' && v.single != null) {
      show('fheat'); el.fheat.style.width = this._pct(v.single) + '%';
      if (curC != null && curC < v.single) { bright('bfheat', curC, v.single); dotOnBright = true; }
      else bright('bfheat', v.single, v.single);
      handle('hlow', v.single);
      label('blow', v.single, 'heat');
    } else if (mode === 'cool' && v.single != null) {
      show('fcool'); el.fcool.style.width = (100 - this._pct(v.single)) + '%';
      if (curC != null && curC > v.single) { bright('bfcool', v.single, curC); dotOnBright = true; }
      else bright('bfcool', v.single, v.single);
      handle('hlow', v.single);
      label('blow', v.single, 'cool');
    }
    // off mode: bar stays empty - the status text under the temp already says "Off" (offlbl removed in v2.2)

    if (used.has('curdot')) {
      // native darkens the current-temp dot when it sits on the bright fill so it stays visible
      el.curdot.style.background = dotOnBright ? 'rgba(0,0,0,.5)' : '#a6a6a6';
    }

    ALL.forEach(k => { if (!used.has(k)) el[k].style.display = 'none'; });
  }

  /* ---------- interactions ---------- */
  _valFromX(clientX) {
    const r = this._el.bar.getBoundingClientRect();
    let f = (clientX - r.left) / r.width;
    f = Math.max(0, Math.min(1, f));
    const step = this._step();
    const raw = this._min() + f * (this._max() - this._min());
    return Math.min(this._max(), Math.max(this._min(), Math.round(raw / step) * step));
  }

  _bindDrag() {
    const el = this._el;
    const down = (e) => {
      const mode = this._mode();
      if (mode === 'off' || this._ecoOn() || !this._stateObj()) return; // eco: Nest rejects setpoint changes
      const v = this._vals();
      const gap = this._config.gap;
      this._opt = { low: v.low, high: v.high, single: v.single };
      if (mode === 'heat_cool') {
        const x = this._valFromX(e.clientX);
        if (e.target === el.hlow) this._drag = 'low';
        else if (e.target === el.hhigh) this._drag = 'high';
        else this._drag = (Math.abs(x - v.low) <= Math.abs(x - v.high)) ? 'low' : 'high';
      } else {
        this._drag = 'single';
      }
      el.bar.setPointerCapture && el.bar.setPointerCapture(e.pointerId);
      e.preventDefault();
      move(e);
    };
    const move = (e) => {
      if (!this._drag) return;
      const x = this._valFromX(e.clientX);
      const gap = this._config.gap;
      if (this._drag === 'low') this._opt.low = Math.min(x, this._opt.high - gap);
      else if (this._drag === 'high') this._opt.high = Math.max(x, this._opt.low + gap);
      else this._opt.single = x;
      this._updateBar(this._mode());
    };
    const up = () => {
      if (!this._drag) return;
      this._drag = null;
      el.bar.classList.remove('dragging');
      this._commit();
    };
    el.bar.addEventListener('pointerdown', down);
    el.hlow.addEventListener('pointerdown', down);
    el.hhigh.addEventListener('pointerdown', down);
    const moveWin = (e) => { if (!this._drag) return; el.bar.classList.add('dragging'); move(e); };
    window.addEventListener('pointermove', moveWin);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _commit() {
    const s = this._stateObj();
    if (!s || !this._hass) return;
    const mode = this._mode();
    const data = { entity_id: this._config.entity };
    if (mode === 'heat_cool') {
      if (this._opt.low == null || this._opt.high == null) return;
      data.target_temp_low = this._opt.low;
      data.target_temp_high = this._opt.high;
    } else {
      if (this._opt.single == null) return;
      data.temperature = this._opt.single;
    }
    this._optUntil = Date.now() + 8000;
    this._hass.callService('climate', 'set_temperature', data);
  }

  _setMode(m) {
    if (!this._hass) return;
    this._optMode = m;
    this._optModeUntil = Date.now() + 8000;
    this._updateModes(m);
    this._updateBar(m);
    this._hass.callService('climate', 'set_hvac_mode', { entity_id: this._config.entity, hvac_mode: m });
  }

  _toggleEco() {
    if (!this._hass || !this._ecoSupported()) return;
    const on = this._ecoOn();
    this._optEco = !on;
    this._optEcoUntil = Date.now() + 8000;
    this._render();
    this._hass.callService('climate', 'set_preset_mode', { entity_id: this._config.entity, preset_mode: on ? 'none' : 'eco' });
  }
}

customElements.define('flat-thermostat-card', FlatThermostatCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-thermostat-card',
  name: 'Flat Thermostat Card',
  description: 'Slim flat thermostat with dual-handle temperature track, native-style mode strip, eco toggle, and daily HVAC runtime chip with expanding runtime graph + today/period/records views',
});
