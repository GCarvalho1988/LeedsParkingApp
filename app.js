import { getName } from './identity.js';
import { renderIdentityOverlay, render } from './ui.js';

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
