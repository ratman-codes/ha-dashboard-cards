/* card-manager-card v1.2 - admin manager for the data-URL custom-card resources.
   What: lists every Lovelace dashboard resource. data-URL resources carrying a
   ";name=" label get full management: decoded self-documenting header preview,
   version, decoded size, FNV-1a hash, blob download, and a guarded update flow:
   paste replacement data: URL -> validation (parse, base64-decode, ;name= label
   must match the target row, header must self-identify as the same card) ->
   old/new version-size-hash diff -> FORCED backup download of the outgoing blob
   -> write by resource ID via the lovelace/resources websocket API (admin-only)
   -> re-read the registry and re-verify byte-for-byte. Wrong-card pastes are
   hard-blocked before anything is sent. Other resources (HACS-managed paths)
   are listed read-only.
   SELF: this manager is itself a data-URL resource; it may update ITSELF only
   behind an extra typed confirmation (type the card name), because a bad self-
   write breaks the tool that fixes cards. Recovery path is always the manual
   paste at Settings > Dashboards > Resources.
   HOW-TO (hosting): this file is base64-encoded into a
   "data:text/javascript;name=card-manager-card;base64,..." URL stored in the
   dashboard resource registry (.storage/lovelace_resources - rides in HA
   backups, zero external hosting). To read this source: copy the resource URL
   and base64-decode everything after "base64,". To update: edit source,
   node --check, re-encode, paste the new URL over THIS resource (via this
   card's own update flow, or at Settings > Dashboards > Resources), then
   hard-refresh the frontend.
   Card YAML (on an admin-only dashboard/view):
     type: custom:card-manager-card
     pin: "1234"          # optional - gates Update mode (Inspect stays open)
     relock_minutes: 5    # optional - idle re-lock to Inspect (default 5)
   Requires an admin user (the lovelace/resources websocket API is admin-only).
   The frontend caches data: URL modules - hard-refresh after any write.
   Built 2026-07-18 by Claude for Ratman. v1.0 initial release.
   v1.1: Inspect mode is always visible; the PIN now gates only Update mode
   (prompted when the Update tab is tapped, cancelable, idle re-lock drops
   back to Inspect).
   v1.2: "Add new card" flow in Update mode - paste a brand-new card's data:
   URL, same validations, plus a duplicate-label hard block (a label that
   already exists means you meant to UPDATE, not add); creates via
   lovelace/resources/create, then re-verifies and shows the new resource_id
   for the inventory notes. No backup step (nothing is overwritten). */

