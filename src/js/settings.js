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
    wordWrap: true,
    startupMode: 'welcome',
    openTabs: [],
    sidebarVisible: false,
    sidebarProjects: [],
    sidebarExpanded: {},
    sidebarFileExtensions: ['md', 'markdown']
  };

  const MAX_RECENT = 10;
  const SAVE_DEBOUNCE_MS = 250;
  let current = { ...DEFAULTS };
  let portablePath = null; // set if portable mode detected
  let wasLoadedFromFile = false;
  let saveTimer = null;

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
    // Cancel any pending debounced save — we're flushing now.
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
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

  // Coalesce rapid set() calls (e.g. dragging a sidebar project, typing
  // in a settings input) so we don't fire a write per keystroke.
  function set(key, value) {
    current[key] = value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save();
    }, SAVE_DEBOUNCE_MS);
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

  // ─── Theme ────────────────────────────────────────────────

  let systemDarkMQ = null;

  function applyTheme(theme) {
    // Clean up previous system listener
    if (systemDarkMQ) {
      systemDarkMQ.removeEventListener('change', onSystemThemeChange);
    }

    if (theme === 'system') {
      systemDarkMQ = window.matchMedia('(prefers-color-scheme: dark)');
      systemDarkMQ.addEventListener('change', onSystemThemeChange);
      if (systemDarkMQ.matches) {
        document.documentElement.dataset.theme = 'dark';
      } else {
        delete document.documentElement.dataset.theme;
      }
    } else if (theme === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function onSystemThemeChange(e) {
    if (e.matches) {
      document.documentElement.dataset.theme = 'dark';
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  // ─── Apply Settings to UI ─────────────────────────────────

  function applyToUI() {
    const { views, toolbar, sidebar } = window.Paddown;

    // Theme
    applyTheme(current.theme || 'light');

    // View mode
    if (views && current.viewMode) {
      views.setMode(current.viewMode);
    }

    // Toolbar visibility
    if (toolbar && current.showToolbar === false) {
      toolbar.hide();
    }

    // Sidebar visibility
    if (sidebar && current.sidebarVisible) {
      sidebar.show();
    }
  }

  function isFirstRun() {
    return !wasLoadedFromFile;
  }

  return {
    load, save, get, set, isPortable, isFirstRun,
    getRecentFiles, addRecentFile, clearRecentFiles,
    applyToUI, applyTheme
  };
})();
