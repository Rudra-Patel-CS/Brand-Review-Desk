/* Brand Review Desk - Client-side Authentication & Session Module
   - Server-managed sessions via HttpOnly cookies (credentials: 'include')
   - Never stores authentication tokens in localStorage or sessionStorage
   - In-memory CSRF token handling for state-mutating requests
*/

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'approver' | 'reviewer' | string;
  disabled?: boolean;
  createdAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  csrfToken: string;
}

// In-memory CSRF token cache (never persisted to web storage)
let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

/**
 * apiFetch: Universal fetch wrapper for authenticated API requests
 * - Automatically includes cookies (credentials: 'include')
 * - Automatically attaches X-CSRF-Token on mutating requests (POST, PUT, PATCH, DELETE)
 * - Automatically sets application/json Content-Type when JSON body is supplied
 */
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const method = (init.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {})
  };

  if (isMutating && currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }

  if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers
  });

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}
