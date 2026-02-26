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
      .replace(/"/g, '&quot;');
  }
};
