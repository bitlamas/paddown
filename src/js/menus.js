/**
 * Paddown — Menu Bar
 * HTML/CSS menu bar with File, Edit, View, Help menus.
 * Dispatches actions to other modules.
 */
window.Paddown = window.Paddown || {};

window.Paddown.menus = (() => {
  let menuBarEl;
  let activeMenu = null;
  let actions = {};

  function setActions(a) {
    actions = a;
  }

  const MENUS = {
    file: {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', action: 'newTab' },
        { label: 'Open\u2026', shortcut: 'Ctrl+O', action: 'open' },
        { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
        { label: 'Save As\u2026', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
        { label: 'Export as HTML\u2026', action: 'exportHtml' },
        { type: 'separator' },
        { label: 'Close Tab', shortcut: 'Ctrl+W', action: 'closeTab' },
        { label: 'Exit', action: 'exit' }
      ]
    },
    edit: {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo' },
        { type: 'separator' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
        { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
        { label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
        { label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' },
        { type: 'separator' },
        { label: 'Find\u2026', shortcut: 'Ctrl+F', action: 'find' },
        { label: 'Replace\u2026', shortcut: 'Ctrl+H', action: 'replace' }
      ]
    },
    view: {
      label: 'View',
      items: [
        { label: 'Split View', action: 'viewSplit', checkable: true, mode: 'split' },
        { label: 'Editor Only', action: 'viewEditor', checkable: true, mode: 'editor-only' },
        { label: 'Preview Only', action: 'viewPreview', checkable: true, mode: 'preview-only' },
        { type: 'separator' },
        { label: 'Toggle Toolbar', action: 'toggleToolbar' },
        { type: 'separator' },
        { label: 'Zoom In', shortcut: 'Ctrl+=', action: 'zoomIn' },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: 'zoomOut' },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: 'zoomReset' }
      ]
    },
    help: {
      label: 'Help',
      items: [
        { label: 'About Paddown', action: 'about' }
      ]
    }
  };

  function buildMenuBar() {
    menuBarEl.innerHTML = '';

    Object.entries(MENUS).forEach(([key, menu]) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      menuItem.dataset.menu = key;

      const trigger = document.createElement('button');
      trigger.className = 'menu-trigger';
      trigger.textContent = menu.label;
      trigger.addEventListener('mousedown', (e) => {
        e.preventDefault();
        toggleMenu(key);
      });
      trigger.addEventListener('mouseenter', () => {
        if (activeMenu && activeMenu !== key) {
          openMenu(key);
        }
      });

      const dropdown = document.createElement('div');
      dropdown.className = 'menu-dropdown';
      dropdown.dataset.menu = key;

      menu.items.forEach(item => {
        if (item.type === 'separator') {
          const sep = document.createElement('div');
          sep.className = 'menu-separator';
          dropdown.appendChild(sep);
          return;
        }

        const row = document.createElement('div');
        row.className = 'menu-row';
        if (item.disabled) row.classList.add('disabled');

        // Check mark for view modes
        if (item.checkable) {
          const check = document.createElement('span');
          check.className = 'menu-check';
          check.dataset.mode = item.mode;
          const currentMode = window.Paddown.views?.getMode();
          check.textContent = currentMode === item.mode ? '\u2713' : '';
          row.appendChild(check);
        }

        const label = document.createElement('span');
        label.className = 'menu-label';
        label.textContent = item.label;
        row.appendChild(label);

        if (item.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'menu-shortcut';
          shortcut.textContent = item.shortcut;
          row.appendChild(shortcut);
        }

        row.addEventListener('click', () => {
          closeAll();
          if (actions[item.action]) actions[item.action]();
        });

        dropdown.appendChild(row);
      });

      menuItem.appendChild(trigger);
      menuItem.appendChild(dropdown);
      menuBarEl.appendChild(menuItem);
    });
  }

  function toggleMenu(key) {
    if (activeMenu === key) {
      closeAll();
    } else {
      openMenu(key);
    }
  }

  function updateCheckmarks() {
    const currentMode = window.Paddown.views?.getMode();
    menuBarEl.querySelectorAll('.menu-check').forEach(check => {
      check.textContent = check.dataset.mode === currentMode ? '\u2713' : '';
    });
  }

  function openMenu(key) {
    closeAll();
    updateCheckmarks();
    activeMenu = key;
    const trigger = menuBarEl.querySelector(`.menu-item[data-menu="${key}"] .menu-trigger`);
    const dropdown = menuBarEl.querySelector(`.menu-dropdown[data-menu="${key}"]`);
    if (trigger) trigger.classList.add('active');
    if (dropdown) dropdown.classList.add('open');
  }

  function closeAll() {
    activeMenu = null;
    menuBarEl.querySelectorAll('.menu-trigger').forEach(el => el.classList.remove('active'));
    menuBarEl.querySelectorAll('.menu-dropdown').forEach(el => el.classList.remove('open'));
  }

  function init() {
    menuBarEl = document.getElementById('menu-bar');
    buildMenuBar();

    // Close menus when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (activeMenu && !menuBarEl.contains(e.target)) {
        closeAll();
      }
    });
  }

  return { init, setActions, closeAll };
})();
