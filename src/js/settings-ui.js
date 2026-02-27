/**
 * Paddown — Settings UI
 * Settings modal with startup behavior options.
 */
window.Paddown = window.Paddown || {};

window.Paddown.settingsUI = (() => {

  function open() {
    if (document.getElementById('settings-overlay')) return;

    const settings = window.Paddown.settings;
    const currentMode = settings.get('startupMode') || 'welcome';

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';

    const card = document.createElement('div');
    card.id = 'settings-card';

    // Header
    const header = document.createElement('h2');
    header.textContent = 'Settings';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'about-close';
    closeBtn.textContent = '\u00D7';

    // Section: On Startup
    const section = document.createElement('div');
    section.className = 'settings-section';

    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'settings-section-label';
    sectionLabel.textContent = 'On Startup';
    section.appendChild(sectionLabel);

    const options = [
      { value: 'restore', label: 'Remember open files' },
      { value: 'blank', label: 'Start with blank tab' },
      { value: 'welcome', label: 'Start with welcome example' }
    ];

    options.forEach(opt => {
      const row = document.createElement('label');
      row.className = 'settings-radio';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'startupMode';
      input.value = opt.value;
      input.checked = opt.value === currentMode;

      input.addEventListener('change', () => {
        if (input.checked) {
          settings.set('startupMode', opt.value);
        }
      });

      const text = document.createTextNode(opt.label);
      row.appendChild(input);
      row.appendChild(text);
      section.appendChild(row);
    });

    card.append(header, closeBtn, section);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animate in
    void overlay.offsetHeight;
    overlay.classList.add('visible');

    function close() {
      overlay.classList.remove('visible');
      const fallback = setTimeout(() => overlay.remove(), 300);
      overlay.addEventListener('transitionend', (e) => {
        if (e.target === overlay) { clearTimeout(fallback); overlay.remove(); }
      }, { once: true });
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
  }

  return { open };
})();
