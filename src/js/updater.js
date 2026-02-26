/**
 * Paddown — Update Checker
 * Checks GitHub Releases for newer versions on launch (with delay).
 * Shows a non-intrusive notification bar at the top of the window.
 */
window.Paddown = window.Paddown || {};

window.Paddown.updater = (() => {
  const CHECK_DELAY_MS = 5000; // wait 5s after launch before checking

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
  }

  function showUpdateBar(version, url) {
    // Don't show if already showing
    if (document.getElementById('update-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.innerHTML =
      `<span>Paddown v${version} is available</span>` +
      `<a id="update-link" href="#">Download</a>` +
      `<button id="update-dismiss" title="Dismiss">\u00D7</button>`;

    // Insert at the very top of body
    document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById('update-link').addEventListener('click', (e) => {
      e.preventDefault();
      if (url && window.__TAURI__?.shell?.open) {
        window.__TAURI__.shell.open(url);
      }
    });

    document.getElementById('update-dismiss').addEventListener('click', () => {
      bar.remove();
    });
  }

  async function check() {
    try {
      const currentVersion = await invoke('get_app_version');
      const result = await invoke('check_for_updates', {
        current_version: currentVersion
      });
      if (result) {
        showUpdateBar(result.version, result.url);
      }
    } catch (err) {
      // Silently fail — update check is non-critical
      console.debug('Update check failed:', err);
    }
  }

  function init() {
    if (!window.Paddown.fileIO.isDesktop()) return;
    setTimeout(check, CHECK_DELAY_MS);
  }

  return { init, check };
})();
