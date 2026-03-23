import { initMsal, handleRedirect, getAccount, login } from './auth.js';
import { render } from './ui.js';

async function bootstrap() {
  // Step 1: Initialise MSAL (must happen before any other MSAL call)
  initMsal();

  // Step 2: Always process any in-flight redirect response first.
  // This is mandatory for the redirect auth flow — if omitted, the app
  // will loop between login redirects and page loads.
  await handleRedirect();

  // Step 3: Check for an active signed-in account
  const account = getAccount();
  if (!account) {
    // No account found — trigger Entra ID login redirect.
    // The page will redirect; execution ends here.
    await login();
    return;
  }

  // Step 4: User is signed in — render the app
  render();
}

bootstrap().catch((err) => {
  console.error('App failed to initialise:', err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<p style="color:#991b1b;padding:1rem;font-size:0.85rem;">Authentication error. Please refresh the page.</p>';
  }
});
