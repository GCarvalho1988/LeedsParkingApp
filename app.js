import { applyTheme, buildToggle } from './theme.js';
import { getName } from './identity.js';
import { renderIdentityOverlay, render, buildAdminLockIcon } from './ui.js';

// Apply theme immediately — before any UI renders — to avoid flash of wrong theme
applyTheme();

try {
  if (!getName()) {
    renderIdentityOverlay(() => render());
  } else {
    render();
  }
} catch (err) {
  console.error('App failed to initialise:', err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML =
      '<p style="color:#991b1b;padding:1rem;font-size:0.85rem;">Failed to load. Please refresh the page.</p>';
  }
}

// Inject theme toggle and admin lock icon into card header after DOM is ready
const header = document.querySelector('.card-header');
if (header) {
  header.appendChild(buildToggle());
  header.appendChild(buildAdminLockIcon());
}
