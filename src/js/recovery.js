/**
 * Paddown — Autosave & Crash Recovery
 * Periodically saves dirty tab content to a recovery directory.
 * On startup, checks for recovery files and offers to restore them.
 */
window.Paddown = window.Paddown || {};

window.Paddown.recovery = (() => {
  const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds
  let intervalId = null;
  let recoveryDir = null;

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  async function init() {
    try {
      recoveryDir = await invoke('get_recovery_dir');
    } catch (err) {
      console.warn('Recovery dir unavailable:', err);
      return;
    }
    intervalId = setInterval(saveRecovery, AUTOSAVE_INTERVAL_MS);
  }

  async function saveRecovery() {
    if (!recoveryDir) return;

    const { tabs } = window.Paddown;
    const allTabs = tabs.getAllTabs();
    const dirtyTabs = allTabs.filter(t => tabs.isTabDirty(t));

    if (dirtyTabs.length === 0) return;

    for (const tab of dirtyTabs) {
      const ta = document.getElementById(`editor-${tab.id}`);
      if (!ta) continue;

      const data = {
        filePath: tab.filePath || null,
        title: tab.title,
        content: ta.value,
        cursorStart: ta.selectionStart,
        cursorEnd: ta.selectionEnd,
        timestamp: Date.now()
      };

      const filename = `recovery-${tab.id}.json`;
      const path = recoveryDir + '/' + filename;

      try {
        await invoke('write_file', { path, contents: JSON.stringify(data) });
      } catch (_) {}
    }
  }

  function filenameFromPath(fullPath) {
    return fullPath.split(/[/\\]/).pop();
  }

  async function clearRecovery() {
    try {
      const files = await invoke('list_recovery_files');
      for (const f of files) {
        try { await invoke('delete_recovery_file', { filename: filenameFromPath(f) }); } catch (_) {}
      }
    } catch (_) {}
  }

  async function checkForRecovery() {
    try {
      const files = await invoke('list_recovery_files');
      if (files.length === 0) return null;

      const items = [];
      for (const f of files) {
        try {
          const raw = await invoke('read_file', { path: f });
          const data = JSON.parse(raw);
          data._recoveryFilename = filenameFromPath(f);
          items.push(data);
        } catch (_) {}
      }
      return items.length > 0 ? items : null;
    } catch (_) {
      return null;
    }
  }

  async function restoreFromRecovery(items) {
    const { tabs, editor, fileIO } = window.Paddown;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const active = tabs.getActiveTab();

      if (i === 0 && tabs.isTabBlankUntitled(active)) {
        tabs.loadIntoTab(active.id, item.content, item.filePath, '\r\n');
      } else {
        tabs.createTab({
          title: item.title || 'Recovered',
          filePath: item.filePath || null,
          content: item.content
        });
      }

      // Fetch current mtime so external modification detection works
      if (item.filePath && fileIO.isDesktop()) {
        const mtime = await fileIO.getMtime(item.filePath);
        const tab = tabs.getActiveTab();
        if (tab && mtime) tab.lastModified = mtime;
      }

      // Restore cursor
      const ta = tabs.getActiveTextarea();
      if (ta && item.cursorStart != null) {
        ta.setSelectionRange(item.cursorStart, item.cursorEnd || item.cursorStart);
      }
    }

    editor.render();

    // Delete recovery files after successful restore
    for (const item of items) {
      if (item._recoveryFilename) {
        try { await invoke('delete_recovery_file', { filename: item._recoveryFilename }); } catch (_) {}
      }
    }
  }

  function stopAutosave() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return { init, saveRecovery, clearRecovery, checkForRecovery, restoreFromRecovery, stopAutosave };
})();
