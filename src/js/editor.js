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
  let renderGeneration = 0;
  const imageCache = new Map();
  const inflightRequests = new Map();

  function render() {
    const ta = window.Paddown.tabs.getActiveTextarea();
    if (!ta) return;

    renderGeneration++;
    const md = ta.value;
    previewEl.innerHTML = marked.parse(md);

    // Fix task list UL — add .contains-task-list if any task items inside
    previewEl.querySelectorAll('ul').forEach(ul => {
      if (ul.querySelector('.task-list-item')) {
        ul.classList.add('contains-task-list');
      }
    });

    resolveImages();
    updateStatusBar(md);
    window.Paddown.tabs.refreshDirtyState();
  }

  function resolveImages() {
    const fileIO = window.Paddown.fileIO;
    if (!fileIO || !fileIO.isDesktop()) return;

    const tab = window.Paddown.tabs.getActiveTab();
    if (!tab || !tab.filePath) return;

    const dir = window.Paddown.utils.dirname(tab.filePath);
    if (!dir) return;

    const imgs = previewEl.querySelectorAll('img');
    const generation = renderGeneration;

    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (!src) continue;
      if (/^(?:https?|data|file|blob):/i.test(src)) continue;

      const decoded = decodeURIComponent(src);
      // Skip absolute paths (Unix /foo, Windows C:\foo or \\server\share)
      // — pass them straight through; otherwise resolve against doc dir.
      const isAbsolute = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(decoded);
      const absPath = isAbsolute ? decoded : dir + '/' + decoded;

      if (imageCache.has(absPath)) {
        img.src = imageCache.get(absPath);
        continue;
      }

      if (!inflightRequests.has(absPath)) {
        const promise = window.__TAURI__.core.invoke('read_file_base64', { path: absPath, baseDir: dir })
          .then(dataUri => {
            imageCache.set(absPath, dataUri);
            inflightRequests.delete(absPath);
            return dataUri;
          })
          .catch(err => {
            inflightRequests.delete(absPath);
            throw err;
          });
        inflightRequests.set(absPath, promise);
      }

      inflightRequests.get(absPath)
        .then(dataUri => {
          if (renderGeneration !== generation) return;
          img.src = dataUri;
        })
        .catch(() => {});
    }
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

    // Restore preview scroll. Defer to a frame after render so the new
    // innerHTML has had a chance to lay out — assigning scrollTop before
    // reflow lands on the wrong position for long docs.
    const tab = window.Paddown.tabs.getActiveTab();
    const previewPane = document.getElementById('preview-pane');
    if (tab && previewPane) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          previewPane.scrollTop = tab.previewScrollTop;
          clearSyncFlag();
        });
      });
    } else {
      clearSyncFlag();
    }
  }

  // ─── External Modification Detection ──────────────────────

  async function checkExternalModification() {
    const { tabs, fileIO } = window.Paddown;
    const tab = tabs.getActiveTab();
    if (!tab || !tab.filePath || !tab.lastModified) return;
    if (!fileIO.isDesktop()) return;
    if (document.getElementById('external-mod-bar')) return;

    try {
      const mtime = await fileIO.getMtime(tab.filePath);
      // Guard: tab may have changed during the async call
      if (tabs.getActiveTab() !== tab) return;
      if (mtime && mtime > tab.lastModified) {
        showExternalModBar(tab);
      }
    } catch (_) {}
  }

  function showExternalModBar(tab) {
    if (document.getElementById('external-mod-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'external-mod-bar';
    const safeTitle = window.Paddown.utils.escapeHtml(tab.title);
    bar.innerHTML =
      `<span>File "${safeTitle}" was modified externally.</span>` +
      `<button id="mod-reload">Reload</button>` +
      `<button class="mod-dismiss" title="Dismiss">\u00D7</button>`;

    // Insert before workspace
    const workspace = document.getElementById('workspace');
    workspace.parentNode.insertBefore(bar, workspace);

    document.getElementById('mod-reload').addEventListener('click', async () => {
      await reloadTabFromDisk(tab);
      bar.remove();
    });

    bar.querySelector('.mod-dismiss').addEventListener('click', () => {
      // Update lastModified to suppress repeated prompts
      window.Paddown.fileIO.getMtime(tab.filePath).then(mtime => {
        if (mtime) tab.lastModified = mtime;
      }).catch(() => {});
      bar.remove();
    });
  }

  async function reloadTabFromDisk(tab) {
    const { tabs, fileIO } = window.Paddown;
    try {
      const result = await fileIO.readFileContent(tab.filePath);
      const ta = tabs.getActiveTextarea();
      if (!ta) return;
      tab.savedContent = result.content;
      tab.lineEnding = result.lineEnding;
      tab.lastModified = result.mtime;
      ta.value = result.content;
      render();
    } catch (err) {
      console.error('Reload failed:', err);
    }
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

  return { init, render, attachToTextarea, checkExternalModification };
})();
