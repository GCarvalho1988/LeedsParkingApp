const STORAGE_KEY = 'parkingTheme';

/** @returns {'light' | 'dark' | 'system'} */
function getPreference() {
  return localStorage.getItem(STORAGE_KEY) || 'system';
}

/** @param {'light' | 'dark' | 'system'} value */
function setPreference(value) {
  localStorage.setItem(STORAGE_KEY, value);
}

let _mediaListener = null;
let _mq = null;

function _applyDark() {
  document.documentElement.setAttribute('data-theme', 'dark');
}

function _applyLight() {
  document.documentElement.removeAttribute('data-theme');
}

function _removeMediaListener() {
  if (_mediaListener && _mq) {
    _mq.removeEventListener('change', _mediaListener);
    _mediaListener = null;
    _mq = null;
  }
}

/**
 * Reads the stored preference and applies the correct theme to <html>.
 * Must be called before any UI renders to avoid flash of wrong theme.
 */
export function applyTheme() {
  _removeMediaListener();

  const pref = getPreference();

  if (pref === 'dark') {
    _applyDark();
  } else if (pref === 'light') {
    _applyLight();
  } else {
    // system — follow OS, update on change
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.matches) {
      _applyDark();
    } else {
      _applyLight();
    }
    _mq = mq;
    _mediaListener = (e) => {
      if (getPreference() === 'system') {
        e.matches ? _applyDark() : _applyLight();
      }
    };
    _mq.addEventListener('change', _mediaListener);
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
