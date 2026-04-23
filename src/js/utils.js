/**
 * Paddown — Shared utilities
 */
window.Paddown = window.Paddown || {};

window.Paddown.utils = {
  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Path helpers — handle both Unix and Windows separators since Tauri
  // returns native paths and the same code runs on every platform.
  basename(path) {
    if (!path) return '';
    const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return i < 0 ? path : path.slice(i + 1);
  },

  dirname(path) {
    if (!path) return '';
    const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return i < 0 ? '' : path.slice(0, i);
  }
};
