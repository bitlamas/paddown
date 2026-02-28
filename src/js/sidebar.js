/**
 * Paddown — Sidebar
 * Project folder browser with collapsible tree, context menus,
 * drag-to-reorder, filesystem watching, and "Other" section.
 */
window.Paddown = window.Paddown || {};

window.Paddown.sidebar = (() => {
  let sidebarEl, treeEl, addBtn;
  let projects = [];       // [{ path, displayName, order, tree, error }]
  let expandedNodes = {};  // { "C:\\path": true }
  let visible = false;

  // Debounce timers for fs-change events, keyed by project path
  const rescanTimers = {};
  let fsUnlisten = null;

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  // ─── Path Helpers ──────────────────────────────────────────

  function normalizePath(p) {
    return p.replace(/\//g, '\\').replace(/\\$/, '').toLowerCase();
  }

  function isUnderProject(filePath, projectPath) {
    if (!filePath || !projectPath) return false;
    return normalizePath(filePath).startsWith(normalizePath(projectPath) + '\\');
  }

  function folderName(p) {
    return p.replace(/\\/g, '/').split('/').pop() || p;
  }

  // ─── SVG Icons (14x14, currentColor) ──────────────────────

  const ICONS = {
    chevron: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 3a1 1 0 011-1h3l1.5 1.5h4a1 1 0 011 1v6a1 1 0 01-1 1h-8.5a1 1 0 01-1-1V3z" stroke="currentColor" stroke-width="1.2"/></svg>',
    file: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 1.5h4.5l3 3v7.5a1 1 0 01-1 1h-6.5a1 1 0 01-1-1v-9.5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5v3h3" stroke="currentColor" stroke-width="1.2"/></svg>',
    error: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4.5v3M7 9v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
  };

  // ─── Visibility ────────────────────────────────────────────

  function show() {
    visible = true;
    sidebarEl.classList.add('open');
    saveVisibility();
  }

  function hide() {
    visible = false;
    sidebarEl.classList.remove('open');
    saveVisibility();
  }

  function toggle() {
    if (visible) hide(); else show();
  }

  function saveVisibility() {
    const { settings, fileIO } = window.Paddown;
    if (fileIO.isDesktop()) settings.set('sidebarVisible', visible);
  }

  // ─── Project Management ────────────────────────────────────

  async function addProject() {
    const { fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;

    try {
      const path = await invoke('show_folder_dialog');
      if (!path) return;

      // Already added?
      if (projects.some(p => normalizePath(p.path) === normalizePath(path))) return;

      const project = {
        path,
        displayName: null,
        order: projects.length,
        tree: null,
        error: false
      };

      projects.push(project);

      // Show sidebar if hidden
      if (!visible) show();

      await scanProject(project);
      renderTree();
      startWatching(project.path);
      saveToSettings();
    } catch (err) {
      console.error('Add project failed:', err);
    }
  }

  function removeProject(path) {
    const idx = projects.findIndex(p => p.path === path);
    if (idx === -1) return;

    const name = projects[idx].displayName || folderName(path);
    if (!confirm(`Remove "${name}" from sidebar?\n\nFiles on disk will not be affected.`)) return;

    stopWatching(path);
    projects.splice(idx, 1);

    // Clean up expanded nodes under this project
    const norm = normalizePath(path);
    Object.keys(expandedNodes).forEach(k => {
      if (normalizePath(k).startsWith(norm)) delete expandedNodes[k];
    });

    renderTree();
    saveToSettings();
  }

  function renameProject(path) {
    const project = projects.find(p => p.path === path);
    if (!project) return;

    const current = project.displayName || folderName(path);
    const name = prompt('Display name for this project:', current);
    if (name === null) return;

    project.displayName = name.trim() || null;
    renderTree();
    saveToSettings();
  }

  // ─── Scanning ──────────────────────────────────────────────

  async function scanProject(project) {
    const { settings } = window.Paddown;
    const exts = settings.get('sidebarFileExtensions') || ['md', 'markdown'];

    try {
      const tree = await invoke('scan_directory', {
        path: project.path,
        extensions: exts
      });
      project.tree = tree;
      project.error = false;
    } catch (err) {
      project.tree = null;
      project.error = true;
      console.warn('Scan failed for', project.path, err);
    }
  }

  async function scanAllProjects() {
    await Promise.all(projects.map(p => scanProject(p)));
  }

  async function refreshProject(path) {
    const project = projects.find(p => p.path === path);
    if (!project) return;
    await scanProject(project);
    renderTree();
  }

  // ─── Tree Rendering ───────────────────────────────────────

  function renderTree() {
    treeEl.innerHTML = '';

    if (projects.length === 0) {
      renderEmptyState();
      return;
    }

    projects.forEach(project => {
      renderProjectNode(project);
    });

    renderOtherSection();
    updateActiveHighlight();
  }

  function renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty';
    empty.innerHTML = '<span>No projects added</span>';

    const btn = document.createElement('button');
    btn.textContent = 'Add Folder';
    btn.addEventListener('click', addProject);
    empty.appendChild(btn);

    treeEl.appendChild(empty);
  }

  function renderProjectNode(project) {
    const el = document.createElement('div');
    el.className = 'sidebar-node sidebar-project-root' + (project.error ? ' error' : '');
    el.dataset.path = project.path;
    el.dataset.type = 'project';

    const isExpanded = expandedNodes[project.path] !== false; // default expanded
    const depth = 0;
    el.style.paddingLeft = (depth * 16 + 8) + 'px';

    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'arrow' + (isExpanded && !project.error ? ' expanded' : '');
    arrow.innerHTML = ICONS.chevron;
    el.appendChild(arrow);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.innerHTML = project.error ? ICONS.error : ICONS.folder;
    el.appendChild(icon);

    // Label
    const label = document.createElement('span');
    label.className = 'node-label';
    if (project.displayName) {
      label.textContent = project.displayName;
      const sub = document.createElement('span');
      sub.className = 'node-subtitle';
      sub.textContent = '(' + folderName(project.path) + ')';
      label.appendChild(sub);
    } else {
      label.textContent = folderName(project.path);
    }
    el.appendChild(label);

    // Error tooltip
    if (project.error) {
      el.title = 'Folder not found: ' + project.path;
    }

    // Click to expand/collapse (skip if drag in progress)
    el.addEventListener('click', (e) => {
      if (project.error) return;
      if (dragState && dragState.started) return;
      toggleNode(project.path);
    });

    // Context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showProjectContextMenu(e, project);
    });

    // Drag reorder
    el.addEventListener('mousedown', onProjectMouseDown);

    treeEl.appendChild(el);

    // Render children if expanded
    if (isExpanded && !project.error && project.tree) {
      project.tree.forEach(entry => renderDirEntry(entry, 1));
    }
  }

  function renderDirEntry(entry, depth) {
    const el = document.createElement('div');
    el.className = 'sidebar-node';
    el.dataset.path = entry.path;
    el.dataset.type = entry.is_dir ? 'dir' : 'file';
    el.style.paddingLeft = (depth * 16 + 8) + 'px';

    if (entry.is_dir) {
      const isExpanded = !!expandedNodes[entry.path];

      // Arrow
      const arrow = document.createElement('span');
      arrow.className = 'arrow' + (isExpanded ? ' expanded' : '');
      arrow.innerHTML = ICONS.chevron;
      el.appendChild(arrow);

      // Icon
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.innerHTML = ICONS.folder;
      el.appendChild(icon);

      // Label
      const label = document.createElement('span');
      label.className = 'node-label';
      label.textContent = entry.name;
      el.appendChild(label);

      // Click to expand/collapse
      el.addEventListener('click', () => toggleNode(entry.path));

      treeEl.appendChild(el);

      // Render children if expanded
      if (isExpanded && entry.children) {
        entry.children.forEach(child => renderDirEntry(child, depth + 1));
      }
    } else {
      // Spacer for alignment (no arrow)
      const spacer = document.createElement('span');
      spacer.className = 'arrow';
      spacer.style.visibility = 'hidden';
      spacer.innerHTML = ICONS.chevron;
      el.appendChild(spacer);

      // Icon
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.innerHTML = ICONS.file;
      el.appendChild(icon);

      // Label
      const label = document.createElement('span');
      label.className = 'node-label';
      label.textContent = entry.name;
      el.appendChild(label);

      // Click to open
      el.addEventListener('click', () => openFile(entry.path));

      // Context menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFileContextMenu(e, entry.path);
      });

      treeEl.appendChild(el);
    }
  }

  // ─── "Other" Section ──────────────────────────────────────

  function renderOtherSection() {
    // Remove existing Other container if present
    const existing = treeEl.querySelector('.sidebar-other');
    if (existing) existing.remove();

    const { tabs } = window.Paddown;
    const allTabs = tabs.getAllTabs();

    // Files not under any project
    const otherFiles = allTabs.filter(t => {
      if (!t.filePath) return false;
      return !projects.some(p => isUnderProject(t.filePath, p.path));
    });

    if (otherFiles.length === 0) return;

    const container = document.createElement('div');
    container.className = 'sidebar-other';

    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.textContent = 'OTHER';
    container.appendChild(label);

    otherFiles.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'sidebar-node';
      el.dataset.path = tab.filePath;
      el.dataset.type = 'other';
      el.style.paddingLeft = '8px';

      // Icon
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.innerHTML = ICONS.file;
      el.appendChild(icon);

      // Label
      const nameLabel = document.createElement('span');
      nameLabel.className = 'node-label';
      nameLabel.textContent = tab.title;
      el.appendChild(nameLabel);

      el.addEventListener('click', () => tabs.switchTab(tab.id));

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showOtherContextMenu(e, tab.filePath);
      });

      container.appendChild(el);
    });

    treeEl.appendChild(container);
  }

  // ─── File Opening ─────────────────────────────────────────

  async function openFile(filePath) {
    const { tabs, editor, fileIO, settings } = window.Paddown;

    // Deduplicate: check existing tabs (normalized for Windows path comparison)
    const normFile = normalizePath(filePath);
    const existing = tabs.getAllTabs().find(t => t.filePath && normalizePath(t.filePath) === normFile);
    if (existing) {
      tabs.switchTab(existing.id);
      return;
    }

    try {
      const rawContent = await invoke('read_file', { path: filePath });
      const lineEnding = fileIO.detectLineEnding(rawContent);
      const content = fileIO.normalizeForEditor(rawContent);

      if (fileIO.isDesktop()) settings.addRecentFile(filePath);

      // Load into blank untitled tab if available
      const active = tabs.getActiveTab();
      if (tabs.isTabBlankUntitled(active)) {
        tabs.loadIntoTab(active.id, content, filePath, lineEnding);
        editor.render();
      } else {
        tabs.createTab({
          title: filePath.split(/[/\\]/).pop(),
          filePath,
          content,
          lineEnding
        });
      }

      updateActiveHighlight();
    } catch (err) {
      console.error('Failed to open file from sidebar:', err);
    }
  }

  // ─── Node Expand/Collapse ─────────────────────────────────

  function toggleNode(path) {
    // Project roots default to expanded
    const isProject = projects.some(p => p.path === path);
    if (isProject) {
      expandedNodes[path] = expandedNodes[path] === false ? true : false;
    } else {
      expandedNodes[path] = !expandedNodes[path];
    }
    renderTree();
    saveExpandedState();
  }

  function collapseAllUnder(projectPath) {
    const norm = normalizePath(projectPath);
    Object.keys(expandedNodes).forEach(k => {
      if (normalizePath(k).startsWith(norm)) {
        expandedNodes[k] = false;
      }
    });
    expandedNodes[projectPath] = false;
    renderTree();
    saveExpandedState();
  }

  // ─── Active Highlight ─────────────────────────────────────

  function updateActiveHighlight() {
    if (!treeEl) return;

    // Refresh "Other" section (lightweight — only replaces its own container)
    renderOtherSection();

    const { tabs } = window.Paddown;
    const active = tabs.getActiveTab();
    const activePath = active?.filePath;

    treeEl.querySelectorAll('.sidebar-node.active').forEach(el => el.classList.remove('active'));

    if (!activePath) return;

    treeEl.querySelectorAll('.sidebar-node').forEach(el => {
      if (el.dataset.path === activePath) {
        el.classList.add('active');
      }
    });
  }

  // ─── Context Menus ────────────────────────────────────────

  let activeContextMenu = null;

  function closeContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
    document.removeEventListener('mousedown', onContextMenuOutside);
  }

  function showContextMenu(e, items) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu open';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    items.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        menu.appendChild(sep);
        return;
      }

      const row = document.createElement('div');
      row.className = 'menu-row';

      const label = document.createElement('span');
      label.className = 'menu-label';
      label.textContent = item.label;
      row.appendChild(label);

      row.addEventListener('click', () => {
        closeContextMenu();
        item.action();
      });

      menu.appendChild(row);
    });

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Adjust position if overflows viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 4) + 'px';
    }

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('mousedown', onContextMenuOutside);
    }, 0);
  }

  function onContextMenuOutside(e) {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) {
      closeContextMenu();
    }
  }

  function showProjectContextMenu(e, project) {
    showContextMenu(e, [
      { label: 'Rename\u2026', action: () => renameProject(project.path) },
      { label: 'Refresh', action: () => refreshProject(project.path) },
      { label: 'Collapse All', action: () => collapseAllUnder(project.path) },
      { type: 'separator' },
      { label: 'Remove', action: () => removeProject(project.path) }
    ]);
  }

  function showFileContextMenu(e, filePath) {
    showContextMenu(e, [
      { label: 'Open', action: () => openFile(filePath) },
      { label: 'Reveal in File Explorer', action: () => revealInExplorer(filePath) }
    ]);
  }

  function showOtherContextMenu(e, filePath) {
    showContextMenu(e, [
      { label: 'Reveal in File Explorer', action: () => revealInExplorer(filePath) }
    ]);
  }

  async function revealInExplorer(filePath) {
    try {
      await invoke('reveal_in_explorer', { path: filePath });
    } catch (err) {
      console.error('Reveal failed:', err);
    }
  }

  // ─── Drag-to-Reorder Projects ─────────────────────────────

  let dragState = null;

  function onProjectMouseDown(e) {
    if (e.button !== 0) return;
    const node = e.currentTarget;
    if (node.dataset.type !== 'project') return;

    dragState = {
      path: node.dataset.path,
      startY: e.clientY,
      started: false,
      el: node
    };

    document.addEventListener('mousemove', onProjectDragMove);
    document.addEventListener('mouseup', onProjectDragUp);
  }

  function onProjectDragMove(e) {
    if (!dragState) return;

    if (!dragState.started) {
      if (Math.abs(e.clientY - dragState.startY) < 5) return;
      dragState.started = true;
      dragState.el.style.opacity = '0.4';
    }

    // Clear existing indicators
    treeEl.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
      el.classList.remove('drag-over-above', 'drag-over-below');
    });

    // Find project root node under cursor
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    const targetNode = target.closest('.sidebar-project-root');
    if (!targetNode || targetNode.dataset.path === dragState.path) return;

    const rect = targetNode.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      targetNode.classList.add('drag-over-above');
    } else {
      targetNode.classList.add('drag-over-below');
    }
  }

  function onProjectDragUp(e) {
    document.removeEventListener('mousemove', onProjectDragMove);
    document.removeEventListener('mouseup', onProjectDragUp);

    if (!dragState) return;

    const didDrag = dragState.started;

    if (didDrag) {
      dragState.el.style.opacity = '';

      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetNode = target ? target.closest('.sidebar-project-root') : null;

      if (targetNode && targetNode.dataset.path !== dragState.path) {
        const fromIdx = projects.findIndex(p => p.path === dragState.path);
        const toIdx = projects.findIndex(p => p.path === targetNode.dataset.path);

        if (fromIdx !== -1 && toIdx !== -1) {
          const rect = targetNode.getBoundingClientRect();
          const insertIdx = e.clientY < rect.top + rect.height / 2 ? toIdx : toIdx + 1;
          const [moved] = projects.splice(fromIdx, 1);
          const adjustedIdx = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
          projects.splice(adjustedIdx, 0, moved);
          saveToSettings();
        }
      }

      treeEl.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
    }

    dragState = null;
    if (didDrag) renderTree();
  }

  // ─── Filesystem Watching ──────────────────────────────────

  async function startWatching(path) {
    const { fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;
    try {
      await invoke('start_watching', { path });
    } catch (err) {
      console.warn('Failed to start watching:', path, err);
    }
  }

  async function stopWatching(path) {
    const { fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;
    if (rescanTimers[path]) {
      clearTimeout(rescanTimers[path]);
      delete rescanTimers[path];
    }
    try {
      await invoke('stop_watching', { path });
    } catch (err) {
      console.warn('Failed to stop watching:', path, err);
    }
  }

  function stopAllWatching() {
    projects.forEach(p => {
      stopWatching(p.path);
    });
  }

  async function setupFsListener() {
    const { fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;
    if (!window.__TAURI__?.event?.listen) return;
    if (fsUnlisten) return; // already listening

    fsUnlisten = await window.__TAURI__.event.listen('fs-change', (event) => {
      const changedPath = event.payload;
      const project = projects.find(p => normalizePath(p.path) === normalizePath(changedPath));
      if (!project) return;

      // Debounce rescan per-project (300ms)
      if (rescanTimers[project.path]) {
        clearTimeout(rescanTimers[project.path]);
      }
      rescanTimers[project.path] = setTimeout(async () => {
        delete rescanTimers[project.path];
        await scanProject(project);
        renderTree();
      }, 300);
    });
  }

  // ─── Settings Persistence ─────────────────────────────────

  async function loadFromSettings() {
    const { settings, fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;

    const savedProjects = settings.get('sidebarProjects') || [];
    expandedNodes = settings.get('sidebarExpanded') || {};

    projects = savedProjects.map(sp => ({
      path: sp.path,
      displayName: sp.displayName || null,
      order: sp.order || 0,
      tree: null,
      error: false
    }));

    if (projects.length > 0) {
      await scanAllProjects();
      renderTree();

      // Start watchers for all projects
      projects.forEach(p => {
        if (!p.error) startWatching(p.path);
      });
    }

    setupFsListener();
  }

  function saveToSettings() {
    const { settings, fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;

    const savedProjects = projects.map((p, i) => ({
      path: p.path,
      displayName: p.displayName,
      order: i
    }));

    settings.set('sidebarProjects', savedProjects);
    saveExpandedState();
  }

  function saveExpandedState() {
    const { settings, fileIO } = window.Paddown;
    if (!fileIO.isDesktop()) return;
    settings.set('sidebarExpanded', { ...expandedNodes });
  }

  // ─── Init ─────────────────────────────────────────────────

  function init() {
    sidebarEl = document.getElementById('sidebar');
    treeEl = sidebarEl.querySelector('.sidebar-tree');
    addBtn = sidebarEl.querySelector('.sidebar-add');

    addBtn.addEventListener('click', addProject);

    // Cancel drag on blur
    window.addEventListener('blur', () => {
      if (dragState) {
        document.removeEventListener('mousemove', onProjectDragMove);
        document.removeEventListener('mouseup', onProjectDragUp);
        if (dragState.started) {
          dragState.el.style.opacity = '';
          treeEl.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
            el.classList.remove('drag-over-above', 'drag-over-below');
          });
        }
        dragState = null;
        renderTree();
      }
    });
  }

  return {
    init,
    show,
    hide,
    toggle,
    addProject,
    loadFromSettings,
    updateActiveHighlight,
    stopAllWatching,
    renderTree
  };
})();
