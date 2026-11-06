/* Brand Review Desk - client-side session helpers.
   The token is a signed, expiring bearer token issued by the API.
   It is stored in localStorage so a refresh keeps the user signed in.
*/

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = 'brd_session';

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.user?.username) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode). The in-memory session still works.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getToken(): string | null {
  return loadSession()?.token ?? null;
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/** fetch() wrapper that attaches the bearer token and clears expired sessions. */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    headers: authHeaders({
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) || {})
    })
  });

  if (res.status === 401) {
    clearSession();
  }

  return res;
}
