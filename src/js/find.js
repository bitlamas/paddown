/**
 * Paddown — Find & Replace
 * Ctrl+F opens find bar, Ctrl+H opens with replace.
 * Searches within the active textarea.
 */
window.Paddown = window.Paddown || {};

window.Paddown.find = (() => {
  let barEl, findInput, replaceInput, replaceRow, countEl, caseSensitiveBtn;
  let isOpen = false;
  let caseSensitive = false;
  let matches = [];
  let currentMatchIdx = -1;

  function build() {
    barEl = document.createElement('div');
    barEl.id = 'find-bar';
    barEl.innerHTML = `
      <div class="find-row">
        <input type="text" class="find-input" placeholder="Find\u2026" spellcheck="false">
        <button class="find-btn find-case" title="Match Case">Aa</button>
        <span class="find-count"></span>
        <button class="find-btn" title="Previous (Shift+F3)">\u2191</button>
        <button class="find-btn" title="Next (F3)">\u2193</button>
        <button class="find-btn find-close" title="Close (Esc)">\u00D7</button>
      </div>
      <div class="replace-row" style="display:none">
        <input type="text" class="replace-input" placeholder="Replace\u2026" spellcheck="false">
        <button class="find-btn" title="Replace">Replace</button>
        <button class="find-btn" title="Replace All">All</button>
      </div>
    `;

    findInput = barEl.querySelector('.find-input');
    replaceInput = barEl.querySelector('.replace-input');
    replaceRow = barEl.querySelector('.replace-row');
    countEl = barEl.querySelector('.find-count');
    caseSensitiveBtn = barEl.querySelector('.find-case');

    const buttons = barEl.querySelectorAll('.find-btn');
    caseSensitiveBtn.addEventListener('click', toggleCase);
    buttons[1].addEventListener('click', findPrev);  // ↑
    buttons[2].addEventListener('click', findNext);   // ↓
    buttons[3].addEventListener('click', close);      // ×
    buttons[4].addEventListener('click', replaceCurrent);  // Replace
    buttons[5].addEventListener('click', replaceAll);      // All

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

  function toggleCase() {
    caseSensitive = !caseSensitive;
    caseSensitiveBtn.classList.toggle('active', caseSensitive);
    onSearchChange();
  }

  function onSearchChange() {
    const query = findInput.value;
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta || !query) {
      matches = [];
      currentMatchIdx = -1;
      countEl.textContent = '';
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
    }

    if (matches.length > 0) {
      currentMatchIdx = 0;
      selectMatch(0);
    } else {
      currentMatchIdx = -1;
    }

    updateCount();
  }

  function selectMatch(idx) {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta || idx < 0 || idx >= matches.length) return;

    currentMatchIdx = idx;
    const match = matches[idx];
    ta.focus();
    ta.setSelectionRange(match.start, match.end);

    // Scroll match into view
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const textBefore = ta.value.slice(0, match.start);
    const lineNum = textBefore.split('\n').length - 1;
    const targetScroll = lineNum * lineHeight - ta.clientHeight / 2;
    ta.scrollTop = Math.max(0, targetScroll);

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
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta || currentMatchIdx < 0 || matches.length === 0) return;

    const match = matches[currentMatchIdx];
    ta.focus();
    ta.setSelectionRange(match.start, match.end);
    document.execCommand('insertText', false, replaceInput.value);

    window.Paddown.editor.render();
    onSearchChange();
  }

  function replaceAll() {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta || matches.length === 0) return;

    const query = findInput.value;
    const replacement = replaceInput.value;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);

    // Select all text and replace to preserve undo
    ta.focus();
    ta.select();
    document.execCommand('insertText', false, ta.value.replace(regex, replacement));

    window.Paddown.editor.render();
    onSearchChange();
  }

  function updateCount() {
    if (matches.length === 0) {
      countEl.textContent = findInput.value ? 'No results' : '';
    } else {
      countEl.textContent = `${currentMatchIdx + 1} of ${matches.length}`;
    }
  }

  function open(showReplace) {
    if (!barEl) build();
    isOpen = true;
    barEl.classList.add('open');
    replaceRow.style.display = showReplace ? '' : 'none';

    // Pre-fill with selection
    const ta = window.Paddown.tabs?.getActiveTextarea();
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

    // Return focus to editor
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (ta) ta.focus();
  }

  function isVisible() {
    return isOpen;
  }

  // Handle F3 / Shift+F3 globally
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
    return false;
  }

  return { open, close, isVisible, handleKeydown };
})();
