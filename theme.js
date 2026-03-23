const STORAGE_KEY = 'parkingTheme';

/** @returns {'light' | 'dark' | 'system'} */
function getPreference() {
  return localStorage.getItem(STORAGE_KEY) || 'system';
}

/** @param {'light' | 'dark' | 'system'} value */
function setPreference(value) {
  localStorage.setItem(STORAGE_KEY, value);
}

/**
 * Reads the stored preference and applies the correct theme to <html>.
 * - 'dark'   → data-theme="dark"  (explicit dark CSS rules apply)
 * - 'light'  → data-theme="light" (no dark rules; system media query excluded by attribute)
 * - 'system' → no attribute       (CSS @media prefers-color-scheme handles it automatically)
 *
 * Must be called before any UI renders to avoid flash of wrong theme.
 */
export function applyTheme() {
  const pref = getPreference();
  if (pref === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (pref === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Builds and returns the theme toggle pill element.
 * Wire up after injection into the DOM.
 */
export function buildToggle() {
  const wrap = document.createElement('div');
  wrap.className = 'theme-toggle';
  wrap.setAttribute('aria-label', 'Theme');

  const icons = {
    light: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
    </svg>`,
    dark: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    system: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`,
  };

  const options = [
    { value: 'light',  label: 'Light',  title: 'Light mode'    },
    { value: 'dark',   label: 'Dark',   title: 'Dark mode'     },
    { value: 'system', label: 'Auto',   title: 'Follow system' },
  ];

  function updateActive() {
    const current = getPreference();
    wrap.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.classList.toggle('theme-toggle-active', btn.dataset.value === current);
    });
  }

  options.forEach(({ value, label, title }) => {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.dataset.value = value;
    btn.setAttribute('aria-label', title);
    btn.title = title;
    btn.innerHTML = `${icons[value]}<span class="theme-toggle-label">${label}</span>`;
    btn.addEventListener('click', () => {
      setPreference(value);
      applyTheme();
      updateActive();
    });
    wrap.appendChild(btn);
  });

  updateActive();
  return wrap;
}
