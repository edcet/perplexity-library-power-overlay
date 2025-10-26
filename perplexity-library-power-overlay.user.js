// ==UserScript==
// @name         Perplexity Library Power Overlay
// @namespace    https://github.com/edcet/perplexity-library-power-overlay
// @version      2.0.0
// @description  Overlay dashboard for Perplexity threads: scrape, analyze, export (XLSX), grid views, kanban, diagrams, and more.
// @author       OSS Collective
// @match        https://www.perplexity.ai/*
// @icon         https://www.perplexity.ai/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const CDN = {
    agGrid: 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.3.3/dist/ag-grid-community.min.js',
    agGridCss: 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.3.3/styles/ag-grid.css',
    agGridTheme: 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.3.3/styles/ag-theme-alpine.css',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js',
    gridstack: 'https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-h5.js',
    gridstackCss: 'https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css',
    sortable: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js'
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      if (c instanceof Node) e.appendChild(c); else e.insertAdjacentHTML('beforeend', c);
    });
    return e;
  };

  const KV = {
    get(key, def) { try { const v = GM_getValue(key); return v === undefined ? def : v; } catch { return def; } },
    set(key, val) { try { GM_setValue(key, val); } catch {} },
    del(key) { try { GM_deleteValue(key); } catch {} },
    keys() { try { return GM_listValues(); } catch { return []; } }
  };

  const STORE = { settings: 'plpo_settings', threads: 'plpo_threads' };
  const DEFAULT_SETTINGS = { hotkey: 'Ctrl+Shift+L', theme: 'light', gridTheme: 'ag-theme-alpine' };

  function initSettings() { if (!KV.get(STORE.settings, null)) KV.set(STORE.settings, DEFAULT_SETTINGS); }

  function injectCssUrl(href) { if (!document.querySelector(`link[data-plpo="${href}"]`)) document.head.appendChild(el('link', { rel: 'stylesheet', href, 'data-plpo': href })); }
  async function loadScript(src, test) {
    if (test && test()) return;
    if (document.querySelector(`script[data-plpo="${src}"]`)) { for (let i=0;i<200;i++){ if(test&&test()) return; await sleep(50);} return; }
    document.head.appendChild(el('script', { src, 'data-plpo': src }));
    for (let i=0;i<200;i++){ if(test&&test()) return; await sleep(50);} console.warn('PLPO timeout', src);
  }
  async function ensureDeps() {
    injectCssUrl(CDN.agGridCss); injectCssUrl(CDN.agGridTheme); injectCssUrl(CDN.gridstackCss);
    await Promise.all([
      loadScript(CDN.agGrid, () => window.agGrid?.Grid),
      loadScript(CDN.xlsx, () => window.XLSX),
      loadScript(CDN.gridstack, () => window.GridStack),
      loadScript(CDN.sortable, () => window.Sortable),
      loadScript(CDN.mermaid, () => window.mermaid)
    ]);
    try { window.mermaid?.initialize?.({ startOnLoad: false, theme: 'base' }); } catch {}
  }

  function scrapeCurrentThread() {
    const messages = [];
    const containers = document.querySelectorAll('[data-message], [data-testid="chat-message"], article');
    containers.forEach((node, i) => {
      const role = node.getAttribute('data-role') || node.getAttribute('data-author') || (node.matches('[data-message]') ? (node.getAttribute('data-message')?.includes('answer') ? 'assistant' : 'user') : 'unknown');
      const text = (node.innerText || '').trim().replace(/\s+/g, ' ');
      if (text) messages.push({ role, text, idx: i + 1 });
    });
    return { id: Date.now(), createdAt: new Date().toISOString(), url: location.href, messages };
  }

  function exportThreadsToXLSX(threads) {
    const rows = [];
    threads.forEach(t => (t.messages||[]).forEach(m => rows.push({ ThreadID: t.id, CreatedAt: t.createdAt, URL: t.url, Index: m.idx, Role: m.role, Text: m.text })));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Threads');
    XLSX.writeFile(wb, `perplexity_threads_${new Date().toISOString().replace(/[:.]/g,'-')}.xlsx`);
  }

  const CSS = `
  .plpo-root { position: fixed; right:12px; bottom:12px; width:min(1200px,92vw); height:70vh; z-index:2147483647; box-shadow:0 8px 30px rgba(0,0,0,.25); border-radius:10px; overflow:hidden; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
  .plpo-root.light { background:#fff; color:#0f172a; border:1px solid #e5e7eb; }
  .plpo-root.dark { background:#0b1220; color:#e5e7eb; border:1px solid #1f2937; }
  .plpo-header { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.08); }
  .plpo-header .title { font-weight:700; }
  .plpo-actions { margin-left:auto; display:flex; gap:8px; }
  .plpo-btn { background:#0ea5e9; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-weight:600; cursor:pointer; }
  .plpo-btn.secondary { background:#334155; color:#e2e8f0; }
  .plpo-btn.ghost { background:transparent; color:inherit; border:1px solid currentColor; }
  .plpo-hidden { display:none !important; }
  .plpo-content { display:flex; height: calc(100% - 92px); }
  .plpo-section { padding:10px; height:100%; overflow:auto; }
  .plpo-grid { height:100%; }
  .ag-theme-alpine { --ag-font-size:12px; --ag-grid-size:4px; }
  .plpo-kanban { display:flex; gap:12px; align-items:flex-start; }
  .plpo-column { background: rgba(148,163,184,.1); padding:8px; border-radius:8px; min-width:220px; }
  .plpo-card { background:#fff; color:#0f172a; border:1px solid #e2e8f0; border-radius:8px; padding:8px; margin:6px 0; }
  .plpo-footer { display:flex; gap:8px; padding:10px 12px; border-top:1px solid rgba(0,0,0,.08); }
  .plpo-min { position:absolute; right:10px; top:10px; width:28px; height:28px; border-radius:8px; line-height:28px; text-align:center; background:transparent; border:1px solid currentColor; cursor:pointer; }
  .plpo-gridstack { height:100%; }
  .plpo-mermaid { background: rgba(148,163,184,.08); border-radius:8px; padding:8px; }
  `;
  function injectCss() { GM_addStyle(CSS); }

  function buildOverlay() {
    const settings = KV.get(STORE.settings, DEFAULT_SETTINGS);
    const root = el('div', { class: `plpo-root ${settings.theme} ${settings.gridTheme} ag-theme-alpine` });
    root.innerHTML = `
      <div class="plpo-header">
        <div class="title">Perplexity Library Power Overlay</div>
        <div class="plpo-actions">
          <button class="plpo-btn" data-action="scrape">Scrape</button>
          <button class="plpo-btn secondary" data-action="export">Export XLSX</button>
          <button class="plpo-btn ghost" data-action="min">Min</button>
          <button class="plpo-btn ghost" data-action="close">Close</button>
        </div>
      </div>
      <div class="plpo-content">
        <div class="plpo-section" data-panel="dashboard"></div>
      </div>
      <div class="plpo-footer">
        <span>Hotkey: ${settings.hotkey}</span>
      </div>`;
    return root;
  }

  function mountDashboard(container) {
    container.innerHTML = '';
    const gridWrap = el('div', { class: 'plpo-section' }, [
      '<h3>Dashboard</h3>',
      '<div class="grid-stack plpo-gridstack"></div>'
    ]);
    container.appendChild(gridWrap);

    const gridEl = gridWrap.querySelector('.grid-stack');
    const gs = window.GridStack.init({ cellHeight: 80, float: true, disableOneColumnMode: true, resizable: { handles: 'se,sw' } }, gridEl);

    const widgets = [
      { w: 6, h: 4, content: '<div class="ag-theme-alpine plpo-grid" style="height:100%" id="plpo-thread-grid"></div>' },
      { w: 3, h: 4, content: '<div class="plpo-kanban" id="plpo-kanban"></div>' },
      { w: 3, h: 4, content: '<pre class="plpo-mermaid" id="plpo-mermaid">flowchart TD\n  A[Thread] --> B{Analyze}\n  B -->|Export| C[Excel]\n  B -->|Visualize| D[Mermaid]\n</pre>' },
    ];

    widgets.forEach(w => {
      const n = el('div', { 'gs-w': w.w, 'gs-h': w.h });
      const content = el('div', { class: 'plpo-card', style: { height: '100%' } }, w.content);
      n.appendChild(content);
      gs.addWidget(n);
    });

    try { window.mermaid?.run?.({ nodes: [gridEl.querySelector('#plpo-mermaid')] }); } catch {}

    const threadGridDiv = gridEl.querySelector('#plpo-thread-grid');
    const threadCols = [
      { headerName: '#', valueGetter: p => p.node.rowIndex + 1, width: 70 },
      { headerName: 'Role', field: 'role', width: 100 },
      { headerName: 'Text', field: 'text', flex: 1 },
    ];
    const activeThread = scrapeCurrentThread();
    const threadGridOptions = { columnDefs: threadCols, rowData: activeThread.messages, defaultColDef: { resizable: true, sortable: true, filter: true } };
    new agGrid.Grid(threadGridDiv, threadGridOptions);

    const kanban = gridEl.querySelector('#plpo-kanban');
    const lanes = ['To Review', 'Insights', 'Follow-ups'];
    lanes.forEach(l => kanban.appendChild(el('div', { class: 'plpo-column' }, [`<h4>${l}</h4>`, '<div class="lane"></div>'])));
    const laneEls = kanban.querySelectorAll('.lane');
    laneEls.forEach(le => { le.appendChild(el('div', { class: 'plpo-card' }, 'Drop messages here')); Sortable.create(le, { group: 'plpo', animation: 150 }); });
    activeThread.messages.slice(0, 6).forEach(m => laneEls[0].appendChild(el('div', { class: 'plpo-card' }, `${m.role}: ${m.text.slice(0,140)}${m.text.length>140?'…':''}`)));

    const footer = container.closest('.plpo-root').querySelector('.plpo-footer');
    footer.querySelector('[data-action="scrape"]').onclick = () => {
      const t = scrapeCurrentThread();
      KV.set(STORE.threads, [...KV.get(STORE.threads, []), t]);
      threadGridOptions.api.setRowData(t.messages);
    };
    footer.querySelector('[data-action="export"]').onclick = () => {
      const selected = KV.get(STORE.threads, []);
      exportThreadsToXLSX(selected.length ? selected : [activeThread]);
    };
    footer.querySelector('[data-action="min"]').onclick = () => {
      const root = container.closest('.plpo-root');
      root.style.height = root.style.height === '44px' ? '70vh' : '44px';
      root.querySelector('.plpo-content').classList.toggle('plpo-hidden');
      root.querySelector('.plpo-footer').classList.toggle('plpo-hidden');
    };
    footer.querySelector('[data-action="close"]').onclick = () => container.closest('.plpo-root')?.remove();
  }

  function parseHotkey(combo) {
    const c = combo.toLowerCase().split('+');
    return { alt: c.includes('alt'), ctrl: c.includes('ctrl') || c.includes('control'), shift: c.includes('shift'), key: c.find(x => !['alt','ctrl','control','shift'].includes(x)) };
  }
  function installHotkey() {
    const hk = KV.get(STORE.settings, DEFAULT_SETTINGS).hotkey || DEFAULT_SETTINGS.hotkey;
    const spec = parseHotkey(hk);
    window.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      if (!!spec.alt !== e.altKey) return;
      if (!!spec.ctrl !== (e.ctrlKey || e.metaKey)) return;
      if (!!spec.shift !== e.shiftKey) return;
      if (key !== spec.key?.toLowerCase()) return;
      e.preventDefault();
      const existing = document.querySelector('.plpo-root');
      if (existing) existing.remove(); else mountOverlay();
    }, true);
  }

  function mountOverlay() {
    const settings = KV.get(STORE.settings, DEFAULT_SETTINGS);
    const root = buildOverlay();
    injectCss();
    ensureDeps().then(() => {
      document.body.appendChild(root);
      mountDashboard(root.querySelector('[data-panel="dashboard"]'));
    });
  }

  initSettings();
  installHotkey();
})();
