/**
 * Paddown — File I/O
 * Tauri invoke wrappers for open/save dialogs and file read/write.
 * Line ending detection and preservation.
 */
window.Paddown = window.Paddown || {};

window.Paddown.fileIO = (() => {
  function isDesktop() {
    return typeof window.__TAURI__ !== 'undefined';
  }

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  // ─── Line Ending Helpers ────────────────────────────────────

  function detectLineEnding(content) {
    if (content.includes('\r\n')) return '\r\n';
    if (content.includes('\n')) return '\n';
    // No line breaks — use Windows default
    return '\r\n';
  }

  function normalizeForEditor(content) {
    return content.replace(/\r\n/g, '\n');
  }

  function denormalizeForSave(content, lineEnding) {
    // First normalize to LF, then apply target
    const normalized = content.replace(/\r\n/g, '\n');
    if (lineEnding === '\r\n') {
      return normalized.replace(/\n/g, '\r\n');
    }
    return normalized;
  }

  // ─── File Operations ────────────────────────────────────────

  async function getMtime(path) {
    try { return await invoke('get_file_mtime', { path }); } catch (_) { return null; }
  }

  async function openFile() {
    if (!isDesktop()) return null;

    const filePath = await invoke('show_open_dialog');
    if (!filePath) return null;

    const rawContent = await invoke('read_file', { path: filePath });
    const lineEnding = detectLineEnding(rawContent);
    const content = normalizeForEditor(rawContent);
    const mtime = await getMtime(filePath);

    return { filePath, content, lineEnding, mtime };
  }

  async function saveFile(content, currentPath, lineEnding) {
    if (!isDesktop()) return null;

    const path = currentPath || await invoke('show_save_dialog', {
      defaultName: 'Untitled.md'
    });
    if (!path) return null;

    const finalContent = denormalizeForSave(content, lineEnding);
    await invoke('write_file', { path, contents: finalContent });
    const mtime = await getMtime(path);

    return { path, mtime };
  }

  async function saveFileAs(content, lineEnding, currentName) {
    if (!isDesktop()) return null;

    const path = await invoke('show_save_dialog', {
      defaultName: currentName || 'Untitled.md'
    });
    if (!path) return null;

    const finalContent = denormalizeForSave(content, lineEnding);
    await invoke('write_file', { path, contents: finalContent });
    const mtime = await getMtime(path);

    return { path, mtime };
  }

  async function readFileContent(filePath) {
    const rawContent = await invoke('read_file', { path: filePath });
    const lineEnding = detectLineEnding(rawContent);
    const content = normalizeForEditor(rawContent);
    const mtime = await getMtime(filePath);
    return { content, lineEnding, mtime };
  }

  return {
    isDesktop,
    detectLineEnding,
    normalizeForEditor,
    denormalizeForSave,
    openFile,
    saveFile,
    saveFileAs,
    readFileContent,
    getMtime
  };
})();
