/**
 * Paddown — HTML Export
 * Generates a standalone HTML file from the preview, with all styles inlined.
 */
window.Paddown = window.Paddown || {};

window.Paddown.exportHtml = (() => {
  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  /**
   * Collect all CSS rules from the app's stylesheets that
   * apply to .standard-markdown, tokens, and code blocks.
   */
  function collectStyles() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          const text = rule.cssText;
          // Include markdown styles, token colors, font/color tokens
          if (text.includes('.standard-markdown') ||
              text.includes('.tok-') ||
              text.includes('.code-block-wrapper') ||
              text.includes('.code-lang-label') ||
              text.includes('.table-wrapper') ||
              text.includes('.task-list-item') ||
              text.includes(':root')) {
            rules.push(text);
          }
        }
      } catch (_) {
        // Cross-origin stylesheet, skip
      }
    }
    return rules.join('\n');
  }

  /**
   * Build a standalone HTML document from the current preview.
   */
  function buildHtml(title) {
    const previewEl = document.getElementById('preview');
    if (!previewEl) return '';

    const css = collectStyles();
    const body = previewEl.innerHTML;
    const safeTitle = (title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
${css}
body {
  font-family: "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif;
  color: #14181f;
  background: #ffffff;
  margin: 0;
  padding: 2rem;
  display: flex;
  justify-content: center;
}
.standard-markdown {
  max-width: 680px;
  width: 100%;
}
  </style>
</head>
<body>
  <div class="standard-markdown">
${body}
  </div>
</body>
</html>`;
  }

  /**
   * Export the current preview as a standalone HTML file.
   */
  async function exportToHtml() {
    const { fileIO, tabs } = window.Paddown;
    if (!fileIO.isDesktop()) return;

    const tab = tabs.getActiveTab();
    if (!tab) return;

    // Derive default filename from tab title
    const baseName = (tab.title || 'Untitled').replace(/\.(md|markdown|txt)$/i, '');
    const defaultName = baseName + '.html';

    try {
      const path = await invoke('show_export_html_dialog', { default_name: defaultName });
      if (!path) return;

      const html = buildHtml(baseName);
      await invoke('write_file', { path, contents: html });
    } catch (err) {
      console.error('HTML export failed:', err);
    }
  }

  return { exportToHtml };
})();
