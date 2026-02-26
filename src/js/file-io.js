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

  async function openFile() {
    if (!isDesktop()) return null;

    const filePath = await invoke('show_open_dialog');
    if (!filePath) return null;

    const rawContent = await invoke('read_file', { path: filePath });
    const lineEnding = detectLineEnding(rawContent);
    const content = normalizeForEditor(rawContent);

    return { filePath, content, lineEnding };
  }

  async function saveFile(content, currentPath, lineEnding) {
    if (!isDesktop()) return null;

    const path = currentPath || await invoke('show_save_dialog', {
      default_name: 'Untitled.md'
    });
    if (!path) return null;

    const finalContent = denormalizeForSave(content, lineEnding);
    await invoke('write_file', { path, contents: finalContent });

    return path;
  }

  async function saveFileAs(content, lineEnding, currentName) {
    if (!isDesktop()) return null;

    const path = await invoke('show_save_dialog', {
      default_name: currentName || 'Untitled.md'
    });
    if (!path) return null;

    const finalContent = denormalizeForSave(content, lineEnding);
    await invoke('write_file', { path, contents: finalContent });

    return path;
  }

  return {
    isDesktop,
    detectLineEnding,
    normalizeForEditor,
    denormalizeForSave,
    openFile,
    saveFile,
    saveFileAs
  };
})();
