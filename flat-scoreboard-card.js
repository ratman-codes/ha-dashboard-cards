/* flat-scoreboard-card v1.1 - custom Lovelace card for the Forecast Lab dashboard.
   Leaderboard for the forecast-accuracy experiment: rank medals, avg-error bars
   (leader in house amber; off-scale entries overflow with a fade), today's call
   per source with busted-call marking, yesterday's miss with blowup marking,
   live actual-so-far in the header, and a long-term trend strip drawn from
   permanent statistics. Built 2026-07-19 by Claude for Ratman (design notes in
   the "NAS / Smart Home" Claude project, doc claude/ha-dashboard-notes.md).

   HOW THIS WORKS / HOW TO MAINTAIN IT (read me first, future person):
   - This entire card is plain JavaScript encoded as base64 and stored as a
     dashboard resource URL: data:text/javascript;name=flat-scoreboard-card;base64,<blob>.
     No file on disk, no internet dependency - the code lives inside the URL,
     in HA's own config (.storage/lovelace_resources), included in HA backups.
   - To READ: decode everything after "base64,". To MODIFY: edit the decoded
     JS (ASCII only in strings), node --check, re-encode, replace the resource
     URL via the Card Manager card (row Update) or at Settings > Dashboards >
     Resources, hard-refresh.
   - All entity ids come from the card YAML (kept out of this source). Shape:
       type: custom:flat-scoreboard-card
       title: Forecast Lab                  # optional
       actual_entity: input_number...       # live actual-high tracker
       sources:                             # one entry per contestant
         - name: WU/TWC
           tag: card source                 # optional small label under name
           avg: sensor...                   # running avg error (state_class!)
           days: counter...                 # days scored
           today: input_number...           # today's 6am call
           yday: input_number...            # yesterday's miss
         - name: ...
       bar_max: 4        # deg F full-scale for the error bars (optional)
       yday_alert: 8     # yday miss >= this renders orange (optional)
       busted_margin: 5  # actual >= call+this marks today's call busted (optional)
       trend_days: 30    # trend strip lookback (optional)
       trend_count: 3    # how many leaders drawn on the trend (optional)
   - Values of -99 in the helpers mean "no data" and render as --.
   - The trend strip reads permanent long-term statistics via the
     recorder/statistics_during_period websocket call (daily mean). Statistics
     only exist from the moment the avg sensors gained state_class
     (2026-07-19) - the strip fills in as days accumulate.
   - Busted / orange-yday decisions are made on the ROUNDED values the card
     prints (whole degrees), so what you see is what was compared.

   CHANGELOG
   v1.1 (2026-09-06, source audit):
     - Trend strip: a failed statistics fetch keeps the last good chart and
       says "trend unavailable" instead of pretending no data exists yet;
       retries after 60 s, and the hourly throttle is only stamped on success
       (a first push with unknown avg sensors no longer burns the hour).
     - busted / orange-yday now compare the rounded values that are printed.
     - Trend x-axis is a shared time axis (rows placed by their day, not by
       array index), so a series with a missing day is no longer shifted.
     - Rows with no avg print a dash instead of a numeric rank; a source
       without an avg id no longer opens more-info for "undefined".
     - Rows are rebuilt only when a printed value or mark changes (a tick of
       the running actual no longer rebuilds the grid); days label guarded.
     - Re-setConfig refreshes the title and discards an in-flight fetch.
     - Press feedback on the primary button only; unused constant removed.
   v1.0 (2026-07-19): initial. */

const ACCENT = '#ffc107';
const ALERT = '#ff9c4a';
const RANK_COLORS = { 1: '#ffc107', 2: '#b0bec5', 3: '#c9946a' };
const TREND_STROKES = ['#ffc107', '#9e9e9e', '#6d6d6d'];

class FlatScoreboardCard extends HTMLElement {
  static getStubConfig() { return { sources: [], actual_entity: '' }; }

  setConfig(config) {
    if (!config.sources || !config.sources.length) {
      throw new Error('flat-scoreboard-card: "sources" list is required');
    }
    this._config = Object.assign(
      { title: 'Forecast Lab', bar_max: 4, yday_alert: 8, busted_margin: 5, trend_days: 30, trend_count: 3 },
      config);
    this._rowsKey = '';
    this._statsFetched = 0;
    this._statsInFlight = false;
    this._trendHtml = '';
    this._cfgSeq = (this._cfgSeq || 0) + 1;
    if (!this.shadowRoot) this._createDom();
    else this._el.title.textContent = this._config.title;
  }

