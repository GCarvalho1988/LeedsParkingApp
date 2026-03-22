import { TENANT_ID, CLIENT_ID } from './config.js';

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

const GRAPH_SCOPES = ['Sites.ReadWrite.All'];

let msalInstance = null;

/**
 * Initialises the MSAL PublicClientApplication.
 * Must be called before any other auth function.
 * Depends on the global `msal` object loaded from the CDN script tag.
 */
export function initMsal() {
  // eslint-disable-next-line no-undef
  msalInstance = new msal.PublicClientApplication(msalConfig);
}

/**
 * Must be called on every page load, before checking for an active account.
 * Processes the auth response when the browser returns from an Entra ID redirect.
 * Returns null if no redirect response is present.
 */
export async function handleRedirect() {
  return msalInstance.handleRedirectPromise();
}

/**
 * Returns the first active MSAL account, or null if not signed in.
 */
export function getAccount() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Acquires a Graph access token silently.
 * Falls back to a redirect if the silent call fails (e.g. token expired).
 * Returns the access token string, or undefined if a redirect was triggered.
 */
export async function getToken() {
  const account = getAccount();
  if (!account) throw new Error('No MSAL account found — call handleRedirect first.');

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    });
    return result.accessToken;
  } catch {
    // Silent acquisition failed — redirect to Entra ID to refresh
    await msalInstance.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    // Page will redirect; execution stops here
  }
}

/**
 * Initiates an Entra ID login redirect.
 * Called when no active account is found on startup.
 */
export async function login() {
  await msalInstance.loginRedirect({ scopes: GRAPH_SCOPES });
}
