/**
 * Paddown — Markdown renderer configuration
 * Uses marked.js v4.3.0 with custom renderer for code blocks,
 * tables, and task lists to match the chat interface rendering.
 */
window.Paddown = window.Paddown || {};

window.Paddown.renderer = (() => {
  const { escapeHtml } = window.Paddown.utils;
  const { highlight } = window.Paddown.highlighter;

  const renderer = new marked.Renderer();

  // Code blocks — add language label + syntax highlighting
  renderer.code = function(code, lang) {
    const safeLang = (lang || '').toLowerCase().trim();
    const highlighted = highlight(code, safeLang);
    const label = safeLang
      ? `<div class="code-lang-label">${escapeHtml(safeLang)}</div>`
      : '';
    return `<div class="code-block-wrapper">${label}<pre><code>${highlighted}</code></pre></div>`;
  };

  // Tables — wrap in overflow-x container
  renderer.table = function(header, body) {
    return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  };

  // Task list items — use checkbox HTML
  renderer.listitem = function(text, task, checked) {
    if (task) {
      const chk = checked ? ' checked=""' : '';
      const cleaned = text.replace(/^<input[^>]+>\s*/i, '');
      return `<li class="task-list-item"><input type="checkbox" disabled${chk}> ${cleaned}</li>\n`;
    }
    return `<li>${text}</li>\n`;
  };

  function init() {
    marked.setOptions({
      renderer,
      gfm: true,
      breaks: false,
      pedantic: false,
    });
  }

  return { init };
})();
