/**
 * Connexion OIDC (Authorization Code + PKCE) contre Keycloak, sans dépendance.
 *
 * - `login()` redirige vers Keycloak, `completeLogin()` échange le code au retour.
 * - Les jetons sont gardés en localStorage et rafraîchis automatiquement.
 * - Toutes les requêtes vers notre serveur passent par `authedFetch()`.
 */

export type CloudConfig = {
  /** URL de l'API (ex. https://notes.example.com/api) */
  serverUrl: string;
  /** Issuer du realm Keycloak (ex. https://sso.example.com/realms/perso) */
  issuer: string;
  /** Client id public configuré dans Keycloak */
  clientId: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string | null;
  /** expiration (ms epoch) du jeton d'accès */
  expiresAt: number;
  name: string | null;
  email: string | null;
  sub: string | null;
};

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
};

const CONFIG_KEY = 'notes:cloud:config';
const SESSION_KEY = 'notes:cloud:session';
const PKCE_KEY = 'notes:cloud:pkce';

const SCOPE = 'openid profile email offline_access';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** PKCE S256 : challenge = base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

export function redirectUri(): string {
  return `${location.origin}${location.pathname}`;
}

export function readConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudConfig>;
    if (!parsed.serverUrl || !parsed.issuer || !parsed.clientId) return null;
    return {
      serverUrl: parsed.serverUrl.replace(/\/+$/, ''),
      issuer: parsed.issuer.replace(/\/+$/, ''),
      clientId: parsed.clientId
    };
  } catch {
    return null;
  }
}

export function writeConfig(config: CloudConfig | null): void {
  try {
    if (!config) localStorage.removeItem(CONFIG_KEY);
    else localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* stockage indisponible */
  }
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null): void {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* stockage indisponible */
  }
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sessionFromTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}): Session {
  const claims = decodeClaims(tokens.id_token ?? tokens.access_token);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: Date.now() + (tokens.expires_in ?? 300) * 1000,
    name: typeof claims.name === 'string' ? claims.name : null,
    email: typeof claims.email === 'string' ? claims.email : null,
    sub: typeof claims.sub === 'string' ? claims.sub : null
  };
}

let discovery: { issuer: string; value: Promise<Discovery> } | null = null;

async function discover(issuer: string): Promise<Discovery> {
  if (discovery?.issuer === issuer) return discovery.value;
  const value = (async () => {
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
      headers: { accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Découverte OIDC impossible (${res.status})`);
    return (await res.json()) as Discovery;
  })();
  discovery = { issuer, value };
  return value;
}

/** Étape 1 : on mémorise le verifier PKCE puis on part chez Keycloak. */
export async function beginLogin(config: CloudConfig): Promise<void> {
  const meta = await discover(config.issuer);
  const verifier = randomToken(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomToken(16);

  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

  const url = new URL(meta.authorization_endpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  location.assign(url.toString());
}

/** Étape 2 : au retour de Keycloak, on échange le code contre des jetons. */
export async function completeLogin(config: CloudConfig): Promise<Session | null> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) {
    if (params.get('error')) {
      throw new Error(params.get('error_description') ?? params.get('error') ?? 'Connexion refusée');
    }
    return null;
  }

  const stored = sessionStorage.getItem(PKCE_KEY);
  sessionStorage.removeItem(PKCE_KEY);
  if (!stored) throw new Error('Session de connexion expirée, recommence.');

  const { verifier, state: expected } = JSON.parse(stored) as { verifier: string; state: string };
  if (state !== expected) throw new Error('État OIDC invalide (réessaie la connexion).');

  const meta = await discover(config.issuer);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: config.clientId,
    code_verifier: verifier
  });

  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Échange du code refusé (${res.status})`);

  const session = sessionFromTokens(
    (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number }
  );
  writeSession(session);
  cleanUrl();
  return session;
}

/** Nettoie `?code=…&state=…` de la barre d'adresse. */
export function cleanUrl(): void {
  const url = new URL(location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('session_state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
}

/** Renvoie un jeton d'accès valide, en le rafraîchissant si besoin. */
export async function accessToken(config: CloudConfig): Promise<string | null> {
  let session = readSession();
  if (!session) return null;
  if (session.expiresAt - 60_000 > Date.now()) return session.accessToken;
  if (!session.refreshToken) {
    writeSession(null);
    return null;
  }

  const meta = await discover(config.issuer);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: config.clientId
  });
  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    writeSession(null);
    return null;
  }
  const refreshed = sessionFromTokens(
    (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number }
  );
  // certains serveurs ne renvoient pas de refresh_token au rafraîchissement
  refreshed.refreshToken ??= session.refreshToken;
  writeSession(refreshed);
  session = refreshed;
  return session.accessToken;
}

export function signOut(): void {
  writeSession(null);
}

/** Requête authentifiée vers notre API ; `null` si non connecté. */
export async function authedFetch(
  config: CloudConfig,
  path: string,
  init: RequestInit = {}
): Promise<Response | null> {
  const token = await accessToken(config);
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return fetch(`${config.serverUrl}${path}`, { ...init, headers });
}