  getCardSize() { return 5; }

  set hass(hass) {
    this._hass = hass;
    this._render();
    this._maybeFetchStats();
  }

  disconnectedCallback() { this._statsFetched = 0; }

  _st(id) { return id && this._hass && this._hass.states[id]; }
  _num(id) {
    const s = this._st(id);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return NaN;
    const v = parseFloat(s.state);
    return (isNaN(v) || v <= -50) ? NaN : v;
  }
  _fmt(v, dp) { return isNaN(v) ? '--' : v.toFixed(dp == null ? 0 : dp); }

  _createDom() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 14px 16px 12px 16px; }
        .hdr { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .hdr .title { font-size: 14px; font-weight: 500; color: var(--primary-text-color); }
        .hdr .sub { font-size: 11.5px; color: #7d7d7d; }
        .hdr .lead { margin-left: auto; font-size: 11.5px; color: var(--secondary-text-color);
          background: rgba(70,70,70,.22); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
        .hdr .lead b { color: var(--primary-text-color); font-weight: 500; }
        .colhead { display: flex; gap: 10px; padding: 0 6px; font-size: 10px; color: #5d5d5d; margin-bottom: 3px; }
        .colhead .a { flex: 0 0 20px; } .colhead .b { flex: 0 0 86px; } .colhead .c { flex: 1; }
        .colhead .d { flex: 0 0 40px; text-align: right; }
        .colhead .e { flex: 0 0 46px; text-align: right; }
        .colhead .f { flex: 0 0 40px; text-align: right; }
        .grid { display: flex; flex-direction: column; gap: 7px; }
        .row { display: flex; align-items: center; gap: 10px; border-radius: 8px; padding: 4px 6px;
          cursor: pointer; transition: transform .12s ease, background .12s ease; }
        .row:hover { background: rgba(70,70,70,.18); }
        .row.press { transform: scale(.985); background: rgba(70,70,70,.22); }
        .rank { flex: 0 0 20px; height: 20px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600; color: #111; background: #4a4a4a; }
        .rank.plain { background: transparent; color: #7d7d7d; font-weight: 400; }
        .name { flex: 0 0 86px; font-size: 12.5px; color: var(--primary-text-color); }
        .name .tag { font-size: 10px; color: #7d7d7d; display: block; }
        .barwrap { flex: 1; height: 8px; border-radius: 4px; background: rgba(70,70,70,.3); position: relative; overflow: hidden; }
        .bar { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #7d7d7d;
          transition: width .35s cubic-bezier(.4,0,.2,1); }
        .bar.leader { background: ${ACCENT}; }
        .bar.over { background: linear-gradient(90deg, #a65b3a 70%, rgba(166,91,58,0)); width: 100% !important; }
        .avg { flex: 0 0 40px; text-align: right; font-size: 12.5px; color: var(--primary-text-color); }
        .avg small { color: #7d7d7d; font-size: 10px; }
        .today { flex: 0 0 46px; text-align: right; font-size: 11.5px; color: var(--primary-text-color); }
        .today.busted { color: ${ALERT}; }
        .yday { flex: 0 0 40px; text-align: right; font-size: 11.5px; color: #7d7d7d; }
        .yday.big { color: ${ALERT}; }
        .trend { margin-top: 12px; border-top: 1px solid rgba(70,70,70,.35); padding-top: 10px; }
        .trend .tl { font-size: 11px; color: #7d7d7d; margin-bottom: 6px; }
        .trend svg { display: block; width: 100%; height: auto; }
        .trend .empty { font-size: 11px; color: #5d5d5d; padding: 6px 0 2px; }
      </style>
      <ha-card>
        <div class="hdr">
          <span class="title" id="title"></span>
          <span class="sub" id="days"></span>
          <span class="lead" id="lead" style="display:none"></span>
        </div>
        <div class="colhead">
          <span class="a"></span><span class="b"></span>
          <span class="c">avg error (lower = better)</span>
          <span class="d"></span><span class="e">today</span><span class="f">yday</span>
        </div>
        <div class="grid" id="grid"></div>
        <div class="trend" id="trend"></div>
      </ha-card>
    `;
    this._el = {};
    ['title', 'days', 'lead', 'grid', 'trend'].forEach(id => this._el[id] = root.getElementById(id));
    this._el.title.textContent = this._config.title;
    this._el.lead.addEventListener('click', () => this._moreInfo(this._config.actual_entity));
    /* row clicks + press feedback via delegation (rows are rebuilt on sort changes) */
    this._el.grid.addEventListener('click', (e) => {
      const row = e.target.closest ? e.target.closest('.row') : null;
      if (row && row.dataset.avg) this._moreInfo(row.dataset.avg);
    });
    this._el.grid.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const row = e.target.closest ? e.target.closest('.row') : null;
      if (row) row.classList.add('press');
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      this._el.grid.addEventListener(ev, () => {
        this._el.grid.querySelectorAll('.row.press').forEach(r => r.classList.remove('press'));
      }));
  }

  _moreInfo(entity) {
    if (!entity) return;
    this.dispatchEvent(new CustomEvent('hass-more-info',
      { detail: { entityId: entity }, bubbles: true, composed: true }));
  }

  /* ---------- leaderboard ---------- */
  _render() {
    if (!this._el || !this._hass) return;
    const c = this._config;
    const actual = this._num(c.actual_entity);
    const rows = c.sources.map(s => {
      const r = {
        name: s.name, tag: s.tag || '', avgEnt: s.avg || '',
        avg: this._num(s.avg), days: this._num(s.days),
        today: this._num(s.today), yday: this._num(s.yday),
      };
      /* decide on the whole degrees that get printed, not hidden tenths */
      r.busted = !isNaN(r.today) && !isNaN(actual) &&
        (Math.round(actual) - Math.round(r.today)) >= c.busted_margin;
      r.ydayBig = !isNaN(r.yday) && Math.round(r.yday) >= c.yday_alert;
      return r;
    }).sort((a, b) => (isNaN(a.avg) ? 999 : a.avg) - (isNaN(b.avg) ? 999 : b.avg));

    /* competition ranking with ties on the rounded avg */
    let lastVal = null, lastRank = 0;
    rows.forEach((r, i) => {
      if (r.avg === lastVal) { r.rank = lastRank; }
      else { r.rank = i + 1; lastRank = r.rank; lastVal = r.avg; }
    });

    const daysMax = Math.max.apply(null, rows.map(r => isNaN(r.days) ? 0 : r.days));
    const daysTxt = daysMax > 0 ? daysMax + ' days scored' : '';
    if (this._daysTxt !== daysTxt) { this._daysTxt = daysTxt; this._el.days.textContent = daysTxt; }
    if (!isNaN(actual)) {
      const html = 'Today: actual <b>' + Math.round(actual) + '&deg;</b> so far';
      if (this._leadHtml !== html) { this._leadHtml = html; this._el.lead.innerHTML = html; }
      this._el.lead.style.display = '';
    } else {
      this._el.lead.style.display = 'none';
    }

    const key = JSON.stringify(rows.map(r => [r.name, r.avg, r.today, r.yday, r.rank, r.busted, r.ydayBig]));
    if (key === this._rowsKey) return;
    this._rowsKey = key;

    this._el.grid.innerHTML = rows.map(r => {
      const noData = isNaN(r.avg);
      const rankCls = (r.rank <= 3 && !noData) ? '' : ' plain';
      const rankBg = (RANK_COLORS[r.rank] && !noData) ? ' style="background:' + RANK_COLORS[r.rank] + '"' : '';
      const rankTxt = noData ? '&ndash;' : r.rank;
      const over = !isNaN(r.avg) && r.avg > c.bar_max;
      const isLeader = r.rank === 1 && !over;
      const w = isNaN(r.avg) ? 0 : Math.min(r.avg / c.bar_max, 1) * 100;
      const barCls = over ? ' over' : (isLeader ? ' leader' : '');
      const busted = r.busted, ydayBig = r.ydayBig;
      return '<div class="row"' + (r.avgEnt ? ' data-avg="' + r.avgEnt + '"' : '') + '>' +
        '<div class="rank' + rankCls + '"' + rankBg + '>' + rankTxt + '</div>' +
        '<div class="name">' + r.name + (r.tag ? '<span class="tag">' + r.tag + '</span>' : '') + '</div>' +
        '<div class="barwrap"><div class="bar' + barCls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
        '<div class="avg">' + this._fmt(r.avg, 1) + '<small>&#176;</small></div>' +
        '<div class="today' + (busted ? ' busted' : '') + '">' + this._fmt(r.today) + (isNaN(r.today) ? '' : '&#176;') + '</div>' +
        '<div class="yday' + (ydayBig ? ' big' : '') + '">' + this._fmt(r.yday) + (isNaN(r.yday) ? '' : '&#176;') + '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------- long-term trend strip ---------- */
  _maybeFetchStats() {
    if (!this._hass || !this.isConnected || this._statsInFlight) return;
    const now = Date.now();
    const HOUR = 60 * 60 * 1000, RETRY = 60 * 1000;
    if (now - this._statsFetched < HOUR) return; /* refresh hourly */
    const c = this._config;
    /* draw the current top-N by avg */
    const ranked = c.sources
      .map(s => ({ s: s, avg: this._num(s.avg) }))
      .filter(x => !isNaN(x.avg))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, c.trend_count);
    if (!ranked.length) {
      /* nothing to ask for yet (avg sensors unknown) - do NOT stamp the hour */
      if (!this._trendHtml && this._el.trend.innerHTML === '') {
        this._el.trend.innerHTML = '<div class="empty">Trend: waiting for the avg sensors.</div>';
      }
      return;
    }
    const ids = ranked.map(x => x.s.avg);
    const start = new Date(now - c.trend_days * 24 * 3600 * 1000).toISOString();
    const seq = this._cfgSeq;
    this._statsInFlight = true;
    this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start, statistic_ids: ids, period: 'day', types: ['mean'],
    }).then(res => {
      this._statsInFlight = false;
      if (seq !== this._cfgSeq) return; /* config changed while in flight */
      this._statsFetched = Date.now();
      this._drawTrend(ranked, res || {});
    }).catch(() => {
      this._statsInFlight = false;
      if (seq !== this._cfgSeq) return;
      this._statsFetched = Date.now() - HOUR + RETRY; /* try again in a minute */
      this._trendFailed(ranked);
    });
  }

  /* a failed fetch is a failed fetch - keep the last good chart, say so, never
     print the "no data yet" text over 7 weeks of real statistics */
  _trendFailed(ranked) {
    const el = this._el; if (!el) return;
    const label = '<div class="tl">Avg error &middot; long-term trend (' +
      ranked.map(x => x.s.name).join(', ') + ')</div>';
    el.trend.innerHTML = (this._trendHtml || label) +
      '<div class="empty">Trend unavailable &mdash; statistics fetch failed, retrying.</div>';
  }

  _drawTrend(ranked, res) {
    const el = this._el; if (!el) return;
    /* rows carry their bucket start; place every series on ONE shared day axis */
    const tkey = p => Math.round(new Date(p.start).getTime() / 3600000);
    const series = ranked.map(x => (res[x.s.avg] || [])
      .filter(p => p && p.mean != null && p.start != null)
      .map(p => ({ t: tkey(p), v: p.mean })));
    const total = series.reduce((n, s) => n + s.length, 0);
    const label = '<div class="tl">Avg error &middot; long-term trend (' +
      ranked.map(x => x.s.name).join(', ') + ')</div>';
    if (total < 4) {
      this._trendHtml = '';
      el.trend.innerHTML = label +
        '<div class="empty">Permanent statistics accumulate from Jul 19, 2026 &mdash; the trend fills in as days pass.</div>';
      return;
    }
    const W = 448, H = 56, padX = 4, padT = 6, padB = 8;
    const axis = Array.from(new Set(series.reduce((a, s) => a.concat(s.map(p => p.t)), []))).sort((a, b) => a - b);
    const pos = {}; axis.forEach((t, i) => pos[t] = i);
    const maxV = Math.max.apply(null, series.map(s => Math.max.apply(null, s.map(p => p.v))));
    const minV = 0;
    const x = t => padX + (axis.length < 2 ? 0 : pos[t] * (W - 2 * padX) / (axis.length - 1));
    const y = v => padT + (maxV - v) * (H - padT - padB) / ((maxV - minV) || 1);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '">' +
      '<line x1="' + padX + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - padX) + '" y2="' + y(0).toFixed(1) +
      '" stroke="rgba(70,70,70,.3)" stroke-width="1"/>';
    series.forEach((s, si) => {
      if (s.length < 2) return;
      const pts = s.map(p => x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + (TREND_STROKES[si] || '#5d5d5d') +
        '" stroke-width="' + (si === 0 ? 2 : 1.5) + '" stroke-linecap="round" stroke-linejoin="round"' +
        (si === 0 ? '' : ' opacity=".8"') + '/>';
    });
    svg += '</svg>';
    this._trendHtml = label + svg;
    el.trend.innerHTML = this._trendHtml;
  }
}

customElements.define('flat-scoreboard-card', FlatScoreboardCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'flat-scoreboard-card',
  name: 'Flat Scoreboard Card',
  description: 'Forecast-accuracy leaderboard: ranks, error bars, today vs actual, yesterday misses, long-term trend',
});
