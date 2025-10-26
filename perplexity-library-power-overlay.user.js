    // Thread view grid (AG Grid)
    const threadPanel = root.querySelector('[data-panel="thread"]');
    const threadGridDiv = threadPanel.querySelector('#plpo-thread-grid');
    const threadCols = [
      { headerName: '#', valueGetter: p => p.node.rowIndex + 1, width: 70 },
      { headerName: 'Role', field: 'role', width: 100 },
      { headerName: 'Text', field: 'text', flex: 1 },
    ];
    const activeThread = scrapeCurrentThread();
    const threadGridOptions = { columnDefs: threadCols, rowData: activeThread.messages, defaultColDef: { resizable: true, sortable: true, filter: true } };
    new agGrid.Grid(threadGridDiv, threadGridOptions);

    // Footer actions
    root.querySelector('[data-action="scrape"]').onclick = () => {
      const t = scrapeCurrentThread();
      KV.set(STORE.threads, [...KV.get(STORE.threads, []), t]);
      threadGridOptions.api.setRowData(t.messages);
    };
    root.querySelector('[data-action="export"]').onclick = () => {
      const selected = KV.get(STORE.threads, []);
      exportThreadsToXLSX(selected.length ? selected : [activeThread]);
    };
    root.querySelector('[data-action="min"]').onclick = () => {
      root.style.height = root.style.height === '44px' ? '70vh' : '44px';
      root.querySelector('.plpo-content').classList.toggle('plpo-hidden');
      root.querySelector('.plpo-footer').classList.toggle('plpo-hidden');
    };

    // Mount dashboard
    mountDashboard(root.querySelector('[data-panel="dashboard"]'));
  }

  // Hotkey toggle
  function parseHotkey(combo){
    const c = combo.toLowerCase().split('+');
    return {
      alt: c.includes('alt'),
      ctrl: c.includes('ctrl') || c.includes('control'),
      shift: c.includes('shift'),
      key: c.find(x => !['alt','ctrl','control','shift'].includes(x))
    }
  }

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
      if (!document.querySelector('.plpo-root')) mountOverlay(); else document.querySelector('.plpo-root').remove();
    }, true);
  }

  // Init
  initSettings();
  installHotkey();

})();
