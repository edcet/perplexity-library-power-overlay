// ==UserScript==
// @name         Perplexity Library Power Overlay
// @namespace    https://github.com/edcet/perplexity-library-power-overlay
// @version      2.0.1
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
  function injectCssUrl(href) {
    if (!document.querySelector(`link[data-plpo="${href}"]`)) document.head.appendChild(el('link', { rel: 'stylesheet', href, 'data-plpo': href }));
  }
  async function loadScript(src, test) {
    if (test && test()) return;
    if (document.querySelector(`script[data-plpo="${src}"]`)) { for (let i=0;i<200;i++){ if (test&&test()) return; await sleep(50);} return; }
    document.head.appendChild(el('script', { src, 'data-plpo': src }));
    for (let i=0;i<200;i++){ if (test&&test()) return; await sleep(50);} console.warn('PLPO timeout', src);
  }
  async function ensureDeps() {
    injectCssUrl(CDN.agGridCss); injectCssUrl(CDN.agGridTheme); injectCssUrl(CDN.gridstackCss);
    await Promise.all([
      loadScript(CDN.agGrid, () => window.agGrid),
      loadScript(CDN.xlsx, () => window.XLSX),
      loadScript(CDN.gridstack, () => window.GridStack),
      loadScript(CDN.sortable, () => window.Sortable),
      loadScript(CDN.mermaid, () => window.mermaid),
    ]);
  }
  function injectCss() {
    GM_addStyle(`
      .plpo-root{position:fixed;bottom:12px;right:12px;width:860px;height:70vh;z-index:999999;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden}
      .plpo-root.dark{background:#0f1115;color:#eaeef2;border-color:#2a2f3a}
      .plpo-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #eee;background:#fafbfc}
      .plpo-header .plpo-actions button{margin-left:6px}
      .plpo-content{flex:1;display:flex;gap:8px;padding:8px}
      .plpo-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px;border-top:1px solid #eee}
      .plpo-hidden{display:none}
    `);
  }
  function buildOverlay() {
    const root = el('div', { class: 'plpo-root', 'data-plpo-root': '1' }, [
      el('div', { class: 'plpo-header' }, [
        '<strong>Perplexity Library Power Overlay</strong>',
        el('div', { class: 'plpo-actions' }, [
          '<button data-action="scrape">Scrape</button>',
          '<button data-action="export">Export XLSX</button>',
          '<button data-action="min">Min</button>',
          '<button data-action="close">Close</button>'
        ])
      ]),
      el('div', { class: 'plpo-content' }, [
        '<div id="plpo-dashboard" data-panel="dashboard" style="flex:1"></div>'
      ]),
      el('div', { class: 'plpo-footer' }, [
        '<span style="opacity:.7">Tip: Use Ctrl+Shift+L to toggle</span>'
      ])
    ]);
    return root;
  }
  function scrapeCurrentThread(){
    const msgs=[...document.querySelectorAll('[data-message-id]')].map(n=>({role:n.querySelector('[data-author]')?.textContent?.trim()||'role',text:n.textContent?.trim()||''}));
    return { messages: msgs };
  }
  function exportThreadsToXLSX(threads){ if(!window.XLSX) return; const wb = XLSX.utils.book_new(); threads.forEach((t,i)=>{ const ws = XLSX.utils.json_to_sheet(t.messages); XLSX.utils.book_append_sheet(wb, ws, 'Thread'+(i+1));}); XLSX.writeFile(wb,'perplexity_threads.xlsx'); }
  function mountDashboard(container){
    const gridEl = el('div', { style: { display: 'flex', gap: '8px', width: '100%', height: '100%' }}, [
      '<div id="plpo-thread-grid" class="ag-theme-alpine" style="flex:1;min-height:260px"></div>',
      '<div id="plpo-kanban" style="width:320px"></div>'
    ]);
    container.innerHTML='';
    container.appendChild(gridEl);
    const threadGridDiv = gridEl.querySelector('#plpo-thread-grid');
    const threadCols = [
      { headerName: '#', valueGetter: p => p.node.rowIndex + 1, width: 70 },
      { headerName: 'Role', field: 'role', width: 100 },
      { headerName: 'Text', field: 'text', flex: 1 },
    ];
    const activeThread = scrapeCurrentThread();
    const threadGridOptions = { columnDefs: threadCols, rowData: activeThread.messages, defaultColDef: { resizable: true, sortable: true, filter: true } };
    if (window.agGrid?.Grid) new agGrid.Grid(threadGridDiv, threadGridOptions);
    const kanban = gridEl.querySelector('#plpo-kanban');
    const lanes = ['To Review', 'Insights', 'Follow-ups'];
    lanes.forEach(l => kanban.appendChild(el('div', { class: 'plpo-column' }, [`<h4>${l}</h4>`, '<div class="lane"></div>'])));
    const laneEls = kanban.querySelectorAll('.lane');
    laneEls.forEach(le => { le.appendChild(el('div', { class: 'plpo-card' }, 'Drop messages here')); if (window.Sortable) Sortable.create(le, { group: 'plpo', animation: 150 }); });
    activeThread.messages.slice(0,6).forEach(m => laneEls[0].appendChild(el('div', { class: 'plpo-card' }, `${m.role}: ${m.text.slice(0,140)}${m.text.length>140?'…':''}`)));
    const root = container.closest('.plpo-root');
    const header = root.querySelector('.plpo-header .plpo-actions');
    // Wire actions on header buttons (fix: previously queried from footer)
    header.querySelector('[data-action="scrape"]').onclick = () => {
      const t = scrapeCurrentThread();
      KV.set(STORE.threads, [...KV.get(STORE.threads, []), t]);
      if (threadGridOptions.api) threadGridOptions.api.setRowData(t.messages);
    };
    header.querySelector('[data-action="export"]').onclick = () => {
      const selected = KV.get(STORE.threads, []);
      exportThreadsToXLSX(selected.length ? selected : [activeThread]);
    };
    header.querySelector('[data-action="min"]').onclick = () => {
      root.style.height = root.style.height === '44px' ? '70vh' : '44px';
      root.querySelector('.plpo-content').classList.toggle('plpo-hidden');
      root.querySelector('.plpo-footer').classList.toggle('plpo-hidden');
    };
    header.querySelector('[data-action="close"]').onclick = () => root?.remove();
  }
  function parseHotkey(combo){ const c = combo.toLowerCase().split('+'); return { alt: c.includes('alt'), ctrl: c.includes('ctrl') || c.includes('control'), shift: c.includes('shift'), key: c.find(x=>!['alt','ctrl','control','shift'].includes(x)) } }
  function installHotkey(){
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
  function mountOverlay(){
    const settings = KV.get(STORE.settings, DEFAULT_SETTINGS);
    const root = buildOverlay();
    if (settings?.theme === 'dark') root.classList.add('dark');
    injectCss();
    ensureDeps().then(() => {
      document.body.appendChild(root);
      mountDashboard(root.querySelector('[data-panel="dashboard"]'));
    });
  }
  initSettings();
  installHotkey();
})();
