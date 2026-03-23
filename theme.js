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

  const options = [
    { value: 'light',  label: '☀️', title: 'Light mode'  },
    { value: 'dark',   label: '🌙', title: 'Dark mode'   },
    { value: 'system', label: '💻', title: 'Follow system' },
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
    btn.textContent = label;
    btn.title = title;
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
