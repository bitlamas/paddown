/**
 * Paddown — View Modes
 * Split view (default), editor-only, preview-only.
 * Ctrl+\ cycles through modes.
 */
window.Paddown = window.Paddown || {};

window.Paddown.views = (() => {
  const MODES = ['split', 'editor-only', 'preview-only'];
  let currentMode = 'split';
  let workspaceEl;

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    currentMode = mode;

    workspaceEl.classList.remove('mode-split', 'mode-editor-only', 'mode-preview-only');
    workspaceEl.classList.add(`mode-${mode}`);
  }

  function getMode() {
    return currentMode;
  }

  function cycle() {
    const idx = MODES.indexOf(currentMode);
    const next = MODES[(idx + 1) % MODES.length];
    setMode(next);
  }

  function init() {
    workspaceEl = document.getElementById('workspace');
    setMode('split');
  }

  return { init, setMode, getMode, cycle, MODES };
})();