(function () {
  'use strict';

  var CM_NAME = 'card-manager-card';
  var CM_VER = '1.2';
  var SWATCHES = ['#ff6f22', '#ffc107', '#64b5f6', '#4caf50', '#26c6da', '#ab47bc', '#ef5350', '#8d6e63'];

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function b64bytes(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function fnv1a(bytes) {
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function parseDataUrl(url) {
    var m = /^data:text\/javascript;name=([A-Za-z0-9._-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(url).trim());
    if (!m) return null;
    var out = { label: m[1], b64: m[2], url: String(url).trim() };
    try {
      out.bytes = b64bytes(out.b64);
    } catch (e) {
      return { label: m[1], badB64: true };
    }
    out.hash = fnv1a(out.bytes);
    out.text = new TextDecoder().decode(out.bytes);
    var hm = /\/\*\s*([A-Za-z0-9._-]+)\s+v([0-9][0-9A-Za-z.\-]*)/.exec(out.text.slice(0, 500));
    out.hdrName = hm ? hm[1] : null;
    out.ver = hm ? hm[2] : null;
    out.nonAscii = 0;
    for (var i = 0; i < out.bytes.length; i++) if (out.bytes[i] > 127) out.nonAscii++;
    return out;
  }

  function fmtKB(n) {
    return n >= 1024 ? (n / 1024).toFixed(1).replace(/\.0$/, '') + ' KB' : n + ' B';
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------- styles ---------- */

  var CSS = [
    ':host{display:block}',
    'ha-card{position:relative;overflow:hidden;padding:0;',
    ' --cm-ink:var(--primary-text-color,#e1e1e1);--cm-ink2:var(--secondary-text-color,#9b9b9b);',
    ' --cm-bg2:rgba(70,70,70,.25);--cm-div:rgba(70,70,70,.3);',
    ' --cm-ok:#4caf50;--cm-warn:#ffc107;--cm-err:#ff5252;',
    ' font-size:14px;line-height:1.45;color:var(--cm-ink)}',
    '.head{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}',
    '.glyph{width:34px;height:34px;border-radius:8px;background:var(--cm-bg2);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}',
    '.title{flex:1;min-width:0}',
    '.title b{font-size:15px;font-weight:500;display:block}',
    '.title span{font-size:11px;color:var(--cm-ink2)}',
    '.modes{display:flex;background:var(--cm-bg2);border-radius:8px;padding:2px;flex:none}',
    '.modes button{border:0;background:none;color:var(--cm-ink2);font:500 12px inherit;font-family:inherit;padding:6px 12px;border-radius:6px;cursor:pointer;transition:.12s ease}',
    '.modes button.on{background:rgba(70,70,70,.55);color:var(--cm-ink)}',
    '.modes button.upd.on{color:var(--cm-warn)}',
    '.banner{margin:0 16px 10px;padding:7px 10px;border-radius:8px;background:var(--cm-bg2);color:var(--cm-ink2);font-size:11.5px;display:flex;gap:8px;align-items:center}',
    '.banner .dot{width:7px;height:7px;border-radius:50%;background:var(--cm-ok);flex:none}',
    '.banner.warn .dot{background:var(--cm-warn)}',
    '.banner.err .dot{background:var(--cm-err)}',
    '.rows{padding:0 8px 8px}',
    '.row-line{display:flex;align-items:center;gap:10px;padding:9px 8px;cursor:pointer;border-radius:10px;user-select:none;transition:transform .12s ease,background .12s ease}',
    '.row-line:active{transform:scale(.985);background:var(--cm-bg2)}',
    '.swatch{width:10px;height:26px;border-radius:5px;flex:none;opacity:.85}',
    '.r-id{flex:1;min-width:0}',
    '.r-id b{font-weight:500;font-size:13.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.r-id span{font-size:11px;color:var(--cm-ink2)}',
    '.r-meta{text-align:right;flex:none}',
    '.r-meta .ver{font-size:12.5px;font-weight:500}',
    '.r-meta .hash{font-family:monospace;font-size:11px;color:var(--cm-ink2)}',
    '.chev{color:var(--cm-ink2);font-size:11px;flex:none;transition:transform .2s ease}',
    '.row.open .chev{transform:rotate(90deg)}',
    '.selftag{font-size:9.5px;font-weight:600;letter-spacing:.05em;color:var(--cm-warn);border:1px solid rgba(255,193,7,.4);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:1px}',
    '.detail{display:none;padding:2px 10px 12px 28px}',
    '.row.open .detail{display:block}',
    '.kv{display:grid;grid-template-columns:96px 1fr;gap:2px 10px;font-size:12px;margin:0 0 10px}',
    '.kv dt{color:var(--cm-ink2)}',
    '.kv dd{margin:0;font-family:monospace;font-size:11.5px;word-break:break-all}',
    '.hdrprev{background:rgba(0,0,0,.25);border:1px solid var(--cm-div);border-radius:8px;padding:8px 10px;font-family:monospace;font-size:11px;line-height:1.5;color:var(--cm-ink2);white-space:pre-wrap;max-height:110px;overflow:auto;margin-bottom:10px}',
    '.btnrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.btn{border:1px solid var(--cm-div);background:var(--cm-bg2);color:var(--cm-ink);font:500 12px inherit;font-family:inherit;border-radius:8px;padding:7px 12px;cursor:pointer;transition:transform .12s ease}',
    '.btn:active{transform:scale(.97)}',
    '.btn.primary{border-color:rgba(255,193,7,.5);color:var(--cm-warn)}',
    '.btn[disabled]{opacity:.35;cursor:not-allowed}',
    '.btn-note{font-size:11px;color:var(--cm-ink2)}',
    '.updflow{margin-top:10px;border:1px solid rgba(255,193,7,.25);border-radius:10px;padding:10px}',
    '.updflow h4{margin:0 0 8px;font-size:12px;font-weight:500;color:var(--cm-warn)}',
    'textarea.paste{width:100%;box-sizing:border-box;height:64px;background:rgba(0,0,0,.25);border:1px solid var(--cm-div);border-radius:8px;color:var(--cm-ink2);font-family:monospace;font-size:11px;padding:8px;resize:vertical}',
    'input.confirm{width:100%;box-sizing:border-box;background:rgba(0,0,0,.25);border:1px solid rgba(255,193,7,.4);border-radius:8px;color:var(--cm-ink);font-family:monospace;font-size:12px;padding:7px 9px;margin-top:8px}',
    '.checks{list-style:none;margin:10px 0;padding:0;font-size:12px}',
    '.checks li{display:flex;gap:8px;align-items:baseline;padding:2px 0}',
    '.checks .st{font-family:monospace;width:14px;flex:none;text-align:center}',
    '.st.ok{color:var(--cm-ok)}.st.err{color:var(--cm-err)}.st.warn{color:var(--cm-warn)}.st.idle{color:var(--cm-ink2)}',
    '.diff{display:grid;grid-template-columns:1fr 24px 1fr;gap:4px 6px;align-items:center;background:rgba(0,0,0,.25);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:12px}',
    '.diff .arr{color:var(--cm-ink2);text-align:center}',
    '.diff .old{color:var(--cm-ink2)}.diff .new{color:var(--cm-ink)}',
    '.diff .mono{font-family:monospace;font-size:11px}',
    '.stepnote{font-size:11.5px;color:var(--cm-ink2);margin:8px 0 0;display:flex;gap:8px;align-items:baseline}',
    '.stepnote .n{color:var(--cm-warn);font-weight:600;font-family:monospace}',
    '.stepnote.ok{color:var(--cm-ok)}.stepnote.err{color:var(--cm-err)}',
    '.sect{padding:4px 16px 14px}',
    '.sect-head{display:flex;align-items:center;gap:8px;color:var(--cm-ink2);font-size:11.5px;cursor:pointer;padding:6px 0;user-select:none}',
    '.sect-head .line{flex:1;height:1px;background:var(--cm-div)}',
    '.others{display:none;font-family:monospace;font-size:11px;line-height:1.9;color:var(--cm-ink2);word-break:break-all}',
    '.sect.open .others{display:block}',
    '.others i{font-style:normal;opacity:.6}',
    '.toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%) translateY(80px);background:rgba(46,46,46,.97);color:var(--cm-ink);padding:10px 16px;border-radius:10px;font-size:12.5px;box-shadow:0 4px 18px rgba(0,0,0,.5);transition:transform .25s cubic-bezier(.4,0,.2,1);max-width:88%;text-align:center;z-index:6}',
    '.toast.show{transform:translateX(-50%) translateY(0)}',
    '.gate{position:absolute;inset:0;background:rgba(17,17,17,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:5}',
    '.gate .lock{font-size:26px}',
    '.gate p{margin:0;color:var(--cm-ink2);font-size:12px;text-align:center;max-width:260px}',
    '.gate p b{color:var(--cm-ink)}',
    '.pips{display:flex;gap:12px;height:12px}',
    '.pip{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--cm-ink2);box-sizing:border-box}',
    '.pip.fill{background:var(--cm-warn);border-color:var(--cm-warn)}',
    '.pips.bad{animation:cmshake .3s}',
    '@keyframes cmshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
    '.pad{display:grid;grid-template-columns:repeat(3,58px);gap:8px}',
    '.pad button{height:44px;border-radius:10px;border:1px solid var(--cm-div);background:var(--cm-bg2);color:var(--cm-ink);font:500 16px inherit;font-family:inherit;cursor:pointer;transition:transform .12s ease}',
    '.pad button:active{transform:scale(.94)}',
    '.gate .hint{font-size:10.5px;color:var(--cm-ink2);opacity:.7}',
    '.loading{padding:20px 16px;color:var(--cm-ink2);font-size:12px}'
  ].join('\n');

  /* ---------- the card ---------- */

  class CardManagerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._mode = 'inspect';
      this._items = [];
      this._others = [];
      this._open = {};
      this._pin = '';
      this._built = false;
      this._relockTimer = null;
      this._unlocked = false;
      this._gateOpen = false;
    }

    setConfig(config) {
      this._cfg = {
        pin: config.pin != null ? String(config.pin) : null,
        relockMs: (Number(config.relock_minutes) > 0 ? Number(config.relock_minutes) : 5) * 60000
      };
    }

    set hass(h) {
      this._hass = h;
      if (!this._built && h) {
        this._built = true;
        this._build();
      }
    }

    getCardSize() { return 12; }

    _ws(msg) { return this._hass.connection.sendMessagePromise(msg); }

    /* ----- skeleton ----- */

    _build() {
      var root = this.shadowRoot;
      root.innerHTML = '<style>' + CSS + '</style>' +
        '<ha-card>' +
        '<div class="gate" id="gate" style="display:none">' +
        '<div class="lock">&#128274;</div>' +
        '<p><b>Update mode is locked.</b><br>Enter PIN to enable resource writes. Inspect stays read-only and open.</p>' +
        '<div class="pips" id="pips">' +
        new Array(Math.max(4, String(this._cfg.pin || '').length) + 1).join('<div class="pip"></div>') +
        '</div>' +
        '<div class="pad" id="pad"></div>' +
        '<button class="btn" data-act="gate-cancel">Cancel</button>' +
        '<div class="hint">PIN is a convenience lock, not security - admins can always edit resources in Settings.</div>' +
        '</div>' +
        '<div class="head">' +
        '<div class="glyph">&#128451;</div>' +
        '<div class="title"><b>Card Manager</b><span id="subtitle">loading&hellip;</span></div>' +
        '<div class="modes">' +
        '<button id="mInspect" class="on" data-act="mode" data-mode="inspect">Inspect</button>' +
        '<button id="mUpdate" class="upd" data-act="mode" data-mode="update">Update</button>' +
        '</div></div>' +
        '<div class="banner" id="banner"><div class="dot"></div><span id="bannerText"></span></div>' +
        '<div class="rows" id="rows"><div class="loading">Reading resource registry&hellip;</div></div>' +
        '<div id="createhost"></div>' +
        '<div class="sect" id="othersSect">' +
        '<div class="sect-head" data-act="toggle-others"><span id="othersLabel">Other resources</span><div class="line"></div><span>&#9656;</span></div>' +
        '<div class="others" id="othersList"></div>' +
        '</div>' +
        '<div class="toast" id="toast"></div>' +
        '</ha-card>';

      var pad = root.getElementById('pad');
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];
      pad.innerHTML = keys.map(function (k) {
        return k === '' ? '<span></span>' :
          '<button data-act="pin" data-key="' + k + '">' + k + '</button>';
      }).join('');

      root.addEventListener('click', this._onClick.bind(this));
      root.addEventListener('pointerdown', this._poke.bind(this));

      this._renderGate();
      this._setBanner();
      this._refresh();
    }

    /* ----- data ----- */

    _refresh() {
      var self = this;
      return this._ws({ type: 'lovelace/resources' }).then(function (list) {
        var items = [], others = [];
        (list || []).forEach(function (r) {
          var url = r.url || '';
          var meta = url.indexOf('data:') === 0 ? parseDataUrl(url) : null;
          if (meta && !meta.badB64) {
            items.push({
              id: r.id, type: r.type || r.res_type || 'module', url: url,
              label: meta.label, bytes: meta.bytes.length, hash: meta.hash,
              ver: meta.ver, hdrName: meta.hdrName,
              preview: meta.text.slice(0, 300),
              self: meta.label === CM_NAME
            });
          } else {
            others.push({ id: r.id, type: r.type || r.res_type || '?', url: url, bad: !!(meta && meta.badB64) });
          }
        });
        items.sort(function (a, b) { return a.label.localeCompare(b.label); });
        self._items = items;
        self._others = others;
        self._error = null;
        self._renderRows();
      }).catch(function (e) {
        self._error = (e && (e.message || e.code)) || 'websocket error';
        self._renderRows();
      });
    }

    /* ----- rendering ----- */

    _setBanner(kind, text) {
      var b = this.shadowRoot.getElementById('banner');
      var t = this.shadowRoot.getElementById('bannerText');
      b.classList.remove('warn', 'err');
      if (kind) b.classList.add(kind);
      if (text) { t.textContent = text; return; }
      if (this._mode === 'update') {
        b.classList.add('warn');
        t.textContent = 'Update mode - writes go through lovelace/resources/update on the exact resource ID. Backup download is forced before every write.';
      } else {
        t.textContent = 'Inspect mode - read-only. Headers decoded live from the resource registry.';
      }
    }

    _renderRows() {
      var root = this.shadowRoot;
      var rowsEl = root.getElementById('rows');
      var sub = root.getElementById('subtitle');
      if (this._error) {
        rowsEl.innerHTML = '<div class="loading">Could not read resources: ' + esc(this._error) +
          '. The lovelace/resources API is admin-only.</div>';
        sub.textContent = 'error';
        this._setBanner('err', 'Resource registry unavailable - are you logged in as an admin?');
        return;
      }
      var admin = this._hass && this._hass.user && this._hass.user.is_admin !== false;
      sub.textContent = this._items.length + ' managed cards - all blobs decoded OK';
      var self = this;
      rowsEl.innerHTML = this._items.map(function (it, i) { return self._rowHTML(it, i); }).join('') +
        (this._mode === 'update' ?
          '<div class="btnrow" style="padding:6px 8px 2px">' +
          '<button class="btn primary" data-act="open-create">Add new card&hellip;</button>' +
          '<span class="btn-note">brand-new resource - existing cards update via their row</span></div>' : '');
      var others = root.getElementById('othersList');
      root.getElementById('othersLabel').textContent =
        'Other resources - HACS-managed, read-only (' + this._others.length + ')';
      others.innerHTML = this._others.map(function (o) {
        return esc(o.url.length > 70 ? o.url.slice(0, 70) + '\u2026' : o.url) +
          ' <i>' + esc(String(o.id).slice(0, 8)) + (o.bad ? ' [bad base64]' : '') + '</i>';
      }).join('<br>');
      if (!admin) this._setBanner('err', 'This user is not an admin - resource writes will be rejected by HA.');
    }

    _rowHTML(it, i) {
      var swatch = SWATCHES[i % SWATCHES.length];
      var open = this._open[it.id] ? ' open' : '';
      var selftag = it.self ? '<span class="selftag">SELF</span>' : '';
      var hdrOK = it.hdrName === it.label ? 'decodes OK - name= label matches header name'
        : 'header name (' + esc(it.hdrName || 'none') + ') does NOT match label';
      var updBtn = '';
      if (this._mode === 'update') {
        updBtn = '<button class="btn primary" data-act="open-flow" data-id="' + esc(it.id) + '">Update this card&hellip;</button>' +
          (it.self ? '<span class="btn-note">SELF - extra confirmation required</span>' : '');
      }
      return '<div class="row' + open + '" data-rowid="' + esc(it.id) + '">' +
        '<div class="row-line" data-act="toggle-row" data-id="' + esc(it.id) + '">' +
        '<div class="swatch" style="background:' + swatch + '"></div>' +
        '<div class="r-id"><b>' + esc(it.label) + selftag + '</b>' +
        '<span>' + fmtKB(it.bytes) + ' &middot; ' + esc(it.type) + ' &middot; data-URL</span></div>' +
        '<div class="r-meta"><div class="ver">' + (it.ver ? 'v' + esc(it.ver) : '?') + '</div>' +
        '<div class="hash">' + esc(it.hash) + '</div></div>' +
        '<div class="chev">&#9656;</div></div>' +
        '<div class="detail">' +
        '<dl class="kv">' +
        '<dt>resource id</dt><dd>' + esc(it.id) + '</dd>' +
        '<dt>FNV-1a</dt><dd>' + esc(it.hash) + '</dd>' +
        '<dt>decoded size</dt><dd>' + it.bytes.toLocaleString() + ' bytes</dd>' +
        '<dt>header</dt><dd>' + hdrOK + '</dd>' +
        '</dl>' +
        '<div class="hdrprev">' + esc(it.preview) + '&hellip;</div>' +
        '<div class="btnrow">' +
        '<button class="btn" data-act="verify" data-id="' + esc(it.id) + '">Verify hash</button>' +
        '<button class="btn" data-act="download" data-id="' + esc(it.id) + '">Download blob</button>' +
        updBtn +
        '</div>' +
        '<div class="flowhost" id="flow-' + esc(it.id) + '">' +
        (this._flowResult && this._flowResult.id === it.id ? this._flowResult.html : '') +
        '</div>' +
        '</div></div>';
    }

    /* ----- interactions ----- */

    _onClick(e) {
      var el = e.composedPath()[0];
      var act = null, node = el;
      while (node && node !== this.shadowRoot) {
        if (node.dataset && node.dataset.act) { act = node.dataset.act; break; }
        node = node.parentNode || node.host;
      }
      if (!act) return;
      var id = node.dataset.id;
      var it = this._items.find(function (x) { return x.id === id; });
      switch (act) {
        case 'pin': this._pinKey(node.dataset.key); break;
        case 'gate-cancel':
          this._gateOpen = false; this._pin = ''; this._renderGate(); break;
        case 'mode': this._requestMode(node.dataset.mode); break;
        case 'toggle-others':
          this.shadowRoot.getElementById('othersSect').classList.toggle('open'); break;
        case 'toggle-row':
          this._open[id] = !this._open[id];
          this._renderRows(); break;
        case 'verify': if (it) this._verify(it); break;
        case 'download':
          if (it) {
            download(it.label + '_v' + (it.ver || 'unk') + '_' + it.hash + '.txt', it.url);
            this._toast('Downloaded ' + it.label + ' blob (' + fmtKB(it.url.length) + ' data: URL).');
          }
          break;
        case 'open-flow': if (it) this._openFlow(it); break;
        case 'open-create': this._openCreate(); break;
        case 'validate-new': this._validateNew(); break;
        case 'cancel-create':
          this._pendingNew = null;
          this.shadowRoot.getElementById('createhost').innerHTML = '';
          break;
        case 'confirm-create': this._confirmCreate(); break;
        case 'validate': if (it) this._validate(it); break;
        case 'cancel-flow':
          if (it) { this._flowHost(it).innerHTML = ''; this._pending = null; }
          break;
        case 'confirm-write': if (it) this._confirmWrite(it); break;
      }
    }

    _requestMode(m) {
      if (m === 'update' && this._cfg.pin && !this._unlocked) {
        this._gateOpen = true;
        this._renderGate();
        return;
      }
      this._setMode(m);
    }

    _setMode(m) {
      this._mode = m;
      this.shadowRoot.getElementById('mInspect').classList.toggle('on', m === 'inspect');
      this.shadowRoot.getElementById('mUpdate').classList.toggle('on', m === 'update');
      this._pending = null;
      this._pendingNew = null;
      this._flowResult = null;
      if (this.shadowRoot.getElementById('createhost'))
        this.shadowRoot.getElementById('createhost').innerHTML = '';
      this._setBanner();
      this._renderRows();
    }

    _verify(it) {
      var self = this;
      this._ws({ type: 'lovelace/resources' }).then(function (list) {
        var live = (list || []).find(function (r) { return r.id === it.id; });
        if (!live) { self._toast('Resource ' + it.label + ' not found in registry!'); return; }
        var meta = parseDataUrl(live.url || '');
        if (!meta || meta.badB64) { self._toast(it.label + ': live blob no longer decodes!'); return; }
        var same = meta.hash === it.hash;
        self._toast(it.label + ': live FNV-1a ' + meta.hash + (same ?
          ' - matches this view.' : ' - CHANGED since this view (was ' + it.hash + '). Refreshing.'));
        if (!same) self._refresh();
      }).catch(function (e) { self._toast('Verify failed: ' + ((e && e.message) || 'ws error')); });
    }

    /* ----- update flow ----- */

    _flowHost(it) { return this.shadowRoot.getElementById('flow-' + it.id); }

    _openFlow(it) {
      this._open[it.id] = true;
      this._flowResult = null;
      this._renderRows();
      var selfWarn = it.self ?
        '<div class="stepnote err">SELF-UPDATE: a bad write here breaks the manager itself. ' +
        'Recovery = manual paste at Settings &gt; Dashboards &gt; Resources. ' +
        'You will be asked to type the card name to confirm.</div>' : '';
      this._flowHost(it).innerHTML =
        '<div class="updflow"><h4>Update ' + esc(it.label) + '</h4>' + selfWarn +
        '<textarea class="paste" id="paste-' + esc(it.id) + '" placeholder="Paste the full replacement data:text/javascript;name=' + esc(it.label) + ';base64,... URL here"></textarea>' +
        '<div class="btnrow" style="margin-top:8px">' +
        '<button class="btn" data-act="validate" data-id="' + esc(it.id) + '">Validate</button>' +
        '<button class="btn" data-act="cancel-flow" data-id="' + esc(it.id) + '">Cancel</button>' +
        '</div><div id="val-' + esc(it.id) + '"></div></div>';
    }

    _validate(it) {
      var host = this.shadowRoot.getElementById('val-' + it.id);
      var raw = (this.shadowRoot.getElementById('paste-' + it.id).value || '').trim();
      this._pending = null;
      if (!raw) { host.innerHTML = '<div class="stepnote err">Nothing pasted.</div>'; return; }
      var checks = [];
      function li(st, txt) { checks.push('<li><span class="st ' + st + '">' + (st === 'ok' ? '&#10003;' : st === 'err' ? '&#10007;' : st === 'warn' ? '!' : '&middot;') + '</span> ' + txt + '</li>'); }

      var meta = parseDataUrl(raw);
      if (!meta) {
        li('err', 'Not a valid <span style="font-family:monospace">data:text/javascript;name=&hellip;;base64,&hellip;</span> URL.');
        host.innerHTML = '<ul class="checks">' + checks.join('') + '</ul>' +
          '<div class="stepnote err">Write blocked - nothing was sent to HA.</div>';
        return;
      }
      if (meta.badB64) {
        li('err', 'base64 payload does not decode.');
        host.innerHTML = '<ul class="checks">' + checks.join('') + '</ul>' +
          '<div class="stepnote err">Write blocked - nothing was sent to HA.</div>';
        return;
      }
      li('ok', 'data: URL parses; base64 decodes cleanly (' + meta.bytes.length.toLocaleString() + ' bytes)');

      var fail = false;
      if (meta.label !== it.label) {
        li('err', '<b>name mismatch:</b> pasted blob is <span style="font-family:monospace">' + esc(meta.label) + '</span>, this row is <span style="font-family:monospace">' + esc(it.label) + '</span>');
        fail = true;
      } else {
        li('ok', 'name= label matches this row (<span style="font-family:monospace">' + esc(it.label) + '</span>)');
      }
      if (!fail) {
        if (meta.hdrName !== it.label) {
          li('err', 'header self-identifies as <span style="font-family:monospace">' + esc(meta.hdrName || 'nothing') + '</span> - expected ' + esc(it.label));
          fail = true;
        } else {
          li('ok', 'header self-identifies as ' + esc(it.label) + (meta.ver ? ' v' + esc(meta.ver) : ''));
        }
      }
      if (!fail) {
        if (meta.nonAscii > 0) li('warn', meta.nonAscii + ' non-ASCII byte(s) in source (house rule: strings must be ASCII-safe; comments may pass)');
        else li('ok', 'ASCII-safe (no bytes &gt; 127)');
        if (meta.hash === it.hash) li('warn', 'new blob is byte-identical to the current one (hash ' + esc(it.hash) + ')');
      }

      if (fail) {
        host.innerHTML = '<ul class="checks">' + checks.join('') + '</ul>' +
          '<div class="stepnote err">Write blocked. This is the exact mistake the manager exists to prevent - nothing was sent to HA.</div>';
        return;
      }

      this._pending = { id: it.id, meta: meta };
      var confirmInput = it.self ?
        '<input class="confirm" id="selfconf-' + esc(it.id) + '" placeholder="Type ' + esc(it.label) + ' to allow self-update" autocomplete="off">' : '';
      host.innerHTML =
        '<ul class="checks">' + checks.join('') + '</ul>' +
        '<div class="diff">' +
        '<div class="old">' + (it.ver ? 'v' + esc(it.ver) : '?') + ' &middot; ' + fmtKB(it.bytes) + '</div><div class="arr">&rarr;</div>' +
        '<div class="new">' + (meta.ver ? 'v' + esc(meta.ver) : '?') + ' &middot; ' + fmtKB(meta.bytes.length) + '</div>' +
        '<div class="old mono">' + esc(it.hash) + '</div><div class="arr">&rarr;</div><div class="new mono">' + esc(meta.hash) + '</div>' +
        '</div>' +
        '<div class="stepnote"><span class="n">1</span> Backup: downloads ' + esc(it.label) + '_v' + esc(it.ver || 'unk') + '_' + esc(it.hash) + '.txt (current blob) - forced, happens on confirm.</div>' +
        '<div class="stepnote"><span class="n">2</span> Write: lovelace/resources/update &rarr; resource ' + esc(String(it.id).slice(0, 8)) + '&hellip; (by ID, not by position).</div>' +
        '<div class="stepnote"><span class="n">3</span> Verify: re-read registry, re-decode, recompute FNV-1a, compare to pasted blob.</div>' +
        confirmInput +
        '<div class="btnrow" style="margin-top:10px">' +
        '<button class="btn primary" data-act="confirm-write" data-id="' + esc(it.id) + '">Backup + write ' + (meta.ver ? 'v' + esc(meta.ver) : '') + '</button>' +
        '<button class="btn" data-act="cancel-flow" data-id="' + esc(it.id) + '">Cancel</button>' +
        '</div>';
    }

    _confirmWrite(it) {
      var self = this;
      var host = this.shadowRoot.getElementById('val-' + it.id);
      if (!this._pending || this._pending.id !== it.id) {
        this._toast('Stale flow - re-validate first.'); return;
      }
      if (it.self) {
        var inp = this.shadowRoot.getElementById('selfconf-' + it.id);
        if (!inp || inp.value.trim() !== it.label) {
          this._toast('Self-update requires typing "' + it.label + '" exactly.');
          if (inp) inp.focus();
          return;
        }
      }
      var meta = this._pending.meta;
      /* step 1: forced backup of the OUTGOING blob */
      download(it.label + '_v' + (it.ver || 'unk') + '_' + it.hash + '.txt', it.url);
      /* step 2: write by resource id */
      this._ws({
        type: 'lovelace/resources/update',
        resource_id: it.id,
        res_type: 'module',
        url: meta.url
      }).then(function () {
        /* step 3: verify */
        return self._ws({ type: 'lovelace/resources' });
      }).then(function (list) {
        var live = (list || []).find(function (r) { return r.id === it.id; });
        var liveMeta = live ? parseDataUrl(live.url || '') : null;
        var ok = liveMeta && !liveMeta.badB64 && liveMeta.hash === meta.hash;
        var note;
        if (ok) {
          note = '<div class="stepnote ok">&#10003; ' +
            (meta.ver ? 'v' + esc(meta.ver) : 'new blob') +
            ' written and verified (FNV-1a ' + esc(meta.hash) + '). Hard-refresh the frontend to load it' +
            (it.self ? ' - this manager included.' : '.') + '</div>';
          self._toast('Backed up ' + (it.ver ? 'v' + it.ver : 'old blob') + ', wrote and verified ' + (meta.ver ? 'v' + meta.ver : 'new blob') + '.');
        } else {
          note = '<div class="stepnote err">&#10007; Post-write verification FAILED - registry does not match the pasted blob. ' +
            'Check Settings &gt; Dashboards &gt; Resources before touching anything else. Your backup download has the previous blob.</div>';
          self._toast('Verification failed - see row for details.');
        }
        host.innerHTML = note;
        self._flowResult = { id: it.id, html: note };
        self._pending = null;
        self._refresh();
      }).catch(function (e) {
        host.innerHTML = '<div class="stepnote err">&#10007; Write failed: ' + esc((e && (e.message || e.code)) || 'websocket error') +
          '. Nothing verified - the registry may be unchanged. Your backup download has the previous blob.</div>';
        self._toast('Write failed.');
      });
    }

    /* ----- create flow (new resources) ----- */

    _openCreate() {
      this._pendingNew = null;
      this.shadowRoot.getElementById('createhost').innerHTML =
        '<div class="updflow" style="margin:2px 16px 12px"><h4>Add new card resource</h4>' +
        '<div class="stepnote">For a BRAND-NEW card only. Updating an existing card happens on its row - a duplicate label is blocked here.</div>' +
        '<textarea class="paste" id="paste-new" placeholder="Paste the full data:text/javascript;name=<new-card>;base64,... URL here"></textarea>' +
        '<div class="btnrow" style="margin-top:8px">' +
        '<button class="btn" data-act="validate-new">Validate</button>' +
        '<button class="btn" data-act="cancel-create">Cancel</button>' +
        '</div><div id="val-new"></div></div>';
    }

    _validateNew() {
      var host = this.shadowRoot.getElementById('val-new');
      var raw = (this.shadowRoot.getElementById('paste-new').value || '').trim();
      this._pendingNew = null;
      if (!raw) { host.innerHTML = '<div class="stepnote err">Nothing pasted.</div>'; return; }
      var checks = [];
      function li(st, txt) { checks.push('<li><span class="st ' + st + '">' + (st === 'ok' ? '&#10003;' : st === 'err' ? '&#10007;' : st === 'warn' ? '!' : '&middot;') + '</span> ' + txt + '</li>'); }
      function blocked() {
        host.innerHTML = '<ul class="checks">' + checks.join('') + '</ul>' +
          '<div class="stepnote err">Create blocked - nothing was sent to HA.</div>';
      }
      var meta = parseDataUrl(raw);
      if (!meta) {
        li('err', 'Not a valid <span style="font-family:monospace">data:text/javascript;name=&hellip;;base64,&hellip;</span> URL.');
        blocked(); return;
      }
      if (meta.badB64) { li('err', 'base64 payload does not decode.'); blocked(); return; }
      li('ok', 'data: URL parses; base64 decodes cleanly (' + meta.bytes.length.toLocaleString() + ' bytes)');
      var existing = this._items.find(function (x) { return x.label === meta.label; });
      if (existing) {
        li('err', '<b>label already exists:</b> <span style="font-family:monospace">' + esc(meta.label) + '</span> is resource ' + esc(String(existing.id).slice(0, 8)) + '&hellip; - if this is a new version, use that row&apos;s Update flow instead');
        blocked(); return;
      }
      li('ok', 'label <span style="font-family:monospace">' + esc(meta.label) + '</span> is new (no duplicate)');
      if (meta.hdrName !== meta.label) {
        li('err', 'header self-identifies as <span style="font-family:monospace">' + esc(meta.hdrName || 'nothing') + '</span> - expected ' + esc(meta.label));
        blocked(); return;
      }
      li('ok', 'header self-identifies as ' + esc(meta.label) + (meta.ver ? ' v' + esc(meta.ver) : ''));
      if (meta.nonAscii > 0) li('warn', meta.nonAscii + ' non-ASCII byte(s) in source (house rule: strings must be ASCII-safe; comments may pass)');
      else li('ok', 'ASCII-safe (no bytes &gt; 127)');

      this._pendingNew = { meta: meta };
      host.innerHTML =
        '<ul class="checks">' + checks.join('') + '</ul>' +
        '<div class="diff">' +
        '<div class="old">(nothing)</div><div class="arr">&rarr;</div>' +
        '<div class="new">' + esc(meta.label) + ' ' + (meta.ver ? 'v' + esc(meta.ver) : '') + ' &middot; ' + fmtKB(meta.bytes.length) + '</div>' +
        '<div class="old mono">-</div><div class="arr">&rarr;</div><div class="new mono">' + esc(meta.hash) + '</div>' +
        '</div>' +
        '<div class="stepnote"><span class="n">1</span> Create: lovelace/resources/create (type module). Nothing existing is touched - no backup step.</div>' +
        '<div class="stepnote"><span class="n">2</span> Verify: re-read registry, find the new entry, re-decode, compare hash.</div>' +
        '<div class="stepnote"><span class="n">3</span> The new resource_id appears below - record it in the inventory notes.</div>' +
        '<div class="btnrow" style="margin-top:10px">' +
        '<button class="btn primary" data-act="confirm-create">Create ' + esc(meta.label) + '</button>' +
        '<button class="btn" data-act="cancel-create">Cancel</button>' +
        '</div>';
    }

    _confirmCreate() {
      var self = this;
      var host = this.shadowRoot.getElementById('val-new');
      if (!this._pendingNew) { this._toast('Stale flow - re-validate first.'); return; }
      var meta = this._pendingNew.meta;
      this._ws({
        type: 'lovelace/resources/create',
        res_type: 'module',
        url: meta.url
      }).then(function () {
        return self._ws({ type: 'lovelace/resources' });
      }).then(function (list) {
        var live = (list || []).find(function (r) {
          var m = (r.url || '').indexOf('data:') === 0 ? parseDataUrl(r.url) : null;
          return m && !m.badB64 && m.label === meta.label;
        });
        var liveMeta = live ? parseDataUrl(live.url) : null;
        var ok = liveMeta && liveMeta.hash === meta.hash;
        if (ok) {
          host.innerHTML = '<div class="stepnote ok">&#10003; ' + esc(meta.label) +
            (meta.ver ? ' v' + esc(meta.ver) : '') + ' created and verified (FNV-1a ' + esc(meta.hash) +
            ').<br>New resource_id: <span style="font-family:monospace">' + esc(live.id) + '</span> - record it in the notes.' +
            '<br>Hard-refresh, then add the card to a dashboard with its <span style="font-family:monospace">type: custom:' + esc(meta.label) + '</span> YAML.</div>';
          self._toast('Created ' + meta.label + ' (' + String(live.id).slice(0, 8) + '\u2026).');
        } else {
          host.innerHTML = '<div class="stepnote err">&#10007; Post-create verification FAILED - could not find a matching entry in the registry. Check Settings &gt; Dashboards &gt; Resources before retrying (a half-created entry may exist).</div>';
          self._toast('Verification failed - see panel.');
        }
        self._pendingNew = null;
        self._refresh();
      }).catch(function (e) {
        host.innerHTML = '<div class="stepnote err">&#10007; Create failed: ' + esc((e && (e.message || e.code)) || 'websocket error') + '. The registry may be unchanged.</div>';
        self._toast('Create failed.');
      });
    }

    /* ----- PIN gate ----- */

    _renderGate() {
      var g = this.shadowRoot.getElementById('gate');
      g.style.display = this._gateOpen ? 'flex' : 'none';
      if (this._gateOpen) {
        this._pin = '';
        this._paintPips();
      }
    }

    _paintPips() {
      var pips = this.shadowRoot.querySelectorAll('.pip');
      for (var i = 0; i < pips.length; i++) pips[i].classList.toggle('fill', i < this._pin.length);
    }

    _pinKey(k) {
      if (k === 'DEL') this._pin = this._pin.slice(0, -1);
      else if (this._pin.length < String(this._cfg.pin || '').length || this._pin.length < 4) this._pin += k;
      this._paintPips();
      var want = String(this._cfg.pin || '');
      if (this._pin.length >= Math.max(want.length, 4)) {
        if (this._pin === want) {
          this._unlocked = true;
          this._gateOpen = false;
          this._renderGate();
          this._toast('Update mode unlocked. Re-locks to Inspect after ' + (this._cfg.relockMs / 60000) + ' min idle.');
          this._setMode('update');
          this._poke();
        } else {
          var pips = this.shadowRoot.getElementById('pips');
          pips.classList.add('bad');
          var self = this;
          setTimeout(function () { pips.classList.remove('bad'); self._pin = ''; self._paintPips(); }, 320);
        }
      }
    }

    _poke() {
      if (!this._cfg || !this._cfg.pin || !this._unlocked) return;
      var self = this;
      clearTimeout(this._relockTimer);
      this._relockTimer = setTimeout(function () {
        self._unlocked = false;
        self._gateOpen = false;
        self._pending = null;
        self._setMode('inspect');
        self._renderGate();
        self._toast('Update mode re-locked after idle.');
      }, this._cfg.relockMs);
    }

    /* ----- toast ----- */

    _toast(msg) {
      var t = this.shadowRoot.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4200);
    }

    disconnectedCallback() {
      clearTimeout(this._relockTimer);
      clearTimeout(this._toastTimer);
    }
  }

  if (!customElements.get(CM_NAME)) customElements.define(CM_NAME, CardManagerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CM_NAME,
    name: 'Card Manager Card',
    description: 'Admin manager for data-URL custom-card resources (v' + CM_VER + ')'
  });
})();
