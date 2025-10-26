// ==UserScript==
// @name         Perplexity Library Power Overlay
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Persistent overlay UI for Perplexity Library automation and session workflows
// @author       Comet Assistant
// @match        https://www.perplexity.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const STORE_KEYS = {
    automations: 'plpo_automations',
    modules: 'plpo_modules',
    settings: 'plpo_settings',
  };

  const DEFAULTS = {
    settings: {
      hotkey: 'Alt+P',
      repo: 'https://raw.githubusercontent.com/edcet/perplexity-library-power-overlay/main/',
      autoUpdate: true,
      uiTheme: 'system',
    },
    automations: [
      {
        id: 'export-thread-md',
        name: 'Export Thread as Markdown',
        desc: 'Scrape current thread and export Markdown',
        run: async () => {
          const md = scrapeThreadToMarkdown();
          downloadFile('perplexity-thread.md', md);
        },
      },
    ],
    modules: [],
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function getStore(key, fallback) {
    try { return GM_getValue(key, fallback); } catch { return fallback; }
  }
  function setStore(key, value) {
    try { GM_setValue(key, value); } catch {}
  }

  function once(id, fn){ if (document.getElementById(id)) return; fn(); }

  function ensureDefaults(){
    if (getStore(STORE_KEYS.settings) == null) setStore(STORE_KEYS.settings, DEFAULTS.settings);
    if (getStore(STORE_KEYS.automations) == null) setStore(STORE_KEYS.automations, DEFAULTS.automations);
    if (getStore(STORE_KEYS.modules) == null) setStore(STORE_KEYS.modules, DEFAULTS.modules);
  }

  function hotkeyMatch(evt, combo) {
    const parts = combo.toLowerCase().split('+');
    const needAlt = parts.includes('alt');
    const needCtrl = parts.includes('ctrl') || parts.includes('control');
    const needShift = parts.includes('shift');
    const key = parts[parts.length-1];
    return (!!evt.altKey === needAlt) && (!!evt.ctrlKey === needCtrl) && (!!evt.shiftKey === needShift) && (evt.key.toLowerCase() === key);
  }

  function downloadFile(name, content) {
    const blob = new Blob([content], {type: 'text/markdown;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function scrapeThreadToMarkdown(){
    // Fallback generic extractor for Perplexity sessions
    const parts = [];
    const title = document.title || 'Perplexity Thread';
    parts.push(`# ${title}`);
    $$('.conversation, [data-conversation-id], main').forEach(section => {
      const text = section.innerText?.trim();
      if (text && text.length > 20) parts.push(text);
    });
    return parts.join('\n\n');
  }

  function createOverlay(){
    once('plpo-root', () => {
      GM_addStyle(`
        #plpo-root { position: fixed; top: 16px; right: 16px; z-index: 2147483647; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
        #plpo-button { background: #5b6bff; color: white; border: none; border-radius: 10px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,0,0,.2); cursor: pointer; font-weight: 600; }
        #plpo-panel { display: none; position: fixed; top: 16px; right: 16px; width: min(420px, 80vw); max-height: min(80vh, 720px); background: var(--plpo-bg, #111827f2); backdrop-filter: blur(8px); color: #e5e7eb; border: 1px solid #334155; border-radius: 14px; overflow: hidden; z-index: 2147483647; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
        #plpo-header { display:flex; align-items:center; justify-content:space-between; padding: 10px 12px; border-bottom: 1px solid #374151; background: #0b1220cc; }
        #plpo-title { font-weight:700; font-size:14px; }
        #plpo-actions { display:flex; gap:8px; }
        .plpo-icon { background:#1f2937; border:1px solid #374151; color:#e5e7eb; border-radius:8px; padding:6px 8px; cursor:pointer; }
        #plpo-body { display:grid; grid-template-columns: 1fr; padding:12px; gap:12px; }
        .plpo-card { background:#0b1220; border:1px solid #1f2937; border-radius:12px; padding:10px; }
        .plpo-list { display:flex; flex-direction:column; gap:8px; }
        .plpo-item { display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px dashed #374151; border-radius:10px; }
        .plpo-badge { font-size:11px; opacity:.8 }
        .plpo-link { color:#93c5fd; text-decoration:underline; cursor:pointer }
      `);

      const root = document.createElement('div');
      root.id = 'plpo-root';
      root.innerHTML = `
        <button id="plpo-button" title="Toggle Overlay (Alt+P)">Overlay</button>
        <section id="plpo-panel" role="dialog" aria-label="Perplexity Library Power Overlay">
          <div id="plpo-header">
            <div id="plpo-title">Perplexity Library Power Overlay <span class="plpo-badge">v1.0.0</span></div>
            <div id="plpo-actions">
              <button class="plpo-icon" id="plpo-refresh" title="Check for updates">Update</button>
              <a class="plpo-icon" id="plpo-repo" href="#" title="Open Repo" target="_blank">Repo</a>
              <button class="plpo-icon" id="plpo-close" title="Close">✕</button>
            </div>
          </div>
          <div id="plpo-body">
            <div class="plpo-card">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <strong>Automations</strong>
                <span class="plpo-badge"><span id="plpo-hotkey-label"></span> to toggle</span>
              </div>
              <div id="plpo-automations" class="plpo-list"></div>
            </div>
            <div class="plpo-card">
              <strong>Modules</strong>
              <div id="plpo-modules" class="plpo-list"></div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <input id="plpo-module-url" placeholder="Add module URL (GitHub raw)" style="flex:1;background:#0b1220;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:8px" />
                <button class="plpo-icon" id="plpo-add-module">Add</button>
              </div>
            </div>
            <div class="plpo-card">
              <strong>Exports & Protocols</strong>
              <div class="plpo-list">
                <button class="plpo-icon" data-action="export-md">Export current thread (Markdown)</button>
              </div>
            </div>
            <div class="plpo-card">
              <strong>Settings</strong>
              <div class="plpo-list">
                <label>Hotkey <input id="plpo-hotkey" style="margin-left:8px;background:#0b1220;color:#e5e7eb;border:1px solid #374151;border-radius:6px;padding:4px 6px;width:120px"/></label>
                <label>Repo <input id="plpo-repo-url" style="margin-left:8px;background:#0b1220;color:#e5e7eb;border:1px solid #374151;border-radius:6px;padding:4px 6px;width:100%"/></label>
                <label><input type="checkbox" id="plpo-autoupdate"/> Auto-update</label>
                <button class="plpo-icon" id="plpo-mutate">Mutation / Fork</button>
              </div>
            </div>
          </div>
        </section>`;
      document.body.appendChild(root);

      const settings = getStore(STORE_KEYS.settings, DEFAULTS.settings);
      $('#plpo-hotkey').value = settings.hotkey;
      $('#plpo-repo-url').value = settings.repo;
      $('#plpo-autoupdate').checked = !!settings.autoUpdate;
      $('#plpo-hotkey-label').textContent = settings.hotkey;
      $('#plpo-repo').href = settings.repo.replace(/raw\.githubusercontent\.com\/(.*)\/main\/$/, 'https://github.com/$1');

      function renderAutomations(){
        const list = $('#plpo-automations');
        list.innerHTML = '';
        const autos = getStore(STORE_KEYS.automations, DEFAULTS.automations);
        autos.forEach(a => {
          const el = document.createElement('div');
          el.className = 'plpo-item';
          el.innerHTML = `<span>${a.name}<br/><span class="plpo-badge">${a.desc||''}</span></span><div><button class="plpo-icon" data-run="${a.id}">Run</button></div>`;
          list.appendChild(el);
        });
      }

      function renderModules(){
        const list = $('#plpo-modules');
        list.innerHTML = '';
        const mods = getStore(STORE_KEYS.modules, DEFAULTS.modules);
        mods.forEach(m => {
          const el = document.createElement('div');
          el.className = 'plpo-item';
          el.innerHTML = `<span>${m.name||m.url}<br/><span class="plpo-badge">${m.url}</span></span><div><button class="plpo-icon" data-mod-run="${m.url}">Run</button> <button class="plpo-icon" data-mod-del="${m.url}">Remove</button></div>`;
          list.appendChild(el);
        });
      }

      renderAutomations();
      renderModules();

      function togglePanel(show){
        const p = $('#plpo-panel');
        p.style.display = (show == null) ? (p.style.display === 'none' || !p.style.display ? 'block' : 'none') : (show ? 'block' : 'none');
      }

      $('#plpo-button').onclick = () => togglePanel();
      $('#plpo-close').onclick = () => togglePanel(false);

      document.addEventListener('keydown', (e) => {
        const hk = getStore(STORE_KEYS.settings, DEFAULTS.settings).hotkey;
        if (hotkeyMatch(e, hk)) { e.preventDefault(); togglePanel(); }
      }, true);

      $('#plpo-hotkey').addEventListener('change', e => {
        const s = getStore(STORE_KEYS.settings, DEFAULTS.settings);
        s.hotkey = e.target.value || 'Alt+P';
        setStore(STORE_KEYS.settings, s);
        $('#plpo-hotkey-label').textContent = s.hotkey;
      });
      $('#plpo-repo-url').addEventListener('change', e => {
        const s = getStore(STORE_KEYS.settings, DEFAULTS.settings);
        s.repo = e.target.value;
        setStore(STORE_KEYS.settings, s);
      });
      $('#plpo-autoupdate').addEventListener('change', e => {
        const s = getStore(STORE_KEYS.settings, DEFAULTS.settings);
        s.autoUpdate = !!e.target.checked;
        setStore(STORE_KEYS.settings, s);
      });

      document.getElementById('plpo-body').addEventListener('click', async (e) => {
        const t = e.target;
        if (t.dataset?.action === 'export-md') {
          const md = scrapeThreadToMarkdown();
          downloadFile('perplexity-thread.md', md);
        }
        if (t.dataset?.run) {
          const autos = getStore(STORE_KEYS.automations, DEFAULTS.automations);
          const a = autos.find(x => x.id === t.dataset.run);
          if (a && typeof a.run === 'function') a.run();
        }
        if (t.id === 'plpo-add-module') {
          const url = $('#plpo-module-url').value.trim();
          if (!url) return;
          const mods = getStore(STORE_KEYS.modules, DEFAULTS.modules);
          mods.push({ url });
          setStore(STORE_KEYS.modules, mods);
          renderModules();
        }
        if (t.dataset?.modDel) {
          const url = t.dataset.modDel;
          const mods = getStore(STORE_KEYS.modules, DEFAULTS.modules).filter(m => m.url !== url);
          setStore(STORE_KEYS.modules, mods);
          renderModules();
        }
        if (t.id === 'plpo-refresh') {
          checkForUpdates(true);
        }
        if (t.id === 'plpo-mutate') {
          const s = getStore(STORE_KEYS.settings, DEFAULTS.settings);
          window.open((s.repo || DEFAULTS.settings.repo).replace('raw.githubusercontent.com/', 'github.com/').replace('/main/', '/tree/main/'), '_blank');
        }
      });

      // Load and register module runners dynamically
      async function runModule(url){
        try {
          const code = await (await fetch(url, {cache:'no-cache'})).text();
          // sandbox
          const fn = new Function('api', code);
          await fn({ downloadFile, scrapeThreadToMarkdown, getStore, setStore });
        } catch(err) { console.error('Module run failed', err); }
      }

      document.getElementById('plpo-body').addEventListener('click', (e) => {
        const t = e.target;
        if (t.dataset?.modRun) runModule(t.dataset.modRun);
      });

      async function checkForUpdates(force=false){
        const s = getStore(STORE_KEYS.settings, DEFAULTS.settings);
        if (!s.autoUpdate && !force) return;
        try {
          const url = (s.repo || DEFAULTS.settings.repo) + 'perplexity-library-power-overlay.user.js';
          await fetch(url, { cache: 'no-cache' });
          // Optional: could compare and prompt to update; for safety, just ensure repo exists
        } catch(e){ console.warn('Update check failed', e); }
      }

      checkForUpdates(false);
    });
  }

  function bootstrap(){
    ensureDefaults();
    createOverlay();
  }

  bootstrap();
})();
