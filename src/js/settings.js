/**
 * Paddown — Settings
 * Persists user preferences to the Tauri app config directory,
 * or to a portable settings.json next to the exe if it exists.
 */
window.Paddown = window.Paddown || {};

window.Paddown.settings = (() => {
  const DEFAULTS = {
    theme: 'light',
    showToolbar: true,
    viewMode: 'split',
    recentFiles: [],
    wordWrap: true
  };

  const MAX_RECENT = 10;
  let current = { ...DEFAULTS };
  let portablePath = null; // set if portable mode detected
  let wasLoadedFromFile = false;

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  async function load() {
    try {
      // Check for portable mode first
      portablePath = await invoke('get_portable_settings_path');

      let raw;
      if (portablePath) {
        raw = await invoke('read_file', { path: portablePath });
      } else {
        raw = await invoke('read_settings');
      }
      const parsed = JSON.parse(raw);
      current = { ...DEFAULTS, ...parsed };
      wasLoadedFromFile = true;
    } catch (err) {
      // File doesn't exist on first run, or parse error
      current = { ...DEFAULTS };
      wasLoadedFromFile = false;
    }
    return current;
  }

  async function save() {
    try {
      const contents = JSON.stringify(current, null, 2);
      if (portablePath) {
        await invoke('write_file', { path: portablePath, contents });
      } else {
        await invoke('write_settings', { contents });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  function get(key) {
    return current[key];
  }

  function set(key, value) {
    current[key] = value;
    save();
  }

  function isPortable() {
    return portablePath !== null;
  }

  // ─── Recent Files ─────────────────────────────────────────

  function getRecentFiles() {
    return current.recentFiles || [];
  }

  function addRecentFile(filePath) {
    if (!filePath) return;
    let list = current.recentFiles || [];
    // Remove if already in list, then prepend
    list = list.filter(p => p !== filePath);
    list.unshift(filePath);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    current.recentFiles = list;
    save();
  }

  function clearRecentFiles() {
    current.recentFiles = [];
    save();
  }

  // ─── Apply Settings to UI ─────────────────────────────────

  function applyToUI() {
    const { views, toolbar } = window.Paddown;

    // View mode
    if (views && current.viewMode) {
      views.setMode(current.viewMode);
    }

    // Toolbar visibility
    if (toolbar && current.showToolbar === false) {
      toolbar.hide();
    }
  }

  function isFirstRun() {
    return !wasLoadedFromFile;
  }

  return {
    load, save, get, set, isPortable, isFirstRun,
    getRecentFiles, addRecentFile, clearRecentFiles,
    applyToUI
  };
})();
