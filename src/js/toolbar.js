/**
 * Paddown — Formatting Toolbar
 * Markdown formatting buttons that wrap selected text.
 * Hideable via View menu.
 */
window.Paddown = window.Paddown || {};

window.Paddown.toolbar = (() => {
  let barEl;
  let visible = true;

  const BUTTONS = [
    { label: 'B', title: 'Bold (Ctrl+B)', action: 'bold', style: 'font-weight:700' },
    { label: 'I', title: 'Italic (Ctrl+I)', action: 'italic', style: 'font-style:italic' },
    { label: 'S', title: 'Strikethrough', action: 'strikethrough', style: 'text-decoration:line-through' },
    { type: 'separator' },
    { label: 'H1', title: 'Heading 1', action: 'h1' },
    { label: 'H2', title: 'Heading 2', action: 'h2' },
    { label: 'H3', title: 'Heading 3', action: 'h3' },
    { type: 'separator' },
    { label: '<>', title: 'Inline Code', action: 'inlineCode' },
    { label: '```', title: 'Code Block', action: 'codeBlock' },
    { type: 'separator' },
    { label: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8.5a3 3 0 0 0 4.2.4l2-2a3 3 0 0 0-4.2-4.2L7.3 3.8"/><path d="M9.5 7.5a3 3 0 0 0-4.2-.4l-2 2a3 3 0 0 0 4.2 4.2l1.2-1.1"/></svg>', title: 'Link (Ctrl+K)', action: 'link', svg: true },
    { label: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6" r="1.25"/><path d="M14.5 10.5l-3.5-3L5 13.5h9a1.5 1.5 0 0 0 .5-.1"/></svg>', title: 'Image', action: 'image', svg: true },
    { type: 'separator' },
    { label: '\u2022', title: 'Bullet List', action: 'bulletList' },
    { label: '1.', title: 'Numbered List', action: 'numberedList' },
    { label: '\u2611', title: 'Task List', action: 'taskList' },
    { type: 'separator' },
    { label: '\u201C', title: 'Blockquote', action: 'blockquote' },
    { label: '\u2015', title: 'Horizontal Rule', action: 'hr' },
    { label: '\u2637', title: 'Table', action: 'table' }
  ];

  // Markdown wrapping actions
  const ACTIONS = {
    bold: () => wrapSelection('**', '**'),
    italic: () => wrapSelection('*', '*'),
    strikethrough: () => wrapSelection('~~', '~~'),
    h1: () => prefixLine('# '),
    h2: () => prefixLine('## '),
    h3: () => prefixLine('### '),
    inlineCode: () => wrapSelection('`', '`'),
    codeBlock: () => wrapSelection('```\n', '\n```'),
    link: () => wrapSelection('[', '](url)'),
    image: () => wrapSelection('![', '](url)'),
    bulletList: () => prefixLine('- '),
    numberedList: () => prefixLine('1. '),
    taskList: () => prefixLine('- [ ] '),
    blockquote: () => prefixLine('> '),
    hr: () => insertText('\n---\n'),
    table: () => insertText('\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n')
  };

  function wrapSelection(before, after) {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || 'text';

    ta.focus();
    ta.setSelectionRange(start, end);
    document.execCommand('insertText', false, before + selected + after);

    // Select the inner text
    const newStart = start + before.length;
    const newEnd = newStart + selected.length;
    ta.setSelectionRange(newStart, newEnd);

    window.Paddown.editor.render();
  }

  function prefixLine(prefix) {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta) return;

    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;

    ta.focus();
    ta.setSelectionRange(lineStart, lineStart);
    document.execCommand('insertText', false, prefix);

    window.Paddown.editor.render();
  }

  function insertText(text) {
    const ta = window.Paddown.tabs?.getActiveTextarea();
    if (!ta) return;

    ta.focus();
    document.execCommand('insertText', false, text);
    window.Paddown.editor.render();
  }

  function getAction(name) {
    return ACTIONS[name] || null;
  }

  function show() {
    visible = true;
    barEl.style.display = '';
  }

  function hide() {
    visible = false;
    barEl.style.display = 'none';
  }

  function toggle() {
    visible ? hide() : show();
  }

  function isVisible() {
    return visible;
  }

  function init() {
    barEl = document.getElementById('toolbar');

    BUTTONS.forEach(btn => {
      if (btn.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'toolbar-separator';
        barEl.appendChild(sep);
        return;
      }

      const el = document.createElement('button');
      el.className = 'toolbar-btn';
      el.title = btn.title;
      if (btn.svg) {
        el.innerHTML = btn.label;
      } else {
        el.textContent = btn.label;
      }
      if (btn.style) el.style.cssText = btn.style;

      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (ACTIONS[btn.action]) ACTIONS[btn.action]();
      });

      barEl.appendChild(el);
    });
  }

  return { init, show, hide, toggle, isVisible, getAction, ACTIONS };
})();
