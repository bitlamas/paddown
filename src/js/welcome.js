/**
 * Paddown — Welcome content
 * Shown in the first tab on first launch.
 */
window.Paddown = window.Paddown || {};

window.Paddown.welcome = (() => {
  const CONTENT = [
    '# Welcome to Paddown',
    '',
    'Paddown is a Markdown notepad that renders with professional chat interface styling. Write notes offline, paste into any chat with zero formatting surprises.',
    '',
    '## Quick Start',
    '',
    'Start typing in the **editor** (left pane) and see the **live preview** (right pane) update instantly.',
    '',
    '### Formatting Basics',
    '',
    'Paddown supports all standard Markdown:',
    '',
    '- **Bold** with `**text**`',
    '- *Italic* with `*text*`',
    '- `Inline code` with backticks',
    '- [Links](https://example.com) with `[text](url)`',
    '- Lists, blockquotes, tables, and more',
    '',
    '### Code Blocks',
    '',
    'Fenced code blocks with syntax highlighting:',
    '',
    '```javascript',
    'function greet(name) {',
    '  return `Hello, ${name}!`;',
    '}',
    '```',
    '',
    '## Keyboard Shortcuts',
    '',
    '| Action | Shortcut |',
    '|---|---|',
    '| New tab | Ctrl+N |',
    '| Open file | Ctrl+O |',
    '| Save | Ctrl+S |',
    '| Save As | Ctrl+Shift+S |',
    '| Close tab | Ctrl+W |',
    '| Find | Ctrl+F |',
    '| Replace | Ctrl+H |',
    '| Bold | Ctrl+B |',
    '| Italic | Ctrl+I |',
    '| Inline code | Ctrl+\\` |',
    '| Link | Ctrl+K |',
    '| Cycle view | Ctrl+\\\\ |',
    '',
    '## View Modes',
    '',
    'Switch between three view modes from the **View** menu:',
    '',
    '1. **Split** — editor and preview side by side (default)',
    '2. **Editor only** — full-width writing',
    '3. **Preview only** — full-width rendered output',
    '',
    '---',
    '',
    'This welcome note is just a regular document. Edit it, delete it, or start a new tab — it\u2019s all yours.',
  ].join('\n');

  function getContent() {
    return CONTENT;
  }

  return { getContent };
})();
