/**
 * Paddown — Application bootstrap
 * Initializes all modules, registers keyboard shortcuts,
 * wires menu/toolbar actions, and handles window events.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const { renderer, editor, fileIO, tabs, views, menus, contextMenu, find, toolbar, settings, exportHtml, updater, welcome, sidebar } = window.Paddown;

  // ─── Initialize Modules ─────────────────────────────────────

  renderer.init();
  editor.init();
  views.init();
  toolbar.init();

  // Load settings before creating tabs (so we can apply view mode, etc.)
  if (fileIO.isDesktop()) {
    await settings.load();
  }

  tabs.init((tab) => {
    const ta = tabs.getActiveTextarea();
    editor.attachToTextarea(ta);
    if (sidebar) sidebar.updateActiveHighlight();
  });

  // Initialize sidebar (needs settings loaded first)
  sidebar.init();

  // Apply saved settings to UI
  if (fileIO.isDesktop()) {
    settings.applyToUI();
  }

  // Load sidebar projects from settings
  if (fileIO.isDesktop()) {
    sidebar.loadFromSettings();
  }

  // Check for updates (non-blocking, delayed)
  updater.init();

  // ─── File Operations ──────────────────────────────────────

  async function handleOpen() {
    if (!fileIO.isDesktop()) return;
    try {
      const result = await fileIO.openFile();
      if (!result) return;

      if (fileIO.isDesktop()) settings.addRecentFile(result.filePath);

      const existing = tabs.getAllTabs().find(t => t.filePath === result.filePath);
      if (existing) { tabs.switchTab(existing.id); return; }

      const active = tabs.getActiveTab();
      if (tabs.isTabBlankUntitled(active)) {
        tabs.loadIntoTab(active.id, result.content, result.filePath, result.lineEnding);
        editor.render();
        sidebar.updateActiveHighlight();
        return;
      }

      tabs.createTab({
        title: result.filePath.split(/[/\\]/).pop(),
        filePath: result.filePath,
        content: result.content,
        lineEnding: result.lineEnding
      });
    } catch (err) {
      console.error('Open failed:', err);
    }
  }

  async function handleSave() {
    if (!fileIO.isDesktop()) return;
    const tab = tabs.getActiveTab();
    if (!tab) return;
    try {
      const ta = tabs.getActiveTextarea();
      const path = await fileIO.saveFile(ta.value, tab.filePath, tab.lineEnding);
      if (path) {
        tabs.markTabSaved(tab.id, path);
        if (fileIO.isDesktop()) settings.addRecentFile(path);
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  }

  async function handleSaveAs() {
    if (!fileIO.isDesktop()) return;
    const tab = tabs.getActiveTab();
    if (!tab) return;
    try {
      const ta = tabs.getActiveTextarea();
      const path = await fileIO.saveFileAs(ta.value, tab.lineEnding, tab.title);
      if (path) {
        tabs.markTabSaved(tab.id, path);
        if (fileIO.isDesktop()) settings.addRecentFile(path);
      }
    } catch (err) {
      console.error('Save As failed:', err);
    }
  }

  // ─── Edit Helpers ─────────────────────────────────────────

  function focusEditor() {
    const ta = tabs.getActiveTextarea();
    if (ta) ta.focus();
  }

  // ─── Shared Action Map ────────────────────────────────────

  const actionMap = {
    // File
    newTab:    () => tabs.createTab(),
    open:      () => handleOpen(),
    save:      () => handleSave(),
    saveAs:    () => handleSaveAs(),
    exportHtml: () => exportHtml.exportToHtml(),
    closeTab:  () => { const t = tabs.getActiveTab(); if (t) tabs.requestCloseTab(t.id); },
    exit:      () => {
      if (window.__TAURI__?.window?.getCurrentWindow) {
        window.__TAURI__.window.getCurrentWindow().close();
      }
    },

    // Edit
    undo:      () => { focusEditor(); document.execCommand('undo'); },
    redo:      () => { focusEditor(); document.execCommand('redo'); },
    cut:       () => { focusEditor(); document.execCommand('cut'); },
    copy:      () => { focusEditor(); document.execCommand('copy'); },
    paste:     () => { focusEditor(); document.execCommand('paste'); },
    selectAll: () => { const ta = tabs.getActiveTextarea(); if (ta) { ta.focus(); ta.select(); } },
    find:      () => find.open(false),
    replace:   () => find.open(true),

    // View
    viewSplit:   () => { views.setMode('split'); if (fileIO.isDesktop()) settings.set('viewMode', 'split'); },
    viewEditor:  () => { views.setMode('editor-only'); if (fileIO.isDesktop()) settings.set('viewMode', 'editor-only'); },
    viewPreview: () => { views.setMode('preview-only'); if (fileIO.isDesktop()) settings.set('viewMode', 'preview-only'); },
    toggleToolbar: () => { toolbar.toggle(); if (fileIO.isDesktop()) settings.set('showToolbar', toolbar.isVisible()); },
    toggleSidebar: () => { sidebar.toggle(); },
    addProjectFolder: () => { sidebar.addProject(); },
    zoomIn:    () => { document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1); },
    zoomOut:   () => { document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) - 0.1); },
    zoomReset: () => { document.body.style.zoom = 1; },

    // Formatting (used by context menu + toolbar)
    bold:          () => toolbar.getAction('bold')?.(),
    italic:        () => toolbar.getAction('italic')?.(),
    inlineCode:    () => toolbar.getAction('inlineCode')?.(),
    link:          () => toolbar.getAction('link')?.(),

    // Settings
    settings: () => window.Paddown.settingsUI.open(),

    // Help
    about: async () => {
      if (document.getElementById('about-overlay')) return;

      let version = '0.1.0';
      try { if (fileIO.isDesktop()) version = await window.__TAURI__.core.invoke('get_app_version'); } catch (_) {}

      const overlay = document.createElement('div');
      overlay.id = 'about-overlay';

      const card = document.createElement('div');
      card.id = 'about-card';

      const logo = document.createElement('img');
      logo.src = 'assets/icon-128.png';
      logo.alt = 'Paddown';
      logo.className = 'about-logo';
      logo.width = 64;
      logo.height = 64;

      const title = document.createElement('h2');
      title.textContent = 'Paddown';

      const ver = document.createElement('p');
      ver.className = 'about-version';
      ver.textContent = `v${version}`;

      const tagline = document.createElement('p');
      tagline.className = 'about-tagline';
      tagline.textContent = 'Markdown notepad with professional chat interface styling. Write notes offline, paste with zero formatting surprises.';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'about-close';
      closeBtn.textContent = '\u00D7';

      card.append(logo, title, ver, tagline, closeBtn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      void overlay.offsetHeight; // force layout for CSS transition
      overlay.classList.add('visible');

      function close() {
        overlay.classList.remove('visible');
        const fallback = setTimeout(() => overlay.remove(), 300);
        overlay.addEventListener('transitionend', (e) => {
          if (e.target === overlay) { clearTimeout(fallback); overlay.remove(); }
        }, { once: true });
        document.removeEventListener('keydown', onKey);
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      }

      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.addEventListener('keydown', onKey);
    }
  };

  // Wire actions into menus and context menu
  menus.init();
  menus.setActions(actionMap);
  contextMenu.init();
  contextMenu.setActions(actionMap);

  // ─── Keyboard Shortcuts ───────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // Let find.js handle F3/Escape when find bar is open
    if (find.handleKeydown(e)) return;

    const ctrl = e.ctrlKey && !e.altKey;

    if (ctrl && !e.shiftKey && e.key === 'n') { e.preventDefault(); actionMap.newTab(); }
    if (ctrl && !e.shiftKey && e.key === 'o') { e.preventDefault(); actionMap.open(); }
    if (ctrl && !e.shiftKey && e.key === 's') { e.preventDefault(); actionMap.save(); }
    if (ctrl && e.shiftKey && e.key === 'S')  { e.preventDefault(); actionMap.saveAs(); }
    if (ctrl && !e.shiftKey && e.key === 'w') { e.preventDefault(); actionMap.closeTab(); }
    if (ctrl && !e.shiftKey && e.key === 'f') { e.preventDefault(); actionMap.find(); }
    if (ctrl && !e.shiftKey && e.key === 'h') { e.preventDefault(); actionMap.replace(); }
    if (ctrl && !e.shiftKey && e.key === 'b') { e.preventDefault(); actionMap.bold(); }
    if (ctrl && !e.shiftKey && e.key === 'i') { e.preventDefault(); actionMap.italic(); }
    if (ctrl && !e.shiftKey && e.key === 'k') { e.preventDefault(); actionMap.link(); }
    if (ctrl && !e.shiftKey && e.key === '`') { e.preventDefault(); actionMap.inlineCode(); }
    if (ctrl && e.shiftKey && e.key === 'E')    { e.preventDefault(); actionMap.toggleSidebar(); }
    if (ctrl && !e.shiftKey && e.key === '\\') { e.preventDefault(); views.cycle(); }
    if (ctrl && !e.shiftKey && e.key === '=') { e.preventDefault(); actionMap.zoomIn(); }
    if (ctrl && !e.shiftKey && e.key === '-') { e.preventDefault(); actionMap.zoomOut(); }
    if (ctrl && !e.shiftKey && e.key === '0') { e.preventDefault(); actionMap.zoomReset(); }

    // Tab switching — use code to avoid conflict with Tab key insertion
    if (e.ctrlKey && !e.shiftKey && e.code === 'Tab') { e.preventDefault(); tabs.nextTab(); }
    if (e.ctrlKey && e.shiftKey && e.code === 'Tab')  { e.preventDefault(); tabs.prevTab(); }
  });

  // ─── Drag and Drop Files ──────────────────────────────────

  const dropOverlay = document.getElementById('drop-overlay');
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      dragCounter++;
      dropOverlay.classList.add('visible');
    }
  });

  document.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove('visible');
    }
  });

  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove('visible');

    if (!fileIO.isDesktop()) return;

    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['md', 'markdown', 'txt'].includes(ext)) continue;

      try {
        // Use file.path if available (Tauri provides it)
        const filePath = file.path || file.name;
        const rawContent = await window.__TAURI__.core.invoke('read_file', { path: filePath });
        const lineEnding = fileIO.detectLineEnding(rawContent);
        const content = fileIO.normalizeForEditor(rawContent);

        const existing = tabs.getAllTabs().find(t => t.filePath === filePath);
        if (existing) { tabs.switchTab(existing.id); continue; }

        const active = tabs.getActiveTab();
        if (tabs.isTabBlankUntitled(active)) {
          tabs.loadIntoTab(active.id, content, filePath, lineEnding);
          editor.render();
        } else {
          tabs.createTab({
            title: filePath.split(/[/\\]/).pop(),
            filePath,
            content,
            lineEnding
          });
        }
      } catch (err) {
        console.error('Drop open failed:', err);
      }
    }
  });

  // ─── Open Files from CLI Args ──────────────────────────────

  if (fileIO.isDesktop()) {
    try {
      const args = await window.__TAURI__.core.invoke('get_cli_args');
      for (const arg of args) {
        // Skip flags
        if (arg.startsWith('-')) continue;
        try {
          const rawContent = await window.__TAURI__.core.invoke('read_file', { path: arg });
          const lineEnding = fileIO.detectLineEnding(rawContent);
          const content = fileIO.normalizeForEditor(rawContent);
          const filePath = arg;

          settings.addRecentFile(filePath);

          const active = tabs.getActiveTab();
          if (tabs.isTabBlankUntitled(active)) {
            tabs.loadIntoTab(active.id, content, filePath, lineEnding);
            editor.render();
          } else {
            tabs.createTab({
              title: filePath.split(/[/\\]/).pop(),
              filePath,
              content,
              lineEnding
            });
          }
        } catch (err) {
          console.error('Failed to open CLI arg:', arg, err);
        }
      }
    } catch (_) {}
  }

  // ─── Startup Mode ──────────────────────────────────────────

  if (fileIO.isDesktop()) {
    // Only apply startup mode if no CLI files were opened
    const cliOpened = tabs.getAllTabs().some(t => t.filePath);

    if (!cliOpened) {
      const startupMode = settings.get('startupMode') || 'welcome';

      if (startupMode === 'restore') {
        const savedTabs = settings.get('openTabs') || [];
        let restored = 0;

        for (const saved of savedTabs) {
          if (!saved.filePath) continue;
          try {
            const rawContent = await window.__TAURI__.core.invoke('read_file', { path: saved.filePath });
            const lineEnding = fileIO.detectLineEnding(rawContent);
            const content = fileIO.normalizeForEditor(rawContent);

            const active = tabs.getActiveTab();
            if (restored === 0 && tabs.isTabBlankUntitled(active)) {
              tabs.loadIntoTab(active.id, content, saved.filePath, lineEnding);
            } else {
              tabs.createTab({
                title: saved.filePath.split(/[/\\]/).pop(),
                filePath: saved.filePath,
                content,
                lineEnding
              });
            }

            // Restore cursor and scroll position
            const ta = tabs.getActiveTextarea();
            if (ta && saved.cursorStart != null) {
              ta.setSelectionRange(saved.cursorStart, saved.cursorEnd || saved.cursorStart);
              requestAnimationFrame(() => {
                ta.scrollTop = saved.scrollTop || 0;
              });
            }

            restored++;
          } catch (err) {
            console.warn('Failed to restore tab:', saved.filePath, err);
          }
        }

        if (restored > 0) editor.render();
        // If no tabs restored, fall through — blank tab already exists

      } else if (startupMode === 'welcome' || settings.isFirstRun()) {
        const active = tabs.getActiveTab();
        if (active && tabs.isTabBlankUntitled(active)) {
          const ta = tabs.getActiveTextarea();
          if (ta) {
            ta.value = welcome.getContent();
            active.savedContent = ta.value;
            editor.render();
          }
        }
      }
      // startupMode === 'blank' → do nothing, blank tab already exists
    }
  }

  // ─── Window Close Handler ─────────────────────────────────

  if (fileIO.isDesktop() && window.__TAURI__?.window?.getCurrentWindow) {
    const appWindow = window.__TAURI__.window.getCurrentWindow();

    appWindow.onCloseRequested(async (event) => {
      event.preventDefault();

      // Stop all filesystem watchers
      sidebar.stopAllWatching();

      // Save open tabs for session restore
      if (settings.get('startupMode') === 'restore') {
        const allTabs = tabs.getAllTabs();
        const openTabs = allTabs
          .filter(t => t.filePath)
          .map(t => {
            const ta = document.getElementById(`editor-${t.id}`);
            return {
              filePath: t.filePath,
              cursorStart: ta ? ta.selectionStart : 0,
              cursorEnd: ta ? ta.selectionEnd : 0,
              scrollTop: ta ? ta.scrollTop : 0
            };
          });
        settings.set('openTabs', openTabs);
        await settings.save();
      }

      const dirtyTabs = tabs.getDirtyTabs();
      if (dirtyTabs.length === 0) {
        appWindow.destroy();
        return;
      }

      const names = dirtyTabs.map(t => t.title).join(', ');
      const ok = confirm(`You have unsaved changes in: ${names}\n\nClose without saving?`);
      if (ok) {
        appWindow.destroy();
      }
    });
  }
});
