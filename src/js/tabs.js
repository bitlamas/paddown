/**
 * Paddown — Tab System
 * Tab data model, tab bar DOM, hidden textarea management,
 * drag-to-reorder, dirty tracking per tab.
 */
window.Paddown = window.Paddown || {};

window.Paddown.tabs = (() => {
  let tabs = [];
  let activeTabId = null;
  let tabBarEl, editorPaneEl, onSwitchCallback;
  let tabCounter = 0;

  // ─── Tab Data Model ─────────────────────────────────────────

  function createTabData(opts = {}) {
    const id = `tab-${++tabCounter}`;
    return {
      id,
      title: opts.title || 'Untitled',
      filePath: opts.filePath || null,
      savedContent: opts.content || '',
      lineEnding: opts.lineEnding || '\r\n',
      scrollTop: 0,
      previewScrollTop: 0,
      cursorStart: 0,
      cursorEnd: 0,
      isNew: !opts.filePath
    };
  }

  // ─── Textarea Management ────────────────────────────────────

  function createTextarea(tabId) {
    const ta = document.createElement('textarea');
    ta.id = `editor-${tabId}`;
    ta.className = 'tab-textarea';
    ta.spellcheck = false;
    ta.placeholder = 'Start writing Markdown here\u2026';
    ta.style.display = 'none';
    editorPaneEl.appendChild(ta);
    return ta;
  }

  function getTextarea(tabId) {
    return document.getElementById(`editor-${tabId}`);
  }

  function getActiveTextarea() {
    if (!activeTabId) return null;
    return getTextarea(activeTabId);
  }

  // ─── Tab Bar Rendering ──────────────────────────────────────

  function renderTabBar() {
    const container = tabBarEl.querySelector('.tab-items');
    container.innerHTML = '';

    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
      el.dataset.tabId = tab.id;
      const isDirty = isTabDirty(tab);
      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = (isDirty ? '\u25CF ' : '') + tab.title;
      el.appendChild(titleSpan);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '\u00D7';
      closeBtn.title = 'Close tab';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestCloseTab(tab.id);
      });
      el.appendChild(closeBtn);

      // Click to switch
      el.addEventListener('click', () => switchTab(tab.id));

      // Mouse-based drag reorder
      el.addEventListener('mousedown', onTabMouseDown);

      container.appendChild(el);
    });
  }

  // ─── Dirty Detection ────────────────────────────────────────

  function isTabDirty(tab) {
    const ta = getTextarea(tab.id);
    if (!ta) return false;
    return ta.value !== tab.savedContent;
  }

  function isAnyTabDirty() {
    return tabs.some(tab => isTabDirty(tab));
  }

  function getDirtyTabs() {
    return tabs.filter(tab => isTabDirty(tab));
  }

  function isTabBlankUntitled(tab) {
    if (!tab || !tab.isNew) return false;
    const ta = getTextarea(tab.id);
    return ta && ta.value === '';
  }

  // ─── Core Operations ────────────────────────────────────────

  function createTab(opts = {}) {
    const tab = createTabData(opts);
    tabs.push(tab);

    const ta = createTextarea(tab.id);
    ta.value = tab.savedContent;

    switchTab(tab.id);
    return tab;
  }

  function switchTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Save current tab state
    if (activeTabId) {
      saveTabState(activeTabId);
      const currentTa = getTextarea(activeTabId);
      if (currentTa) currentTa.style.display = 'none';
    }

    activeTabId = tabId;

    // Show new tab's textarea
    const ta = getTextarea(tabId);
    if (ta) {
      ta.style.display = '';
      ta.selectionStart = tab.cursorStart;
      ta.selectionEnd = tab.cursorEnd;
      // Defer scroll until after layout recalculation
      requestAnimationFrame(() => {
        ta.scrollTop = tab.scrollTop;
      });
    }

    renderTabBar();
    updateWindowTitle();

    if (onSwitchCallback) onSwitchCallback(tab);
  }

  function saveTabState(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    const ta = getTextarea(tabId);
    if (!tab || !ta) return;

    tab.cursorStart = ta.selectionStart;
    tab.cursorEnd = ta.selectionEnd;
    tab.scrollTop = ta.scrollTop;

    // Preview scroll saved by editor module
    const previewPane = document.getElementById('preview-pane');
    if (previewPane) tab.previewScrollTop = previewPane.scrollTop;
  }

  function requestCloseTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (isTabDirty(tab)) {
      const result = confirm(`Save changes to "${tab.title}"?\n\nClick OK to close without saving, or Cancel to go back.`);
      if (!result) return;
    }

    closeTab(tabId);
  }

  function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    // Remove textarea
    const ta = getTextarea(tabId);
    if (ta) ta.remove();

    tabs.splice(idx, 1);

    // Last tab closed — create a fresh one
    if (tabs.length === 0) {
      createTab();
      return;
    }

    // Switch to adjacent tab if we closed the active one
    if (activeTabId === tabId) {
      const newIdx = Math.min(idx, tabs.length - 1);
      activeTabId = null; // clear so switchTab doesn't save state for removed tab
      switchTab(tabs[newIdx].id);
    } else {
      renderTabBar();
    }
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
  }

  function getTab(tabId) {
    return tabs.find(t => t.id === tabId) || null;
  }

  function getAllTabs() {
    return tabs;
  }

  // ─── File State Helpers ─────────────────────────────────────

  function markTabSaved(tabId, filePath) {
    const tab = tabs.find(t => t.id === tabId);
    const ta = getTextarea(tabId);
    if (!tab || !ta) return;

    tab.filePath = filePath;
    tab.title = filePath.split(/[/\\]/).pop();
    tab.savedContent = ta.value;
    tab.isNew = false;

    renderTabBar();
    updateWindowTitle();
  }

  function loadIntoTab(tabId, content, filePath, lineEnding) {
    const tab = tabs.find(t => t.id === tabId);
    const ta = getTextarea(tabId);
    if (!tab || !ta) return;

    tab.filePath = filePath || null;
    tab.title = filePath ? filePath.split(/[/\\]/).pop() : 'Untitled';
    tab.savedContent = content;
    tab.lineEnding = lineEnding || '\r\n';
    tab.isNew = !filePath;

    ta.value = content;
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;

    renderTabBar();
    updateWindowTitle();
  }

  // ─── Window Title ───────────────────────────────────────────

  function updateWindowTitle() {
    const tab = getActiveTab();
    if (!tab) {
      document.title = 'Paddown';
      return;
    }
    const dirty = isTabDirty(tab);
    const prefix = dirty ? '\u25CF ' : '';
    document.title = `${prefix}${tab.title} - Paddown`;
  }

  // Call this after any edit to refresh dirty state in tab bar + title
  // Only re-renders if dirty state actually changed (avoids DOM thrash on every keystroke)
  function refreshDirtyState() {
    const tab = getActiveTab();
    if (!tab) return;
    const dirty = isTabDirty(tab);
    if (tab._lastDirtyState !== dirty) {
      tab._lastDirtyState = dirty;
      renderTabBar();
      updateWindowTitle();
    }
  }

  // ─── Tab Navigation ─────────────────────────────────────────

  function nextTab() {
    if (tabs.length < 2) return;
    const idx = tabs.findIndex(t => t.id === activeTabId);
    const next = (idx + 1) % tabs.length;
    switchTab(tabs[next].id);
  }

  function prevTab() {
    if (tabs.length < 2) return;
    const idx = tabs.findIndex(t => t.id === activeTabId);
    const prev = (idx - 1 + tabs.length) % tabs.length;
    switchTab(tabs[prev].id);
  }

  // ─── Mouse-based Tab Reorder ────────────────────────────────
  // Uses mousedown/mousemove/mouseup instead of HTML5 DnD,
  // which Tauri v2 WebView2 intercepts for native file drops.

  let dragState = null; // { tabId, startX, started, el }

  function cleanupDrag() {
    document.removeEventListener('mousemove', onDragMouseMove);
    document.removeEventListener('mouseup', onDragMouseUp);

    if (dragState && dragState.started) {
      dragState.el.classList.remove('dragging');
      tabBarEl.querySelectorAll('.drag-over').forEach(
        el => el.classList.remove('drag-over')
      );
    }

    dragState = null;
  }

  function onTabMouseDown(e) {
    // Only left-click, ignore close button
    if (e.button !== 0) return;
    if (e.target.closest('.tab-close')) return;

    // Clean up any in-progress drag (defensive)
    if (dragState) cleanupDrag();

    dragState = {
      tabId: e.currentTarget.dataset.tabId,
      startX: e.clientX,
      started: false,
      el: e.currentTarget
    };

    document.addEventListener('mousemove', onDragMouseMove);
    document.addEventListener('mouseup', onDragMouseUp);
  }

  function onDragMouseMove(e) {
    if (!dragState) return;

    // 5px threshold before starting drag
    if (!dragState.started) {
      if (Math.abs(e.clientX - dragState.startX) < 5) return;
      dragState.started = true;
      dragState.el.classList.add('dragging');
    }

    // Find tab under cursor and show indicator
    const container = tabBarEl.querySelector('.tab-items');
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    const targetTab = target.closest('.tab-item');
    if (targetTab && targetTab.dataset.tabId !== dragState.tabId) {
      targetTab.classList.add('drag-over');
    }
  }

  function onDragMouseUp(e) {
    if (!dragState) return;

    const didDrag = dragState.started;

    if (didDrag) {
      // Find drop target
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetTab = target ? target.closest('.tab-item') : null;

      if (targetTab && targetTab.dataset.tabId !== dragState.tabId) {
        const fromIdx = tabs.findIndex(t => t.id === dragState.tabId);
        const toIdx = tabs.findIndex(t => t.id === targetTab.dataset.tabId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = tabs.splice(fromIdx, 1);
          tabs.splice(toIdx, 0, moved);
        }
      }
    }

    // renderTabBar rebuilds the DOM, which implicitly suppresses the
    // click event that would otherwise fire after mouseup on the
    // original (now-detached) element.
    cleanupDrag();
    if (didDrag) renderTabBar();
  }

  // ─── Init ───────────────────────────────────────────────────

  function init(switchCallback) {
    onSwitchCallback = switchCallback;
    tabBarEl = document.getElementById('tab-bar');
    editorPaneEl = document.getElementById('editor-pane');

    // "+" new tab button
    const addBtn = tabBarEl.querySelector('.tab-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => createTab());
    }

    // Double-click empty tab bar area → new tab
    const tabItems = tabBarEl.querySelector('.tab-items');
    if (tabItems) {
      tabItems.addEventListener('dblclick', (e) => {
        if (e.target === tabItems) createTab();
      });
    }

    // Cancel drag if window loses focus (mouse released outside WebView2)
    window.addEventListener('blur', () => {
      if (dragState) {
        cleanupDrag();
        renderTabBar();
      }
    });

    // Create initial blank tab
    createTab();
  }

  return {
    init,
    createTab,
    switchTab,
    closeTab,
    requestCloseTab,
    getActiveTab,
    getTab,
    getAllTabs,
    getActiveTextarea,
    markTabSaved,
    loadIntoTab,
    isTabDirty,
    isAnyTabDirty,
    getDirtyTabs,
    refreshDirtyState,
    updateWindowTitle,
    isTabBlankUntitled,
    nextTab,
    prevTab
  };
})();
