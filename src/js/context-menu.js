/**
 * Paddown — Context Menu
 * Custom right-click menu for the editor textarea.
 */
window.Paddown = window.Paddown || {};

window.Paddown.contextMenu = (() => {
  let menuEl;
  let actions = {};

  function setActions(a) {
    actions = a;
  }

  const ITEMS = [
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
    { label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
    { label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' },
    { type: 'separator' },
    { label: 'Bold', shortcut: 'Ctrl+B', action: 'bold' },
    { label: 'Italic', shortcut: 'Ctrl+I', action: 'italic' },
    { label: 'Code', shortcut: 'Ctrl+`', action: 'inlineCode' },
    { label: 'Link', shortcut: 'Ctrl+K', action: 'link' },
    { type: 'separator' },
    { label: 'Find\u2026', shortcut: 'Ctrl+F', action: 'find' }
  ];

  function build() {
    menuEl = document.createElement('div');
    menuEl.id = 'context-menu';
    menuEl.className = 'context-menu';

    ITEMS.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        menuEl.appendChild(sep);
        return;
      }

      const row = document.createElement('div');
      row.className = 'menu-row';

      const label = document.createElement('span');
      label.className = 'menu-label';
      label.textContent = item.label;
      row.appendChild(label);

      const shortcut = document.createElement('span');
      shortcut.className = 'menu-shortcut';
      shortcut.textContent = item.shortcut;
      row.appendChild(shortcut);

      row.addEventListener('click', () => {
        hide();
        if (actions[item.action]) actions[item.action]();
      });

      menuEl.appendChild(row);
    });

    document.body.appendChild(menuEl);
  }

  function show(x, y) {
    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
    menuEl.classList.add('open');

    // Keep within viewport
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuEl.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menuEl.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    });
  }

  function hide() {
    menuEl.classList.remove('open');
  }

  function init() {
    build();

    // Intercept right-click on editor pane
    document.getElementById('editor-pane').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      show(e.clientX, e.clientY);
    });

    // Close on click outside
    document.addEventListener('mousedown', (e) => {
      if (!menuEl.contains(e.target)) hide();
    });
  }

  return { init, setActions, hide };
})();
