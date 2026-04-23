/**
 * Paddown — Find & Replace
 * Ctrl+F opens find bar, Ctrl+H opens with replace.
 * Searches within the active textarea, painting matches via a transparent
 * overlay layer (WebView2 doesn't render textarea selection when the
 * textarea isn't focused, so we can't rely on native selection).
 */
window.Paddown = window.Paddown || {};

window.Paddown.find = (() => {
  let barEl, findInput, replaceInput, replaceRow, countEl, caseSensitiveBtn;
  let highlightLayer = null;
  let attachedTextarea = null;
  let isOpen = false;
  let caseSensitive = false;
  let matches = [];
  let currentMatchIdx = -1;

  function build() {
    barEl = document.createElement('div');
    barEl.id = 'find-bar';
    barEl.innerHTML = `
      <div class="find-row">
        <input type="text" class="find-input" placeholder="Find…" spellcheck="false">
        <button class="find-btn find-case" title="Match Case">Aa</button>
        <span class="find-count"></span>
        <button class="find-btn" title="Previous (Shift+F3)">↑</button>
        <button class="find-btn" title="Next (F3)">↓</button>
        <button class="find-btn find-close" title="Close (Esc)">×</button>
      </div>
      <div class="replace-row">
        <input type="text" class="replace-input" placeholder="Replace…" spellcheck="false">
        <button class="find-btn" title="Replace">Replace</button>
        <button class="find-btn" title="Replace All">All</button>
      </div>
    `;

    findInput = barEl.querySelector('.find-input');
    replaceInput = barEl.querySelector('.replace-input');
    replaceRow = barEl.querySelector('.replace-row');
    replaceRow.style.display = 'none';
    countEl = barEl.querySelector('.find-count');
    caseSensitiveBtn = barEl.querySelector('.find-case');

    const buttons = barEl.querySelectorAll('.find-btn');
    caseSensitiveBtn.addEventListener('click', toggleCase);
    buttons[1].addEventListener('click', () => { findPrev(); findInput.focus(); });
    buttons[2].addEventListener('click', () => { findNext(); findInput.focus(); });
    buttons[3].addEventListener('click', close);
    buttons[4].addEventListener('click', replaceCurrent);
    buttons[5].addEventListener('click', replaceAll);

    findInput.addEventListener('input', onSearchChange);
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) findPrev(); else findNext();
      }
      if (e.key === 'Escape') close();
    });

    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Insert before workspace
    const workspace = document.getElementById('workspace');
    workspace.parentNode.insertBefore(barEl, workspace);
  }

  // ─── Highlight overlay ──────────────────────────────────────

  function ensureLayer() {
    if (highlightLayer) return;
    highlightLayer = document.createElement('div');
    highlightLayer.className = 'find-highlight-layer';
    highlightLayer.setAttribute('aria-hidden', 'true');
    document.getElementById('editor-pane').appendChild(highlightLayer);
  }

  function removeLayer() {
    if (highlightLayer) {
      highlightLayer.remove();
      highlightLayer = null;
    }
    detachFromTextarea();
  }

  function syncScroll() {
    if (highlightLayer && attachedTextarea) {
      highlightLayer.scrollTop = attachedTextarea.scrollTop;
      highlightLayer.scrollLeft = attachedTextarea.scrollLeft;
    }
  }

  function ensureAttached() {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (ta === attachedTextarea) return;
    detachFromTextarea();
    attachedTextarea = ta;
    if (attachedTextarea) {
      attachedTextarea.addEventListener('scroll', syncScroll);
    }
  }

  function detachFromTextarea() {
    if (attachedTextarea) {
      attachedTextarea.removeEventListener('scroll', syncScroll);
      attachedTextarea = null;
    }
  }

  function renderHighlights() {
    if (!highlightLayer || !attachedTextarea) return;
    const text = attachedTextarea.value;
    const escapeHtml = window.Paddown.utils.escapeHtml;

    if (matches.length === 0) {
      highlightLayer.innerHTML = '';
      return;
    }

    let html = '';
    let lastEnd = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      html += escapeHtml(text.slice(lastEnd, m.start));
      const cls = i === currentMatchIdx ? ' class="current"' : '';
      html += `<mark${cls}>${escapeHtml(text.slice(m.start, m.end))}</mark>`;
      lastEnd = m.end;
    }
    html += escapeHtml(text.slice(lastEnd));
    // Trailing-newline trick: a final \n in a textarea adds a visible
    // empty line; in a div the trailing \n collapses unless followed by
    // content. Append a space so wrapping/scroll match.
    if (text.endsWith('\n')) html += ' ';

    highlightLayer.innerHTML = html;
    syncScroll();
  }

  // ─── Search & navigation ────────────────────────────────────

  function toggleCase() {
    caseSensitive = !caseSensitive;
    caseSensitiveBtn.classList.toggle('active', caseSensitive);
    onSearchChange();
    findInput.focus();
  }

  function onSearchChange() {
    ensureAttached();
    const query = findInput.value;
    const ta = attachedTextarea;
    if (!ta || !query) {
      matches = [];
      currentMatchIdx = -1;
      countEl.textContent = '';
      renderHighlights();
      return;
    }

    const text = ta.value;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);

    matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === regex.lastIndex) regex.lastIndex++; // zero-width guard
    }

    if (matches.length > 0) {
      currentMatchIdx = 0;
      scrollToMatch(matches[0]);
      // Sync the textarea's selection too — cheap, and useful if the
      // user later focuses the editor (e.g. to start editing at the match).
      ta.setSelectionRange(matches[0].start, matches[0].end);
    } else {
      currentMatchIdx = -1;
    }

    renderHighlights();
    updateCount();
  }

  function scrollToMatch(match) {
    const ta = attachedTextarea;
    if (!ta) return;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const lineNum = ta.value.slice(0, match.start).split('\n').length - 1;
    const targetScroll = lineNum * lineHeight - ta.clientHeight / 2;
    ta.scrollTop = Math.max(0, targetScroll);
    syncScroll();
  }

  function selectMatch(idx) {
    if (idx < 0 || idx >= matches.length) return;
    currentMatchIdx = idx;
    const match = matches[idx];
    if (attachedTextarea) {
      attachedTextarea.setSelectionRange(match.start, match.end);
      scrollToMatch(match);
    }
    renderHighlights();
    updateCount();
  }

  function findNext() {
    if (matches.length === 0) return;
    selectMatch((currentMatchIdx + 1) % matches.length);
  }

  function findPrev() {
    if (matches.length === 0) return;
    selectMatch((currentMatchIdx - 1 + matches.length) % matches.length);
  }

  function replaceCurrent() {
    const ta = attachedTextarea;
    if (!ta || currentMatchIdx < 0 || matches.length === 0) return;

    const match = matches[currentMatchIdx];
    // execCommand needs the textarea focused to take effect.
    ta.focus();
    ta.setSelectionRange(match.start, match.end);
    document.execCommand('insertText', false, replaceInput.value);

    window.Paddown.editor.render();
    onSearchChange();
    findInput.focus();
  }

  function replaceAll() {
    const ta = attachedTextarea;
    if (!ta || matches.length === 0) return;

    const query = findInput.value;
    const replacement = replaceInput.value;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);

    // Select all text and replace through execCommand to preserve undo.
    ta.focus();
    ta.select();
    document.execCommand('insertText', false, ta.value.replace(regex, replacement));

    window.Paddown.editor.render();
    onSearchChange();
    findInput.focus();
  }

  function updateCount() {
    if (matches.length === 0) {
      countEl.textContent = findInput.value ? 'No results' : '';
    } else {
      countEl.textContent = `${currentMatchIdx + 1} of ${matches.length}`;
    }
  }

  // ─── Open / close ───────────────────────────────────────────

  function open(showReplace) {
    if (!barEl) build();
    isOpen = true;
    barEl.classList.add('open');
    replaceRow.style.display = showReplace ? '' : 'none';

    ensureLayer();
    ensureAttached();

    // Pre-fill with current selection (single line only)
    const ta = attachedTextarea;
    if (ta) {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && !sel.includes('\n')) {
        findInput.value = sel;
      }
    }

    findInput.focus();
    findInput.select();
    onSearchChange();
  }

  function close() {
    isOpen = false;
    if (barEl) barEl.classList.remove('open');
    matches = [];
    currentMatchIdx = -1;
    removeLayer();

    // Return focus to editor
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (ta) ta.focus();
  }

  function isVisible() {
    return isOpen;
  }

  // Handle F3 / Shift+F3 globally, plus suppress editor-targeting
  // formatting shortcuts when the find/replace input has focus (those
  // operate on the active textarea regardless of focus).
  function handleKeydown(e) {
    if (!isOpen) return false;
    if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) findPrev(); else findNext();
      return true;
    }
    if (e.key === 'Escape') {
      close();
      return true;
    }
    if (barEl && barEl.contains(e.target) && e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (e.key === 'b' || e.key === 'i' || e.key === 'k' || e.key === '`') {
        return true;
      }
    }
    return false;
  }

  return { open, close, isVisible, handleKeydown };
})();
