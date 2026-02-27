/**
 * Paddown — Editor logic
 * Live preview rendering with 60ms debounce, tab key handling,
 * and status bar updates. Works with the active textarea from tabs.js.
 */
window.Paddown = window.Paddown || {};

window.Paddown.editor = (() => {
  let previewEl;
  let statChars, statWords, statLines, statEncoding, statCursor;
  let debounceTimer = null;
  let currentTextarea = null;

  function render() {
    const ta = window.Paddown.tabs.getActiveTextarea();
    if (!ta) return;

    const md = ta.value;
    previewEl.innerHTML = marked.parse(md);

    // Fix task list UL — add .contains-task-list if any task items inside
    previewEl.querySelectorAll('ul').forEach(ul => {
      if (ul.querySelector('.task-list-item')) {
        ul.classList.add('contains-task-list');
      }
    });

    updateStatusBar(md);
    window.Paddown.tabs.refreshDirtyState();
  }

  function updateStatusBar(md) {
    const tab = window.Paddown.tabs.getActiveTab();
    const chars = md.length;
    const words = md.trim() === '' ? 0 : md.trim().split(/\s+/).length;
    const lines = md === '' ? 0 : md.split('\n').length;
    statChars.textContent = `${chars.toLocaleString()} char${chars !== 1 ? 's' : ''}`;
    statWords.textContent = `${words.toLocaleString()} word${words !== 1 ? 's' : ''}`;
    statLines.textContent = `${lines.toLocaleString()} line${lines !== 1 ? 's' : ''}`;
    statEncoding.textContent = tab && tab.lineEnding === '\r\n' ? 'CRLF' : 'LF';
    updateCursorPosition();
  }

  function updateCursorPosition() {
    const ta = currentTextarea;
    if (!ta || !statCursor) return;
    const pos = ta.selectionStart;
    const textBefore = ta.value.slice(0, pos);
    const ln = textBefore.split('\n').length;
    const lastNewline = textBefore.lastIndexOf('\n');
    const col = pos - lastNewline;
    statCursor.textContent = `Ln ${ln}, Col ${col}`;
  }

  function onCursorChange() {
    updateCursorPosition();
  }

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 60);
  }

  function onKeydown(e) {
    // Only handle plain Tab (not Ctrl+Tab which switches tabs)
    if (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Use execCommand to preserve undo/redo stack
      document.execCommand('insertText', false, '  ');
      render();
    }
  }

  // ─── Bidirectional Scroll Sync ──────────────────────────────

  let scrollSyncSource = null; // 'editor' | 'preview' | 'restore' | null
  let syncClearTimer = 0;

  function clearSyncFlag() {
    clearTimeout(syncClearTimer);
    syncClearTimer = setTimeout(() => { scrollSyncSource = null; }, 50);
  }

  function onEditorScroll() {
    if (scrollSyncSource) return;

    const views = window.Paddown.views;
    if (views && views.getMode() !== 'split') return;

    const ta = currentTextarea;
    if (!ta) return;

    const previewPane = document.getElementById('preview-pane');
    if (!previewPane) return;

    scrollSyncSource = 'editor';
    const editorMax = Math.max(ta.scrollHeight - ta.clientHeight, 1);
    const editorRatio = ta.scrollTop / editorMax;
    previewPane.scrollTop = editorRatio * (previewPane.scrollHeight - previewPane.clientHeight);
    clearSyncFlag();
  }

  function onPreviewScroll() {
    if (scrollSyncSource) return;

    const views = window.Paddown.views;
    if (views && views.getMode() !== 'split') return;

    const ta = currentTextarea;
    if (!ta) return;

    const previewPane = document.getElementById('preview-pane');
    if (!previewPane) return;

    scrollSyncSource = 'preview';
    const previewMax = Math.max(previewPane.scrollHeight - previewPane.clientHeight, 1);
    const previewRatio = previewPane.scrollTop / previewMax;
    ta.scrollTop = previewRatio * (ta.scrollHeight - ta.clientHeight);
    clearSyncFlag();
  }

  // Called by tabs.js when switching tabs — attach listeners to new textarea
  function attachToTextarea(ta) {
    // Detach from previous textarea (O(1) instead of O(n))
    if (currentTextarea) {
      currentTextarea.removeEventListener('input', onInput);
      currentTextarea.removeEventListener('keydown', onKeydown);
      currentTextarea.removeEventListener('scroll', onEditorScroll);
      currentTextarea.removeEventListener('mouseup', onCursorChange);
      currentTextarea.removeEventListener('keyup', onCursorChange);
    }

    currentTextarea = ta;

    if (ta) {
      ta.addEventListener('input', onInput);
      ta.addEventListener('keydown', onKeydown);
      ta.addEventListener('scroll', onEditorScroll);
      ta.addEventListener('mouseup', onCursorChange);
      ta.addEventListener('keyup', onCursorChange);
      ta.focus();
    }

    // Suppress scroll sync during tab restore to avoid overwriting
    // the saved scroll positions with ratio-computed values
    scrollSyncSource = 'restore';

    render();

    // Restore preview scroll
    const tab = window.Paddown.tabs.getActiveTab();
    const previewPane = document.getElementById('preview-pane');
    if (tab && previewPane) {
      previewPane.scrollTop = tab.previewScrollTop;
    }

    clearSyncFlag();
  }

  function init() {
    previewEl    = document.getElementById('preview');
    statChars    = document.getElementById('stat-chars');
    statWords    = document.getElementById('stat-words');
    statLines    = document.getElementById('stat-lines');
    statEncoding = document.getElementById('stat-encoding');
    statCursor   = document.getElementById('stat-cursor');

    // Open links in default browser instead of navigating in-app
    previewEl.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (window.__TAURI__) {
        window.__TAURI__.core.invoke('open_url', { url: href });
      } else {
        window.open(href, '_blank');
      }
    });

    // Preview → Editor scroll sync
    const previewPane = document.getElementById('preview-pane');
    if (previewPane) {
      previewPane.addEventListener('scroll', onPreviewScroll);
    }
  }

  return { init, render, attachToTextarea };
})();
